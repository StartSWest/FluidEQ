/* FluidEQ — GPL-3.0-or-later */
#ifndef FLUIDEQ_ENGINE_SOURCE_ANALYSIS_H
#define FLUIDEQ_ENGINE_SOURCE_ANALYSIS_H

#include <optional>
#include <memory>
#include <string>
#include <string_view>

#include "fluideq/chain_source.h"
#include "fluideq_engine/config.h"

namespace fluideq_engine {

inline constexpr const wchar_t* kSourceAnalysisFile = L"fluideq-source-analysis.txt";

/** Immutable source measurements. No output's selected controls or gains. */
struct SourceAnalysis {
  bool library = false;
  bool engine_owner = true;
  uint64_t source = 0;
  uint64_t epoch = 0;
  uint64_t revision = 0;
  std::wstring endpoint;
  bool has_level = false;
  double level = 0;
  double peak = 0;
  std::optional<FeqNoiseProfile> noise;
  bool voice_available = false;
  std::string voice_model;
  // Never read from the writable sidecar: supplied by the trusted module's
  // own protected installation path, after the setup helper verifies it.
  std::string voice_runtime;
  /** Pins verified data through model loading; never retained by the graph. */
  std::shared_ptr<void> voice_model_guard;
  std::string identity;

  FeqChainSourceAnalysis view() const noexcept;
  /** DSP facts only: an ACK revision or route move must not rebuild a rack. */
  std::string processing_identity() const;
};

/** Refuses duplicate/unknown fields, invalid numbers and incomplete facts. */
std::optional<SourceAnalysis> parse_source_analysis(std::string_view text);

/** Only the Library source and receivers of that source may use its scan. */
SourceAnalysis source_for_endpoint(const std::optional<SourceAnalysis>& source,
    const Endpoint& endpoint, const std::wstring& from, bool default_mode);

}  // namespace fluideq_engine
#endif
