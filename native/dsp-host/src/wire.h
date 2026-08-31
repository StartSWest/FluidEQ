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

/* For the profile's band and partial counts, which size its payload. */
#include "fluideq/denoise.h"
/* For FEQ_BASS_FORGE_BANDS, which sizes the two runs in the analysis frame. */
#include "fluideq/bass_forge.h"

/*
 * Bumped to 2 when Denoise changed the analysis frame layout.
 *
 * The handshake already refuses a host whose protocol differs; what it cannot
 * catch is a host built before a layout change that did not move this number.
 * That host agrees it speaks version 1, is accepted, and then desynchronises
 * on the first analysis frame — reported as diagnostic 3005 with magic 0,
 * which names the symptom and nothing about the cause. `pnpm dev` does not
 * rebuild the native host, so a pull across this change is exactly when it
 * happens.
 */
#define FEQ_WIRE_PROTOCOL_VERSION 2

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
  FEQ_CMD_SET_CROSSFADE_TABLE = 20,
  /**
   * The measured noise floor, as `FEQ_DENOISE_PROFILE_WIRE` doubles.
   *
   * Its own command rather than part of the chain snapshot, matching
   * `SET_TRACK_GAINS`: it comes from analysis rather than from a dial and
   * changes once per track, not once per knob-drag. A payload length of zero
   * clears it, which is what a track with no scan sends — the stage then
   * follows the floor live and says so, rather than subtracting the previous
   * song's hiss from this one.
   */
  FEQ_CMD_SET_NOISE_PROFILE = 21,
  /**
   * The voice model and the ONNX Runtime, as one UTF-8 payload of
   * `parameter_id` bytes: the model path, a newline, then the runtime path.
   *
   * One command for both because neither is any use without the other, and a
   * module half-pointed at a model is a control that reads as ready while
   * doing nothing. A zero-length payload unloads.
   */
  FEQ_CMD_LOAD_VOICE_MODEL = 22
};

