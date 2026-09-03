/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The supervised host process: device, engine, control, telemetry.
 *
 * It owns the output endpoint and the real-time thread. What it deliberately
 * does NOT own is any decision: the renderer resolves presets, clamps every
 * value and sends one already-valid snapshot. This process validates the frame
 * it was handed and nothing else, because a second opinion about what a gain
 * may be is a second answer.
 *
 * Three threads, and which one may do what is the whole design:
 *
 *   control    reads stdin, validates, prepares snapshots, opens the device
 *   real-time  owned by the backend; generates, processes, writes to the device
 *   telemetry  drains the engine's ring and writes frames to stdout
 *
 * The real-time thread never writes to stdout, never allocates and never takes
 * a lock. The other two share stdout under a mutex, because two writers
 * interleaving inside one binary frame is a desynchronised stream that looks
 * like corruption rather than like a race.
 */

#include "audio_backend.h"
#include "decoders/pcm_decoder.h"
#include "parent_watch.h"
#include "process_stats.h"
#include "fluideq/chain.h"
#include "fluideq/dsp.h"
#include "fluideq/player.h"
#include "fluideq/parameters.h"
#include "wire.h"

#include <atomic>
#include <chrono>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <mutex>
// For `std::bad_alloc`, which the offline render refuses rather than dies of.
#include <new>
#include <string>
#include <thread>
#include <vector>

#ifdef _WIN32
#include <fcntl.h>
#include <io.h>
#endif

namespace {

constexpr uint32_t kFallbackSampleRate = 48000;
constexpr uint32_t kFallbackBlockFrames = 512;
constexpr uint32_t kEngineChannels = 2;
/** 25 ms, i.e. 40 Hz — ahead of the 20-30 Hz the renderer redraws at. */
constexpr int kTelemetryIntervalMs = 25;

/**
 * Twenty telemetry ticks, so half a second between process samples.
 *
 * Counted on the loop that already exists rather than given a clock of its
 * own. The number is chosen from what reads well rather than from what is
 * cheap: memory and CPU are figures somebody watches climb, and a column that
 * changes forty times a second cannot be read at all. It is also the window
 * the CPU percentage is averaged over — short enough to see the engine react
 * to a track starting, long enough that a single scheduling quantum does not
 * dominate the answer.
 */
constexpr int kStatsIntervalTicks = 20;

enum class SignalKind : int { Silence = 0, Sine = 1 };

/**
 * The bring-up generator, and later the permanent "is the output alive" check.
 *
 * Not a placeholder for a decoder — it is a signal generator, which is a real
 * instrument on a real console. Until decoding lands it is the only way to put
 * a known waveform through the whole path and hear whether what comes back is
 * what went in, and it stays useful afterwards for exactly the same reason.
 */
class SignalSource {
 public:
  void configure(SignalKind kind, double frequency_hz) {
    kind_.store(static_cast<int>(kind), std::memory_order_relaxed);
    if (frequency_hz > 0.0 && frequency_hz < 24000.0) {
      frequency_.store(frequency_hz, std::memory_order_relaxed);
    }
  }

  void set_sample_rate(uint32_t rate) { sample_rate_ = rate; }

  /** Real-time. Arithmetic only: no allocation, no branch on anything shared. */
  void render(float* const* planar, uint32_t channels, uint32_t frames) {
    if (static_cast<SignalKind>(kind_.load(std::memory_order_relaxed)) ==
        SignalKind::Silence) {
      return;
    }
    const double frequency = frequency_.load(std::memory_order_relaxed);
    const double step = 6.283185307179586 * frequency /
                        static_cast<double>(sample_rate_ == 0 ? 1 : sample_rate_);
    for (uint32_t frame = 0; frame < frames; ++frame) {
      // -12 dBFS. Loud enough to measure, quiet enough that a mistake in the
      // chain above it does not arrive at full scale in somebody's headphones.
      const float value = static_cast<float>(0.251188643 * std::sin(phase_));
      for (uint32_t channel = 0; channel < channels; ++channel) {
        planar[channel][frame] = value;
      }
      phase_ += step;
      // Wrapped rather than left to grow: a double accumulating a phase for an
      // hour loses the precision that keeps the sine a sine.
      if (phase_ > 6.283185307179586) {
        phase_ -= 6.283185307179586;
      }
    }
  }

