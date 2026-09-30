/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What the host's parts share: the state every thread reads, and the calls
 * each part makes into another. Which thread may do what is main.cpp's
 * header.
 */
#ifndef FLUIDEQ_HOST_H
#define FLUIDEQ_HOST_H

#include "analysis_publication.h"
#include "audio_backend.h"
#include "chain_route.h"
#include "processing_latency.h"
#include "fluideq/chain.h"
#include "fluideq/doorbell.h"
#include "fluideq/dsp.h"
#include "fluideq/meters.h"
#include "fluideq/parameters.h"
#include "fluideq/player.h"
#include "wire.h"

#include <atomic>
#include <cmath>
#include <cstddef>
#include <cstdint>
#include <mutex>
#include <string>
#include <vector>

namespace feq_host {

constexpr uint32_t kFallbackSampleRate = 48000;
constexpr uint32_t kFallbackBlockFrames = 512;
constexpr uint32_t kEngineChannels = 2;

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
  ProcessingLatency processing_latency;
  ChainRoute chain_route;
  AnalysisPublication analysis_publication;
  std::atomic<bool> raw_sharing{false};
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
   * Where the shipped heads for the room are (`--room-heads`), and which
   * one the current chain was given, so a slider drag — a reconfigure per
   * frame — does not re-read half a megabyte each time. -1 is none yet; a
   * rebuild starts a chain with no head and sets this back.
   */
  std::string room_heads_dir;
  int room_head_loaded = -1;
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
   * What the decoder thread sleeps on.
   *
   * Armed by the audio thread when the decks gave up frames — room in the
   * read-ahead is the decoder's only work while a track plays — and rung by
   * the control thread whenever it changes what the decks hold. The decoder
   * used to sleep 5 ms and look, two hundred times a second, with two seconds
   * already buffered and whether or not anything played.
   */
  FeqDoorbell decoder_bell;
  /** Audio thread (or an offline render, which never runs beside it): the
   *  frames the decks had given up when the decoder was last armed. */
  uint64_t frames_taken_armed = 0;
  /**
   * What the telemetry thread sleeps on.
   *
   * Armed by the audio thread when the engine publishes a report — about
   * forty a second of audio, which is the rate the panel has always been fed
   * at, now kept by the music rather than by a 25 ms sleep that went on
   * ticking with the device closed. Rung as well when the device wants
   * reopening, when a command left the process changed with no device
   * running (`stats_wanted`), and to stop.
   */
  FeqDoorbell telemetry_bell;
  /** Audio thread (or an offline render, which never runs beside it). */
  uint64_t reports_seen = 0;
  /** A process sample is owed for work done with no audio to count it by. */
  std::atomic<bool> stats_wanted{false};
  /**
   * Guards the decoder against its two writers.
   *
   * The decoder thread pumps; the control thread loads and seeks. Both touch
   * the same decoder handle, so both take this. The AUDIO thread never does —
   * it only reads the rings, which are lock-free by construction, and a
   * callback waiting on a mutex the decoder thread holds is a dropout with no
   * bug in it. The deck bookkeeping below is under it too.
   */
  std::mutex decoder_mutex;
  /** What a deck holds as far as loading goes: the file, and where it was cued. */
  struct DeckNote {
    std::string path;
    double cue_seconds = 0.0;
    /** Readied as the next track and not heard since, so a handoff can take it
     *  as it is instead of loading the file again. */
    bool fresh = false;
  };
  DeckNote deck_notes[FEQ_PLAYER_DECKS];
  /**
   * The track the queue moves to next, which the renderer names at any time
   * and this side readies on the free deck the moment there is one.
   *
   * The renderer used to load it itself, and could not know when that moment
   * was: during a fade both decks are heard, only the player knows when the
   * fade ends, and a guess made off a clock loaded the next track onto the
   * deck still fading out. Named here, it waits for `ready_spare` to find a
   * deck free — at the fade's end, on the decoder thread's next pass.
   */
  std::string spare_path;
  double spare_seconds = 0.0;
  bool spare_wanted = false;
  /**
   * A deck a handoff has loaded, waiting for the fade or cut that makes it
   * heard. The next track may not be readied onto it in between: the load
   * and the fade are two commands, and the decoder thread can run between
   * them.
   */
  uint32_t reserved_deck = FEQ_PLAYER_DECKS;
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
   * The retry runs on the telemetry thread once per change Windows reports
   * while the outage lasts — a headset re-enumerating reports several — so a
   * line per attempt would bury the one that says what happened. Touched
   * only under `device_mutex`, which every reopen already holds.
   */
  bool reopen_failure_reported{false};
  /**
   * The engine's last whole parameter snapshot, and its revision: a START
   * applies it again to the engine it rebuilds. The control thread's alone.
   */
  std::vector<double> snapshot = std::vector<double>(FEQ_PARAMETER_COUNT, 0.0);
  uint32_t snapshot_revision = 0;
};

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
 * `LEAD + bands * BAND_PARAMS` plus a supported trailer — but the vector has already
 * been allocated, so the refusal comes one allocation too late. This is the
 * same arithmetic at its maximum, checked before the memory is asked for.
 */
