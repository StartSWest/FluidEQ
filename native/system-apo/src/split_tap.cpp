/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "split_tap.h"

#include <algorithm>
#include <iterator>

#include "split_file.h"
#include "split_transport.h"

namespace fluideq_engine {
namespace {

/**
 * Whether `rate` is one a Windows output runs at. The source's rate is read
 * from memory another process writes, and each new one built a resampling
 * table of about 260 kB that is kept for the life of the tap: a rate that
 * changed on every block grew audiodg without end. The list bounds it.
 */
bool is_output_rate(uint32_t rate) noexcept {
  constexpr uint32_t kRates[] = {8000,   11025,  16000,  22050,  32000,
                                 44100,  48000,  88200,  96000,  176400,
                                 192000, 352800, 384000, 705600, 768000};
  return std::find(std::begin(kRates), std::end(kRates), rate) !=
         std::end(kRates);
}

}  // namespace

SplitTap::SplitTap(const std::wstring& endpoint, uint32_t rate,
                   uint32_t channels, unsigned long mask, bool default_mode,
                   int64_t ticks_per_second, const std::wstring& config_identity)
    : endpoint_(endpoint),
      config_identity_(config_identity),
      own_(split_endpoint(endpoint, config_identity)),
      rate_(rate),
      channels_(channels),
      mask_(mask),
      default_mode_(default_mode),
      ticks_per_second_(ticks_per_second),
      reader_(rate, channels, mask) {}

SplitTap::~SplitTap() {
  if (source_enabled_) writer_control_->remove_writer();
  if (writer_control_) {
    if (HANDLE process = writer_control_->prepare_writer()) CloseHandle(process);
  }
  if (writer_process_) CloseHandle(writer_process_);
  if (own_ == nullptr) {
    return;
  }
  split_release(own_->writer, this);
  if (mixing_) {
    own_->stats.state.store(static_cast<uint32_t>(SplitState::off),
                            std::memory_order_relaxed);
  }
  split_release(own_->reader, this);
}

bool SplitTap::follow(const std::optional<std::string>& text,
                      bool owner) noexcept {
  const bool was_failed = transport_failed();
  const bool was_pending = initializing() != nullptr;
  const bool was_source = source_enabled_;
  try {
    transport_failed_ = own_ == nullptr && !endpoint_.empty();
    const SplitRole role = owner && text && own_ != nullptr
                               ? split_role_of(*text, endpoint_)
                               : SplitRole{};
    // Every instance on the output reports the same part, whichever of them
    // plays it, because they all write the same status file.
    const bool changed = role.from != from_;
    from_ = role.from;
    if (!default_mode_) {
      return changed;
    }
    SplitEndpoint* source =
        role.primary ? own_ : role.target()
            ? split_endpoint(role.from, config_identity_) : nullptr;
    if (role.target() && source == nullptr) transport_failed_ = true;
    source_active_.store(role.source, std::memory_order_relaxed);
    if (role.primary) {
      // Even a failed ring allocation leaves this endpoint exclusively a
      // source. It must never inherit a former receiver's fade or trim.
      // Publish protection before optional ring allocation can take time.
      route_.store(own_, std::memory_order_release);
      if (role.source) {
        writer_control_ = split_ring(*own_);
        if (writer_control_ == nullptr) transport_failed_ = true;
      }
    }
    const bool enabled = role.source && writer_control_ != nullptr;
    if (enabled != source_enabled_) {
      if (enabled) writer_control_->add_writer();
      else writer_control_->remove_writer();
      source_enabled_ = enabled;
    }
    volume_.store(role.volume, std::memory_order_relaxed);
    reader_control_ = nullptr;
    if (source != nullptr && source != own_) {
      // The main output may already be writing: its kernel is ready before
      // the first block asks for it.
      SplitRing::Clock clock;
      SplitRing* ring = split_ring(*source);
      reader_control_ = ring;
      if (ring) ring->initialize();
      if (ring == nullptr) transport_failed_ = true;
      if (ring != nullptr && ring->clock(&clock) && clock.rate != 0) {
        ensure_kernel(clock.rate);
      }
    }
    prepare();
    route_.store(source, std::memory_order_release);
    return changed || was_source != source_enabled_ ||
        was_failed != transport_failed() || was_pending != (initializing() != nullptr);
  } catch (...) {
    // Optional setup must not keep a stale receiver feeding a new main.
    // Stop sharing on failure; the ordinary output's graph keeps running.
    route_.store(nullptr, std::memory_order_release);
    transport_failed_ = true;
    return true;
  }
}

void SplitTap::prepare(void* initialized) noexcept {
  if (writer_process_) CloseHandle(writer_process_);
  if (source_enabled_ && writer_control_) writer_control_->initialize(initialized);
  if (reader_control_) reader_control_->initialize(initialized);
  writer_process_ = writer_control_ ? writer_control_->prepare_writer() : nullptr;
  try {
    const uint32_t rate = wanted_rate_.load(std::memory_order_relaxed);
    if (rate != 0) {
      ensure_kernel(rate);
    }
  } catch (...) {
    // Asked again by the audio thread's next wake; it plays nothing meanwhile.
  }
}

void* SplitTap::writer_released() const noexcept {
  return source_enabled_ && writer_control_ ? writer_control_->release_event() : nullptr;
}

void* SplitTap::initializing() const noexcept {
  if (source_enabled_ && writer_control_ && writer_control_->initializing())
    return writer_control_->initializing();
  return reader_control_ ? reader_control_->initializing() : nullptr;
}

bool SplitTap::transport_failed() const noexcept {
  return transport_failed_ || (source_enabled_ && writer_control_ && writer_control_->failed()) ||
      (reader_control_ && reader_control_->failed());
}

void SplitTap::ensure_kernel(uint32_t rate) {
  if (!is_output_rate(rate)) {
    return;
  }
  for (const auto& kernel : kernels_) {
    if (kernel->source_rate() == rate) {
      kernel_.store(kernel.get(), std::memory_order_release);
      return;
    }
  }
  kernels_.push_back(std::make_unique<SplitKernel>(rate, rate_));
  kernel_.store(kernels_.back().get(), std::memory_order_release);
}

std::optional<SplitReport> SplitTap::report() const {
  if (from_.empty() || own_ == nullptr) {
    return std::nullopt;
  }
  SplitReport report;
  report.from = from_;
  const auto state = static_cast<SplitState>(
      own_->stats.state.load(std::memory_order_relaxed));
  // Asked to play and not started yet is waiting, whatever was said before.
  report.state = state == SplitState::off ? SplitState::waiting : state;
  report.lag_us = own_->stats.lag_us.load(std::memory_order_relaxed);
  report.underruns = own_->stats.underruns.load(std::memory_order_relaxed);
  return report;
}

void SplitTap::begin() noexcept {
  route_at_block_ = route_.load(std::memory_order_acquire);
  source_at_block_ = source_active_.load(std::memory_order_relaxed);
  const bool primary = own_ != nullptr && route_at_block_ == own_;
  if (primary) output_gain_ = 1.0f;
  else if (route_at_block_ != nullptr && reading_ == nullptr) {
    output_gain_ = volume_.load(std::memory_order_relaxed);
  }
  if (primary && reading_ != nullptr) {
    reader_.restart();
    reading_ = nullptr;
    if (mixing_) {
      own_->stats.state.store(static_cast<uint32_t>(SplitState::off),
                              std::memory_order_relaxed);
      split_release(own_->reader, this);
      mixing_ = false;
    }
  }
}

SplitRing* SplitTap::writer_ring() noexcept {
  const bool primary = own_ != nullptr && route_at_block_ == own_;
  SplitRing* const ring = primary && source_at_block_
      ? own_->ring.load(std::memory_order_acquire) : nullptr;
  if (ring == nullptr) {
    if (writing_) {
      split_release(own_->writer, this);
      writing_ = false;
    }
    return nullptr;
  }
  if (!writing_) {
    writing_ = split_claim(own_->writer, this);
    if (!writing_) {
      return nullptr;  // Another instance on this output writes it.
    }
  }
  return ring;
}

bool SplitTap::write(const float* input, uint32_t frames,
                     int64_t ticks) noexcept {
  // One bounded copy for any number of receivers. Their cursors, trim,
  // presets and stalls never enter this path or change main's samples.
  if (SplitRing* ring = writer_ring()) {
    return ring->write(input, channels_, frames, rate_, mask_, ticks);
  }
  return false;
}

bool SplitTap::mix(float* const* planes, uint32_t frames,
                   int64_t now) noexcept {
  SplitEndpoint* const from = route_at_block_;
  if (from == own_) {
    return false;
  }
  if (from == nullptr) {
    // Stopped: faded out from where it was, never cut, and only then let go.
    if (mixing_) {
      reader_.idle(planes, frames, own_->stats);
      if (!reader_.faded()) {
        return false;
      }
      own_->stats.state.store(static_cast<uint32_t>(SplitState::off),
                              std::memory_order_relaxed);
      split_release(own_->reader, this);
      mixing_ = false;
    }
    reading_ = nullptr;
    reader_.restart();
    return false;
  }
  if (from != reading_) {
    reading_ = from;
    reader_.restart();
  }
  if (!mixing_) {
    mixing_ = split_claim(own_->reader, this);
    if (!mixing_) {
      return false;  // Another instance on this output plays it.
    }
    own_->stats.underruns.store(0, std::memory_order_relaxed);
    own_->stats.lag_us.store(0, std::memory_order_relaxed);
  }
  const SplitRing* const ring = from->ring.load(std::memory_order_acquire);
  if (ring == nullptr) {
    return reader_.idle(planes, frames, own_->stats);
  }
  const bool wake = reader_.mix(
      *ring, kernel_.load(std::memory_order_acquire),
      1.0f, planes, frames, now,
      ticks_per_second_, own_->stats);
  wanted_rate_.store(reader_.wanted_rate(), std::memory_order_relaxed);
  return wake;
}

void SplitTap::trim_output(float* const* planes, uint32_t frames) noexcept {
  // This is the selected output's listening level, not an input gain. Moving
  // it ahead of the rack lets the leveler undo it and invalidates full-file
  // source measurements. The endpoint's own local mix shares this control.
  // active()/reading() keep this path alive after the shorter raw-input fade
  // ends, or a stopped receiver's local audio would jump to unity mid-ramp.
  if (route_at_block_ == own_ || rate_ == 0) return;
  const float target = route_at_block_ != nullptr
      ? volume_.load(std::memory_order_relaxed) : 1.0f;
  const float step = static_cast<float>(1.0 / (0.020 * rate_));
  for (uint32_t frame = 0; frame < frames; ++frame) {
    output_gain_ = output_gain_ < target ? std::min(target, output_gain_ + step)
                                        : std::max(target, output_gain_ - step);
    for (uint32_t channel = 0; channel < channels_; ++channel) {
      planes[channel][frame] *= output_gain_;
    }
  }
}

}  // namespace fluideq_engine