 private:
  std::atomic<int> kind_{static_cast<int>(SignalKind::Silence)};
  std::atomic<double> frequency_{440.0};
  uint32_t sample_rate_ = kFallbackSampleRate;
  double phase_ = 0.0;
};

struct HostState {
  FeqEngine* engine = nullptr;
  /** The whole signal path. Null until a device has told us its rate. */
  FeqChain* chain = nullptr;
  FeqPlayer* player = nullptr;
  /**
   * What the panel draws, owned here rather than by the chain.
   *
   * Outlives every chain rebuild on purpose. A device that renegotiates its
   * rate, or a band being added, destroys and rebuilds the chain — and meters
   * owned by the chain would take the spectrum's smoothing history with them,
   * so every display in the panel would blank and refill on a settings change.
   */
  FeqMeters* meters = nullptr;
  uint32_t sample_rate = kFallbackSampleRate;
  uint32_t channels = kEngineChannels;
  uint32_t block_frames = kFallbackBlockFrames;
  SignalSource source;
  /**
   * The last chain a renderer sent, kept so a device change can re-apply it.
   *
   * A device deciding it wants 44.1 kHz is not the user asking for their
   * settings back at defaults, and a rebuild that silently flattened the chain
   * would look exactly like the engine ignoring the panel.
   */
  FeqChainSettings chain_settings{};
  /**
   * The voice model that most recently loaded successfully.
   *
   * A device open rebuilds the fallback-rate chain before audio starts. The
   * model used to live only inside that discarded chain, so downloading it
   * before START made it disappear as soon as the real endpoint negotiated.
   * Keeping the paths beside the settings lets every replacement chain restore
   * the same module before it can be published to the audio thread.
   */
  std::string voice_model_path;
  std::string voice_runtime_path;
  /**
   * The listener's fader, 0 to 1, and where the ramp has reached.
   *
   * `volume` is written by the control thread and read by the audio thread;
   * `volume_now` belongs to the audio thread alone and needs no atomic.
   */
  std::atomic<float> volume{1.0f};
  float volume_now = 1.0f;
  /** True once a deck holds audio, which is what silences the generator. */
  std::atomic<bool> player_has_source{false};
  /**
   * Guards the decoder against its two writers.
   *
   * The decoder thread pumps; the control thread loads and seeks. Both touch
   * the same decoder handle, so both take this. The AUDIO thread never does —
   * it only reads the rings, which are lock-free by construction, and a
   * callback waiting on a mutex the decoder thread holds is a dropout with no
   * bug in it.
   */
  std::mutex decoder_mutex;
  /**
   * Serialises anything that opens, closes or rebuilds the device path, plus
   * the voice-model state copied into every rebuilt chain.
   *
   * Taken by the control thread for START, STOP and voice-model changes, and
   * by the reopen below. Never by the audio thread, which only reads what
   * those two have already finished building.
   */
  std::mutex device_mutex;
  /** What the renderer last asked for, so a reopen knows whether to start. */
  std::atomic<bool> device_wanted{false};
  /**
   * Incremented on every endpoint reopen, and reported in telemetry.
   *
   * A rebuilt player has no decks, so a reopen leaves a healthy stream playing
   * nothing. Only the renderer knows what was playing and where, so this is the
   * signal telling it to cue that again.
   */
  std::atomic<uint32_t> device_generation{0};
  /**
   * Whether the current outage has already been logged.
   *
   * The retry runs on the telemetry thread, about forty times a second, so a
   * line per attempt would bury the one that says what happened. Touched only
   * under `device_mutex`, which every reopen already holds.
   */
  bool reopen_failure_reported{false};
};

std::mutex g_stdout_mutex;

bool read_exact(void* into, size_t bytes) {
  auto* cursor = static_cast<unsigned char*>(into);
  size_t remaining = bytes;
  while (remaining > 0) {
    // `fread` may return short on a pipe with nothing wrong — the writer has
    // simply not finished. Treating that as end-of-stream is how a transport
    // develops a rare, unreproducible desync under load.
    const size_t got = std::fread(cursor, 1, remaining, stdin);
    if (got == 0) {
      return false;
    }
    cursor += got;
    remaining -= got;
  }
  return true;
}

/**
 * The longest path this host will accept from the wire.
 *
 * Windows extended-length paths top out at 32767 UTF-16 units, so this is the
 * generous end of what a real one can be rather than a guess at what is
 * reasonable. Nothing legitimate approaches it; the number exists so that a
 * length field which is NOT a length has somewhere to fail.
 */
constexpr uint32_t kMaxPathBytes = 32u * 1024u;

/**
 * The longest chain payload the decoder could ever accept, in doubles.
 *
 * `feq_chain_settings_decode` already refuses anything that is not exactly
 * `LEAD + bands * BAND_PARAMS` — but it is handed a vector that has already
 * been allocated, so the refusal comes one allocation too late. This is the
 * same arithmetic at its maximum, checked before the memory is asked for.
 */
constexpr uint32_t kMaxChainParams =
    FEQ_CHAIN_PARAM_LEAD + FEQ_CHAIN_MAX_EQ_BANDS * FEQ_CHAIN_BAND_PARAMS;

/**
 * Whether a length that arrived from the pipe is one this build can hold.
 *
 * Every variable-length command states its own count, and that count is read
 * from the wire before anything is allocated for it. Sizing an allocation
 * straight from it is how a desynchronised stream — a host built before a
 * layout change, a frame read at the wrong offset — becomes a 34 GB
 * `std::vector`, and there is no `catch` between that and `std::terminate`
 * anywhere on this path. The engine would disappear mid-playback and the log
 * would say nothing about why.
 *
 * REFUSED RATHER THAN CLAMPED, AND FATAL RATHER THAN SKIPPED. A length outside
 * its range means the reader and the writer disagree about where this frame
 * ends. `wire.h` already states the rule for that case and it applies whole:
 * there is no safe number of bytes to skip, so the stream is not recoverable
 * and the loop stops rather than guessing at the next frame boundary.
 *
 * The ceilings are the encoder's own maxima, so a legitimate frame is never
 * refused — see `kMaxPathBytes` and `kMaxChainParams`.
 */
bool payload_within(uint32_t count, uint32_t ceiling, const char* what) {
  if (count <= ceiling) {
    return true;
  }
  std::fprintf(stderr,
               "FluidEQ-DSP: %s declares %u, ceiling is %u; the control "
               "stream has desynchronised\n",
               what, count, ceiling);
  return false;
}

/**
 * A `double` from the wire read back as a byte length.
 *
 * `RENDER_TO_FILE` carries its path length in `value`, which is a `double`
 * because the frame has no second integer field free. A negative or NaN double
 * cast to `size_t` is undefined behaviour BEFORE any allocation is attempted —
 * on x86-64 it lands on 0x8000000000000000, which `std::string` answers with a
 * `length_error` and this process answers with `std::terminate`. So the value
 * is judged as a double, while it still is one.
 */
bool wire_length_from_double(double value, uint32_t ceiling, uint32_t* out) {
  if (!std::isfinite(value) || value < 0.0 ||
      value > static_cast<double>(ceiling)) {
    std::fprintf(stderr,
                 "FluidEQ-DSP: path length %f is not a length; the control "
                 "stream has desynchronised\n",
                 value);
    return false;
  }
  *out = static_cast<uint32_t>(value);
  return true;
}

bool write_frame(const void* from, size_t bytes) {
  const std::lock_guard<std::mutex> held(g_stdout_mutex);
  const auto* cursor = static_cast<const unsigned char*>(from);
  size_t remaining = bytes;
  while (remaining > 0) {
    const size_t put = std::fwrite(cursor, 1, remaining, stdout);
    if (put == 0) {
      return false;
    }
    cursor += put;
    remaining -= put;
  }
  return std::fflush(stdout) == 0;
}

void send_handshake(const char* backend_name) {
  FeqWireHandshake handshake{};
  handshake.magic = FEQ_MAGIC_HANDSHAKE;
  handshake.protocol_version = FEQ_WIRE_PROTOCOL_VERSION;
  handshake.parameter_schema_version = FEQ_PARAMETER_SCHEMA_VERSION;
  handshake.abi_version = feq_core_abi_version();
  handshake.parameter_count = static_cast<uint32_t>(FEQ_PARAMETER_COUNT);
  handshake.analysis_frame_bytes =
      static_cast<uint32_t>(sizeof(FeqWireAnalysisFrame));
  std::snprintf(handshake.core_version, sizeof(handshake.core_version), "%s",
                feq_core_version());
#if defined(_M_X64) || defined(__x86_64__)
  std::snprintf(handshake.architecture, sizeof(handshake.architecture), "x64");
#elif defined(_M_ARM64) || defined(__aarch64__)
  std::snprintf(handshake.architecture, sizeof(handshake.architecture), "arm64");
#else
  std::snprintf(handshake.architecture, sizeof(handshake.architecture),
                "unknown");
#endif
  std::snprintf(handshake.build_revision, sizeof(handshake.build_revision), "%s",
                FEQ_BUILD_REVISION);
  std::snprintf(handshake.backend, sizeof(handshake.backend), "%s",
                backend_name);
  write_frame(&handshake, sizeof(handshake));
}

/** Takes the enum; the narrowing to the wire's width happens once, here. */
void send_ack(uint32_t request_id,
              FeqWireStatus status,
              uint32_t revision,
              uint64_t applied_at,
              double sanitized) {
  FeqWireAckFrame ack{};
  ack.magic = FEQ_MAGIC_ACK;
  ack.protocol_version = FEQ_WIRE_PROTOCOL_VERSION;
  ack.status = static_cast<uint16_t>(status);
  ack.request_id = request_id;
  ack.accepted_revision = revision;
  ack.applied_at_sample_frame = applied_at;
  ack.sanitized_value = sanitized;
  write_frame(&ack, sizeof(ack));
}

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

  if (stage_mask == 0 && has_scope == 0 && bands == 0) {
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
  FeqMasterTelemetry master{};
  feq_meters_read_master(state.meters, &master);
  frame.auto_headroom_reduction_db =
      static_cast<float>(master.auto_headroom_reduction_db);
  frame.auto_headroom_true_peak_db =
      static_cast<float>(master.auto_headroom_true_peak_db);
  frame.safety_reduction_db = static_cast<float>(master.safety_reduction_db);
  frame.safety_true_peak_db = static_cast<float>(master.safety_true_peak_db);
  frame.dc_correction_db = static_cast<float>(master.dc_correction_db);
  frame.repaired_samples = static_cast<uint32_t>(master.repaired_samples);
  frame.true_peak_factor = master.true_peak_factor;
  frame.safety_enabled = master.safety_enabled != 0 ? 1u : 0u;
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
    // Amounts then levels, each  long, so a reader that knows the count
    // knows both offsets without a second field.
    std::memcpy(packet.data() + at, band_amounts.data(), band_bytes / 2);
    at += band_bytes / 2;
    std::memcpy(packet.data() + at, band_levels.data(), band_bytes / 2);
  }
  write_frame(packet.data(), packet.size());
}

