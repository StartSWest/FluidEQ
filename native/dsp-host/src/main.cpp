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
#include "fluideq/dsp.h"
#include "fluideq/parameters.h"
#include "wire.h"

#include <atomic>
#include <chrono>
#include <cmath>
#include <cstdio>
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
  uint32_t sample_rate = kFallbackSampleRate;
  uint32_t channels = kEngineChannels;
  uint32_t block_frames = kFallbackBlockFrames;
  SignalSource source;
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
  state->source.render(planar, state->channels, frames);
  // On the stack, so nothing is allocated: adding const to a pointer array is
  // not an implicit conversion in C++, and the alternative is a cast that
  // hides what it is doing.
  const float* inputs[2] = {planar[0], state->channels > 1 ? planar[1]
                                                           : planar[0]};
  feq_engine_process_planar(state->engine, inputs, planar, frames);
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

}  // namespace

int main() {
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
    std::fprintf(stderr, "fluideq-dsp-host: engine could not be created\n");
    return 1;
  }

  std::unique_ptr<IAudioOutputBackend> backend =
      create_audio_backend(&render_bridge, &state);
  send_handshake(backend->name());

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
          std::fprintf(stderr, "fluideq-dsp-host: %s\n", error.c_str());
          send_ack(frame.request_id, FEQ_WIRE_REJECTED, 0, 0, 0.0);
          break;
        }
        state.sample_rate = negotiated.sample_rate;
        state.channels =
            negotiated.channels < kEngineChannels ? negotiated.channels
                                                  : kEngineChannels;
        state.block_frames = negotiated.max_block_frames;
        if (!rebuild_engine(state, snapshot, snapshot_revision) ||
            !backend->start(error)) {
          std::fprintf(stderr, "fluideq-dsp-host: %s\n", error.c_str());
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
  publishing.store(false, std::memory_order_release);
  telemetry.join();
  feq_engine_destroy(state.engine);
  return 0;
}
