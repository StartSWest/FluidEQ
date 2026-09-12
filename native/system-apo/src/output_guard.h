#ifndef FLUIDEQ_ENGINE_OUTPUT_GUARD_H
#define FLUIDEQ_ENGINE_OUTPUT_GUARD_H

#include <vector>
#include "fluideq/post_filter_normalizer.h"

namespace fluideq_engine {
/**
 * Actual final samples, not a sum of filter gains. The 2 ms lookahead catches
 * peaks after DSP, IR, curves and preamp; linked gain preserves the stereo
 * image. Storage moves with the graph on edits, including the bypass path,
 * so toggling controls cannot reset the envelope or empty the delay line.
 */
class OutputGuard {
 public:
  OutputGuard(uint32_t rate, uint32_t channels);
  void process(float* const* planar, uint32_t frames, bool enabled) noexcept;
  uint32_t latency() const noexcept { return latency_; }
  double gain_db() const noexcept;
  void reassess(uint32_t settling_frames) noexcept;
 private:
  uint32_t rate_;
  uint32_t latency_;
  uint32_t window_frames_;
  uint32_t measured_frames_ = 0;
  double window_peak_ = 0;
  double quiet_seconds_ = 0;
  double target_db_ = 0;
  uint32_t overload_age_ = 10;
  uint32_t settling_frames_ = 0;
  uint32_t reassess_frames_ = 0;
  double reassess_peak_ = 0;
  double edit_goal_db_ = 0;
  bool edit_recovery_ = false;
  FeqPostFilterNormalizer state_{};
  std::vector<FeqTruePeak> detectors_;
  std::vector<std::vector<float>> delay_;
  std::vector<float*> planes_;
  std::vector<float> reductions_;
  std::vector<float*> processing_planes_;
};
}
#endif
