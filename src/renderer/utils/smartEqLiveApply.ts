/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ISmartEqSettings } from 'common/constants';
import {
  SAMPLE_FREQUENCIES,
  gainAtFrequency,
  getTFCoefficients,
} from 'common/response';
import { getSmartEqFilters } from 'common/smartEq';
import { SMART_EQ_LAYOUT, gainsOf } from './smartEqSolve';

/**
 * Smart correction heard while it forms (Ivan, 2026-11-27: "can we make the
 * smart eq continue to apply the EQ while measuring, not at the end, without
 * affecting the take? the source").
 *
 * THE TAKE CANNOT HEAR IT, and nothing is subtracted to make that so. The
 * measurement listens ahead of every EQ (`audio/rawSource.ts`): the Library
 * through its host's rack input, which is the decoded file, and every other
 * player through Windows' process loopback, which delivers each program's
 * mix before the endpoint's effects — and Equalizer APO and the FluidEQ
 * Engine are both endpoint effects. The Smart layer is written into the
 * engine's configuration and nowhere else (`SET_SMART_EQ` in
 * `main/ipc/layers.ts`; the Library host never sees it), so putting the
 * forming curve on changes what leaves the engine and nothing either tap
 * carries. Subtracting what was applied would only be needed for a tap after
 * the EQ, and the one this app had — the endpoint loopback — is exactly what
 * Smart correction stopped measuring (`SmartEqEngine.tsx`). Nothing here
 * touches the capture either: a step is taken from the curve the preview has
 * already solved from its checkpoint, so the take, the moment it is held and
 * the curve written there are the ones end-only writing gave, to the bit.
 *
 * WHAT PLAYS WALKS; THE ANSWER DOES NOT. Each checkpoint — half a second of
 * music heard (`CONVERGENCE_CHECK_MS`), so the music is the cadence and no
 * clock is — moves what plays toward the curve forming at that checkpoint by
 * at most `LIVE_STEP_DB` of heard response at any frequency. The engine fades
 * every write over 20 ms, which takes the click out and leaves the jump in:
 * a song's curve stands 2-6 dB from flat where it corrects anything, and
 * arriving in 20 ms that is a switch being thrown. Walked in half-decibel
 * steps every half second it comes in as the measurement firms up, at one
 * decibel a second at most. Steps are scaled as a whole, so what plays keeps
 * the forming curve's shape on the way and only gets nearer to it.
 *
 * NOTHING DRIFTS. The take's own curve is the last word, written exactly: at
 * the hold when what plays is a step from it or nearer, otherwise walked the
 * rest of the way on the music after the hold and then written
 * (`audio/smartEqLive.ts`, `onAfterTake`), and nothing after that.
 *
 * This is not the stepping `common/smartEqContinuous.ts` took out. That loop
 * measured its own output and stepped so as not to chase it, so where it
 * stepped from was part of every answer. Here where it steps from is what is
 * heard and nothing else: the target is the whole solve of the source each
 * time, and the take's curve is solved whole — so nothing the walk did can
 * drift into what is kept.
 *
 * Measured on eight records through the real capture, from two starting
 * points each, in a one-shot and a running mode (2026-11-27): the take and
 * its curve came out identical to end-only writing in all 32 runs (0.000 dB);
 * the hold had been a jump of 2.0-6.1 dB in the 26 that corrected anything,
 * and every write became a step of 0.50 dB or less, 7 to 54 of them a song;
 * at the hold what played was 0.09-1.19 dB from the take's curve, landed in
 * one write in 23 runs and walked in over two or three in the other three.
 */

/**
 * The most a checkpoint's step changes what is heard, at any frequency, in dB.
 *
 * Half a decibel is about the smallest change of a broad tone balance a
 * listener picks out side by side on the same passage; inside music, faded
 * over the engine's 20 ms, it passes as the correction coming in. Ivan's
 * ears are the check on that.
 */
export const LIVE_STEP_DB = 0.5;

/**
 * Nearer than this and what plays stays: the write would be a config reload
 * on the engine for a change no-one hears. A quarter of a decibel is half a
 * step, so what plays is never further from the forming curve than that once
 * it has caught up, and a curve that only shimmers as it forms costs nothing.
 */
