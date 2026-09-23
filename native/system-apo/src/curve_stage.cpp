/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "curve_stage.h"

#include <algorithm>
#include <cmath>
#include <utility>

namespace fluideq_engine {

CurveStage::CurveStage(const std::vector<float>& kernel, uint32_t delay_frames,
                       uint32_t sample_rate, uint32_t channels,
                       uint32_t max_frames)
    : channels_(channels),
      max_frames_(max_frames),
      delay_(feq_convolver_latency() + delay_frames),
      fade_frames_(std::max<uint32_t>(
          1u, static_cast<uint32_t>(std::lround(kFadeSeconds * sample_rate)))),
      ring_(channels, std::vector<float>(static_cast<size_t>(delay_) + max_frames + 1, 0.0f)),
      delayed_(max_frames, 0.0f),
      own_out_(max_frames, 0.0f),
      outgoing_out_(max_frames, 0.0f) {
  outgoing_.reserve(channels);
  if (kernel.empty()) {
    return;
  }
  kernel_.reset(feq_convolver_kernel_create(kernel.data(),
                                            static_cast<uint32_t>(kernel.size())));
  if (!kernel_ || !build_convolvers(kernel_.get(), channels, convolvers_)) {
    convolvers_.clear();
    kernel_.reset();
    failed_ = true;
    return;
  }
  identity_ = kernel_identity(kernel);
  // A stage that starts a stream plays its convolvers from the first sample:
  // they and the ring are both empty then, so there is nothing to bridge.
  own_mix_ = 1.0;
}

void CurveStage::take_as_outgoing(CurveStage& previous, double mix) noexcept {
  outgoing_kernel_.swap(previous.kernel_);
  outgoing_.swap(previous.convolvers_);
  outgoing_mix_ = mix;
}

void CurveStage::adopt(CurveStage& previous) noexcept {
  if (previous.channels_ != channels_ || previous.max_frames_ != max_frames_) {
    return;
  }
  // The input history, whatever else happens: both rings are the music's
  // last samples, and the newest ones are what the delay reads.
  if (previous.ring_.front().size() == ring_.front().size()) {
    ring_.swap(previous.ring_);
    write_ = previous.write_;
  } else {
    const size_t size = ring_.front().size();
    const size_t before = previous.ring_.front().size();
    const size_t keep = std::min(size, before);
    for (uint32_t channel = 0; channel < channels_; ++channel) {
      for (size_t back = 1; back <= keep; ++back) {
        ring_[channel][(size - back) % size] =
            previous.ring_[channel][(previous.write_ + before - back) % before];
      }
    }
    write_ = 0;
  }

  // The same kernel: this is the same stage carrying on.
  if (identity_ != nullptr && identity_ == previous.identity_) {
    kernel_.swap(previous.kernel_);
    convolvers_.swap(previous.convolvers_);
    outgoing_kernel_.swap(previous.outgoing_kernel_);
    outgoing_.swap(previous.outgoing_);
    own_mix_ = previous.own_mix_;
    outgoing_mix_ = previous.outgoing_mix_;
    warm_left_ = previous.warm_left_;
    return;
  }

  if (!convolvers_.empty()) {
    // A new curve over running convolvers: they hand their history across
    // and crossfade inside (50 ms, as between any two curves), and this
    // stage carries on wherever the previous one was.
    bool handed_over = previous.convolvers_.size() == convolvers_.size();
    for (size_t channel = 0; handed_over && channel < convolvers_.size(); ++channel) {
      handed_over = feq_convolver_transfer(convolvers_[channel].get(),
                                           previous.convolvers_[channel].get(),
                                           fade_frames_ * 5 / 2) != 0;
    }
    if (handed_over) {
      own_mix_ = previous.own_mix_;
      warm_left_ = previous.warm_left_;
      outgoing_kernel_.swap(previous.outgoing_kernel_);
      outgoing_.swap(previous.outgoing_);
      outgoing_mix_ = previous.outgoing_mix_;
      return;
    }
    // The first curve: these convolvers warm up on the music behind the
    // delay before they are heard.
    own_mix_ = 0.0;
    warm_left_ = feq_convolver_kernel_warmup(kernel_.get());
  } else {
    own_mix_ = 0.0;
    warm_left_ = 0;
  }
  // Whatever of the previous stage's convolvers is still being heard fades
  // out here. A previous stage that was itself still fading an older set out
  // hands that one on instead only when its own set was not yet heard.
  if (!previous.convolvers_.empty() && previous.own_mix_ > 0.0) {
    take_as_outgoing(previous, std::min(1.0, previous.own_mix_ + previous.outgoing_mix_));
  } else if (!previous.outgoing_.empty() && previous.outgoing_mix_ > 0.0) {
    outgoing_kernel_.swap(previous.outgoing_kernel_);
    outgoing_.swap(previous.outgoing_);
    outgoing_mix_ = previous.outgoing_mix_;
  }
}

void CurveStage::process(float* const* planar, uint32_t frames) noexcept {
  if (planar == nullptr || frames == 0 || frames > max_frames_) {
    return;
  }
  const size_t size = ring_.front().size();
  const bool own_heard = !convolvers_.empty() && own_mix_ >= 1.0 &&
                         outgoing_mix_ <= 0.0 && warm_left_ == 0;
  const double step = 1.0 / static_cast<double>(fade_frames_);
  double own_mix = own_mix_;
  double outgoing_mix = outgoing_mix_;
  for (uint32_t channel = 0; channel < channels_; ++channel) {
    float* buffer = planar[channel];
    if (buffer == nullptr) {
      continue;
    }
    std::vector<float>& ring = ring_[channel];
    size_t at = write_;
    for (uint32_t frame = 0; frame < frames; ++frame) {
      ring[at] = buffer[frame];
      delayed_[frame] = ring[(at + size - delay_) % size];
      at = at + 1 == size ? 0 : at + 1;
    }
    if (own_heard) {
      feq_convolve(convolvers_[channel].get(), buffer, frames);
      continue;
    }
    if (convolvers_.empty() && outgoing_mix_ <= 0.0) {
      // No curve and nothing fading: the delay, exactly.
      std::copy_n(delayed_.begin(), frames, buffer);
      continue;
    }
    if (!convolvers_.empty()) {
      std::copy_n(buffer, frames, own_out_.begin());
      feq_convolve(convolvers_[channel].get(), own_out_.data(), frames);
    }
    const bool outgoing_heard = !outgoing_.empty() && outgoing_mix_ > 0.0;
    if (outgoing_heard) {
      std::copy_n(buffer, frames, outgoing_out_.begin());
      feq_convolve(outgoing_[channel].get(), outgoing_out_.data(), frames);
    }
    // Every channel walks the same ramps from the same start.
    own_mix = own_mix_;
    outgoing_mix = outgoing_mix_;
    uint64_t warm = warm_left_;
    for (uint32_t frame = 0; frame < frames; ++frame) {
      if (warm > 0) {
        --warm;
      } else if (!convolvers_.empty() && own_mix < 1.0) {
        own_mix = std::min(1.0, own_mix + step);
      }
      // An outgoing set keeps playing while this stage's own convolvers are
      // still warming — a phase switch changes the kernel's length, and the
      // curve must not drop out for a kernel's length in between — and then
      // crosses over to them.
      if (outgoing_mix > 0.0 && (convolvers_.empty() || warm == 0)) {
        outgoing_mix = std::max(0.0, outgoing_mix - step);
      }
      const double dry = std::max(0.0, 1.0 - own_mix - outgoing_mix);
      double sample = dry * static_cast<double>(delayed_[frame]);
      if (!convolvers_.empty()) sample += own_mix * static_cast<double>(own_out_[frame]);
      if (outgoing_heard) sample += outgoing_mix * static_cast<double>(outgoing_out_[frame]);
      buffer[frame] = static_cast<float>(sample);
    }
  }
  write_ = (write_ + frames) % size;
  if (!own_heard) {
    own_mix_ = own_mix;
    outgoing_mix_ = outgoing_mix;
    warm_left_ -= std::min<uint64_t>(warm_left_, frames);
  }
}

}  // namespace fluideq_engine
