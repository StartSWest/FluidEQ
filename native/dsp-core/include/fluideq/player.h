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
 *  - any thread may read the position and state, and ask for a cut or a
 *    fade (`select`, `start_crossfade`).
 *
 * Which deck is heard belongs to the audio thread. A cut or a fade is asked
 * for, and made at the top of the next block, the newest request replacing
 * one not yet taken; a load is carried out there too, so what is left of the
 * file it replaced leaves under an 80 ms ramp rather than on the sample it
 * had reached. Every question asked from another thread is answered as if
 * the change asked for had already been made.
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
  /**
   * In AND out: the player fills this in with the count it wants before `open`
   * is called, and the decoder must produce exactly that many.
   *
   * Leaving the fold-down to the player instead would give a different answer
   * per decoder — a mono file duplicated across both channels is 3 dB louder
   * than one that leaves the right silent, and both are defensible until two
   * files in one playlist do different things. Only the decoder can see the
   * file's own layout, so only the decoder can map it.
   */
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
   * Planar, at the FILE's rate and `info.channels` wide, into caller buffers.
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

/**
 * Non-zero on success. Replaces whatever the deck held.
 *
 * Onto a deck that is one half of a running fade, the new file becomes what
 * the fade goes to, from silence and over the whole fade again, and the other
 * deck fades out from the level it had reached. That is a skip taken inside
 * a fade, and it is why the track chosen last is the one that plays.
 */
int feq_player_load(FeqPlayer* player, uint32_t deck, const char* path);
/** Empties the deck. What it was still playing leaves under a short ramp. */
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

/**
 * Make one deck audible at the next block, with no fade. What is taken off
 * the path leaves under a short ramp and the deck comes in under one.
 */
void feq_player_select(FeqPlayer* player, uint32_t deck);
uint32_t feq_player_active_deck(const FeqPlayer* player);
/**
 * The deck the transport is ABOUT: the incoming deck from the moment a
 * crossfade is started, the active one otherwise.
 *
 * `feq_player_active_deck` is the audio thread's notion — the deck the fader
 * is still mixing FROM until it finishes — and the telemetry used to report
 * that one. So for the whole of a fade the host told the app the outgoing
 * track's position and state under the incoming track's name, and when the
 * outgoing file ran out before the fade did, its ENDED was read as the new
 * track's end: the queue advanced a second time and skipped a song (Ivan,
 * 2026-09-22, "it starts the next song then jumps into the one after"). The
 * app has already moved on to the incoming track when it asks for the fade;
 * this is the deck that agrees with it.
 */
uint32_t feq_player_reported_deck(const FeqPlayer* player);

/**
 * Non-zero while `deck` is on the listened path: the active deck, empty or
 * paused or not, and the incoming one from the moment a fade starts.
 *
 * The host resets its chain when the sound in it changes source — a load or
 * a seek on a deck the listener hears — and must NOT when the spare deck is
 * being readied while the other plays: the next track is decoded and cued
 * there mid-song (`prime` in `nativeMirror.ts`), and a reset then emptied
 * every delay line and every dynamics state under the song that was playing,
 * twice a track — a hiccup in the middle of it (Ivan, 2026-09-22).
 */
int feq_player_deck_audible(const FeqPlayer* player, uint32_t deck);

/** Non-zero while a fade is running: both decks are in use and neither is
 *  free to be loaded without cutting into what is heard. */
int feq_player_fading(const FeqPlayer* player);

/**
 * Where the track the transport moves to next belongs: the deck that is not
 * active when no fade runs, and the QUIETER of the two while one does.
 *
 * Answered here because only the player knows whether its fade is still
 * running. The app used to alternate the decks itself, one per handoff — but
 * the active deck is the one a fade leaves until the fade ends, so a second
 * Next inside one overlap loaded the new track over the deck still fading out
 * and then asked for a fade to it, which was refused as a fade to itself. The
 * running fade finished on the track skipped past, and that is what played
 * while the player showed the one chosen (Ivan, 2026-09-23: "I click 1, 2, 3,
 * 2 is the one that plays"). The quieter deck is the one whose loss is heard
 * least; loaded there, the new track fades in from silence and the louder one
 * fades out from where it was (`feq_player_load`). A fade asked for and not
 * yet begun gives up its own deck: its track has not been heard at all.
 */
uint32_t feq_player_handoff_deck(const FeqPlayer* player);

/**
 * Ask for a fade to the other deck, made at the top of the next block.
 *
 * A duration of zero is an immediate cut. Asking again for the fade already
 * running keeps its place on the curve rather than stepping the outgoing deck
 * back to full level. Asked for while nothing plays, it is only the incoming
 * deck coming in: what was paused is not started again to be faded away
 * (Ivan, 2026-09-23: "if crossfade is on and we don't have a source ... we
 * just fade in the target").
 */
void feq_player_start_crossfade(FeqPlayer* player,
                                uint32_t to_deck,
                                double duration_ms,
                                FeqCrossfadeCurve curve);
/**
 * The Custom curve's shape, for the next fade.
 *
 * Held pending while a fade runs; see `feq_crossfader_set_table`.
 */
void feq_player_set_crossfade_table(FeqPlayer* player,
                                    const FeqCrossfadeTable* table);

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
