#include "output_guard.h"
#include <algorithm>
#include <cmath>

namespace fluideq_engine {
OutputGuard::OutputGuard(uint32_t rate, uint32_t channels)
    : rate_(rate), latency_(feq_post_filter_normalizer_look_ahead(rate)),
      detectors_(channels), delay_(channels), planes_(channels),
      reductions_(latency_ + 1, 0.0f) {
  for (uint32_t channel = 0; channel < channels; ++channel) {
    delay_[channel].resize(latency_ + 1, 0.0f);
    planes_[channel] = delay_[channel].data();
  }
  feq_post_filter_normalizer_init(&state_, detectors_.data(), planes_.data(),
      reductions_.data(), channels, latency_ + 1, 4);
  feq_linked_limiter_set_look_ahead(&state_.limiter, latency_);
}
void OutputGuard::process(float* const* planar, uint32_t frames, bool enabled) noexcept {
  FeqPostFilterNormalizerOptions options{};
  options.enabled = enabled ? 1 : 0;
  options.output_ceiling_db = -0.8;
  options.following_gain_db = 0;
  options.release_ms = 400;
  options.sample_rate = rate_;
  feq_post_filter_normalizer_process(&state_, planar, frames, &options);
}
double OutputGuard::gain_db() const noexcept {
  return 20.0 * std::log10(std::max(1e-12, state_.limiter.gain));
}
}
