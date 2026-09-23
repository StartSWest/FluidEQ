/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The crossfade, as arithmetic on samples rather than as gain automation.
 *
 * `deckCrossfade.ts` schedules a curve onto two `GainNode`s and hopes the
 * browser honours it, with two fallback paths for when it does not: a
 * requestAnimationFrame loop that paints the gain from wall time, and a direct
 * `element.volume` assignment. Both of those are the same bug in two costumes —
 * a gain that moves once per painted frame steps in 16 ms increments, so a two
 * second fade is 120 steps and every one of them is a discontinuity in the
 * waveform. It is inaudible on most material and it zippers on a sustained
 * note, which is exactly the material a crossfade is chosen for.
 *
 * Here the gain is recomputed per sample from a frame counter. There is no
 * scheduler to reject it, no frame to be late, and no fallback needed: the
 * only clock is the one that produced the samples.
 */
#ifndef FLUIDEQ_CROSSFADE_H
#define FLUIDEQ_CROSSFADE_H

#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

/**
 * The order is `CROSSFADE_CURVES` in `chain.ts`, which is append-only: the
 * wire carries an index into that list.
 */
typedef enum FeqCrossfadeCurve {
  FEQ_CROSSFADE_EQUAL_POWER = 0,
  FEQ_CROSSFADE_SMOOTH = 1,
  FEQ_CROSSFADE_LINEAR = 2,
  /** The dragged shape, which needs a table and is not a closed form. */
  FEQ_CROSSFADE_CUSTOM = 3
} FeqCrossfadeCurve;

/** Matches CROSSFADE_TABLE_POINTS in crossfadeShape.ts. */
#define FEQ_CROSSFADE_TABLE_POINTS 64

/** Both sides of one dragged shape, sampled evenly across the fade. */
typedef struct FeqCrossfadeTable {
  float outgoing[FEQ_CROSSFADE_TABLE_POINTS];
  float incoming[FEQ_CROSSFADE_TABLE_POINTS];
} FeqCrossfadeTable;

/**
 * One deck's gain at a point in the fade, `progress` from 0 to 1.
 *
 * Ported from `crossfadeGain`, including the normalisation that divides the
 * equal-power pair by their sum. That division is what makes the two gains add
 * to exactly one at every point rather than to 1.414 in the middle, which is
 * the difference between a fade that holds its level and one that bulges by
 * 3 dB halfway through — audible on anything dense, and the reason "equal
 * power" is the default rather than a curiosity.
 */
double feq_crossfade_gain(FeqCrossfadeCurve curve, double progress, int incoming);

/**
 * The Custom curve, read out of a table with linear interpolation.
 *
 * Separate from `feq_crossfade_gain` because it is the one curve that is data
 * rather than arithmetic; giving the closed-form function a table argument it
 * ignores for three of four curves would hide that.
 */
double feq_crossfade_table_gain(const FeqCrossfadeTable* table,
                                double progress,
                                int incoming);

typedef struct FeqCrossfader {
  FeqCrossfadeCurve curve;
  /** What the mixer is reading. Written only while no fade is running. */
  FeqCrossfadeTable table;
  FeqCrossfadeTable pending;
  /** Zero means no fade is running and the outgoing deck is alone. */
  uint64_t duration_frames;
  uint64_t elapsed_frames;
  int active;
  /**
   * The level the outgoing side starts the fade from, as a factor on its
   * curve: one for a fade out of a track playing at full level.
   *
   * Less than one when a fade is started out of the middle of another — the
   * track being left was already part way down its own curve, and starting it
   * back at unity would be a step up to full level — and zero when nothing
   * was heard at all, where the fade is only the incoming side coming in.
   */
  double outgoing_scale;
} FeqCrossfader;

void feq_crossfader_init(FeqCrossfader* state);

/**
 * Hand over a shape for the NEXT fade.
 *
 * Held pending and promoted by `feq_crossfader_start`, and only when no fade
 * is running. The audio thread reads the live table for the whole length of a
 * fade, so writing it from the command thread mid-fade would tear it — half
 * one shape and half another, which is a step in the gain rather than a
 * different curve. A shape that arrives during a fade therefore applies to the
 * one after it, which is also what the panel promises the user.
 */
void feq_crossfader_set_table(FeqCrossfader* state,
                              const FeqCrossfadeTable* table);

/**
 * Begin a fade of `duration_frames`. A duration of zero is an immediate cut.
 *
 * Restarting one that is already running takes the new curve and duration from
 * the current position rather than jumping: a queue that skips twice inside one
 * fade must not step the level on the second skip.
 */
void feq_crossfader_start(FeqCrossfader* state,
                          FeqCrossfadeCurve curve,
                          uint64_t duration_frames);

/**
 * Begin a fresh fade from its first frame, whatever was running: the incoming
 * side from silence, the outgoing side from `outgoing_scale` of its curve.
 *
 * `feq_crossfader_start` is for the same fade asked for again, and keeps its
 * place; this is for a fade to somewhere new, which the listener expects to
 * hear arrive from nothing (Ivan, 2026-09-23: "just start 3 fading in"). The
 * pending table is promoted here, as it is at any other fade's start.
 */
void feq_crossfader_restart(FeqCrossfader* state,
                            FeqCrossfadeCurve curve,
                            uint64_t duration_frames,
                            double outgoing_scale);

/**
 * Mix one block. Planar, `channels` pointers each, `out` may alias `outgoing`.
 *
 * Real-time safe: arithmetic and a counter. When no fade is running the
 * outgoing deck is copied through at unity and the incoming deck is ignored,
 * which is what makes this safe to call unconditionally on every block.
 */
void feq_crossfader_mix(FeqCrossfader* state,
                        const float* const* outgoing,
                        const float* const* incoming,
                        float* const* out,
                        uint32_t channels,
                        uint32_t frames);

/** 0 to 1. Reports 1 when nothing is running, which is a completed fade. */
double feq_crossfader_progress(const FeqCrossfader* state);

/**
 * The gain the mixer applies to one side at the position the fade has
 * reached: what `feq_crossfader_mix` would multiply that side by on its next
 * sample, `outgoing_scale` included. Unity for the outgoing side and nothing
 * for the incoming one before any fade has been configured, which is how
 * `mix` copies the outgoing through.
 */
double feq_crossfader_gain(const FeqCrossfader* state, int incoming);

#ifdef __cplusplus
}
#endif

#endif /* FLUIDEQ_CROSSFADE_H */
