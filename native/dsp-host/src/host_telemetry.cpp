/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What the telemetry thread sends: the engine's reports, the panel's
 * analysis, and what the process costs.
 */
#include "host.h"
#include "process_stats.h"

#include <array>
#include <cstring>
#include <mutex>
#include <string>
#include <vector>

namespace feq_host {

/**
 * Send the panel one frame of what the chain just did, if there is any.
 *
 * Called from the telemetry thread, which is the whole point: the transforms
 * happen here rather than in the audio callback. Three 2048-point FFTs is tens
 * of microseconds of work, and a meter that can cost a dropout is a worse
 * defect than a meter that does not move.
 *
 * Sends nothing at all when no stage has published a new window and the scope
 * has not either — a repeated frame would be twelve kilobytes down the pipe to
 * repaint an identical picture.
 */
void drain_analysis(HostState& state) {
  if (state.meters == nullptr || feq_meters_enabled(state.meters) == 0) {
    state.analysis_publication.clear();
    return;
  }

  static thread_local std::vector<float> spectra;
  static thread_local std::vector<float> scope;
  static thread_local std::vector<float> band_amounts;
  static thread_local std::vector<float> band_levels;
  spectra.resize(static_cast<size_t>(FEQ_METER_BINS) * FEQ_METER_STAGE_COUNT);
  scope.resize(static_cast<size_t>(FEQ_METER_SCOPE_PAIRS) * 2);
  band_amounts.resize(FEQ_METER_MAX_BANDS);
  band_levels.resize(FEQ_METER_MAX_BANDS);

  uint32_t stage_mask = 0;
  uint32_t present = 0;
  for (uint32_t stage = 0; stage < FEQ_METER_STAGE_COUNT; stage += 1) {
    float* target = spectra.data() + static_cast<size_t>(present) *
                                         FEQ_METER_BINS;
    if (feq_meters_read_spectrum(state.meters, stage, target,
                                 FEQ_METER_BINS) != 0) {
      stage_mask |= (1u << stage);
      present += 1;
    }
  }

  double correlation = 1.0;
  float peaks[2] = {0.0f, 0.0f};
  const int has_scope =
      feq_meters_read_scope(state.meters, scope.data(), FEQ_METER_SCOPE_PAIRS,
                            &correlation, peaks);

  const uint32_t bands = feq_meters_read_bands(
      state.meters, band_amounts.data(), band_levels.data(),
      FEQ_METER_MAX_BANDS);

  FeqRoomReport room{};
  feq_meters_read_room(state.meters, &room);
  // Raw sharing produces no rack spectrum windows. Its inactive report still
  // needs one frame, otherwise the display retains the previous active match.
  if (!state.analysis_publication.take(stage_mask, has_scope != 0, bands, room)) {
    return;
  }

  static uint32_t sequence = 0;
  sequence += 1;

  FeqWireAnalysisFrame frame{};
  frame.magic = FEQ_MAGIC_ANALYSIS;
  frame.sequence = sequence;
  frame.stage_mask = stage_mask;
  frame.bins = FEQ_METER_BINS;
  frame.pairs = has_scope != 0 ? FEQ_METER_SCOPE_PAIRS : 0;
  frame.bands = bands;
  feq_meters_read_exciter(state.meters, frame.exciter_bands,
                          &frame.exciter_organic);
  feq_meters_read_maximizer(state.meters, &frame.maximizer_reduction_db);
  feq_meters_read_dimension(state.meters, &frame.dimension_guard);
  feq_wire_room_report(frame, room);
  FeqMasterTelemetry master{};
  feq_meters_read_master(state.meters, &master);
  frame.auto_headroom_reduction_db =
      static_cast<float>(master.auto_headroom_reduction_db);
  frame.auto_headroom_true_peak_db =
      static_cast<float>(master.auto_headroom_true_peak_db);
  // The six words after Auto Headroom were the final guard's readings until
  // it was removed on 2026-09-22; they stay in the layout as zeros.
  frame.safety_reduction_db = 0.0f;
  frame.safety_true_peak_db = 0.0f;
  frame.dc_correction_db = 0.0f;
  frame.repaired_samples = 0u;
  frame.true_peak_factor = 0u;
  frame.safety_enabled = 0u;
  feq_meters_read_normalizer(state.meters, frame.normalizer_input_peaks,
                             frame.normalizer_output_peaks,
                             &frame.normalizer_applied_gain_db);
  float loudness[4] = {0.0f, 0.0f, 0.0f, 0.0f};
  feq_meters_read_loudness(state.meters, loudness);
  frame.loudness_momentary_lufs = loudness[0];
  frame.loudness_short_term_lufs = loudness[1];
  frame.loudness_integrated_lufs = loudness[2];
  frame.loudness_range_lu = loudness[3];
  FeqDenoiseReport denoise{};
  feq_chain_denoise_report(state.chain, &denoise);
  frame.denoise_reduction_db = static_cast<float>(denoise.reduction_db);
  frame.denoise_noise_floor_db = static_cast<float>(denoise.noise_floor_db);
  frame.denoise_clicks_repaired = denoise.clicks_repaired;
  frame.denoise_voice_underruns = denoise.voice_underruns;
  for (uint32_t band = 0; band < FEQ_DENOISE_PROFILE_BANDS; band += 1) {
    frame.denoise_floor_bands[band] =
        static_cast<float>(denoise.floor_bands_db[band]);
    frame.denoise_hiss_reduction_bands[band] =
        static_cast<float>(denoise.hiss_reduction_bands_db[band]);
  }
  frame.denoise_profile_ready = denoise.profile_ready != 0 ? 1u : 0u;
  frame.denoise_voice_model_loaded =
      denoise.voice_model_loaded != 0 ? 1u : 0u;
  // Forge's two runs and Punch's three gains, straight out of the atomics the
  // audio thread published them into. Neither stage has a spectrum tap: what
  // Forge made is the gap between these two curves, and what Punch did is a
  // gain over time, and a 1024-bin transform can show neither.
  feq_meters_read_bass_forge(state.meters, frame.bass_forge_input_db,
                             frame.bass_forge_output_db);
  feq_meters_read_bass_punch(state.meters, &frame.bass_punch_transient_db,
                             &frame.bass_punch_sustain_db,
                             &frame.bass_punch_duck_db);
  frame.correlation = correlation;
  frame.peak_left = peaks[0];
  frame.peak_right = peaks[1];

  /**
   * Assembled whole, then written once, and that is not tidiness.
   *
   * `write_frame` locks stdout for the length of one call, so three calls are
   * three chances for a command acknowledgement from the control thread to land
   * between this header and its twelve kilobytes of floats. The reader would
   * take the ack's first bytes as spectrum and never find the stream again —
   * a desynchronisation that is permanent, not a dropped frame. Every other
   * frame in this protocol is a single write; this is the only one large enough
   * to be tempted otherwise.
   */
  static thread_local std::vector<unsigned char> packet;
  const size_t spectrum_bytes =
      sizeof(float) * static_cast<size_t>(present) * FEQ_METER_BINS;
  const size_t band_bytes = sizeof(float) * static_cast<size_t>(bands) * 2;
  const size_t scope_bytes =
      has_scope != 0
          ? sizeof(float) * static_cast<size_t>(FEQ_METER_SCOPE_PAIRS) * 2
          : 0;
  packet.resize(sizeof(frame) + spectrum_bytes + scope_bytes + band_bytes);

  size_t at = 0;
  std::memcpy(packet.data() + at, &frame, sizeof(frame));
  at += sizeof(frame);
  if (spectrum_bytes > 0) {
    std::memcpy(packet.data() + at, spectra.data(), spectrum_bytes);
    at += spectrum_bytes;
  }
  if (scope_bytes > 0) {
    std::memcpy(packet.data() + at, scope.data(), scope_bytes);
    at += scope_bytes;
  }
  if (band_bytes > 0) {
    // Amounts then levels, each `bands` long, so a reader that knows the count
    // knows both offsets without a second field.
    std::memcpy(packet.data() + at, band_amounts.data(), band_bytes / 2);
    at += band_bytes / 2;
    std::memcpy(packet.data() + at, band_levels.data(), band_bytes / 2);
  }
  write_frame(packet.data(), packet.size());
}

/** Sends every report the engine has published, and says how many. */
uint32_t drain_telemetry(HostState& state, const IAudioOutputBackend& backend) {
  const std::lock_guard<std::mutex> held(state.device_mutex);
  FeqTelemetryV1 record{};
  uint32_t drained = 0;
  while (feq_engine_try_read_telemetry(state.engine, &record)) {
    drained += 1;
    const FeqBackendStats stats = backend.stats();
    FeqWireTelemetryFrame frame{};
    frame.magic = FEQ_MAGIC_TELEMETRY;
    frame.applied_revision = record.applied_revision;
    frame.sequence = record.sequence;
    frame.frames_processed = record.frames_processed;
    // The device's buffer, not the engine's idea of one. The engine reports
    // whatever block it was handed, which for an offline render is the render's
    // own size and for the device path was never set at all — so this field
    // shipped as a constant zero, and the share-of-budget figure that makes a
    // callback time readable could not be computed from it.
    frame.latency_frames =
        stats.buffer_frames != 0 ? stats.buffer_frames : record.latency_frames;
    frame.device_generation =
        state.device_generation.load(std::memory_order_acquire);
    frame.peak_left = record.peak[0];
    frame.peak_right = record.peak[1];
    frame.callback_p50_us = record.callback_p50_us;
    frame.callback_p99_us = record.callback_p99_us;
    // The engine cannot see an underrun — it is handed a block or it is not.
    // Only the device thread knows a period went by unserved.
    frame.xruns = stats.underruns;
    frame.drops = record.drops;
    frame.repaired_samples = record.repaired_samples;
    frame.sample_rate = state.sample_rate;
    frame.channels = state.channels;
    frame.processing_frames = UINT32_MAX;
    std::array<uint32_t, 10> processing{};
    if (backend.is_running() && state.processing_latency.read(processing)) {
      frame.processing_frames = processing[0];
      for (size_t i = 0; i < 8; ++i) frame.processing_parts[i] = processing[i + 1];
      frame.processing_active = processing[9];
      const std::string endpoint = backend.endpoint_guid();
      if (endpoint.size() < sizeof(frame.processing_endpoint)) {
        std::memcpy(frame.processing_endpoint, endpoint.data(), endpoint.size());
      }
    }
    /**
     * The transport, read from the player rather than inferred.
     *
     * Safe from this thread: `player.h` states that any thread may read the
     * position and state, which is why they are atomics there and why this
     * does not take `decoder_mutex` — the audio callback must never wait on a
     * lock a telemetry drain is holding.
     *
     * An absent player reports an empty deck at zero rather than stale
     * numbers, so the renderer sees "nothing loaded" instead of the last
     * track's position frozen on the bar.
     */
    if (state.player != nullptr) {
      // The incoming deck from the moment a fade starts, not the one still
      // being faded out: the app has already moved on to it, and the outgoing
      // deck's end mid-fade is not the new track ending (`player.h`).
      const uint32_t deck = feq_player_reported_deck(state.player);
      frame.active_deck = deck;
      frame.deck_state =
          static_cast<uint32_t>(feq_player_deck_state(state.player, deck));
      frame.deck_position_seconds =
          feq_player_position_seconds(state.player, deck);
      frame.deck_duration_seconds =
          feq_player_duration_seconds(state.player, deck);
    }
    write_frame(&frame, sizeof(frame));
  }
  return drained;
}

/**
 * Say what this process costs, whether or not any audio is flowing.
 *
 * Deliberately not folded into the telemetry frame beside it: telemetry is
 * produced per audio callback and therefore stops entirely when nothing is
 * playing, which is when a memory figure is most often being looked at. A
 * process asleep with a gigabyte resident is a bug; a process asleep with no
 * row is invisible. So a sample also follows every command handled with no
 * device running (`stats_wanted`) — whatever made the gigabyte resident was
 * one of those — and the CPU figure is a running total, which goes on
 * reading as asleep without being sent again.
 *
 * A platform without an implementation sends nothing at all, rather than a
 * frame of zeroes: the app draws a dash for a figure it does not have, and a
 * zero would read as a measured zero.
 */
void publish_process_stats() {
  FeqProcessStats sample{};
  if (!feq_sample_process_stats(&sample)) {
    return;
  }
  FeqWireStatsFrame frame{};
  frame.magic = FEQ_MAGIC_STATS;
  frame.working_set_bytes = sample.working_set_bytes;
  frame.cpu_seconds = sample.cpu_seconds;
  write_frame(&frame, sizeof(frame));
}

}  // namespace feq_host
