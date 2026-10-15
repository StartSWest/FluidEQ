/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { DSP_DEFAULTS, IDspSettings, clampDspSettings } from './chain';

/**
 * The stages a listener can save a profile of, beside the ones that already
 * keep their own (the EQ's `userPresets.ts`, the Room's `savedRooms.ts`, the
 * whole rack's `userDspPresets.ts`). Each has a picker of profiles and a
 * `presetId` saying which one is showing. The Normalizer has neither: it is a
 * mode and two figures, with nothing to name.
 */
export const PRESET_STAGES = [
  'denoise',
  'deEsser',
  'exciter',
  'bassForge',
  'bassPunch',
  'dimension',
  'maximizer',
  'master',
] as const;

export type TPresetStage = (typeof PRESET_STAGES)[number];

/** A saved profile's id: whose it is, by the value alone, as `user:` is. */
export const stagePresetPrefix = (stage: TPresetStage): string =>
  `stage:${stage}:`;

export const isStagePresetId = (stage: TPresetStage, id: string): boolean =>
  id.startsWith(stagePresetPrefix(stage));

/** Isolate off on the stages that have it: a monitor is never a sound. */
const monitorOff = (stage: TPresetStage): Record<string, boolean> =>
  'isolate' in DSP_DEFAULTS[stage] ? { isolate: false } : {};

/**
 * What a saved profile keeps of a stage: its sound, read through the rack's
 * own clamp so a value from another build lands in range. Not whether the
 * stage runs, which profile was showing, or a monitor that was on.
 */
export const stagePresetSettings = <S extends TPresetStage>(
  stage: S,
  settings: unknown,
): IDspSettings[S] => {
  const raw = typeof settings === 'object' && settings !== null ? settings : {};
  return clampDspSettings({
    ...DSP_DEFAULTS,
    [stage]: {
      ...raw,
      ...monitorOff(stage),
      enabled: DSP_DEFAULTS[stage].enabled,
      presetId: '',
    },
  })[stage];
};

/**
 * A saved profile put on the stage: switched on, named by its id, and with
 * what is the listener's rather than the sound's kept from the stage as it
 * was — the Master's level-matched comparison, as its factory destinations
 * keep it, and the Exciter's oversampling, as its factory profiles do.
 */
export const applyStagePreset = <S extends TPresetStage>(
  stage: S,
  saved: IDspSettings[S],
  current: IDspSettings[S],
  id: string,
): IDspSettings[S] => {
  const listener: Record<string, unknown> = {
    ...('matchedBypass' in current
      ? { matchedBypass: current.matchedBypass }
      : {}),
    ...('oversampling' in current
      ? { oversampling: current.oversampling }
      : {}),
  };
  return clampDspSettings({
    ...DSP_DEFAULTS,
    [stage]: {
      ...saved,
      ...listener,
      ...monitorOff(stage),
      enabled: true,
      presetId: id,
    },
  })[stage];
};
