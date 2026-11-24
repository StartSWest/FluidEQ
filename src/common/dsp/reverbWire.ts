/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Reverb on the rack's line: a tagged trailer of its own after Voice's
 * and before the preset's curve, written only while the stage is on.
 * `FEQ_CHAIN_REVERB_*` in `chain.h` is the other half; an engine before
 * 1.33 refuses a line with it, so `lineForEngine` takes it off for one.
 */

import { IReverbSettings, REVERB_RANGES, REVERB_TYPES } from './reverbStage';

export const CHAIN_REVERB_TAG = 1380275778; // ASCII REVB
export const CHAIN_REVERB_SCHEMA = 1;
export const CHAIN_REVERB_FIELDS = 10;
export const CHAIN_REVERB_TRAILER = 13;

export const reverbTrailer = (reverb: IReverbSettings): number[] => [
  CHAIN_REVERB_TAG,
  CHAIN_REVERB_SCHEMA,
  CHAIN_REVERB_FIELDS,
  reverb.enabled ? 1 : 0,
  REVERB_TYPES.indexOf(reverb.type),
  reverb.mixDb,
  reverb.decayS,
  reverb.predelayMs,
  reverb.toneHz,
  reverb.lowCutHz,
  reverb.width,
  reverb.duck ? 1 : 0,
  reverb.duckDb,
];

const within = (value: number, range: { min: number; max: number }) =>
  value >= range.min && value <= range.max;

/** Whether a Reverb trailer the engine would read starts at `at`. */
export const isReverbTrailer = (
  values: readonly number[],
  at: number,
): boolean => {
  if (
    values[at] !== CHAIN_REVERB_TAG ||
    values.length < at + CHAIN_REVERB_TRAILER ||
    values[at + 1] !== CHAIN_REVERB_SCHEMA ||
    values[at + 2] !== CHAIN_REVERB_FIELDS
  ) {
    return false;
  }
  const r = REVERB_RANGES;
  const flag = (value: number) => value === 0 || value === 1;
  const type = values[at + 4];
  return (
    flag(values[at + 3]) &&
    Number.isInteger(type) &&
    type >= 0 &&
    type < REVERB_TYPES.length &&
    within(values[at + 5], r.mixDb) &&
    within(values[at + 6], r.decayS) &&
    within(values[at + 7], r.predelayMs) &&
    within(values[at + 8], r.toneHz) &&
    within(values[at + 9], r.lowCutHz) &&
    within(values[at + 10], r.width) &&
    flag(values[at + 11]) &&
    within(values[at + 12], r.duckDb)
  );
};
