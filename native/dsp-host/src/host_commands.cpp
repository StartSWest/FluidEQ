/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The control pipe's commands: the dispatch, and the device's, the engine's
 * and the chain's own. The decks' are host_deck_commands.cpp.
 *
 * A handler that reads a payload returns whether the stream is still in
 * step, as `dispatch_command` does (host.h).
 */
#include "host.h"

#include <cstdio>
#include <cstring>
#include <mutex>
#include <new>
#include <string>
#include <vector>

namespace feq_host {

namespace {

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

/**
 * START: the device opened, and the engine, the chain and the player rebuilt
 * around what it agreed to.
 */
void start_device(HostState& state, IAudioOutputBackend& backend,
                  const FeqDecoderOps& decoder_ops,
                  const FeqWireCommandFrame& frame) {
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
  if (backend.is_running()) {
    std::fprintf(stderr,
                 "FluidEQ-DSP: device start reused rate=%u channels=%u "
                 "blockFrames=%u\n",
                 state.sample_rate, state.channels, state.block_frames);
    send_ack(frame.request_id, FEQ_WIRE_APPLIED, frame.settings_revision,
             0, static_cast<double>(state.sample_rate));
    return;
  }
  std::string error;
  FeqBackendFormat negotiated{};
  if (!backend.open(negotiated, error)) {
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
             backend.endpoint_absent() ? FEQ_WIRE_UNSUPPORTED
                                       : FEQ_WIRE_REJECTED,
             0, 0, 0.0);
    return;
  }
  state.processing_latency.clear();
  state.sample_rate = negotiated.sample_rate;
  state.channels =
      negotiated.channels < kEngineChannels ? negotiated.channels
                                            : kEngineChannels;
  state.block_frames = negotiated.max_block_frames;
  if (!rebuild_engine(state, state.snapshot, state.snapshot_revision) ||
      !rebuild_chain_and_player(state, decoder_ops) ||
      !backend.start(error)) {
    std::fprintf(stderr, "FluidEQ-DSP: %s\n", error.c_str());
    backend.close();
    send_ack(frame.request_id, FEQ_WIRE_REJECTED, 0, 0, 0.0);
    return;
  }
  std::fprintf(stderr,
               "FluidEQ-DSP: device started backend=%s rate=%u "
               "channels=%u blockFrames=%u\n",
               backend.name(), state.sample_rate, state.channels,
               state.block_frames);
  send_ack(frame.request_id, FEQ_WIRE_APPLIED, frame.settings_revision, 0,
           static_cast<double>(state.sample_rate));
}

/** STOP: the endpoint released. */
void stop_device(HostState& state, IAudioOutputBackend& backend,
                 const FeqWireCommandFrame& frame) {
  state.device_wanted.store(false, std::memory_order_release);
  const std::lock_guard<std::mutex> device_held(state.device_mutex);
  const bool was_open = backend.is_open();
  const bool was_running = backend.is_running();
  // The endpoint is released, not paused. A held-open device keeps the
  // hardware awake, which is audible on a DAC as its own noise floor in
  // a room where nothing is playing.
  backend.close();
  std::fprintf(stderr,
               "FluidEQ-DSP: device stopped wasOpen=%u wasRunning=%u\n",
               was_open ? 1u : 0u, was_running ? 1u : 0u);
  send_ack(frame.request_id, FEQ_WIRE_APPLIED, frame.settings_revision, 0,
           0.0);
}

/** APPLY_SNAPSHOT: every engine parameter at once, kept for a rebuild. */
bool apply_snapshot(HostState& state, const FeqWireCommandFrame& frame) {
  if (frame.parameter_id != static_cast<uint32_t>(FEQ_PARAMETER_COUNT)) {
    // A renderer built against a different table. Refused whole rather
    // than applied partially: half a preset is a chain no user chose.
    send_ack(frame.request_id, FEQ_WIRE_REJECTED, 0, 0, 0.0);
    return true;
  }
  if (!read_exact(state.snapshot.data(),
                  state.snapshot.size() * sizeof(double))) {
    return false;
  }
  state.snapshot_revision = frame.settings_revision;
  FeqConfigV1 config{};
  config.abi_version = FEQ_ABI_VERSION;
  config.settings_revision = frame.settings_revision;
  config.parameter_count = static_cast<uint32_t>(state.snapshot.size());
  config.parameter_values = state.snapshot.data();
  FeqStatus status = feq_engine_prepare_config(state.engine, &config);
  if (status == FEQ_OK) {
    status = feq_engine_commit_prepared_config(state.engine);
  }
  send_ack(frame.request_id,
           status == FEQ_OK ? FEQ_WIRE_APPLIED : FEQ_WIRE_REJECTED,
           frame.settings_revision, 0, 0.0);
  return true;
}

/**
 * RUN_OFFLINE_BLOCKS: blocks through the whole path with no device running,
 * for what they leave behind — telemetry, a pre-rolled deck.
 */
void run_offline_blocks(HostState& state, const IAudioOutputBackend& backend,
                        const FeqWireCommandFrame& frame) {
  if (backend.is_running()) {
    // Two producers into one engine would interleave their blocks and
    // both readings would be wrong. Offline rendering is for a device
    // that is not running, which is exactly when it is useful.
    send_ack(frame.request_id, FEQ_WIRE_REJECTED, 0, 0, 0.0);
    return;
  }
  std::vector<float> left(state.block_frames, 0.0f);
  std::vector<float> right(state.block_frames, 0.0f);
  float* planar[2] = {left.data(), right.data()};
  for (uint32_t block = 0; block < frame.parameter_id; ++block) {
    pump_decks(state);
    render_bridge(&state, planar, state.block_frames);
    ring_what_the_block_armed(&state);
  }
  send_ack(frame.request_id, FEQ_WIRE_APPLIED, frame.settings_revision,
           static_cast<uint64_t>(frame.parameter_id) * state.block_frames,
           0.0);
}

/** LOAD_VOICE_MODEL: the voice cleaner's model and runtime, or none. */
bool load_voice_model(HostState& state, const FeqWireCommandFrame& frame) {
  if (frame.parameter_id == 0) {
    const std::lock_guard<std::mutex> device_held(state.device_mutex);
    if (state.chain != nullptr) {
      feq_chain_load_voice_model(state.chain, nullptr, nullptr);
    }
    state.voice_model_path.clear();
    state.voice_runtime_path.clear();
    send_ack(frame.request_id, FEQ_WIRE_APPLIED, frame.settings_revision,
             0, 0.0);
    return true;
  }
  // Two paths and the newline between them, so twice the ceiling plus
  // one. Checked before the string is sized — see `payload_within`.
  if (!payload_within(frame.parameter_id, 2u * kMaxPathBytes + 1u,
                      "voice model payload")) {
    return false;
  }
  std::string payload(frame.parameter_id, '\0');
  if (!read_exact(payload.data(), payload.size())) {
    return false;
  }
  const size_t split = payload.find('\n');
  if (split == std::string::npos) {
    send_ack(frame.request_id, FEQ_WIRE_REJECTED, 0, 0, 0.0);
    return true;
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
  return true;
}

/** SET_NOISE_PROFILE: a scanned track's noise for the restoration, or none. */
bool set_noise_profile(HostState& state, const FeqWireCommandFrame& frame) {
  // Length zero clears it. A track with no scan must not inherit the
  // previous song's floor: subtracting one recording's hiss from another
  // is audible and there is nothing on screen that would explain it.
  if (frame.parameter_id == 0) {
    if (state.chain != nullptr) {
      feq_chain_set_noise_profile(state.chain, nullptr);
    }
    send_ack(frame.request_id, FEQ_WIRE_APPLIED, frame.settings_revision,
             0, 0.0);
    return true;
  }
  if (frame.parameter_id != FEQ_DENOISE_PROFILE_WIRE) {
    send_ack(frame.request_id, FEQ_WIRE_REJECTED, 0, 0, 0.0);
    return true;
  }
  std::vector<double> values(FEQ_DENOISE_PROFILE_WIRE, 0.0);
  if (!read_exact(values.data(), values.size() * sizeof(double))) {
    return false;
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
  return true;
}

/** APPLY_CHAIN: the whole rack, decoded, applied and kept for a rebuild. */
bool apply_chain(HostState& state, const FeqWireCommandFrame& frame) {
  // The decoder checks the exact length too, but it is handed a vector
  // that has already been allocated. This is the same ceiling, reached
  // one step earlier — see `kMaxChainParams`.
  if (!payload_within(frame.parameter_id, kMaxChainParams,
                      "chain payload")) {
    return false;
  }
  std::vector<double> values(frame.parameter_id, 0.0);
  if (frame.parameter_id > 0 &&
      !read_exact(values.data(), values.size() * sizeof(double))) {
    return false;
  }
  FeqChainSettings settings{};
  if (feq_chain_settings_decode(values.data(), frame.parameter_id,
                                &settings) == 0) {
    // Refused whole rather than applied partially: half a chain is a
    // signal path nobody chose, and the layout is versioned by its own
    // length so a mismatch is knowable rather than guessable.
    send_ack(frame.request_id, FEQ_WIRE_REJECTED, 0, 0, 0.0);
    return true;
  }
  state.chain_settings = settings;
  if (state.chain != nullptr) {
    feq_chain_configure(state.chain, &state.chain_settings);
    apply_room_head(state, state.chain);
  }
  send_ack(frame.request_id, FEQ_WIRE_APPLIED, frame.settings_revision, 0,
           0.0);
  return true;
}

/** RENDER_TO_FILE: the whole path rendered offline into a float WAV. */
bool render_to_file(HostState& state, const IAudioOutputBackend& backend,
                    const FeqWireCommandFrame& frame) {
  if (backend.is_running()) {
    // Two producers into one chain interleave their blocks and both
    // results are wrong. Offline rendering is for a device that is not
    // running, which is exactly when it is useful.
    send_ack(frame.request_id, FEQ_WIRE_REJECTED, 0, 0, 0.0);
    return true;
  }
  uint32_t path_bytes = 0;
  if (!wire_length_from_double(frame.value, kMaxPathBytes, &path_bytes)) {
    return false;
  }
  std::string path(path_bytes, '\0');
  if (!path.empty() && !read_exact(path.data(), path.size())) {
    return false;
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
    return true;
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
    return true;
  }

  for (uint32_t at = 0; at < total; at += state.block_frames) {
    const uint32_t span = total - at < state.block_frames
                              ? total - at
                              : state.block_frames;
    pump_decks(state);
    render_bridge(&state, planar, span);
    ring_what_the_block_armed(&state);
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
  return true;
}

}  // namespace

bool dispatch_command(HostState& state, IAudioOutputBackend& backend,
                      const FeqDecoderOps& decoder_ops,
                      const FeqWireCommandFrame& frame) {
  switch (frame.command) {
    case FEQ_CMD_HELLO:
      send_ack(frame.request_id, FEQ_WIRE_APPLIED, frame.settings_revision, 0,
               0.0);
      return true;

    case FEQ_CMD_START:
      start_device(state, backend, decoder_ops, frame);
      return true;

    case FEQ_CMD_STOP:
      stop_device(state, backend, frame);
      return true;

    case FEQ_CMD_SET_PARAMETER: {
      const FeqStatus status = feq_engine_set_parameter(
          state.engine, frame.parameter_id, frame.parameter_index,
          frame.value, frame.settings_revision);
      send_ack(frame.request_id,
               status == FEQ_OK ? FEQ_WIRE_APPLIED : FEQ_WIRE_REJECTED,
               frame.settings_revision, 0, frame.value);
      return true;
    }

    case FEQ_CMD_APPLY_SNAPSHOT:
      return apply_snapshot(state, frame);

    case FEQ_CMD_SET_DIAGNOSTIC_SIGNAL:
      state.source.configure(
          frame.parameter_id == 0 ? SignalKind::Silence : SignalKind::Sine,
          frame.value);
      send_ack(frame.request_id, FEQ_WIRE_APPLIED, frame.settings_revision, 0,
               frame.value);
      return true;

    case FEQ_CMD_RUN_OFFLINE_BLOCKS:
      run_offline_blocks(state, backend, frame);
      return true;

    case FEQ_CMD_LOAD_VOICE_MODEL:
      return load_voice_model(state, frame);

    case FEQ_CMD_SET_NOISE_PROFILE:
      return set_noise_profile(state, frame);

    case FEQ_CMD_APPLY_CHAIN:
      return apply_chain(state, frame);

    case FEQ_CMD_LOAD_DECK:
      return load_deck(state, frame);

    case FEQ_CMD_UNLOAD_DECK:
      unload_deck(state, frame);
      return true;

    case FEQ_CMD_SET_PLAYING:
      if (state.player != nullptr) {
        feq_player_set_playing(state.player,
                               frame.parameter_id != 0 ? 1 : 0);
      }
      send_ack(frame.request_id, FEQ_WIRE_APPLIED, frame.settings_revision, 0,
               0.0);
      return true;

    case FEQ_CMD_SEEK_DECK:
      seek_deck(state, frame);
      return true;

    case FEQ_CMD_SELECT_DECK:
      select_deck(state, frame);
      return true;

    case FEQ_CMD_CROSSFADE:
      crossfade(state, frame);
      return true;

    case FEQ_CMD_SET_CROSSFADE_TABLE:
      return set_crossfade_table(state, frame);

    case FEQ_CMD_SET_TRACK_GAINS:
      return set_track_gains(state, frame);

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
      return true;
    }

    case FEQ_CMD_SET_RAW_SHARING:
      state.raw_sharing.store(frame.parameter_id != 0,
                              std::memory_order_release);
      send_ack(frame.request_id, FEQ_WIRE_APPLIED, 0, 0, 0.0);
      return true;

    case FEQ_CMD_SET_ANALYSIS: {
      const int wanted = frame.parameter_id != 0 ? 1 : 0;
      feq_meters_set_enabled(state.meters, wanted);
      std::fprintf(stderr, "FluidEQ-DSP: analysis %s\n",
                   wanted != 0 ? "enabled" : "disabled");
      send_ack(frame.request_id, FEQ_WIRE_APPLIED, frame.settings_revision, 0,
               static_cast<double>(wanted));
      return true;
    }

    case FEQ_CMD_RENDER_TO_FILE:
      return render_to_file(state, backend, frame);

    case FEQ_CMD_SHUTDOWN:
      std::fprintf(stderr,
                   "FluidEQ-DSP: shutdown command acknowledged\n");
      send_ack(frame.request_id, FEQ_WIRE_APPLIED, frame.settings_revision, 0,
               0.0);
      return false;

    default:
      send_ack(frame.request_id, FEQ_WIRE_UNSUPPORTED, 0, 0, 0.0);
      return true;
  }
}

}  // namespace feq_host
