/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Two decks, a bounded read-ahead each, and a crossfade between them.
 *
 * The TypeScript player is two `<audio>` elements behind two `GainNode`s: the
 * decoding, the timing and the fade all belong to the browser, and the app asks
 * for them politely. What that costs is visible in `deckCrossfade.ts`, which
 * carries two fallback paths for when Chromium declines to run an automation
 * curve. Here the decks are buffers and the fade is arithmetic, so there is
 * nothing to decline.
 *
 * Three threads, and which one may call what is part of the contract:
 *
 *  - the audio callback calls `feq_player_render` and nothing else;
 *  - one decoder thread calls `load`, `seek`, `unload` and `pump`;
 *  - any thread may read the position and state.
 *
 * `render` allocates nothing, takes no lock and makes no OS call. `pump` does
 * all three and must never run on the audio thread.
 */
#ifndef FLUIDEQ_PLAYER_H
#define FLUIDEQ_PLAYER_H

#include <stdint.h>

#include "fluideq/crossfade.h"

#ifdef __cplusplus
extern "C" {
#endif

#define FEQ_PLAYER_DECKS 2

typedef struct FeqDecoderInfo {
  uint32_t sample_rate;
  uint32_t channels;
  /** Zero when the decoder cannot say — a stream rather than a file. */
  uint64_t total_frames;
} FeqDecoderInfo;

/**
 * The decoder, as a table the host fills in.
 *
 * dsp-core reads no files and knows no formats: it compiles with nothing but a
 * standard library, and a codec would drag a platform and a licence into it.
 * The host owns both.
 *
 * Every entry is called from the decoder thread and may block.
 */
typedef struct FeqDecoderOps {
  void* user;
  /** Null on failure. `info` is filled in only on success. */
  void* (*open)(void* user, const char* path, FeqDecoderInfo* info);
  void (*close)(void* user, void* handle);
  /**
   * Planar, at the FILE's rate and channel count, into caller-owned buffers.
   * Returns frames produced; fewer than asked for means end of file.
   */
  uint32_t (*read)(void* user, void* handle, float* const* channels,
                   uint32_t frames);
  /** Non-zero on success. A decoder that cannot seek may return zero. */
  int (*seek)(void* user, void* handle, uint64_t frame);
} FeqDecoderOps;

typedef enum FeqDeckState {
  FEQ_DECK_EMPTY = 0,
  /** Loaded, with frames either buffered or still coming. */
  FEQ_DECK_READY = 1,
  /** The decoder is exhausted and the buffer has run dry. */
  FEQ_DECK_ENDED = 2
} FeqDeckState;

typedef struct FeqPlayer FeqPlayer;

/**
 * `read_ahead_frames` bounds how far ahead of the playhead the decoder may
 * run, per deck.
 *
 * Bounded rather than "as much as fits": an unbounded read-ahead decodes a
 * whole album into memory during a gapless run, and the memory is the smaller
 * problem — the decoder thread then competes with the audio thread for cache
 * for no benefit, because nothing past a second or two will ever be needed
 * before the next seek.
 */
FeqPlayer* feq_player_create(double output_rate,
                             uint32_t channels,
                             uint32_t maximum_block_frames,
                             uint32_t read_ahead_frames,
                             const FeqDecoderOps* ops);
void feq_player_destroy(FeqPlayer* player);

/* ------------------------------------------------------ decoder thread -- */

/** Non-zero on success. Replaces whatever the deck held. */
int feq_player_load(FeqPlayer* player, uint32_t deck, const char* path);
void feq_player_unload(FeqPlayer* player, uint32_t deck);

/**
 * Move the playhead. Non-zero on success.
 *
 * What was already decoded ahead of the old position is dropped by the reader
 * without the writer stopping — see `discard_until` in `ring.h`. A seek that
 * waited for the audio thread to acknowledge would stall the decoder for a
 * whole block on every scrub.
 */
int feq_player_seek(FeqPlayer* player, uint32_t deck, double seconds);

/**
 * Fill whatever room the rings have. Returns frames decoded across both decks.
 *
 * Call it whenever it returns non-zero and then wait; a decoder thread that
 * spins on a full ring is a core spent on nothing.
 */
uint32_t feq_player_pump(FeqPlayer* player);

/* ------------------------------------------------------ any thread ------ */

void feq_player_set_playing(FeqPlayer* player, int playing);
int feq_player_is_playing(const FeqPlayer* player);

/** Make one deck audible at once, with no fade. */
void feq_player_select(FeqPlayer* player, uint32_t deck);
uint32_t feq_player_active_deck(const FeqPlayer* player);

/**
 * Begin a fade to the other deck.
 *
 * A duration of zero is an immediate cut. Starting one while another is
 * running keeps its place on the curve rather than stepping the outgoing deck
 * back to full level.
 */
void feq_player_start_crossfade(FeqPlayer* player,
                                uint32_t to_deck,
                                double duration_ms,
                                FeqCrossfadeCurve curve);
/** 0 to 1. Reports 1 when nothing is running. */
double feq_player_crossfade_progress(const FeqPlayer* player);

double feq_player_position_seconds(const FeqPlayer* player, uint32_t deck);
double feq_player_duration_seconds(const FeqPlayer* player, uint32_t deck);
int feq_player_deck_state(const FeqPlayer* player, uint32_t deck);

/**
 * True once a loaded deck holds enough to start without an immediate gap.
 *
 * Playing the moment the first frame arrives is how a start stutters: the
 * device wants a block every few milliseconds and the decoder has not opened
 * the file yet.
 */
int feq_player_deck_primed(const FeqPlayer* player, uint32_t deck);

/* ------------------------------------------------------- audio thread -- */

/**
 * One block, planar, `channels` pointers. Overwrites; never accumulates.
 *
 * Real-time safe. When a fade completes, the incoming deck is promoted here
 * rather than by the caller — an index swap costs nothing, and waiting for
 * another thread to notice would put the outgoing track back for however many
 * blocks that took.
 */
void feq_player_render(FeqPlayer* player, float* const* channels,
                       uint32_t frames);

#ifdef __cplusplus
}
#endif

#endif /* FLUIDEQ_PLAYER_H */
