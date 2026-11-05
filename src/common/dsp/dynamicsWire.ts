/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  DYNAMICS_BANDS,
  DYNAMICS_RANGES,
  IDynamicsSettings,
} from './dynamicsStage';

/**
 * Dynamics on the rack's line: DYNA, schema, field count, then the switch,
 * five values a band and attack, release, mix and make-up (`FEQ_CHAIN_DYNAMICS_*` in
 * `chain.h`). After Footsteps' trailer when there is one, before the preset's
 * curve, and written only while the stage is on, so every rack without it is
 * the line it always was. An engine before 1.27 refuses the line whole, so
 * the app takes the trailer off for one (`ENGINE_DYNAMICS_SINCE`).
 */
export const CHAIN_DYNAMICS_TAG = 1146703425; // ASCII DYNA
export const CHAIN_DYNAMICS_SCHEMA = 1;
export const CHAIN_DYNAMICS_FIELDS = 20;
export const CHAIN_DYNAMICS_TRAILER = 23;

export const dynamicsTrailer = (dynamics: IDynamicsSettings): number[] => [
  CHAIN_DYNAMICS_TAG,
  CHAIN_DYNAMICS_SCHEMA,
  CHAIN_DYNAMICS_FIELDS,
  dynamics.enabled ? 1 : 0,
  ...dynamics.bands.flatMap((band) => [
    band.upThresholdDb,
    band.upRatio,
    band.upMaxDb,
    band.downThresholdDb,
    band.downRatio,
  ]),
  dynamics.attackMs,
  dynamics.releaseMs,
  dynamics.mix,
  dynamics.makeupDb,
];

const within = (value: number, range: { min: number; max: number }) =>
  value >= range.min && value <= range.max;

/** Whether a well-formed Dynamics trailer stands at `at`, as the engine reads one. */
export const isDynamicsTrailer = (
  values: readonly number[],
  at: number,
): boolean => {
  if (
    values[at] !== CHAIN_DYNAMICS_TAG ||
    values.length < at + CHAIN_DYNAMICS_TRAILER ||
    values[at + 1] !== CHAIN_DYNAMICS_SCHEMA ||
    values[at + 2] !== CHAIN_DYNAMICS_FIELDS ||
    (values[at + 3] !== 0 && values[at + 3] !== 1)
  ) {
    return false;
  }
  const r = DYNAMICS_RANGES;
  for (let band = 0; band < DYNAMICS_BANDS; band += 1) {
    const read = at + 4 + band * 5;
    if (
      !within(values[read], r.upThresholdDb) ||
      !within(values[read + 1], r.upRatio) ||
      !within(values[read + 2], r.upMaxDb) ||
      !within(values[read + 3], r.downThresholdDb) ||
      !within(values[read + 4], r.downRatio)
    ) {
      return false;
    }
  }
  const tail = at + 4 + DYNAMICS_BANDS * 5;
  return (
    within(values[tail], r.attackMs) &&
    within(values[tail + 1], r.releaseMs) &&
    within(values[tail + 2], r.mix) &&
    within(values[tail + 3], r.makeupDb)
  );
};
