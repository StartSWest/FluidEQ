/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#ifndef FLUIDEQ_ENGINE_CURVE_STAGE_H
#define FLUIDEQ_ENGINE_CURVE_STAGE_H

#include <cstdint>
#include <memory>
#include <vector>

#include "fluideq/convolver.h"
#include "fluideq_engine/graph.h"
#include "graph_stages.h"

namespace fluideq_engine {

/**
 * The EQ page's graphic curves as one stage — and, while no curve is loaded,
 * the plain delay that stage then amounts to.
 *
 * `# FluidEQCurveStage: ON` keeps the stage in place with no curve at all, so
 * that the first curve added never moves the audio. Kept as a convolver, that
 * empty stage ran a 16384-tap kernel holding one non-zero tap: two thirds of
 * the engine's work on Ivan's chain (0.13 ms of every 10 ms block against
 * 0.05 without it) to copy samples. Empty, it is now a ring of the same
 * length, bit for bit the same output.
 *
 * Going from one to the other never clicks and never costs a spike. The ring
 * is fed in both states, so a stage that becomes a delay has its history at
 * once, and the delay fades in over 20 ms under the convolvers it replaces,
 * which the new stage keeps running for that long. A stage that gains its
 * first curve plays the delay while its convolvers warm up on the music
 * (`feq_convolver_kernel_warmup`, a kernel's length) and only then fades to
 * them — never a cold convolver's partial output, and never the burst of
 * work replaying that history in one block would be. A curve replaced by one
 * of another length (a phase switch) keeps playing until its successor is
 * warm, then crosses over to it. Between two curves of the same length the
 * convolvers hand their history over as they always have
 * (`feq_convolver_transfer`).
 */
class CurveStage {
 public:
  static constexpr double kFadeSeconds = 0.02;

  /**
   * An empty `kernel` makes the delay. `delay_frames` is the design's own
   * delay (a linear design's half length), added to the convolver's
   * partition in both states so the stage's latency never depends on
   * whether a curve is loaded.
   */
  CurveStage(const std::vector<float>& kernel, uint32_t delay_frames,
             uint32_t sample_rate, uint32_t channels, uint32_t max_frames);

  CurveStage(const CurveStage&) = delete;
  CurveStage& operator=(const CurveStage&) = delete;

  /** A curve was asked for and its convolvers could not be built. */
  bool failed() const noexcept { return failed_; }
  uint32_t latency() const noexcept { return delay_; }
  bool convolving() const noexcept { return !convolvers_.empty(); }
  /** The kernel, as `kernel_identity` interns it; null for the delay. */
  const std::shared_ptr<const std::vector<float>>& identity() const noexcept {
    return identity_;
  }

  /**
   * Carries on from `previous`: its input history and whatever it was
   * playing. At a block boundary on the audio thread; allocates nothing,
   * and leaves everything it takes owned here, freed with this stage.
   */
  void adopt(CurveStage& previous) noexcept;

  void process(float* const* planar, uint32_t frames) noexcept;

 private:
  using KernelPtr = std::unique_ptr<FeqConvolverKernel, detail::ConvolverKernelDeleter>;

  void take_as_outgoing(CurveStage& previous, double mix) noexcept;

  uint32_t channels_;
  uint32_t max_frames_;
  uint32_t delay_;
  uint32_t fade_frames_;
  // Every channel's recent input, long enough to read `delay_` frames back
  // across a whole block.
  std::vector<std::vector<float>> ring_;
  size_t write_ = 0;
  // Declared before the convolvers built from them, so they are destroyed
  // after: each convolver holds a pointer into its kernel.
  KernelPtr kernel_;
  KernelPtr outgoing_kernel_;
  std::shared_ptr<const std::vector<float>> identity_;
  std::vector<ConvolverPtr> convolvers_;
  // A previous stage's convolvers still fading out.
  std::vector<ConvolverPtr> outgoing_;
  // Shares of the output: own convolvers, outgoing ones, and the delay for
  // the rest. Never both non-zero for long: an outgoing set fades in 20 ms,
  // a new set waits a kernel's length before it starts.
  double own_mix_ = 0.0;
  double outgoing_mix_ = 0.0;
  uint64_t warm_left_ = 0;
  std::vector<float> delayed_;
  std::vector<float> own_out_;
  std::vector<float> outgoing_out_;
  bool failed_ = false;
};

}  // namespace fluideq_engine

#endif