export const LIVE_DEADBAND_DB = 0.25;

/** How many times a step is shrunk to bring its rounded write inside the step. */
const STEP_PASSES = 8;

/**
 * A layer as it is heard: its rendered filters (at its strength, rounded to
 * what the engine reads, the neutral ones dropped) summed at every probe
 * frequency of the response graph, in dB.
 */
export const heardResponse = (
  layer: ISmartEqSettings | undefined,
): number[] => {
  const filters = getSmartEqFilters(layer).map((filter) =>
    getTFCoefficients(filter),
  );
  return SAMPLE_FREQUENCIES.map((frequency) =>
    filters.reduce(
      (sum, coefficients) => sum + gainAtFrequency(frequency, coefficients),
      0,
    ),
  );
};

/** The largest difference between two heard responses, in dB. */
const distanceOf = (a: number[], b: number[]): number =>
  a.reduce(
    (largest, level, index) => Math.max(largest, Math.abs(level - b[index])),
    0,
  );

/** How far apart two layers are as heard, in dB at the worst frequency. */
export const heardDistance = (
  a: ISmartEqSettings | undefined,
  b: ISmartEqSettings | undefined,
): number => distanceOf(heardResponse(a), heardResponse(b));

/** `share` of the way from one set of gains to another, band by band. */
const between = (
  from: Record<string, number>,
  to: Record<string, number>,
  share: number,
): Record<string, number> =>
  Object.fromEntries(
    SMART_EQ_LAYOUT.map(({ id }) => {
      const start = from[id] ?? 0;
      return [id, start + ((to[id] ?? 0) - start) * share];
    }),
  );

/** One checkpoint's move, or none. */
export interface ILiveStep {
  /** What to write now; undefined is no layer, which is a layer to write. */
  layer: ISmartEqSettings | undefined;
  /** The heard change it makes, in dB at the worst frequency. */
  stepDb: number;
}

/**
 * What plays, one checkpoint nearer the forming curve.
 *
 * `build` turns gains into the layer exactly as the hold will write them —
 * the listener's strength, the limit, the rounding — so the step is judged on
 * what will be heard. Nothing when what plays is already within
 * `LIVE_DEADBAND_DB` of where the curve is forming, and nothing when what
 * plays is a hand edit of the engine's file (`apoOverride`): that is somebody's
 * own sound, which the hold replaces as it always has and the walk does not
 * presume to start from.
 */
export const stepTowardForming = (
  playing: ISmartEqSettings | undefined,
  target: Record<string, number>,
  build: (gains: Record<string, number>) => ISmartEqSettings | undefined,
): ILiveStep | undefined => {
  if (playing?.apoOverride) {
    return undefined;
  }
  const from = heardResponse(playing);
  const whole = build(target);
  const distance = distanceOf(from, heardResponse(whole));
  if (distance < LIVE_DEADBAND_DB) {
    return undefined;
  }
  if (distance <= LIVE_STEP_DB) {
    return { layer: whole, stepDb: distance };
  }
  // A biquad's response is only nearly proportional to its gain, and the
  // write rounds each band to a tenth, so the share that should make the step
  // is checked against the layer it builds and shrunk until that fits.
  const start = gainsOf(playing);
  let share = LIVE_STEP_DB / distance;
  let layer = build(between(start, target, share));
  let stepDb = distanceOf(from, heardResponse(layer));
  for (let pass = 1; pass < STEP_PASSES && stepDb > LIVE_STEP_DB; pass += 1) {
    share *= (LIVE_STEP_DB / stepDb) * 0.95;
    layer = build(between(start, target, share));
    stepDb = distanceOf(from, heardResponse(layer));
  }
  // Rounding alone can leave a sliver of a step that changes nothing heard;
  // and a step the passes could not bring inside the limit is not taken —
  // the next checkpoint tries again from the same place.
  return stepDb < LIVE_DEADBAND_DB / 2 || stepDb > LIVE_STEP_DB
    ? undefined
    : { layer, stepDb };
};
