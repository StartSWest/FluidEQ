/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/
#include "analysis_link.h"
#include <array>
#include <cstring>
#include "../../dsp-host/src/wire.h"

namespace fluideq_engine {
// Use the same wire record and decoder as Library playback. These are the
// system rack's own taps: endpoint loopback cannot recover individual stages.
std::vector<unsigned char> AnalysisLink::snapshot() {
  std::array<float, FEQ_METER_BINS * FEQ_METER_STAGE_COUNT> spectra{};
  std::array<float, FEQ_METER_SCOPE_PAIRS * 2> scope{};
  std::array<float, FEQ_METER_MAX_BANDS> amounts{}, levels{};
  FeqWireAnalysisFrame frame{};
  uint32_t present = 0;
  for (uint32_t stage = 0; stage < FEQ_METER_STAGE_COUNT; ++stage) {
    if (feq_meters_read_spectrum(meters_, stage,
            spectra.data() + present * FEQ_METER_BINS, FEQ_METER_BINS) != 0) {
      frame.stage_mask |= 1u << stage;
      ++present;
    }
  }
  double correlation = 1;
  float peaks[2]{};
  const bool has_scope = feq_meters_read_scope(meters_, scope.data(),
      FEQ_METER_SCOPE_PAIRS, &correlation, peaks) != 0;
  // No fresh audio window means no new display frame, even if static band
  // telemetry still exists from before Windows stopped the endpoint.
  if (present == 0 && !has_scope) return {};
  frame.magic = FEQ_MAGIC_ANALYSIS;
  frame.sequence = ++sequence_;
  frame.bins = FEQ_METER_BINS;
  frame.pairs = has_scope ? FEQ_METER_SCOPE_PAIRS : 0;
  frame.bands = feq_meters_read_bands(meters_, amounts.data(), levels.data(),
                                    FEQ_METER_MAX_BANDS);
  frame.correlation = correlation;
  frame.peak_left = peaks[0];
  frame.peak_right = peaks[1];
  feq_meters_read_exciter(meters_, frame.exciter_bands, &frame.exciter_organic);
  feq_meters_read_maximizer(meters_, &frame.maximizer_reduction_db);
  feq_meters_read_dimension(meters_, &frame.dimension_guard);
  FeqMasterTelemetry master{};
  feq_meters_read_master(meters_, &master);
  frame.auto_headroom_reduction_db = static_cast<float>(master.auto_headroom_reduction_db);
  frame.auto_headroom_true_peak_db = static_cast<float>(master.auto_headroom_true_peak_db);
  frame.safety_reduction_db = static_cast<float>(master.safety_reduction_db);
  frame.safety_true_peak_db = static_cast<float>(master.safety_true_peak_db);
  frame.dc_correction_db = static_cast<float>(master.dc_correction_db);
  frame.repaired_samples = static_cast<uint32_t>(master.repaired_samples);
  frame.true_peak_factor = master.true_peak_factor;
  frame.safety_enabled = master.safety_enabled != 0 ? 1u : 0u;
  feq_meters_read_normalizer(meters_, frame.normalizer_input_peaks,
      frame.normalizer_output_peaks, &frame.normalizer_applied_gain_db);
  float loudness[4]{};
  feq_meters_read_loudness(meters_, loudness);
  frame.loudness_momentary_lufs = loudness[0];
  frame.loudness_short_term_lufs = loudness[1];
  frame.loudness_integrated_lufs = loudness[2];
  frame.loudness_range_lu = loudness[3];
  FeqDenoiseReport denoise{};
  feq_meters_read_denoise(meters_, &denoise);
  frame.denoise_reduction_db = static_cast<float>(denoise.reduction_db);
  frame.denoise_noise_floor_db = static_cast<float>(denoise.noise_floor_db);
  frame.denoise_clicks_repaired = denoise.clicks_repaired;
  frame.denoise_voice_underruns = denoise.voice_underruns;
  frame.denoise_profile_ready = denoise.profile_ready != 0 ? 1u : 0u;
  frame.denoise_voice_model_loaded = denoise.voice_model_loaded != 0 ? 1u : 0u;
  for (uint32_t band = 0; band < FEQ_DENOISE_PROFILE_BANDS; ++band) {
    frame.denoise_floor_bands[band] = static_cast<float>(denoise.floor_bands_db[band]);
    frame.denoise_hiss_reduction_bands[band] = static_cast<float>(denoise.hiss_reduction_bands_db[band]);
  }
  feq_meters_read_bass_forge(meters_, frame.bass_forge_input_db,
                            frame.bass_forge_output_db);
  feq_meters_read_bass_punch(meters_, &frame.bass_punch_transient_db,
      &frame.bass_punch_sustain_db, &frame.bass_punch_duck_db);
  const size_t spectrum_bytes = sizeof(float) * present * FEQ_METER_BINS;
  const size_t scope_bytes = sizeof(float) * frame.pairs * 2;
  const size_t band_bytes = sizeof(float) * frame.bands;
  std::vector<unsigned char> packet(sizeof(frame) + spectrum_bytes +
                                    scope_bytes + band_bytes * 2 + sizeof(float) * 4);
  size_t offset = 0;
  const auto append = [&](const void* source, size_t size) {
    std::memcpy(packet.data() + offset, source, size);
    offset += size;
  };
  append(&frame, sizeof(frame));
  append(spectra.data(), spectrum_bytes);
  append(scope.data(), scope_bytes);
  append(amounts.data(), band_bytes);
  append(levels.data(), band_bytes);
  float live_input[4] = {-120, -120, -120, 0};
  feq_meters_read_live_input(meters_, live_input);
  append(live_input, sizeof(live_input));
  return packet;
}
}  // namespace fluideq_engine
