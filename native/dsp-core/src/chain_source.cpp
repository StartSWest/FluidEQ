/* FluidEQ — GPL-3.0-or-later */
#include "fluideq/chain_source.h"
#include "chain_internal.h"

#include <algorithm>
#include <cmath>

namespace {
bool valid_level(double value) {
  return std::isfinite(value) && value >= -120.0 && value <= 24.0;
}

bool valid_noise(const FeqNoiseProfile* profile) {
  if (profile == nullptr) return true;
  if (!std::isfinite(profile->floor_dbfs) ||
      !std::isfinite(profile->hum_hz) ||
      profile->hum_partial_count > FEQ_DENOISE_MAX_HUM_PARTIALS) return false;
  for (double band : profile->bands_db) {
    if (!std::isfinite(band)) return false;
  }
  for (uint32_t i = 0; i < profile->hum_partial_count; ++i) {
    if (!std::isfinite(profile->hum_partial_hz[i]) ||
        !std::isfinite(profile->hum_partial_excess_db[i])) return false;
  }
  return true;
}

// Kept equal to inputNormalizer.ts: the cached integrated measurement is
// different from live leveling's loudest settled short-term reference.
double input_gain(const FeqChainSettings& settings,
                  const FeqChainSourceAnalysis& source) {
  if (source.has_level == 0 || settings.normalizer.mode == 0) return 0.0;
  const double room = settings.normalizer.ceiling_db - source.true_peak_dbtp;
  if (settings.normalizer.mode == 1) return std::max(-48.0, std::min(0.0, room));
  if (source.integrated_lufs <= -70.0) return 0.0;
  return std::max(-48.0, std::min({12.0, room,
      settings.normalizer.target_lufs - source.integrated_lufs}));
}

double master_gain(const FeqChainSettings& settings,
                   const FeqChainSourceAnalysis& source, double normalizer) {
  if (source.has_level == 0 || settings.master.enabled == 0 ||
      settings.master.loudness_maximize == 0) return 0.0;
  const double level = source.integrated_lufs + normalizer;
  if (level <= -70.0) return 0.0;
  const double asked = settings.master.loudness_target_lufs - level;
  if (asked <= 0.0) return std::max(FEQ_MASTER_LOUDNESS_MIN_DB, asked);
  const double room = settings.master.ceiling_db -
      (source.true_peak_dbtp + normalizer) -
      std::max(0.0, settings.master.output_trim_db);
  return std::max(0.0, std::min({FEQ_MASTER_LOUDNESS_MAX_DB, asked,
      room + settings.master.peak_limiting_db}));
}
}

extern "C" int feq_chain_prepare_source_analysis(FeqChain* chain,
    const FeqChainSourceAnalysis* source, FeqLevelingMemory* live_memory,
    FeqChainSourceStatus* status) {
  if (status != nullptr) *status = FeqChainSourceStatus{};
  if (chain == nullptr || source == nullptr || source->version != 1 ||
      (source->library != 0 && source->library != 1) ||
      (source->library != 0 && source->source_id == 0) ||
      (source->has_level != 0 && (!valid_level(source->integrated_lufs) ||
                               !valid_level(source->true_peak_dbtp))) ||
      !valid_noise(source->noise) ||
      ((source->voice_model_path == nullptr) !=
       (source->voice_runtime_path == nullptr))) return 0;

  if (source->library != 0) {
    feq_live_normalizer_destroy(chain->live_normalizer);
    chain->live_normalizer = nullptr;
    chain->leveling = nullptr;
    const double input = input_gain(chain->settings, *source);
    feq_chain_set_track_level_gains(chain, input,
        master_gain(chain->settings, *source, input), 1);
    feq_chain_set_noise_profile(chain, source->noise);
  } else {
    if (feq_chain_enable_live_normalizer(chain) == 0) return 0;
    feq_chain_attach_leveling_memory(chain, live_memory);
    chain->host_track_gains = 0;
    chain->settings.denoise.profile_source = FEQ_DENOISE_PROFILE_ADAPTIVE;
    feq_denoise_configure(chain->denoise, &chain->settings.denoise);
    feq_chain_set_noise_profile(chain, nullptr);
  }
  bool voice_ready = false;
  if (chain->settings.enabled != 0 && chain->settings.denoise.enabled != 0 &&
      chain->settings.denoise.voice.enabled != 0 &&
      source->voice_model_path != nullptr) {
    voice_ready = feq_chain_load_voice_model(chain, source->voice_model_path,
                                            source->voice_runtime_path) != 0;
    if (!voice_ready) return 0;
  }
  chain_apply_denoise_alignment(chain);
  chain->source_analysis_version = source->version;
  chain->source_library = source->library != 0;
  chain->source_id = source->source_id;
  chain->source_epoch = source->epoch;
  chain->source_revision = source->revision;
  if (status != nullptr) {
    status->ready = 1;
    status->voice_ready = voice_ready ? 1 : 0;
  }
  return 1;
}