void drain_telemetry(HostState& state, const IAudioOutputBackend& backend) {
  FeqTelemetryV1 record{};
  while (feq_engine_try_read_telemetry(state.engine, &record)) {
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
      const uint32_t deck = feq_player_active_deck(state.player);
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
}

/**
 * Say what this process costs, whether or not any audio is flowing.
 *
 * Deliberately not folded into the telemetry frame beside it: telemetry is
 * produced per audio callback and therefore stops entirely when nothing is
 * playing, which is when a memory figure is most often being looked at. A
 * process asleep with a gigabyte resident is a bug; a process asleep with no
 * row is invisible.
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
  frame.cpu_percent = sample.cpu_percent;
  write_frame(&frame, sizeof(frame));
}

/**
 * The real-time entry point, called by the backend once per device period.
 *
 * Generate, then process in place. Both halves obey the callback rules in
 * dsp.h; the stack array below is the only storage either of them needs.
 */
void render_bridge(void* context, float* const* planar, uint32_t frames) {
  auto* state = static_cast<HostState*>(context);
  if (state == nullptr || state->engine == nullptr) {
    return;
  }

  /**
   * The player first, the generator only when there is nothing to play.
   *
   * Not "either/or by a mode flag": a deck with audio in it always wins, and
   * the generator fills the silence so that the output path can be proved
   * alive with no file loaded. Both write into `planar`, which the backend
   * pre-zeroes, so a source that writes nothing produces silence rather than
   * the previous period again.
   */
  if (state->player != nullptr &&
      state->player_has_source.load(std::memory_order_acquire)) {
    feq_player_render(state->player, planar, frames);
  } else {
    state->source.render(planar, state->channels, frames);
  }

  /**
   * The listener's volume, applied here — before the chain, on purpose.
   *
   * On the element path the volume lives on the `<audio>` element, and an
   * element routed through `createMediaElementSource` applies it to what
   * reaches the graph. So the chain has always seen post-volume audio, and the
   * compressor and limiter have always responded to it. Applying it after the
   * chain instead would be a defensible design and a different one, and the two
   * engines would stop matching the moment a dynamics stage was armed.
   *
   * Mirrored at all because the elements are MUTED while the native engine is
   * audible: without this the fader moved and nothing happened, which is the
   * whole feature missing rather than a subtlety.
   *
   * Ramped across the block rather than stepped. A fader dragged across its
   * range sends a change every few milliseconds and a step per block is a click
   * per block — audible as a zip up the side of the sound. This is the
   * animation's own duration, not a timer standing in for a race.
   */
  const float target = state->volume.load(std::memory_order_relaxed);
  const float from = state->volume_now;
  if (from != target || target != 1.0f) {
    const float step =
        frames > 0 ? (target - from) / static_cast<float>(frames) : 0.0f;
    for (uint32_t channel = 0; channel < state->channels; ++channel) {
      float running = from;
      float* samples = planar[channel];
      for (uint32_t at = 0; at < frames; ++at) {
        running += step;
        samples[at] *= running;
      }
    }
    state->volume_now = target;
  }

  /**
   * A guard at the chain's input, which is a different job from the one below.
   *
   * The engine at the end repairs and COUNTS, and its count is what telemetry
   * reports. This one repairs and says nothing, because it is protecting the
   * filters rather than reporting on them: one non-finite sample entering a
   * biquad makes every subsequent sample non-finite, so a single bad frame
   * from a decoder silences the rest of the track and looks like the engine
   * died. Catching it after the chain would be catching it too late.
   */
  for (uint32_t channel = 0; channel < state->channels; ++channel) {
    for (uint32_t at = 0; at < frames; ++at) {
      if (!std::isfinite(planar[channel][at])) {
        planar[channel][at] = 0.0f;
      }
    }
  }

  if (state->chain != nullptr) {
    feq_chain_process(state->chain, planar, frames);
  }

  // On the stack, so nothing is allocated: adding const to a pointer array is
  // not an implicit conversion in C++, and the alternative is a cast that
  // hides what it is doing.
  const float* inputs[2] = {planar[0], state->channels > 1 ? planar[1]
                                                           : planar[0]};
  feq_engine_process_planar(state->engine, inputs, planar, frames);
}

/**
 * Decode ahead of the block an offline render is about to produce.
 *
 * An offline render is not paced by a device: it calls `render_bridge` as fast
 * as the CPU allows, while the decks are refilled by the decoder thread in its
 * own time. Nothing connected those two, so the loop read a ring that was dry
 * for much of the run. Measured here, a five-second export of the same passage
 * came back 53% silent for m4a, 22% for wma and 15% for flac; with this pump it
 * is 0.4%, 0.2% and none. So it was a WAV export full of holes, and a decoder
 * smoke test whose peak was whichever of the two states its telemetry window
 * happened to land on.
 *
 * AAC loses that race hardest because Media Foundation returns 1024 frames per
 * `ReadSample` where the vendored decoders return thousands, which is why the
 * check that failed was always `m4a` — the decode itself is correct, and reads
 * the same file at full level when nothing is outrunning it.
 *
 * The mutex is the one the decoder thread holds around its own pump, so a deck
 * still has exactly one producer writing to it at a time.
 */
void pump_decks(HostState& state) {
  const std::lock_guard<std::mutex> held(state.decoder_mutex);
  if (state.player != nullptr) {
    feq_player_pump(state.player);
  }
}

/**
 * A 32-bit float WAV, written by hand.
 *
 * Float rather than 16-bit because the point of this file is comparison: the
 * chain works in float end to end and quantising on the way out would put a
 * dither-sized difference between two engines that actually agree.
 */
bool write_float_wav(const std::string& path,
                     const std::vector<float>& interleaved,
                     uint32_t sample_rate,
                     uint32_t channels) {
  std::FILE* file = nullptr;
#ifdef _WIN32
  if (fopen_s(&file, path.c_str(), "wb") != 0) {
    file = nullptr;
  }
#else
  file = std::fopen(path.c_str(), "wb");
#endif
  if (file == nullptr) {
    return false;
  }
  const auto data_bytes =
      static_cast<uint32_t>(interleaved.size() * sizeof(float));
  const uint32_t byte_rate = sample_rate * channels * 4;
  unsigned char header[44];
  std::memcpy(header, "RIFF", 4);
  const uint32_t riff = 36 + data_bytes;
  std::memcpy(header + 4, &riff, 4);
  std::memcpy(header + 8, "WAVEfmt ", 8);
  const uint32_t fmt_size = 16;
  std::memcpy(header + 16, &fmt_size, 4);
  // Format 3 is IEEE float, which is what the samples below actually are.
  const uint16_t format = 3;
  std::memcpy(header + 20, &format, 2);
  const auto channel_count = static_cast<uint16_t>(channels);
  std::memcpy(header + 22, &channel_count, 2);
  std::memcpy(header + 24, &sample_rate, 4);
  std::memcpy(header + 28, &byte_rate, 4);
  const auto block_align = static_cast<uint16_t>(channels * 4);
  std::memcpy(header + 32, &block_align, 2);
  const uint16_t bits = 32;
  std::memcpy(header + 34, &bits, 2);
  std::memcpy(header + 36, "data", 4);
  std::memcpy(header + 40, &data_bytes, 4);

  const bool ok =
      std::fwrite(header, 1, sizeof(header), file) == sizeof(header) &&
      std::fwrite(interleaved.data(), sizeof(float), interleaved.size(),
                  file) == interleaved.size();
  std::fclose(file);
  return ok;
}

/** Rebuild the engine around a device that has told us what it wants. */

bool rebuild_engine(HostState& state,
                    const std::vector<double>& snapshot,
                    uint32_t revision) {
  FeqEngine* replacement = feq_engine_create(state.sample_rate, state.channels,
                                             state.block_frames);
  if (replacement == nullptr) {
    return false;
  }
  // Re-applied rather than lost. The device deciding it wants 44.1 kHz is not
  // the user asking for their settings back at defaults, and a rebuild that
  // silently flattened the chain would look exactly like the engine ignoring
  // the panel.
  FeqConfigV1 config{};
  config.abi_version = FEQ_ABI_VERSION;
  config.settings_revision = revision;
  config.parameter_count = static_cast<uint32_t>(snapshot.size());
  config.parameter_values = snapshot.data();
  if (feq_engine_prepare_config(replacement, &config) == FEQ_OK) {
    feq_engine_commit_prepared_config(replacement);
  }
  FeqEngine* previous = state.engine;
  state.engine = replacement;
  feq_engine_destroy(previous);
  state.source.set_sample_rate(state.sample_rate);
  return true;
}

/**
 * Rebuild the chain and the player around the rate the device agreed to.
 *
 * Both are torn down and remade rather than retuned, because both size every
 * buffer they own from the rate and the block: a look-ahead in samples, a
 * resampler's phase table, sixty-four sets of coefficients. Retuning them in
 * place would be the same allocations with more ways to get half of it done.
 *
 * The device is not running while this happens — `open` negotiates, this
 * rebuilds, and only then does `start` let a callback in. That ordering is the
 * whole reason `open` and `start` are separate calls.
 */
bool rebuild_chain_and_player(HostState& state, const FeqDecoderOps& ops) {
  FeqChain* chain = feq_chain_create(static_cast<double>(state.sample_rate),
                                     state.channels, state.block_frames);
  if (chain == nullptr) {
    return false;
  }
  feq_chain_configure(chain, &state.chain_settings);
  if (!state.voice_model_path.empty() &&
      feq_chain_load_voice_model(chain, state.voice_model_path.c_str(),
                                 state.voice_runtime_path.c_str()) == 0) {
    std::fprintf(stderr,
                 "FluidEQ-DSP: voice model failed to survive chain rebuild\n");
    // Voice is optional. A missing runtime must not turn a healthy output
    // device into silence; the meter reports the module unavailable and the
    // next rebuild can retry the retained, previously valid pair.
  }
  // Re-attached rather than recreated, so the panel's displays carry across a
  // rebuild instead of blanking every time a band moves.
  feq_chain_set_meters(chain, state.meters);
  // Told the rate here, because this is the one place it is known to have
  // changed: a device that renegotiated to 44.1 kHz publishes windows more
  // slowly, and the spectrum's decay is derived from that rate.
  feq_meters_set_sample_rate(state.meters,
                             static_cast<double>(state.sample_rate));

  // Two seconds of read-ahead per deck. Long enough that a decoder thread
  // descheduled for a moment cannot starve the callback, short enough that a
  // seek throws away almost nothing.
  const uint32_t read_ahead = state.sample_rate * 2;
  FeqPlayer* player = feq_player_create(
      static_cast<double>(state.sample_rate), state.channels,
      state.block_frames, read_ahead, &ops);
  if (player == nullptr) {
    feq_chain_destroy(chain);
    return false;
  }

  FeqChain* old_chain = state.chain;
  FeqPlayer* old_player = state.player;
  state.chain = chain;
  state.player = player;
  // Anything a deck held is gone with the old player, so the generator takes
  // over again until something is loaded into the new one.
  state.player_has_source.store(false, std::memory_order_release);
  feq_chain_destroy(old_chain);
  feq_player_destroy(old_player);
  return true;
}

/**
 * Follow the output the listener is actually using.
 *
 * Windows moves the default render endpoint whenever somebody switches from
 * speakers to headphones, or unplugs a monitor. The old endpoint stays
 * perfectly valid, so WASAPI reports nothing at all and the stream goes on
 * playing to a device nobody is listening to. The element path follows the
 * default on its own, which is why only the native engine went quiet —
 * reported as changing the output and getting no sound.
 *
 * Done here rather than on the notification thread, which is a callback about
 * the very device this tears down, and rather than on the control thread, which
 * spends its life blocked reading stdin and would not act until the next
 * command happened to arrive.
 *
 * The sequence is close, open, rebuild, start — the ordering the rebuild has
 * always required — under the same lock START and STOP take, so a reopen and a
 * command can never be inside the device path together.
 */
void reopen_if_device_changed(HostState& state, IAudioOutputBackend& backend,
                              const FeqDecoderOps& decoder_ops) {
  if (!backend.needs_reopen()) {
    return;
  }
  const std::lock_guard<std::mutex> held(state.device_mutex);
  backend.clear_reopen();
  if (!state.device_wanted.load(std::memory_order_acquire)) {
    // Nobody wants a device right now; the flag was about one being taken away.
    return;
  }

  backend.close();
  std::string error;
  FeqBackendFormat negotiated{};
  if (!backend.open(negotiated, error)) {
    /**
     * The device is not there YET, which is not the same as not coming back.
     *
     * A headset powering off and on, or Windows re-enumerating after one is
     * plugged in, leaves a window of a second or so with no default endpoint
     * at all — Chromium logs "invalid output parameters" against the same
     * moment. Opening during that window fails, and giving up here left the
     * host closed and silent with nothing scheduled to try again: the process
     * alive, no device, no error anybody could see, and only a restart to fix
     * it. That is the "no sound after changing output" this mechanism was
     * supposed to prevent.
     *
     * The request goes back so the next telemetry tick tries again, which is a
     * poll that already exists rather than a delay invented here. Reported
     * once per outage: this runs about forty times a second, and a log line
     * per attempt would bury the one that matters.
     */
    backend.request_reopen();
    if (!state.reopen_failure_reported) {
      state.reopen_failure_reported = true;
      std::fprintf(stderr,
                   "FluidEQ-DSP: reopen failed: %s; retrying until an "
                   "endpoint is available\n",
                   error.c_str());
    }
    return;
  }
  state.reopen_failure_reported = false;

  const uint32_t channels = negotiated.channels < kEngineChannels
                                ? negotiated.channels
                                : kEngineChannels;
  /**
   * Rebuilt only if the new endpoint is actually shaped differently.
   *
   * Everything the chain and the player own is sized by rate, channel count and
   * block length, so a change in any of those needs a rebuild. Nothing else
   * does — and rebuilding anyway is destructive in a way that is easy to miss:
   * the player goes with it, and a new player has no decks, so the track that
   * was playing is gone.
   *
   * That is what a device change felt like. Speakers to headphones is the same
   * 48 kHz stereo endpoint by another name, so the rebuild was pure loss: the
   * output moved correctly and the music stopped, three times in a row on one
   * machine. Keeping the player when its shape has not changed means the track
   * simply carries on out of the new device, which is what somebody plugging in
   * headphones expects to happen.
   */
  const bool shape_changed = negotiated.sample_rate != state.sample_rate ||
                             channels != state.channels ||
                             negotiated.max_block_frames != state.block_frames;
  state.sample_rate = negotiated.sample_rate;
  state.channels = channels;
  state.block_frames = negotiated.max_block_frames;

  if (shape_changed && !rebuild_chain_and_player(state, decoder_ops)) {
    std::fprintf(stderr, "FluidEQ-DSP: reopen failed to rebuild the chain\n");
    backend.close();
    return;
  }
  if (!backend.start(error)) {
    // Opened and then refused to run, which is the same outage a moment later.
    // Closed and asked for again rather than left as a silent open handle.
    std::fprintf(stderr, "FluidEQ-DSP: reopen failed to start: %s\n",
                 error.c_str());
    backend.close();
    backend.request_reopen();
    return;
  }

  if (!shape_changed) {
    // The decks survived, so there is nothing for the renderer to put back and
    // no reason to make it reload a track that never stopped playing.
    std::fprintf(stderr,
                 "FluidEQ-DSP: output device changed; same format, kept "
                 "playing at %u Hz\n",
                 state.sample_rate);
    return;
  }

  /**
   * Announced last, once there is something to come back to.
   *
   * The rebuild above destroyed the player, so every deck is empty and
   * `player_has_source` is false — the endpoint is correct and the music has
   * stopped. Bumping this is what tells the renderer to cue what it was playing
   * again, and it is bumped only on the path where the device really did come
   * back, so a failed reopen does not ask for a reload into nothing.
   */
  state.device_generation.fetch_add(1, std::memory_order_acq_rel);
  std::fprintf(stderr,
               "FluidEQ-DSP: output device changed; reopened at %u Hz\n",
               state.sample_rate);
}

/**
 * The backend, reachable from the parent watch without carrying a context.
 *
 * A raw pointer to something `main` owns and outlives: the watch thread only
 * ever calls `close()` on it, and only while `main` is still blocked in its
 * read loop. A second `unique_ptr` here would be a second owner.
 */
IAudioOutputBackend* g_backend_for_exit = nullptr;

/** Runs on the watch thread when the parent dies. Releases the endpoint. */
void release_device_on_parent_exit() {
  if (g_backend_for_exit != nullptr) {
    g_backend_for_exit->close();
  }
}

/** `--parent-pid <n>`, or zero when nobody said. */
uint32_t parent_pid_from(int argc, char** argv) {
  for (int index = 1; index + 1 < argc; ++index) {
    if (std::strcmp(argv[index], "--parent-pid") == 0) {
      return static_cast<uint32_t>(std::strtoul(argv[index + 1], nullptr, 10));
    }
  }
  return 0;
}

}  // namespace

