/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Fixed-size binary frames, little-endian, over the child process's stdio.
 *
 * Binary and not JSON, because the alternative was a hand-rolled JSON reader
 * in C++ — a parser nobody would test as hard as it needs and that fails by
 * misreading a field rather than by refusing it. These frames have one layout,
 * one length, and a magic word that says which kind arrived; a frame that is
 * not exactly right is dropped rather than guessed at.
 *
 * Stdio and not a named pipe, which is what the spec first said. A supervised
 * child's stdio is private by construction: there is no endpoint for anything
 * else on the machine to connect to, so there is no token to invent, mint,
 * pass or leak. If the host ever needs to outlive its parent or be reached by
 * a second client, that is when it earns a real endpoint.
 *
 * Every field is naturally aligned and every frame is padded to a multiple of
 * eight, so the same struct can be memcpy'd on both sides without a packing
 * pragma changing the layout under one compiler and not the other.
 */
#ifndef FLUIDEQ_HOST_WIRE_H
#define FLUIDEQ_HOST_WIRE_H

#include <stdint.h>

#define FEQ_WIRE_PROTOCOL_VERSION 1

/* 'FEQ' plus a letter for the kind, so a desynchronised stream is obvious. */
#define FEQ_MAGIC_HANDSHAKE 0x48514546u /* FEQH */
#define FEQ_MAGIC_COMMAND 0x43514546u   /* FEQC */
#define FEQ_MAGIC_ACK 0x41514546u       /* FEQA */
#define FEQ_MAGIC_TELEMETRY 0x54514546u /* FEQT */
#define FEQ_MAGIC_ANALYSIS 0x4E514546u  /* FEQN */

