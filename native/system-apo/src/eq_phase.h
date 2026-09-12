#ifndef FLUIDEQ_ENGINE_EQ_PHASE_H
#define FLUIDEQ_ENGINE_EQ_PHASE_H

#include <memory>
#include <vector>
#include "fluideq/linear_phase.h"
#include "fluideq_engine/graph.h"

namespace fluideq_engine {

class EqPhaseStage {
 public:
  EqPhaseStage(const std::vector<FeqLinearPhaseBand>& bands, bool linear,
               uint32_t sample_rate, uint32_t channels, uint32_t max_frames);
  void process(float* const* planar, uint32_t frames) noexcept;
  void adopt(EqPhaseStage& previous) noexcept;
  void reset() noexcept;
  bool same_response(const EqPhaseStage& previous) const noexcept;
  uint32_t latency() const noexcept;
  bool failed() const noexcept { return failed_; }

 private:
  uint32_t sample_rate_;
  uint32_t channels_;
  uint32_t max_frames_;
  bool linear_;
  bool failed_ = false;
  double mix_ = 0.0;
  uint32_t warmup_ = 0;
  std::vector<FeqFilterType> layout_;
  std::vector<FeqBiquadCoefficients> coefficients_;
  std::vector<FeqBiquadState> states_;
  std::vector<float> scratch_;
  std::unique_ptr<FeqConvolverKernel, detail::ConvolverKernelDeleter> kernel_;
  std::vector<std::unique_ptr<FeqConvolver, detail::ConvolverDeleter>> convolvers_;
  std::shared_ptr<const std::vector<float>> identity_;
};

}
#endif
