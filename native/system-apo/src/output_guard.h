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
  /**
   * The loudest true peak the last `process` call was handed, before any gain:
   * what the EQ made of that block (`InputHistory::record_peak`).
   */
  double last_input_peak() const noexcept { return last_input_peak_; }
  void reassess(uint32_t settling_frames) noexcept;
  /**
   * The curve's own level, 0 dB or below: where Auto normalize starts, and
   * how much a louder curve has to come down at once.
   *
   * The first enabled block starts here rather than at 0 dB, and the level is
   * brought back up from it as the music leaves room — Ivan's description of
   * his normalizer. A later, lower level (a band raised while playing) takes
   * the level down by the difference at once, so the boost never arrives over
   * the ceiling; a higher one is left to the recovery.
   */
  void set_curve_level(double db) noexcept;
  /**
   * An edit whose level was worked out before it was heard
   * (`level_prediction.h`): the level moves by `db` at once, and none of the
   * after-edit catching up that `set_curve_level` and `reassess` do is left to
   * run, because what it would have measured is already known. The curve's
   * level is recorded all the same, for a guard switched off and on again.
   * Before the guard's first enabled block the level is left to start at the
   * curve's level, as it always does.
   */
  void shift_level(double db, double curve_level_db,
                   uint32_t settling_frames) noexcept;
  /**
   * Where `from` has the level, taken as this guard's own: its target and
   * where it is in getting there, and the gain its limiter is applying. The
   * look-ahead line stays this guard's, empty. For a graph crossing over
   * from `from` (`graph.h`), which plays on meanwhile, so nothing is moved.
   */
  void take_level(const OutputGuard& from) noexcept;
 private:
  double curve_level_db_ = 0;
  double last_input_peak_ = 0;
  /** The next enabled block starts from the curve's level. */
  bool armed_ = true;
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