enum FeqWireCommand {
  FEQ_CMD_HELLO = 1,
  FEQ_CMD_START = 2,
  FEQ_CMD_STOP = 3,
  FEQ_CMD_SET_PARAMETER = 4,
  /** Followed immediately by `parameter_id` doubles of payload. */
  FEQ_CMD_APPLY_SNAPSHOT = 5,
  /**
   * Render `parameter_id` blocks of silence through the engine.
   *
   * Not a debug hook. Offline rendering is a real capability the parity
   * harness and any future export both need, and until the device backend
   * exists it is also the only way to exercise the engine end to end — which
   * is precisely the thing that has to work before a device is worth adding.
   */
  FEQ_CMD_RUN_OFFLINE_BLOCKS = 6,
  FEQ_CMD_SHUTDOWN = 7,
  /**
   * The output-path signal generator: `parameter_id` selects it (0 silence,
   * 1 sine) and `value` sets the frequency.
   *
   * A generator on a console, not a stub for a decoder. It is the only way to
   * put a known waveform through the whole chain and hear whether what comes
   * back is what went in, and that stays true after decoding exists.
   */
  FEQ_CMD_SET_DIAGNOSTIC_SIGNAL = 8,
  /**
   * The whole chain, as `parameter_id` doubles of payload.
   *
   * Separate from `APPLY_SNAPSHOT` because they answer different questions.
   * The snapshot is the flat parameter table: sixty-odd scalars addressed by a
   * permanent id, which is what one dragged control needs. A chain also has
   * arrays — up to sixty-four EQ bands — and a flat list of scalars cannot
   * carry those without inventing an indexing scheme both sides would then
   * have to agree about forever. The layout here is the one `chainParams`
   * already writes for the parity fixtures, so the decoder the app depends on
   * at runtime is the decoder those twenty-seven whole-chain cases exercise.
   */
  FEQ_CMD_APPLY_CHAIN = 9,
  /**
   * Load a file into a deck. `parameter_index` is the deck, `parameter_id` the
   * byte length of the UTF-8 path that follows.
   *
   * A length and bytes rather than a fixed field: a path is not bounded by
   * anything useful, and truncating one produces a file-not-found for a file
   * that exists.
   */
  FEQ_CMD_LOAD_DECK = 10,
  FEQ_CMD_UNLOAD_DECK = 11,
  /** `parameter_id` non-zero to play. */
  FEQ_CMD_SET_PLAYING = 12,
  /** `parameter_index` is the deck, `value` the position in seconds. */
  FEQ_CMD_SEEK_DECK = 13,
  /** `parameter_index` is the deck to become audible, with no fade. */
  FEQ_CMD_SELECT_DECK = 14,
  /**
   * `parameter_index` is the deck to fade to, `value` the duration in ms and
   * `parameter_id` the curve's index in `CROSSFADE_CURVES`.
   */
  FEQ_CMD_CROSSFADE = 15,
  /**
   * The whole-track gains from analysis, as two doubles of payload: the input
   * gain and the master loudness gain, both in dB. `parameter_id` non-zero
   * lands on them rather than gliding.
   *
   * Both in one command because they always arrive together. Split across two,
   * a track would play for a block with one applied and not the other — which
   * is a level step on every track change rather than the ramp that exists to
   * prevent exactly that.
   */
  FEQ_CMD_SET_TRACK_GAINS = 16,
  /**
   * Render `parameter_id` frames from the loaded deck to a 32-bit float WAV.
   *
   * `parameter_index` is the deck and the path follows the frame as UTF-8
   * bytes, `value` carrying their length. Refused while the device is running,
   * for the same reason an offline block render is: two producers into one
   * chain interleave their blocks and both results are wrong.
   *
   * Not a test hook. Offline rendering is the export path, and it is also the
   * only way to ask "do the two engines agree on this actual song" and get an
   * answer in samples rather than in somebody's opinion, which is what the
   * whole migration turns on.
   */
  FEQ_CMD_RENDER_TO_FILE = 17,
  /**
   * Turn the panel's measurements on or off. `parameter_id` non-zero to enable.
   *
   * A command rather than something always on, because the DSP tab is one of
   * several and is usually closed. Three transforms and a scope window per
   * block is real work to do for a picture nobody is looking at, and the whole
   * reason the engine moved to C++ was to stop spending cycles like that.
   */
  FEQ_CMD_SET_ANALYSIS = 18,
  /**
   * The listener's volume, 0 to 1, in `value`.
   *
   * Needed at all because the elements are muted while the native engine is
   * audible, so the fader on the player reached nothing: it moved and the sound
   * did not change. Applied before the chain, which is where the element path
   * has always applied it — an element routed through Web Audio hands its
   * volume to the graph, so the dynamics stages have always responded to it and
   * the two engines would part company here if this went after them.
   */
  FEQ_CMD_SET_VOLUME = 19,
  /**
   * The Custom curve's shape, as `2 * FEQ_CROSSFADE_TABLE_POINTS` doubles of
   * payload: the outgoing side first, then the incoming one.
   *
   * One command for both sides because a fade drawn against two different
   * shapes steps in the middle of the overlap.
   */
  FEQ_CMD_SET_CROSSFADE_TABLE = 20
};


enum FeqWireStatus {
  FEQ_WIRE_APPLIED = 0,
  FEQ_WIRE_REJECTED = 1,
  FEQ_WIRE_UNSUPPORTED = 2
};

typedef struct FeqWireHandshake {
  uint32_t magic;
  uint32_t protocol_version;
  uint32_t parameter_schema_version;
  uint32_t abi_version;
  uint32_t parameter_count;
  uint32_t reserved;
  char core_version[24];
  char architecture[16];
  char build_revision[24];
  /** Which device backend was compiled in — "wasapi-shared", "unsupported". */
  char backend[16];
} FeqWireHandshake;

typedef struct FeqWireCommandFrame {
  uint32_t magic;
  uint16_t protocol_version;
  uint16_t command;
  uint32_t request_id;
  uint32_t settings_revision;
  uint32_t parameter_id;
  int32_t parameter_index;
  double value;
} FeqWireCommandFrame;

typedef struct FeqWireAckFrame {
  uint32_t magic;
  uint16_t protocol_version;
  uint16_t status;
  uint32_t request_id;
  uint32_t accepted_revision;
  uint64_t applied_at_sample_frame;
  double sanitized_value;
} FeqWireAckFrame;