int main(int argc, char** argv) {
#ifdef _WIN32
  // Without this the CRT rewrites 0x0A as 0x0D 0x0A on the way out and eats
  // the 0x0D on the way in, which corrupts any frame whose bytes happen to
  // include a newline — that is, most of them, silently and intermittently.
  _setmode(_fileno(stdin), _O_BINARY);
  _setmode(_fileno(stdout), _O_BINARY);
#endif

  HostState state;
  state.engine = feq_engine_create(state.sample_rate, state.channels,
                                   state.block_frames);
  if (state.engine == nullptr) {
    std::fprintf(stderr, "FluidEQ-DSP: engine could not be created\n");
    return 1;
  }

  /**
   * Allocated once for the life of the process, and switched off.
   *
   * Off because the DSP tab is one of several and is usually closed; the
   * renderer turns it on when the panel mounts. Allocated up front because the
   * alternative is allocating buffers on the first block after a command,
   * which is the audio thread's problem and not the control thread's.
   *
   * A null result is not fatal. The meters are a display; an engine that
   * refused to start over a spectrum would be a worse trade than a panel with
   * still graphs, and `capture` already treats null as "nobody is looking".
   */
  state.meters = feq_meters_create(state.channels);

  std::unique_ptr<IAudioOutputBackend> backend =
      create_audio_backend(&render_bridge, &state);
  /**
   * Started before the handshake, so a parent that dies during start-up still
   * takes this process with it.
   *
   * The supervisor's `stop` and the stdin EOF both handle an orderly exit.
   * This handles the one that strands a process: Electron force-killed, no
   * shutdown sent, no `kill` called, and this process potentially blocked
   * inside `fwrite` on a pipe nobody is draining any more.
   */
  g_backend_for_exit = backend.get();
  const uint32_t parent_pid = parent_pid_from(argc, argv);
  feq_watch_parent(parent_pid, &release_device_on_parent_exit);
  send_handshake(backend->name());
  std::fprintf(stderr,
               "FluidEQ-DSP: host ready backend=%s parentPid=%u fallbackRate=%u "
               "channels=%u blockFrames=%u\n",
               backend->name(), parent_pid, state.sample_rate, state.channels,
               state.block_frames);

  // Built once and handed to every player: the decoder is stateless and the
  // per-file state lives behind the handle it returns.
  const FeqDecoderOps decoder_ops = feq_decoder_ops();
  feq_chain_settings_defaults(&state.chain_settings);
  /**
   * Built before any device exists, at the fallback rate.
   *
   * `START` rebuilds both around whatever the endpoint actually agreed to, so
   * this pair is not the one that plays. It is what makes the host usable with
   * no device at all: an offline render is a real capability the parity harness
   * and any future export both need, and until it works end to end there is
   * nothing worth attaching a device to.
   */
  rebuild_chain_and_player(state, decoder_ops);

  std::vector<double> snapshot(FEQ_PARAMETER_COUNT, 0.0);
  uint32_t snapshot_revision = 0;

  std::atomic<bool> publishing{true};
  std::thread telemetry([&] {
    /*
     * Prime the CPU difference here, and throw the answer away.
     *
     * A percentage is a difference between two readings and the first call has
     * only one. Whatever it returned would be a number about starting up
     * printed in a column that is read as "what the engine is doing now", so
     * the first frame anybody sees is deliberately a real half-second interval
     * instead. Until it arrives the app draws its dash, which is what a dash
     * there means.
     */
    FeqProcessStats primed{};
    feq_sample_process_stats(&primed);
    int stats_ticks = 0;
    while (publishing.load(std::memory_order_acquire)) {
      reopen_if_device_changed(state, *backend, decoder_ops);
      drain_telemetry(state, *backend);
      // Same thread as telemetry, deliberately: this is where the transforms
      // are allowed to happen, and giving them a thread of their own would add
      // a second writer to stdout for no gain.
      drain_analysis(state);
      stats_ticks += 1;
      if (stats_ticks >= kStatsIntervalTicks) {
        stats_ticks = 0;
        publish_process_stats();
      }
      std::this_thread::sleep_for(
          std::chrono::milliseconds(kTelemetryIntervalMs));
    }
    drain_telemetry(state, *backend);
  });

  /**
   * The decoder thread: the only one that may touch a file.
   *
   * It fills whatever room the decks have and then waits. The wait is not a
   * race being papered over — a ring that is full has nothing to be done about
   * until the audio thread takes some, and there is no useful signal to block
   * on that would not cost a lock the callback might contend for. Five
   * milliseconds against a two-second read-ahead is four hundred times more
   * often than it needs to be, which is the margin.
   *
   * `load` and `seek` are handled on the control thread, which is a second
   * writer to the same decoder. That is safe only because the control thread
   * takes `decoder_mutex` and this thread does too — a mutex the AUDIO thread
   * never touches, which is the rule that matters.
   */
  std::atomic<bool> decoding{true};
  std::thread decoder([&] {
    while (decoding.load(std::memory_order_acquire)) {
      uint32_t produced = 0;
      {
        const std::lock_guard<std::mutex> held(state.decoder_mutex);
        if (state.player != nullptr) {
          produced = feq_player_pump(state.player);
        }
      }
      if (produced == 0) {
        std::this_thread::sleep_for(std::chrono::milliseconds(5));
      }
    }
  });

  bool running = true;
  while (running) {
    FeqWireCommandFrame frame{};
    if (!read_exact(&frame, sizeof(frame))) {
      // The parent closed the pipe. An ordinary shutdown, not a fault:
      // Electron exiting takes its children with it, and there is nothing to
      // report to a process that has already gone.
      std::fprintf(stderr,
                   "FluidEQ-DSP: control pipe closed; orderly shutdown\n");
      break;
    }
    if (frame.magic != FEQ_MAGIC_COMMAND ||
        frame.protocol_version != FEQ_WIRE_PROTOCOL_VERSION) {
      send_ack(frame.request_id, FEQ_WIRE_UNSUPPORTED, 0, 0, 0.0);
      continue;
    }

    switch (frame.command) {
      case FEQ_CMD_HELLO:
        send_ack(frame.request_id, FEQ_WIRE_APPLIED, frame.settings_revision, 0,
                 0.0);
        break;

      case FEQ_CMD_START: {
        /**
         * Already serving audio: say so and change nothing.
         *
         * Everything below rebuilds the engine, the chain and the player, and
         * that is only safe while no callback can be inside them. The comment
         * on `rebuild_chain_and_player` says exactly that, and it was true for
         * the path it was written for — `open` negotiates, the rebuild happens,
         * and only then does `start` let a callback in.
         *
         * A SECOND start breaks the assumption, because `open` returns early
         * when the endpoint is already held and never stops the render thread.
         * The rebuild then destroyed the chain and the player out from under a
         * callback that was calling `feq_player_render` on them — a
         * use-after-free, which showed up as the engine going silent after the
         * renderer reloaded.
         *
         * And a reload is precisely when it happens: main owns the supervisor
         * and does not reload with the window, so the fresh renderer finds a
         * host that is already up and asks it to start again.
         *
         * A caller that genuinely wants a different device sends STOP first,
         * which closes the endpoint and joins the render thread. That is the
         * ordering the rebuild has always required.
         */
        state.device_wanted.store(true, std::memory_order_release);
        const std::lock_guard<std::mutex> device_held(state.device_mutex);
        if (backend->is_running()) {
          std::fprintf(stderr,
                       "FluidEQ-DSP: device start reused rate=%u channels=%u "
                       "blockFrames=%u\n",
                       state.sample_rate, state.channels, state.block_frames);
          send_ack(frame.request_id, FEQ_WIRE_APPLIED, frame.settings_revision,
                   0, static_cast<double>(state.sample_rate));
          break;
        }
        std::string error;
        FeqBackendFormat negotiated{};
        if (!backend->open(negotiated, error)) {
          std::fprintf(stderr, "FluidEQ-DSP: %s\n", error.c_str());
          /**
           * A machine with no output endpoint is UNSUPPORTED, not REJECTED.
           *
           * Both mean the device did not open and the app treats them alike,
           * so nothing downstream changes. What it buys is a caller that can
           * tell a build agent with no sound card from a device that exists
           * and would not open — the second is a defect and the first is a
           * fact about the hardware, and reporting them identically is what
           * left the weekly cold build failing on a missing sound card.
           */
          send_ack(frame.request_id,
                   backend->endpoint_absent() ? FEQ_WIRE_UNSUPPORTED
                                              : FEQ_WIRE_REJECTED,
                   0, 0, 0.0);
          break;
        }
        state.sample_rate = negotiated.sample_rate;
        state.channels =
            negotiated.channels < kEngineChannels ? negotiated.channels
                                                  : kEngineChannels;
        state.block_frames = negotiated.max_block_frames;
        if (!rebuild_engine(state, snapshot, snapshot_revision) ||
            !rebuild_chain_and_player(state, decoder_ops) ||
            !backend->start(error)) {
          std::fprintf(stderr, "FluidEQ-DSP: %s\n", error.c_str());
          backend->close();
          send_ack(frame.request_id, FEQ_WIRE_REJECTED, 0, 0, 0.0);
          break;
        }
        std::fprintf(stderr,
                     "FluidEQ-DSP: device started backend=%s rate=%u "
                     "channels=%u blockFrames=%u\n",
                     backend->name(), state.sample_rate, state.channels,
                     state.block_frames);
        send_ack(frame.request_id, FEQ_WIRE_APPLIED, frame.settings_revision, 0,
                 static_cast<double>(state.sample_rate));
        break;
      }

      case FEQ_CMD_STOP: {
        state.device_wanted.store(false, std::memory_order_release);
        const std::lock_guard<std::mutex> device_held(state.device_mutex);
        const bool was_open = backend->is_open();
        const bool was_running = backend->is_running();
        // The endpoint is released, not paused. A held-open device keeps the
        // hardware awake, which is audible on a DAC as its own noise floor in
        // a room where nothing is playing.
        backend->close();
        std::fprintf(stderr,
                     "FluidEQ-DSP: device stopped wasOpen=%u wasRunning=%u\n",
                     was_open ? 1u : 0u, was_running ? 1u : 0u);
        send_ack(frame.request_id, FEQ_WIRE_APPLIED, frame.settings_revision, 0,
                 0.0);
        break;
      }

      case FEQ_CMD_SET_PARAMETER: {
        const FeqStatus status = feq_engine_set_parameter(
            state.engine, frame.parameter_id, frame.parameter_index,
            frame.value, frame.settings_revision);
        send_ack(frame.request_id,
                 status == FEQ_OK ? FEQ_WIRE_APPLIED : FEQ_WIRE_REJECTED,
                 frame.settings_revision, 0, frame.value);
        break;
      }

      case FEQ_CMD_APPLY_SNAPSHOT: {
        if (frame.parameter_id != static_cast<uint32_t>(FEQ_PARAMETER_COUNT)) {
          // A renderer built against a different table. Refused whole rather
          // than applied partially: half a preset is a chain no user chose.
          send_ack(frame.request_id, FEQ_WIRE_REJECTED, 0, 0, 0.0);
          break;
        }
        if (!read_exact(snapshot.data(), snapshot.size() * sizeof(double))) {
          running = false;
          break;
        }
        snapshot_revision = frame.settings_revision;
        FeqConfigV1 config{};
        config.abi_version = FEQ_ABI_VERSION;
        config.settings_revision = frame.settings_revision;
        config.parameter_count = static_cast<uint32_t>(snapshot.size());
        config.parameter_values = snapshot.data();
        FeqStatus status = feq_engine_prepare_config(state.engine, &config);
        if (status == FEQ_OK) {
          status = feq_engine_commit_prepared_config(state.engine);
        }
        send_ack(frame.request_id,
                 status == FEQ_OK ? FEQ_WIRE_APPLIED : FEQ_WIRE_REJECTED,
                 frame.settings_revision, 0, 0.0);
        break;
      }

      case FEQ_CMD_SET_DIAGNOSTIC_SIGNAL:
        state.source.configure(
            frame.parameter_id == 0 ? SignalKind::Silence : SignalKind::Sine,
            frame.value);
        send_ack(frame.request_id, FEQ_WIRE_APPLIED, frame.settings_revision, 0,
                 frame.value);
        break;

      case FEQ_CMD_RUN_OFFLINE_BLOCKS: {
        if (backend->is_running()) {
          // Two producers into one engine would interleave their blocks and
          // both readings would be wrong. Offline rendering is for a device
          // that is not running, which is exactly when it is useful.
          send_ack(frame.request_id, FEQ_WIRE_REJECTED, 0, 0, 0.0);
          break;
        }
        std::vector<float> left(state.block_frames, 0.0f);
        std::vector<float> right(state.block_frames, 0.0f);
        float* planar[2] = {left.data(), right.data()};
        for (uint32_t block = 0; block < frame.parameter_id; ++block) {
          pump_decks(state);
          render_bridge(&state, planar, state.block_frames);
        }
        send_ack(frame.request_id, FEQ_WIRE_APPLIED, frame.settings_revision,
                 static_cast<uint64_t>(frame.parameter_id) * state.block_frames,
                 0.0);
        break;
      }

      case FEQ_CMD_LOAD_VOICE_MODEL: {
        if (frame.parameter_id == 0) {
          const std::lock_guard<std::mutex> device_held(state.device_mutex);
          if (state.chain != nullptr) {
            feq_chain_load_voice_model(state.chain, nullptr, nullptr);
          }
          state.voice_model_path.clear();
          state.voice_runtime_path.clear();
          send_ack(frame.request_id, FEQ_WIRE_APPLIED, frame.settings_revision,
                   0, 0.0);
          break;
        }
        // Two paths and the newline between them, so twice the ceiling plus
        // one. Checked before the string is sized — see `payload_within`.
        if (!payload_within(frame.parameter_id, 2u * kMaxPathBytes + 1u,
                            "voice model payload")) {
          running = false;
          break;
        }
        std::string payload(frame.parameter_id, '\0');
        if (!read_exact(payload.data(), payload.size())) {
          running = false;
          break;
        }
        const size_t split = payload.find('\n');
        if (split == std::string::npos) {
          send_ack(frame.request_id, FEQ_WIRE_REJECTED, 0, 0, 0.0);
          break;
        }
        const std::string model = payload.substr(0, split);
        const std::string runtime = payload.substr(split + 1);
        // Loading builds a session and starts a worker, so it happens here on
        // the control thread and never from the callback. A refusal is
        // reported rather than swallowed: the card distinguishes "no model" it
        // asked for from one it thought it had.
        int loaded = 0;
        {
          // A default-device notification can rebuild the chain on the
          // telemetry thread. Loading and remembering the model are one
          // operation under the same lock, so the rebuild sees either the
          // old successful pair or the new successful pair, never half of
          // one.
          const std::lock_guard<std::mutex> device_held(state.device_mutex);
          loaded = state.chain != nullptr
                       ? feq_chain_load_voice_model(state.chain, model.c_str(),
                                                    runtime.c_str())
                       : 0;
          if (loaded != 0) {
            state.voice_model_path = model;
            state.voice_runtime_path = runtime;
          }
        }
        send_ack(frame.request_id,
                 loaded != 0 ? FEQ_WIRE_APPLIED : FEQ_WIRE_REJECTED,
                 frame.settings_revision, 0, 0.0);
        break;
      }

      case FEQ_CMD_SET_NOISE_PROFILE: {
        // Length zero clears it. A track with no scan must not inherit the
        // previous song's floor: subtracting one recording's hiss from another
        // is audible and there is nothing on screen that would explain it.
        if (frame.parameter_id == 0) {
          if (state.chain != nullptr) {
            feq_chain_set_noise_profile(state.chain, nullptr);
          }
          send_ack(frame.request_id, FEQ_WIRE_APPLIED, frame.settings_revision,
                   0, 0.0);
          break;
        }
        if (frame.parameter_id != FEQ_DENOISE_PROFILE_WIRE) {
          send_ack(frame.request_id, FEQ_WIRE_REJECTED, 0, 0, 0.0);
          break;
        }
        std::vector<double> values(FEQ_DENOISE_PROFILE_WIRE, 0.0);
        if (!read_exact(values.data(), values.size() * sizeof(double))) {
          running = false;
          break;
        }
        FeqNoiseProfile profile{};
        size_t at = 0;
        for (uint32_t band = 0; band < FEQ_DENOISE_PROFILE_BANDS; band += 1) {
          profile.bands_db[band] = values[at++];
        }
        profile.floor_dbfs = values[at++];
        profile.hum_hz = values[at++];
        const double count = values[at++];
        profile.hum_partial_count = static_cast<uint32_t>(
            count > 0 && count <= FEQ_DENOISE_MAX_HUM_PARTIALS ? count : 0);
        for (uint32_t i = 0; i < FEQ_DENOISE_MAX_HUM_PARTIALS; i += 1) {
          profile.hum_partial_hz[i] = values[at++];
        }
        for (uint32_t i = 0; i < FEQ_DENOISE_MAX_HUM_PARTIALS; i += 1) {
          profile.hum_partial_excess_db[i] = values[at++];
        }
        if (state.chain != nullptr) {
          feq_chain_set_noise_profile(state.chain, &profile);
        }
        send_ack(frame.request_id, FEQ_WIRE_APPLIED, frame.settings_revision, 0,
                 0.0);
        break;
      }

      case FEQ_CMD_APPLY_CHAIN: {
        // The decoder checks the exact length too, but it is handed a vector
        // that has already been allocated. This is the same ceiling, reached
        // one step earlier — see `kMaxChainParams`.
        if (!payload_within(frame.parameter_id, kMaxChainParams,
                            "chain payload")) {
          running = false;
          break;
        }
        std::vector<double> values(frame.parameter_id, 0.0);
        if (frame.parameter_id > 0 &&
            !read_exact(values.data(), values.size() * sizeof(double))) {
          running = false;
          break;
        }
        FeqChainSettings settings{};
        if (feq_chain_settings_decode(values.data(), frame.parameter_id,
                                      &settings) == 0) {
          // Refused whole rather than applied partially: half a chain is a
          // signal path nobody chose, and the layout is versioned by its own
          // length so a mismatch is knowable rather than guessable.
          send_ack(frame.request_id, FEQ_WIRE_REJECTED, 0, 0, 0.0);
          break;
        }
        state.chain_settings = settings;
        if (state.chain != nullptr) {
          feq_chain_configure(state.chain, &state.chain_settings);
        }
        send_ack(frame.request_id, FEQ_WIRE_APPLIED, frame.settings_revision, 0,
                 0.0);
        break;
      }

      case FEQ_CMD_LOAD_DECK: {
        if (!payload_within(frame.parameter_id, kMaxPathBytes, "deck path")) {
          running = false;
          break;
        }
        std::string path(frame.parameter_id, '\0');
        if (frame.parameter_id > 0 &&
            !read_exact(path.data(), path.size())) {
          running = false;
          break;
        }
        const auto deck = static_cast<uint32_t>(frame.parameter_index);
        bool loaded = false;
        {
          const std::lock_guard<std::mutex> held(state.decoder_mutex);
          if (state.player != nullptr) {
            loaded = feq_player_load(state.player, deck, path.c_str()) != 0;
          }
        }
        if (loaded) {
          state.player_has_source.store(true, std::memory_order_release);
          // A new source, not an A/B toggle: every delayed sample belongs to
          // the previous track and would play on under this one's gain.
          if (state.chain != nullptr) {
            feq_chain_reset(state.chain, FEQ_CHAIN_RESET_SOURCE_CHANGE);
          }
        }
        send_ack(frame.request_id,
                 loaded ? FEQ_WIRE_APPLIED : FEQ_WIRE_REJECTED,
                 frame.settings_revision, 0, 0.0);
        break;
      }

      case FEQ_CMD_UNLOAD_DECK: {
        const std::lock_guard<std::mutex> held(state.decoder_mutex);
        if (state.player != nullptr) {
          feq_player_unload(state.player,
                            static_cast<uint32_t>(frame.parameter_index));
        }
        send_ack(frame.request_id, FEQ_WIRE_APPLIED, frame.settings_revision, 0,
                 0.0);
        break;
      }

      case FEQ_CMD_SET_PLAYING:
        if (state.player != nullptr) {
          feq_player_set_playing(state.player,
                                 frame.parameter_id != 0 ? 1 : 0);
        }
        send_ack(frame.request_id, FEQ_WIRE_APPLIED, frame.settings_revision, 0,
                 0.0);
        break;

      case FEQ_CMD_SEEK_DECK: {
        bool sought = false;
        {
          const std::lock_guard<std::mutex> held(state.decoder_mutex);
          if (state.player != nullptr) {
            sought = feq_player_seek(state.player,
                                     static_cast<uint32_t>(
                                         frame.parameter_index),
                                     frame.value) != 0;
          }
        }
        if (sought && state.chain != nullptr) {
          feq_chain_reset(state.chain, FEQ_CHAIN_RESET_SEEK);
        }
        send_ack(frame.request_id,
                 sought ? FEQ_WIRE_APPLIED : FEQ_WIRE_REJECTED,
                 frame.settings_revision, 0, frame.value);
        break;
      }

      case FEQ_CMD_SELECT_DECK:
        if (state.player != nullptr) {
          feq_player_select(state.player,
                            static_cast<uint32_t>(frame.parameter_index));
        }
        send_ack(frame.request_id, FEQ_WIRE_APPLIED, frame.settings_revision, 0,
                 0.0);
        break;

      case FEQ_CMD_CROSSFADE:
        if (state.player != nullptr) {
          feq_player_start_crossfade(
              state.player, static_cast<uint32_t>(frame.parameter_index),
              frame.value,
              static_cast<FeqCrossfadeCurve>(
                  static_cast<int>(frame.parameter_id)));
        }
        send_ack(frame.request_id, FEQ_WIRE_APPLIED, frame.settings_revision, 0,
                 frame.value);
        break;

      case FEQ_CMD_SET_CROSSFADE_TABLE: {
        // Read before the player check so a refused table still drains its
        // payload: leaving 128 doubles in the pipe desynchronises every
        // command after it, which reads as the host ignoring the transport.
        double points[FEQ_CROSSFADE_TABLE_POINTS * 2] = {0.0};
        if (!read_exact(points, sizeof(points))) {
          running = false;
          break;
        }
        if (state.player != nullptr) {
          FeqCrossfadeTable table;
          for (int at = 0; at < FEQ_CROSSFADE_TABLE_POINTS; ++at) {
            table.outgoing[at] = static_cast<float>(points[at]);
            table.incoming[at] =
                static_cast<float>(points[FEQ_CROSSFADE_TABLE_POINTS + at]);
          }
          feq_player_set_crossfade_table(state.player, &table);
        }
        send_ack(frame.request_id, FEQ_WIRE_APPLIED, frame.settings_revision, 0,
                 0.0);
        break;
      }

      case FEQ_CMD_SET_TRACK_GAINS: {
        // Two doubles, because they always arrive together: split across two
        // commands a track would play for a block with one applied and not
        // the other, which is the level step the ramp exists to prevent.
        double gains[2] = {0.0, 0.0};
        if (!read_exact(gains, sizeof(gains))) {
          running = false;
          break;
        }
        if (state.chain != nullptr) {
          feq_chain_set_track_level_gains(state.chain, gains[0], gains[1],
                                          frame.parameter_id != 0 ? 1 : 0);
        }
        send_ack(frame.request_id, FEQ_WIRE_APPLIED, frame.settings_revision, 0,
                 gains[0]);
        break;
      }

      case FEQ_CMD_SET_VOLUME: {
        // Clamped here as well as in the renderer. A gain above one is a
        // listener asking to clip, and a non-finite one silences the track for
        // as long as it takes somebody to notice.
        const double wanted = frame.value;
        const float clamped = static_cast<float>(
            !(wanted >= 0.0) ? 0.0 : (wanted > 1.0 ? 1.0 : wanted));
        state.volume.store(clamped, std::memory_order_relaxed);
        send_ack(frame.request_id, FEQ_WIRE_APPLIED, frame.settings_revision, 0,
                 static_cast<double>(clamped));
        break;
      }

      case FEQ_CMD_SET_ANALYSIS: {
        const int wanted = frame.parameter_id != 0 ? 1 : 0;
        feq_meters_set_enabled(state.meters, wanted);
        std::fprintf(stderr, "FluidEQ-DSP: analysis %s\n",
                     wanted != 0 ? "enabled" : "disabled");
        send_ack(frame.request_id, FEQ_WIRE_APPLIED, frame.settings_revision, 0,
                 static_cast<double>(wanted));
        break;
      }

      case FEQ_CMD_RENDER_TO_FILE: {
        if (backend->is_running()) {
          // Two producers into one chain interleave their blocks and both
          // results are wrong. Offline rendering is for a device that is not
          // running, which is exactly when it is useful.
          send_ack(frame.request_id, FEQ_WIRE_REJECTED, 0, 0, 0.0);
          break;
        }
        uint32_t path_bytes = 0;
        if (!wire_length_from_double(frame.value, kMaxPathBytes, &path_bytes)) {
          running = false;
          break;
        }
        std::string path(path_bytes, '\0');
        if (!path.empty() && !read_exact(path.data(), path.size())) {
          running = false;
          break;
        }

        const uint32_t total = frame.parameter_id;
        /*
         * A WAV cannot say how long this would be, so it is not a WAV.
         *
         * `write_float_wav` stores the data length in the 32-bit field the
         * format gives it, and `static_cast<uint32_t>` of anything past that
         * TRUNCATES — the file would be written in full and its header would
         * describe a fraction of it, which every reader on the other side
         * believes. Refusing here is the honest answer, and it doubles as the
         * ceiling that keeps the reserve below from being asked for 34 GB.
         */
        // `state.channels` is `min(negotiated, 2)` with no floor under it, so a
        // backend that negotiated nothing would divide by zero here. One is the
        // smallest divisor that keeps this a ceiling rather than a crash; a
        // zero-channel endpoint has larger problems than its export limit.
        const uint32_t render_channels =
            state.channels < 1u ? 1u : state.channels;
        const uint32_t max_render_frames =
            (0xFFFFFFFFu - 64u) /
            (render_channels * static_cast<uint32_t>(sizeof(float)));
        if (total > max_render_frames) {
          // Answered rather than fatal, unlike the length checks above: this
          // count sits in the frame itself and nothing follows it in the pipe,
          // so the stream is still in step and the caller can be told no.
          std::fprintf(stderr,
                       "FluidEQ-DSP: render of %u frames exceeds what a WAV "
                       "can address (%u)\n",
                       total, max_render_frames);
          send_ack(frame.request_id, FEQ_WIRE_REJECTED, 0, 0, 0.0);
          break;
        }
        std::vector<float> left(state.block_frames, 0.0f);
        std::vector<float> right(state.block_frames, 0.0f);
        float* planar[2] = {left.data(), right.data()};
        std::vector<float> out;
        /*
         * The one allocation here that a WELL-FORMED request can still fail.
         *
         * Every other length on this path is now bounded by what the protocol
         * or the WAV format can express, so an oversized one is a
         * desynchronised stream and stops the loop. This one is different: a
         * three-hour render is a legitimate ask that a machine may simply not
         * have the memory for, and the whole render is accumulated before it is
         * written. Without this the failure is `std::terminate` — the engine
         * vanishes mid-session and the log says nothing — instead of the export
         * being refused while playback carries on.
         */
        try {
          out.reserve(static_cast<size_t>(total) * state.channels);
        } catch (const std::bad_alloc&) {
          std::fprintf(stderr,
                       "FluidEQ-DSP: not enough memory to render %u frames\n",
                       total);
          send_ack(frame.request_id, FEQ_WIRE_REJECTED, 0, 0, 0.0);
          break;
        }

        for (uint32_t at = 0; at < total; at += state.block_frames) {
          const uint32_t span = total - at < state.block_frames
                                    ? total - at
                                    : state.block_frames;
          pump_decks(state);
          render_bridge(&state, planar, span);
          // Interleaved on the way out, which is what a WAV holds and what
          // every reader on the other side expects.
          for (uint32_t frame_at = 0; frame_at < span; ++frame_at) {
            for (uint32_t channel = 0; channel < state.channels; ++channel) {
              out.push_back(planar[channel][frame_at]);
            }
          }
        }

        const bool written =
            write_float_wav(path, out, state.sample_rate, state.channels);
        send_ack(frame.request_id,
                 written ? FEQ_WIRE_APPLIED : FEQ_WIRE_REJECTED,
                 frame.settings_revision, total, 0.0);
        break;
      }

      case FEQ_CMD_SHUTDOWN:
        std::fprintf(stderr,
                     "FluidEQ-DSP: shutdown command acknowledged\n");
        send_ack(frame.request_id, FEQ_WIRE_APPLIED, frame.settings_revision, 0,
                 0.0);
        running = false;
        break;

      default:
        send_ack(frame.request_id, FEQ_WIRE_UNSUPPORTED, 0, 0, 0.0);
        break;
    }
  }

  // Device first: the real-time thread reads the engine, so the engine must
  // outlive it by the whole of this shutdown.
  backend->close();
  decoding.store(false, std::memory_order_release);
  decoder.join();
  publishing.store(false, std::memory_order_release);
  telemetry.join();
  // The player before the chain before the engine, which is the reverse of the
  // order they are read in: nothing may be destroyed while a thread above it
  // could still be holding a pointer into it.
  feq_player_destroy(state.player);
  feq_chain_destroy(state.chain);
  // After the chain, which holds a borrowed pointer to it.
  feq_meters_destroy(state.meters);
  feq_engine_destroy(state.engine);
  std::fprintf(stderr, "FluidEQ-DSP: host stopped cleanly\n");
  return 0;
}
