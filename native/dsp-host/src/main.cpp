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

void drain_telemetry(HostState& state, const IAudioOutputBackend& backend) {
  FeqTelemetryV1 record{};
  while (feq_engine_try_read_telemetry(state.engine, &record)) {
    const FeqBackendStats stats = backend.stats();
    FeqWireTelemetryFrame frame{};
    frame.magic = FEQ_MAGIC_TELEMETRY;
    frame.applied_revision = record.applied_revision;
    frame.sequence = record.sequence;
    frame.frames_processed = record.frames_processed;
    frame.latency_frames = record.latency_frames;
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
    write_frame(&frame, sizeof(frame));
  }
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
  feq_watch_parent(parent_pid_from(argc, argv), &release_device_on_parent_exit);
  send_handshake(backend->name());

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
    while (publishing.load(std::memory_order_acquire)) {
      drain_telemetry(state, *backend);
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
        std::string error;
        FeqBackendFormat negotiated{};
        if (!backend->open(negotiated, error)) {
          std::fprintf(stderr, "FluidEQ-DSP: %s\n", error.c_str());
          send_ack(frame.request_id, FEQ_WIRE_REJECTED, 0, 0, 0.0);
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
        send_ack(frame.request_id, FEQ_WIRE_APPLIED, frame.settings_revision, 0,
                 static_cast<double>(state.sample_rate));
        break;
      }

      case FEQ_CMD_STOP:
        // The endpoint is released, not paused. A held-open device keeps the
        // hardware awake, which is audible on a DAC as its own noise floor in
        // a room where nothing is playing.
        backend->close();
        send_ack(frame.request_id, FEQ_WIRE_APPLIED, frame.settings_revision, 0,
                 0.0);
        break;

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
          render_bridge(&state, planar, state.block_frames);
        }
        send_ack(frame.request_id, FEQ_WIRE_APPLIED, frame.settings_revision,
                 static_cast<uint64_t>(frame.parameter_id) * state.block_frames,
                 0.0);
        break;
      }

      case FEQ_CMD_APPLY_CHAIN: {
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

      case FEQ_CMD_RENDER_TO_FILE: {
        if (backend->is_running()) {
          // Two producers into one chain interleave their blocks and both
          // results are wrong. Offline rendering is for a device that is not
          // running, which is exactly when it is useful.
          send_ack(frame.request_id, FEQ_WIRE_REJECTED, 0, 0, 0.0);
          break;
        }
        std::string path(static_cast<size_t>(frame.value), '\0');
        if (!path.empty() && !read_exact(path.data(), path.size())) {
          running = false;
          break;
        }

        const uint32_t total = frame.parameter_id;
        std::vector<float> left(state.block_frames, 0.0f);
        std::vector<float> right(state.block_frames, 0.0f);
        float* planar[2] = {left.data(), right.data()};
        std::vector<float> out;
        out.reserve(static_cast<size_t>(total) * state.channels);

        for (uint32_t at = 0; at < total; at += state.block_frames) {
          const uint32_t span = total - at < state.block_frames
                                    ? total - at
                                    : state.block_frames;
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
  feq_engine_destroy(state.engine);
  return 0;
}
