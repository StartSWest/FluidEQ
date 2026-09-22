#include "eq_phase.h"

#include <algorithm>
#include <cmath>
#include <utility>
#include "graph_stages.h"
#include "linear_bands.h"

namespace fluideq_engine {

EqPhaseStage::EqPhaseStage(std::vector<IirBand> bands, bool linear,
    uint32_t sample_rate, uint32_t channels, uint32_t max_frames)
    : sample_rate_(sample_rate), channels_(channels), max_frames_(max_frames),
      linear_(linear && !bands.empty()),
      iir_(std::move(bands), sample_rate, channels, max_frames) {
  scratch_.resize(static_cast<size_t>(channels) * max_frames);
  if (!linear_) return;
  std::vector<FeqBiquadCoefficients> coefficients;
  coefficients.reserve(iir_.bands().size());
  for (const IirBand& band : iir_.bands()) coefficients.push_back(band.coefficients);
  std::vector<float> samples = design_linear_bands(coefficients, sample_rate);
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
  // A stream that starts in linear phase starts on the FIR, delay and all.
  // It used to start on the biquads — no delay — and fade to the FIR once
  // the FIR had filled, which put the sound back by the kernel's half length
  // mid-song: the first 0.35 s of every stream played twice, 0.7 s with both
  // layers linear. `adopt` still carries an earlier stage's mix, so a switch
  // of phase mode while playing fades across as before.
  mix_ = 1.0;
}

bool EqPhaseStage::same_response(const EqPhaseStage& previous) const noexcept {
  return linear_ == previous.linear_ && iir_.same_response(previous.iir_);
}

void EqPhaseStage::adopt(EqPhaseStage& previous) noexcept {
  if (sample_rate_ != previous.sample_rate_ || channels_ != previous.channels_ ||
      max_frames_ != previous.max_frames_) return;
  iir_.adopt(previous.iir_);
  const bool history_live = previous.linear_ || previous.mix_ > 0.0;
  if (!history_live || previous.convolvers_.empty()) {
    // Nothing on the FIR side to carry: a switch into linear phase fades from
    // the biquads once the FIR has filled, as it always has.
    if (linear_) {
      mix_ = 0.0;
      warmup_ = static_cast<uint32_t>(feq_convolver_kernel_warmup(kernel_.get()));
    }
    return;
  }
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
  if (wet) {
    for (uint32_t channel = 0; channel < channels_; ++channel) {
      if (planar[channel] == nullptr) continue;
      float* filtered = scratch_.data() + static_cast<size_t>(channel) * max_frames_;
      std::copy_n(planar[channel], frames, filtered);
      feq_convolve(convolvers_[channel].get(), filtered, frames);
    }
  }
  iir_.process(planar, frames);
  if (!wet) return;
  for (uint32_t channel = 0; channel < channels_; ++channel) {
    float* buffer = planar[channel];
    if (buffer == nullptr) continue;
    const float* filtered = scratch_.data() + static_cast<size_t>(channel) * max_frames_;
    double blend = mix_;
    for (uint32_t frame = 0; frame < frames; ++frame) {
      if (frame >= waiting) blend = std::clamp(blend + direction, 0.0, 1.0);
      if (blend > 0.0) {
        buffer[frame] = static_cast<float>(buffer[frame] +
            blend * (static_cast<double>(filtered[frame]) - buffer[frame]));
      }
    }
  }
  const uint32_t fading = frames > waiting ? frames - waiting : 0;
  mix_ = std::clamp(mix_ + direction * fading, 0.0, 1.0);
  warmup_ = waiting > frames ? waiting - frames : 0;
}

uint32_t EqPhaseStage::latency() const noexcept {
  return linear_ && identity_
      ? static_cast<uint32_t>(identity_->size() / 2) + feq_convolver_latency() : 0;
}

void EqPhaseStage::reset() noexcept {
  iir_.reset();
  // A linear stage restarts on its FIR — a gap as long as its delay, never a
  // replay of what was already heard.
  mix_ = linear_ ? 1.0 : 0.0;
  warmup_ = 0;
  for (auto& convolver : convolvers_) feq_convolver_reset(convolver.get());
}

}