/** Bands, then floor, fundamental and partial count, then the partials. */
#define FEQ_DENOISE_PROFILE_WIRE \
  (FEQ_DENOISE_PROFILE_BANDS + 3 + FEQ_DENOISE_MAX_HUM_PARTIALS * 2)


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
  /**
   * `sizeof(FeqWireAnalysisFrame)`, asked of the compiler rather than agreed.
   *
   * The analysis frame is the only one whose length is not fixed, so the
   * reader takes this many bytes as its header and reads the rest of the
   * length out of it. A host whose header is a different size therefore does
   * not send one bad frame — it sends the next frame's first bytes as part of
   * this one, and every frame after that is misread. The desynchronisation is
   * permanent and its symptom is silence, because the supervisor's only
   * answer to a lost stream is to kill the host.
   *
   * That happened. The frame went from 160 bytes to 320 when Denoise's forty
   * floor bands landed, `FEQ_WIRE_PROTOCOL_VERSION` stayed at 1 because
   * nothing makes it move, and a host binary from twenty-two minutes earlier
   * handshook cleanly and then destroyed the stream. The version is a number
   * somebody has to remember to change; this is one the compiler cannot get
   * wrong, and it is checked before a single frame is read.
   *
   * An older host leaves this zero, which is not any frame size and is
   * refused like any other mismatch.
   */
  uint32_t analysis_frame_bytes;
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
  /** Deepest Maximizer reduction over the block, dB. Never positive. */
  float maximizer_reduction_db;
  /**
   * How much widening Dimension is allowing, 0 to 1.
   *
   * Occupies the float that was padding the pair above to eight-byte
   * alignment, so the frame does not grow and no offset below it moves.
   */
  float dimension_guard;
  /**
   * The Master tail, and the Normalizer's bars.
   *
   * In the header for the same reason the exciter's four are: they are always
   * available and there are a fixed number of them, so a length and an offset
   * would be more protocol than the thing it describes. Present because the
   * worklet used to post them and is a passthrough now — the Master card's five
   * readouts and the Normalizer's four bars had no source at all, and printed
   * their defaults over a chain that was measuring every one of them.
   */
  float auto_headroom_reduction_db;
  float auto_headroom_true_peak_db;
  float safety_reduction_db;
  float safety_true_peak_db;
  float dc_correction_db;
  uint32_t repaired_samples;
  /** 1, 2 or 4; the panel prints it beside the ceiling it was measured at. */
  uint32_t true_peak_factor;
  /** Development can bypass the guard, and the card says which state it is in. */
  uint32_t safety_enabled;
  float normalizer_input_peaks[2];
  float normalizer_output_peaks[2];
  float normalizer_applied_gain_db;
  /** Pads the struct to eight-byte alignment; the assert below names it. */
  float reserved_tail;
  /**
   * What the output actually measures, by BS.1770: momentary, short term,
   * integrated, and the loudness range in LU.
   *
   * The Master page offered a loudness target and had no way to show whether
   * the chain reached it — the only LUFS on screen was the number the user had
   * dialled. That is how the makeup came to apply exactly zero decibels to
   * every track for the life of the stage without anybody being able to see it.
   */
  float loudness_momentary_lufs;
  float loudness_short_term_lufs;
  float loudness_integrated_lufs;
  float loudness_range_lu;
  /*
   * Denoise, appended after every pre-existing offset and never inserted.
   *
   * The TypeScript reader's guards are `length < ANALYSIS_HEADER_BYTES` — a
   * floor rather than an exact check — so a field placed above one of these
   * does not fail there, it reads whatever float has moved into the old offset
   * and hands the panel a plausible number. The static_assert below is the
   * only thing that catches a change here, so it moves in the same commit.
   */
  float denoise_reduction_db;
  float denoise_noise_floor_db;
  uint32_t denoise_clicks_repaired;
  uint32_t denoise_voice_underruns;
  /*
   * Two words rather than one bitfield, and it costs nothing: the second slot
   * was padding anyway. They are two independent facts — a profile can be
   * loaded with no model and a model with no profile — and the card says
   * something different about each, so packing them would be a bit test on
   * both sides to recover what the struct can just state.
   */
  uint32_t denoise_profile_ready;
  uint32_t denoise_voice_model_loaded;
  /**
   * The live floor per profile band, in the profile's density units.
   *
   * Forty floats is a lot for a fixed header and they earn it: without them
   * the Adaptive mode has no visible behaviour at all, and a mode whose only
   * evidence is whether the sound got better is a mode nobody can tune.
   */
  float denoise_floor_bands[FEQ_DENOISE_PROFILE_BANDS];
  /*
   * The two bass stages, appended after every pre-existing offset.
   *
   * Forge sends its eight bands twice — the dry low band and the forged one —
   * because the graph draws the generated content as the AREA BETWEEN the two
   * curves. One run of levels would show that something is happening in the
   * bass and say nothing at all about what the stage made, which is the only
   * question the card is asked.
   *
   * In the header rather than the payload for the same reason the exciter's
   * four are: fixed in number and always available, so a length and an offset
   * would be more protocol than the thing it describes.
   */
  float bass_forge_input_db[FEQ_BASS_FORGE_BANDS];
  float bass_forge_output_db[FEQ_BASS_FORGE_BANDS];
  /*
   * Punch reports applied gain, not level, so these rest at 0 dB rather than
   * at the -120 floor the two runs above rest at. A reader that floors them
   * would be showing a stage ducking by 120 dB while it sits idle.
   */
  float bass_punch_transient_db;
  float bass_punch_sustain_db;
  float bass_punch_duck_db;
  /*
   * Pads the frame back to eight-byte alignment, and the assert below names
   * the arithmetic: nineteen floats is 76 bytes onto 320, and 396 is not a
   * multiple of the eight that `correlation` at offset 24 forces on the whole
   * struct. The compiler would insert this byte-for-byte anyway; spelling it
   * out is what keeps the TypeScript constant derivable by reading this file.
   */
  float bass_reserved_tail;
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
/*
 * 120, then 136 when Master loudness landed, then Denoise's six words took it
 * to 160 and its forty floor bands to 320. The two bass stages add sixteen
 * floats for Forge and three for Punch — 76 bytes, which lands on 396 and is
 * rounded to 400 by the explicit `bass_reserved_tail`, because `correlation`
 * makes the whole struct eight-byte aligned.
 */
static_assert(sizeof(FeqWireAnalysisFrame) == 400, "analysis frame size");
#endif

#endif /* FLUIDEQ_HOST_WIRE_H */
