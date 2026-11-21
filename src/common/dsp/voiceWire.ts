/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Voice stage on the rack's line: a tagged trailer of its own after
 * Dynamics' and before the preset's curve, written only while the stage is
 * on. `FEQ_CHAIN_VOICE_*` in `chain.h` is the other half; an engine before
 * 1.31 refuses a line with it, so `lineForEngine` takes it off for one.
 */

import { IVoiceSettings, VOICE_RANGES } from './voiceStage';

export const CHAIN_VOICE_TAG = 1448036675; // ASCII VOIC
export const CHAIN_VOICE_SCHEMA = 1;
export const CHAIN_VOICE_FIELDS = 10;
export const CHAIN_VOICE_TRAILER = 13;

export const voiceTrailer = (voice: IVoiceSettings): number[] => [
  CHAIN_VOICE_TAG,
  CHAIN_VOICE_SCHEMA,
  CHAIN_VOICE_FIELDS,
  voice.enabled ? 1 : 0,
  voice.lowCutHz,
  voice.proximityDb,
  voice.deplosive,
  voice.gateEnabled ? 1 : 0,
  voice.gateThresholdDb,
  voice.gateRangeDb,
  voice.gateHoldMs,
  voice.gateAttackMs,
  voice.gateReleaseMs,
];

const within = (value: number, range: { min: number; max: number }) =>
  value >= range.min && value <= range.max;

/** Whether a Voice trailer the engine would read starts at `at`. */
export const isVoiceTrailer = (
  values: readonly number[],
  at: number,
): boolean => {
  if (
    values[at] !== CHAIN_VOICE_TAG ||
    values.length < at + CHAIN_VOICE_TRAILER ||
    values[at + 1] !== CHAIN_VOICE_SCHEMA ||
    values[at + 2] !== CHAIN_VOICE_FIELDS
  ) {
    return false;
  }
  const r = VOICE_RANGES;
  const flag = (value: number) => value === 0 || value === 1;
  const lowCut = values[at + 4];
  return (
    flag(values[at + 3]) &&
    (lowCut === 0 || within(lowCut, r.lowCutHz)) &&
    within(values[at + 5], r.proximityDb) &&
    within(values[at + 6], r.deplosive) &&
    flag(values[at + 7]) &&
    within(values[at + 8], r.gateThresholdDb) &&
    within(values[at + 9], r.gateRangeDb) &&
    within(values[at + 10], r.gateHoldMs) &&
    within(values[at + 11], r.gateAttackMs) &&
    within(values[at + 12], r.gateReleaseMs)
  );
};