typedef struct FeqWireTelemetryFrame {
  uint32_t magic;
  uint32_t applied_revision;
  uint64_t sequence;
  uint64_t frames_processed;
  uint32_t latency_frames;
  /**
   * Bumped every time the endpoint is reopened, which the renderer must notice.
   *
   * Reopening rebuilds the chain and the player, and a rebuilt player has no
   * decks: whatever was loaded is gone and `player_has_source` is false again.
   * So following the default output device to a new endpoint, on its own, is a
   * working stream playing nothing — the device change was handled and the
   * music still stopped.
   *
   * The renderer is the only side that knows which file was playing and where,
   * so it has to be told to cue it again. This is how: a counter it can compare
   * with the last one it saw, riding a frame that already arrives forty times a
   * second, rather than a new frame type for an event that happens when
   * somebody plugs in headphones.
   */
  uint32_t device_generation;
  float peak_left;
  float peak_right;
  double callback_p50_us;
  double callback_p99_us;
  uint64_t xruns;
  uint64_t drops;
  uint64_t repaired_samples;
  /** What the device negotiated, which is rarely what was asked for. */
  uint32_t sample_rate;
  uint32_t channels;
} FeqWireTelemetryFrame;

/**
 * What the panel draws, when it is open.
 *
 * Followed by its payload: for each stage named in `stage_mask`, ascending,
 * `bins` floats of dB; then `pairs * 2` floats of interleaved left and right
 * for the goniometer. Variable length, like `LOAD_DECK` and `APPLY_CHAIN`
 * before it — a fixed field big enough for three spectra would make every
 * telemetry frame carry twelve kilobytes it does not need.
 *
 * Separate from `FeqWireTelemetryFrame` because they answer to different
 * clocks. Telemetry reports per callback and must stay small enough to be sent
 * that often; this is published once per 2048-sample window, about 23 times a
 * second, and is two orders of magnitude larger.
 */
typedef struct FeqWireAnalysisFrame {
  uint32_t magic;
  uint32_t sequence;
  /** Bit per `FeqMeterStage`; a stage absent this frame simply had no window. */
  uint32_t stage_mask;
  /** Per stage present, so a reader can skip a frame it disagrees with. */
  uint32_t bins;
  uint32_t pairs;
  /**
   * EQ bands whose activity follows the scope, as amount then level pairs.
   *
   * A dynamic band's effect is the one thing in the rack that cannot be drawn
   * from its settings, so it has to be measured and sent: the curve is drawn at
   * full strength and its at-rest twin at zero, and neither moves when the
   * threshold does. The worklet used to report this and no longer processes
   * anything, which is why the dial went dead.
   */
  uint32_t bands;
  double correlation;
  float peak_left;
  float peak_right;
  /**
   * The exciter three bands and its organic stage, always present.
   *
   * In the header rather than the payload because there are four of them and
   * they are always available — a length and an offset for sixteen bytes would
   * be more protocol than the thing it describes.
   */
  float exciter_bands[3];
  float exciter_organic;
} FeqWireAnalysisFrame;

#ifdef __cplusplus
/**
 * The frame sizes, asserted rather than commented.
 *
 * These numbers are duplicated in `src/main/dspHost/wire.ts`, which has to
 * decode the same bytes and cannot ask the compiler what they are. Written by
 * hand they were wrong for two of the four structs on the first attempt — a
 * mistake that costs nothing here and produces a desynchronised stream and
 * garbage telemetry there. If one of these fails, fix the TypeScript to match;
 * do not pad the struct to suit it.
 */
static_assert(sizeof(FeqWireHandshake) == 104, "handshake frame size");
static_assert(sizeof(FeqWireCommandFrame) == 32, "command frame size");
static_assert(sizeof(FeqWireAckFrame) == 32, "ack frame size");
static_assert(sizeof(FeqWireTelemetryFrame) == 88, "telemetry frame size");
static_assert(sizeof(FeqWireAnalysisFrame) == 56, "analysis frame size");
#endif

#endif /* FLUIDEQ_HOST_WIRE_H */
