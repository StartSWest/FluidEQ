/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ISmartEqSettings } from 'common/constants';
import {
  LIVE_DEADBAND_DB,
  LIVE_STEP_DB,
  heardDistance,
  heardResponse,
  stepTowardForming,
} from 'renderer/utils/smartEqLiveApply';
import {
  SMART_EQ_LAYOUT,
  gainsOf,
  smartEqLayerOf,
} from 'renderer/utils/smartEqSolve';

/**
 * Smart correction put on while it measures walks what plays toward the
 * curve forming, never jumps to it (Ivan, 2026-11-27): no step changes what
 * is heard by more than `LIVE_STEP_DB` anywhere, every step gets nearer, and
 * a correction the listener's strength leaves unheard is never written.
 */

const ranged = {
  status: 'partial' as const,
  lowFrequency: 35,
  highFrequency: 15000,
};
const buildAt =
  (intensity: number | undefined) => (gains: Record<string, number>) =>
    smartEqLayerOf(gains, ranged, intensity);

/** A broad bass lift and a presence dip: what a dull, boomy master asks for. */
const forming = (scale: number): Record<string, number> =>
  Object.fromEntries(
    SMART_EQ_LAYOUT.map(({ id, frequency }) => {
      const bass = frequency < 200 ? 3 : 0;
      const presence = frequency >= 2000 && frequency <= 5000 ? -2.5 : 0;
      return [id, (bass + presence) * scale];
    }),
  );

/** Walk from `start` toward `target` until nothing is left to step. */
const walk = (
  start: ISmartEqSettings | undefined,
  target: Record<string, number>,
  intensity: number | undefined = undefined,
) => {
  const steps: Array<{ layer: ISmartEqSettings | undefined; stepDb: number }> =
    [];
  let playing = start;
  for (let guard = 0; guard < 200; guard += 1) {
    const step = stepTowardForming(playing, target, buildAt(intensity));
    if (!step) {
      break;
    }
    steps.push(step);
    playing = step.layer;
  }
  return { steps, playing };
};

describe('stepping what plays toward the curve forming', () => {
  it('walks a far curve in, no step heard as more than a step', () => {
    const target = forming(1);
    const whole = buildAt(undefined)(target);
    // The control: the curve is far more than one step from flat, so a
    // single write would be the jump this exists to prevent.
    expect(heardDistance(undefined, whole)).toBeGreaterThan(4 * LIVE_STEP_DB);

    const { steps, playing } = walk(undefined, target);

    expect(steps.length).toBeGreaterThan(4);
    let from: ISmartEqSettings | undefined;
    let left = heardDistance(undefined, whole);
    steps.forEach(({ layer, stepDb }) => {
      // Measured on what is written, after the rounding to a tenth.
      expect(heardDistance(from, layer)).toBeCloseTo(stepDb, 9);
      expect(stepDb).toBeLessThanOrEqual(LIVE_STEP_DB);
      const nowLeft = heardDistance(layer, whole);
      expect(nowLeft).toBeLessThan(left);
      left = nowLeft;
      from = layer;
    });
    // And it arrives: what plays is within the deadband of the curve.
    expect(heardDistance(playing, whole)).toBeLessThan(LIVE_DEADBAND_DB);
  });

  it('keeps the shape on the way: every frequency moves toward the curve, none past it', () => {
    const target = forming(1);
    const goal = heardResponse(buildAt(undefined)(target));
    const { steps } = walk(undefined, target);
    // Half a rounding step of a band, summed over the bells that overlap.
    const slack = 0.15;
    steps.forEach(({ layer }) => {
      heardResponse(layer).forEach((level, point) => {
        const low = Math.min(0, goal[point]) - slack;
        const high = Math.max(0, goal[point]) + slack;
        expect(level).toBeGreaterThanOrEqual(low);
        expect(level).toBeLessThanOrEqual(high);
      });
    });
  });

  /** The curve's loudest point as heard, which scaling it moves by most. */
  const peakOf = (scale: number) =>
    heardDistance(undefined, buildAt(undefined)(forming(scale)));

  it('writes the curve itself once it is a step away or nearer', () => {
    // Nine tenths of a step short of the curve at its loudest point.
    const playing = buildAt(undefined)(
      forming(1 - (0.9 * LIVE_STEP_DB) / peakOf(1)),
    );
    const target = forming(1);
    const distance = heardDistance(playing, buildAt(undefined)(target));
    expect(distance).toBeGreaterThan(LIVE_DEADBAND_DB);
    expect(distance).toBeLessThanOrEqual(LIVE_STEP_DB);
    const step = stepTowardForming(playing, target, buildAt(undefined));
    expect(step?.layer).toEqual(buildAt(undefined)(target));
    expect(step?.stepDb).toBeCloseTo(distance, 9);
  });

  it('leaves what plays alone inside the deadband', () => {
    const playing = buildAt(undefined)(forming(1));
    // A shimmer of the forming curve: one band, a tenth of a decibel.
    const nudged = (gain: number) => ({ ...forming(1), 'smart-1000': gain });
    const distance = heardDistance(playing, buildAt(undefined)(nudged(0.1)));
    expect(distance).toBeGreaterThan(0);
    expect(distance).toBeLessThan(LIVE_DEADBAND_DB);
    expect(stepTowardForming(playing, nudged(0.1), buildAt(undefined))).toBe(
      undefined,
    );
    // The control: half a decibel is past the deadband, and stepped.
    expect(
      stepTowardForming(playing, nudged(0.5), buildAt(undefined)),
    ).toBeDefined();
  });

  it('writes nothing for a correction the strength leaves unheard', () => {
    const target = forming(1);
    // At zero strength nothing of the layer is heard, so nothing is walked.
    expect(walk(undefined, target, 0).steps).toHaveLength(0);
    // The control: the same curve at half strength is heard, and walked,
    // each step judged on what is heard at that strength.
    const half = walk(undefined, target, 0.5);
    expect(half.steps.length).toBeGreaterThan(1);
    half.steps.forEach(({ stepDb }) =>
      expect(stepDb).toBeLessThanOrEqual(LIVE_STEP_DB),
    );
    expect(half.steps.length).toBeLessThan(
      walk(undefined, target).steps.length,
    );
  });

  it('never walks from a hand edit of the engine file', () => {
    const edited: ISmartEqSettings = {
      filters: buildAt(undefined)(forming(0.5))?.filters ?? {},
      apoOverride: { filters: {} },
    };
    expect(stepTowardForming(edited, forming(1), buildAt(undefined))).toBe(
      undefined,
    );
    // The control: the same layer without the edit is walked.
    expect(
      stepTowardForming(
        { filters: edited.filters },
        forming(1),
        buildAt(undefined),
      ),
    ).toBeDefined();
  });

  it('starts from what plays, whatever it is', () => {
    // A curve already on (the song's own, or a walk under way) is the start:
    // the first step from it is a step, not a return to flat.
    const playing = buildAt(undefined)(forming(-0.6));
    const target = forming(1);
    const step = stepTowardForming(playing, target, buildAt(undefined));
    expect(step).toBeDefined();
    expect(heardDistance(playing, step?.layer)).toBeLessThanOrEqual(
      LIVE_STEP_DB,
    );
    const moved = gainsOf(step?.layer);
    const was = gainsOf(playing);
    // Every bass band moved up from where it was, toward +3.
    SMART_EQ_LAYOUT.filter(({ frequency }) => frequency < 200).forEach(
      ({ id }) => expect(moved[id]).toBeGreaterThan(was[id]),
    );
  });
});
