#ifndef FLUIDEQ_ENGINE_EQ_PHASE_H
#define FLUIDEQ_ENGINE_EQ_PHASE_H

#include <memory>
#include <vector>
#include "fluideq_engine/graph.h"
#include "iir_cascade.h"

namespace fluideq_engine {

/**
 * One layer's bands — the user's own EQ, or every curve layer together — as
 * minimum-phase biquads, or as one linear-phase FIR of the same magnitude.
 *
 * Always built, even with no bands: an empty stage is a straight copy that
 * costs nothing, and it is what lets a layer that appears or disappears in an
 * edit fade in or out rather than start or stop in the middle of a waveform.
 */
class EqPhaseStage {
 public:
  EqPhaseStage(std::vector<IirBand> bands, bool linear, uint32_t sample_rate,
               uint32_t channels, uint32_t max_frames);
  void process(float* const* planar, uint32_t frames) noexcept;
  void adopt(EqPhaseStage& previous) noexcept;
  /** Nothing ran before this stage: its biquads fade in from the input. */
  void fade_in() noexcept { iir_.fade_in(); }
  void reset() noexcept;
  bool same_response(const EqPhaseStage& previous) const noexcept;
  uint32_t latency() const noexcept;
  bool failed() const noexcept { return failed_; }
  bool empty() const noexcept { return iir_.empty(); }

 private:
  uint32_t sample_rate_;
  uint32_t channels_;
  uint32_t max_frames_;
  bool linear_;
  bool failed_ = false;
  double mix_ = 0.0;
  uint32_t warmup_ = 0;
  IirCascade iir_;
  std::vector<float> scratch_;
  std::unique_ptr<FeqConvolverKernel, detail::ConvolverKernelDeleter> kernel_;
  std::vector<std::unique_ptr<FeqConvolver, detail::ConvolverDeleter>> convolvers_;
  std::shared_ptr<const std::vector<float>> identity_;
};

}
#endif