constexpr uint32_t kMaxChainParams = FEQ_CHAIN_MAX_PARAMS;

/* host_wire.cpp: the control pipe in, whole frames out. */
bool read_exact(void* into, size_t bytes);
bool payload_within(uint32_t count, uint32_t ceiling, const char* what);
bool wire_length_from_double(double value, uint32_t ceiling, uint32_t* out);
bool write_frame(const void* from, size_t bytes);
void send_handshake(const char* backend_name);
void send_ack(uint32_t request_id,
              FeqWireStatus status,
              uint32_t revision,
              uint64_t applied_at,
              double sanitized);

/* host_telemetry.cpp: what the telemetry thread sends. */
void drain_analysis(HostState& state);
uint32_t drain_telemetry(HostState& state, const IAudioOutputBackend& backend);
void publish_process_stats();

/* host_audio.cpp: the audio thread's block, and the decks it plays. */
void render_bridge(void* context, float* const* planar, uint32_t frames);
void ring_what_the_block_armed(void* context);
void wake_telemetry(void* context);
void pump_decks(HostState& state);
void ready_spare(HostState& state);
void took_the_path(HostState& state, uint32_t deck);

/* host_device.cpp: the engine, chain and player, built around a device. */
bool rebuild_engine(HostState& state,
                    const std::vector<double>& snapshot,
                    uint32_t revision);
void apply_room_head(HostState& state, FeqChain* chain);
bool rebuild_chain_and_player(HostState& state, const FeqDecoderOps& ops);
void reopen_if_device_changed(HostState& state, IAudioOutputBackend& backend,
                              const FeqDecoderOps& decoder_ops);

/**
 * host_commands.cpp: one command from the control pipe, acted on and
 * answered. Whether the control loop reads another: false once a payload
 * could not be read or declared a length that is not one — the stream is
 * out of step and there is no safe number of bytes to skip — or once the
 * parent has said shut down.
 */
bool dispatch_command(HostState& state, IAudioOutputBackend& backend,
                      const FeqDecoderOps& decoder_ops,
                      const FeqWireCommandFrame& frame);

/*
 * host_deck_commands.cpp: the decks' commands. Those that read a payload
 * say whether the stream is still in step, as `dispatch_command` does.
 */
bool load_deck(HostState& state, const FeqWireCommandFrame& frame);
void unload_deck(HostState& state, const FeqWireCommandFrame& frame);
void seek_deck(HostState& state, const FeqWireCommandFrame& frame);
void select_deck(HostState& state, const FeqWireCommandFrame& frame);
void crossfade(HostState& state, const FeqWireCommandFrame& frame);
bool set_crossfade_table(HostState& state, const FeqWireCommandFrame& frame);
bool set_track_gains(HostState& state, const FeqWireCommandFrame& frame);

}  // namespace feq_host

#endif  // FLUIDEQ_HOST_H
