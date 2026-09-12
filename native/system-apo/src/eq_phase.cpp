#include "eq_phase.h"

#include <algorithm>
#include <cmath>
#include <utility>
#include "graph_stages.h"
#include "linear_bands.h"

namespace fluideq_engine {

EqPhaseStage::EqPhaseStage(const std::vector<FeqLinearPhaseBand>& bands,
    bool linear, uint32_t sample_rate, uint32_t channels, uint32_t max_frames)
    : sample_rate_(sample_rate), channels_(channels), max_frames_(max_frames),
      linear_(linear) {
  for (const auto& band : bands) {
    layout_.push_back(band.type);
    coefficients_.push_back(feq_biquad_coefficients(
        band.type, band.frequency, band.gain_db, band.quality, sample_rate));
  }
  states_.assign(static_cast<size_t>(channels) * bands.size(), FeqBiquadState{});
  scratch_.resize(static_cast<size_t>(channels) * max_frames);
  if (!linear_) return;
  std::vector<float> samples = design_linear_bands(bands, sample_rate);
  const bool finite = !samples.empty() && std::all_of(samples.begin(), samples.end(),
      [](float sample) { return std::isfinite(sample); });
  if (finite) kernel_.reset(feq_convolver_kernel_create(
      samples.data(), static_cast<uint32_t>(samples.size())));
  if (!kernel_ || !build_convolvers(kernel_.get(), channels_, convolvers_)) {
    failed_ = true;
    linear_ = false;
    return;
  }
  identity_ = kernel_identity(std::move(samples));
  warmup_ = static_cast<uint32_t>(feq_convolver_kernel_warmup(kernel_.get()));
}

bool EqPhaseStage::same_response(const EqPhaseStage& previous) const noexcept {
  return linear_ == previous.linear_ && layout_ == previous.layout_ &&
      coefficients_.size() == previous.coefficients_.size() &&
      std::equal(coefficients_.begin(), coefficients_.end(),
          previous.coefficients_.begin(),
          [](const FeqBiquadCoefficients& current, const FeqBiquadCoefficients& before) {
            return current.b0 == before.b0 && current.b1 == before.b1 &&
                current.b2 == before.b2 && current.a1 == before.a1 &&
                current.a2 == before.a2;
          });
}

void EqPhaseStage::adopt(EqPhaseStage& previous) noexcept {
  if (sample_rate_ != previous.sample_rate_ || channels_ != previous.channels_ ||
      max_frames_ != previous.max_frames_) return;
  if (layout_ == previous.layout_) {
    std::copy(previous.states_.begin(), previous.states_.end(), states_.begin());
  }
  const bool history_live = previous.linear_ || previous.mix_ > 0.0;
  if (!history_live || previous.convolvers_.empty()) return;
  if (!linear_ || identity_ == previous.identity_) {
    kernel_.swap(previous.kernel_);
    convolvers_.swap(previous.convolvers_);
    identity_.swap(previous.identity_);
  } else {
    for (size_t channel = 0; channel < convolvers_.size(); ++channel) {
      feq_convolver_transfer(convolvers_[channel].get(),
          previous.convolvers_[channel].get(), sample_rate_ / 20);
    }
  }
  mix_ = previous.mix_;
  warmup_ = previous.warmup_;
}

void EqPhaseStage::process(float* const* planar, uint32_t frames) noexcept {
  if (frames > max_frames_ || planar == nullptr) return;
  const bool wet = !convolvers_.empty() && (linear_ || mix_ > 0.0);
  const double step = 1.0 / std::max(1.0, static_cast<double>(sample_rate_) / 20.0);
  const double direction = linear_ ? step : -step;
  const uint32_t waiting = warmup_;
  for (uint32_t channel = 0; channel < channels_; ++channel) {
    float* buffer = planar[channel];
    if (buffer == nullptr) continue;
    float* filtered = scratch_.data() + static_cast<size_t>(channel) * max_frames_;
    if (wet) {
      std::copy_n(buffer, frames, filtered);
      feq_convolve(convolvers_[channel].get(), filtered, frames);
    }
    for (size_t band = 0; band < coefficients_.size(); ++band) {
      feq_biquad_process(&states_[static_cast<size_t>(channel) * coefficients_.size() + band],
          buffer, frames, &coefficients_[band]);
    }
    if (wet) {
      double blend = mix_;
      for (uint32_t frame = 0; frame < frames; ++frame) {
        if (frame >= waiting) blend = std::clamp(blend + direction, 0.0, 1.0);
        if (blend > 0.0) {
          buffer[frame] = static_cast<float>(buffer[frame] +
              blend * (static_cast<double>(filtered[frame]) - buffer[frame]));
        }
      }
    }
  }
  if (wet) {
    const uint32_t fading = frames > waiting ? frames - waiting : 0;
    mix_ = std::clamp(mix_ + direction * fading, 0.0, 1.0);
    warmup_ = waiting > frames ? waiting - frames : 0;
  }
}

uint32_t EqPhaseStage::latency() const noexcept {
  return linear_ && identity_
      ? static_cast<uint32_t>(identity_->size() / 2) + feq_convolver_latency() : 0;
}

void EqPhaseStage::reset() noexcept {
  for (auto& state : states_) feq_biquad_reset(&state);
  mix_ = 0.0;
  warmup_ = kernel_ ? static_cast<uint32_t>(feq_convolver_kernel_warmup(kernel_.get())) : 0;
}

}
