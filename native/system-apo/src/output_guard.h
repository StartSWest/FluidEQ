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
   * An edit whose level is being worked out on the music just heard
   * (`level_prediction.h`) while the edit already plays: the level the chain
   * before it had is kept as the basis the prediction will be applied to,
   * and until it arrives the level goes by the curve's own level against the
   * basis's — down as far as a louder curve needs, back up as a drag returns
   * towards where it started, never above the basis. A second edit before
   * the first's level has arrived keeps the same basis: the prediction that
   * settles it is made against the chain the basis was the level for.
   *
   * `sound_changed` false keeps a hold already running and otherwise does
   * what `set_curve_level` does. Before the guard's first enabled block
   * nothing is held: the level starts at the curve's level there, as it
   * always does.
   */
  void hold(double curve_level_db, uint32_t settling_frames,
            bool sound_changed) noexcept;
  /** Whether a held edit is waiting for its level. */
  bool holding() const noexcept { return holding_; }
  /**
   * The held edit's level has arrived: the basis moved by `shift_db`, and
   * none of the after-edit catching up that `reassess` does, because what
   * it would have measured is already known. A NaN is a prediction that had
   * nothing to go on, and the level is then found the old way from where it
   * is. Nothing happens unless a hold is running.
   */
  void settle(double shift_db, uint32_t settling_frames) noexcept;
  /** A hold whose level will not come: the next edit finds it the old way. */
  void release_hold() noexcept { holding_ = false; }
  /**
   * Where `from` has the level, taken as this guard's own: its target and
   * where it is in getting there, and the gain its limiter is applying. The
   * look-ahead line stays this guard's, empty. For a graph crossing over
   * from `from` (`graph.h`), which plays on meanwhile, so nothing is moved.
   */
  void take_level(const OutputGuard& from) noexcept;
 private:
  /**
   * An edit's new level, reached over `kEditGlideSeconds` rather than at the
   * limiter's look-ahead: a level stepped down in two milliseconds is heard
   * as a click (measured on a preset switch under four low tones: -79 dBFS
   * above 5 kHz for 3 dB, -69 for 10). Peaks are caught all the same: the
   * limiter's ceiling does not glide.
   */
  void move_target(double db) noexcept;
  /** The level `process` hands the limiter now, gliding or not. */
  double applied_db() const noexcept;

  double curve_level_db_ = 0;
  // A held edit (`hold`): the basis level and the curve level it went with.
  bool holding_ = false;
  double held_db_ = 0;
  double held_curve_db_ = 0;
  // The glide towards `target_db_` (`move_target`).
  double glide_from_db_ = 0;
  uint32_t glide_left_ = 0;
  uint32_t glide_frames_ = 1;
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
