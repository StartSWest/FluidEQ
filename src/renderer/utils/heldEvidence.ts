/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IBalanceCaptureState } from './autoBalanceCapture';

/**
 * Fold what a run-out hold heard into the measurement.
 *
 * The full-band gate holds when a range drops under its floor and waits up to
 * twenty seconds for it (`fullBandGate.ts`). When it waits that out, its own
 * conclusion is that the absence is the record — and then every frame it
 * held was a frame of the record, as good as any heard afterwards. They were
 * thrown away, so a record with no air started learning from nothing at
 * twenty seconds. Now they are kept aside while the hold lasts
 * (`heldEvidence` on the capture) and counted here once it runs out; a hold
 * the record ends is still thrown away whole.
 *
 * Exactly what learning those frames in order would have left, for every
 * quantity that is a sum: the spectrum's power and weight, each range's
 * presence, its weighted Welford state (merged by Chan's rule), and the
 * listened time. A forgetting window (`halfLifeMs`) ages what came before by
 * the hold's listened time first, as learning through it would have. The
 * typical levels are the held capture's, which went on following the record
 * while the measurement's stood still.
 *
 * Mutates `state`.
 */
const mergeHeldEvidence = (
  state: IBalanceCaptureState,
  held: IBalanceCaptureState,
): void => {
  const keep =
    state.halfLifeMs && held.listenedMs > 0
      ? 0.5 ** (held.listenedMs / state.halfLifeMs)
      : 1;
  for (let index = 0; index < state.power.length; index += 1) {
    state.power[index] = state.power[index] * keep + held.power[index];
    state.weight[index] = state.weight[index] * keep + held.weight[index];
  }
  for (let index = 0; index < state.presenceSum.length; index += 1) {
    state.presenceSum[index] =
      state.presenceSum[index] * keep + held.presenceSum[index];
    state.presenceWeight[index] =
      state.presenceWeight[index] * keep + held.presenceWeight[index];
  }
  state.regionStates.forEach((region, index) => {
    const other = held.regionStates[index];
    const weightA = region.weight * keep;
    const weight = weightA + other.weight;
    if (!(weight > 0)) {
      return;
    }
    const delta = other.mean - region.mean;
    /* eslint-disable no-param-reassign -- merged in place, like the accumulator it belongs to */
    region.m2 =
      region.m2 * keep +
      other.m2 +
      (delta * delta * weightA * other.weight) / weight;
    region.mean += (delta * other.weight) / weight;
    region.weight = weight;
    /* eslint-enable no-param-reassign */
  });
  state.typicalDb.set(held.typicalDb);
  state.listenedMs += held.listenedMs;
  state.acceptedFrames += held.acceptedFrames;
};

export default mergeHeldEvidence;
