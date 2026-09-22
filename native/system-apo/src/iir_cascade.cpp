/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "iir_cascade.h"

#include <algorithm>
#include <bitset>
#include <cmath>
#include <utility>

namespace fluideq_engine {

namespace {

constexpr double kPi = 3.14159265358979323846;

bool same_coefficients(const FeqBiquadCoefficients& left,
                       const FeqBiquadCoefficients& right) {
  return left.b0 == right.b0 && left.b1 == right.b1 && left.b2 == right.b2 &&
         left.a1 == right.a1 && left.a2 == right.a2;
}

}  // namespace

FeqFilterType to_core_type(FilterType type) {
  // Spelled out rather than cast. `biquad.h` says its order is the host
  // protocol's and append-only, while `config.h`'s follows Equalizer APO's
  // type aliases; a cast would keep compiling on the day one of them moves
  // and silently apply the wrong shape to every band.
  switch (type) {
    case FilterType::NO:
      return FEQ_FILTER_NO;
    case FilterType::LSC:
      return FEQ_FILTER_LSC;
    case FilterType::HSC:
      return FEQ_FILTER_HSC;
    case FilterType::LPQ:
      return FEQ_FILTER_LPQ;
    case FilterType::HPQ:
      return FEQ_FILTER_HPQ;
    case FilterType::BP:
      return FEQ_FILTER_BP;
    case FilterType::PK:
      break;
  }
  return FEQ_FILTER_PK;
}

IirBand design_band(const Band& band, uint32_t sample_rate) {
  const FeqFilterType type = to_core_type(band.type);
  const double rate = static_cast<double>(sample_rate);
  IirBand designed{};
  designed.type = type;
  designed.frequency = band.frequency;
  designed.quality = band.quality;
  designed.coefficients =
      band.matched
          ? feq_biquad_coefficients_matched(type, band.frequency, band.gain_db,
                                            band.quality, rate)
          : feq_biquad_coefficients(type, band.frequency, band.gain_db,
                                    band.quality, rate);
  return designed;
}

IirCascade::IirCascade(std::vector<IirBand> bands, uint32_t sample_rate,
                       uint32_t channels, uint32_t max_frames)
    : bands_(std::move(bands)),
      states_(static_cast<size_t>(channels) * bands_.size(), FeqBiquadState{}),
      outgoing_(kMaxFadeBands, FeqBiquadCoefficients{}),
      outgoing_states_(static_cast<size_t>(channels) * kMaxFadeBands,
                       FeqBiquadState{}),
      scratch_(max_frames, 0.0f),
      channels_(channels),
      max_frames_(max_frames),
      fade_frames_(std::max<uint32_t>(
          1u, static_cast<uint32_t>(std::lround(kFadeSeconds * sample_rate)))) {}

bool IirCascade::same_response(const IirCascade& other) const noexcept {
  if (bands_.size() != other.bands_.size()) {
    return false;
  }
  for (size_t at = 0; at < bands_.size(); ++at) {
    if (!same_coefficients(bands_[at].coefficients,
                           other.bands_[at].coefficients)) {
      return false;
    }
  }
  return true;
}

void IirCascade::adopt(const IirCascade& previous) noexcept {
  if (previous.channels_ != channels_) {
    return;
  }
  const size_t count = bands_.size();
  const size_t before = previous.bands_.size();

  // What was playing a moment ago keeps playing beside this for the fade.
  if (previous.fade_left_ > 0) {
    outgoing_count_ = previous.outgoing_count_;
    std::copy_n(previous.outgoing_.begin(), outgoing_count_, outgoing_.begin());
    std::copy(previous.outgoing_states_.begin(), previous.outgoing_states_.end(),
              outgoing_states_.begin());
    fade_total_ = previous.fade_total_;
    fade_left_ = previous.fade_left_;
  } else if (!same_response(previous) && before <= kMaxFadeBands) {
    outgoing_count_ = before;
    for (size_t band = 0; band < before; ++band) {
      outgoing_[band] = previous.bands_[band].coefficients;
    }
    for (uint32_t channel = 0; channel < channels_; ++channel) {
      std::copy_n(previous.states_.begin() +
                      static_cast<std::ptrdiff_t>(channel * before),
                  before,
                  outgoing_states_.begin() +
                      static_cast<std::ptrdiff_t>(channel * kMaxFadeBands));
    }
    fade_total_ = fade_frames_;
    fade_left_ = fade_frames_;
  }

  // Every band still here carries on from where it was: first the same band
  // exactly, then the same type at the same frequency with a new width, then
  // — for a band whose frequency was dragged — the same type in the same
  // place. Past `kMaxFadeBands` earlier bands are not searched.
  std::bitset<kMaxFadeBands> taken;
  std::bitset<kMaxFadeBands> found;
  const size_t searched = std::min(before, kMaxFadeBands);
  const auto carry = [&](size_t band, size_t from) {
    for (uint32_t channel = 0; channel < channels_; ++channel) {
      states_[channel * count + band] = previous.states_[channel * before + from];
    }
    taken.set(from);
    found.set(band);
  };
  for (int pass = 0; pass < 3; ++pass) {
    for (size_t band = 0; band < count && band < kMaxFadeBands; ++band) {
      if (found.test(band)) {
        continue;
      }
      const IirBand& now = bands_[band];
      if (pass == 2) {
        if (band < searched && !taken.test(band) &&
            previous.bands_[band].type == now.type) {
          carry(band, band);
        }
        continue;
      }
      for (size_t from = 0; from < searched; ++from) {
        const IirBand& then = previous.bands_[from];
        if (taken.test(from) || then.type != now.type ||
            then.frequency != now.frequency ||
            (pass == 0 && then.quality != now.quality)) {
          continue;
        }
        carry(band, from);
        break;
      }
    }
  }
}

void IirCascade::fade_in() noexcept {
  if (bands_.empty()) {
    return;
  }
  outgoing_count_ = 0;  // No bands: the outgoing sound is the input itself.
  fade_total_ = fade_frames_;
  fade_left_ = fade_frames_;
}

void IirCascade::process(float* const* planar, uint32_t frames) noexcept {
  if (planar == nullptr || frames == 0 || frames > max_frames_) {
    return;
  }
  const size_t count = bands_.size();
  const bool fading = fade_left_ > 0;
  const uint32_t done = fade_total_ - fade_left_;
  for (uint32_t channel = 0; channel < channels_; ++channel) {
    float* buffer = planar[channel];
    if (buffer == nullptr) {
      continue;
    }
    if (fading) {
      std::copy_n(buffer, frames, scratch_.begin());
      FeqBiquadState* old_state =
          outgoing_states_.data() + static_cast<size_t>(channel) * kMaxFadeBands;
      for (size_t band = 0; band < outgoing_count_; ++band) {
        feq_biquad_process(old_state + band, scratch_.data(), frames,
                           &outgoing_[band]);
      }
    }
    FeqBiquadState* state = states_.data() + static_cast<size_t>(channel) * count;
    for (size_t band = 0; band < count; ++band) {
      feq_biquad_process(state + band, buffer, frames, &bands_[band].coefficients);
    }
    if (fading) {
      for (uint32_t frame = 0; frame < frames; ++frame) {
        const uint32_t at = done + frame;
        if (at >= fade_total_) {
          break;  // The rest of the block is already the new cascade alone.
        }
        const double weight =
            0.5 - 0.5 * std::cos(kPi * static_cast<double>(at) /
                                 static_cast<double>(fade_total_));
        const double outgoing = static_cast<double>(scratch_[frame]);
        buffer[frame] = static_cast<float>(
            outgoing + weight * (static_cast<double>(buffer[frame]) - outgoing));
      }
    }
  }
  if (fading) {
    fade_left_ -= std::min(fade_left_, frames);
  }
}

void IirCascade::reset() noexcept {
  for (FeqBiquadState& state : states_) {
    feq_biquad_reset(&state);
  }
  fade_left_ = 0;
  outgoing_count_ = 0;
}

}  // namespace fluideq_engine
