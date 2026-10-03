/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import path from 'path';
import { clampDspSettings, DSP_DEFAULTS } from '../common/dsp/chain';
import { DEFAULT_EQ_CUTS, toEqCuts } from '../common/eqCuts';
import { isCurveComparison } from '../common/curveComparison';
import { DEFAULT_TREBLE_DESIGN, isTrebleDesign } from '../common/filterDesign';
import type { IOutputSound } from '../common/outputSettings';
import { outputDesignsOf } from './outputDesigns';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/** Absence remains distinct from an explicit default until legacy import. */
export const sanitizeOutputSound = (value: unknown): IOutputSound => {
  const input = isRecord(value) ? value : {};
  const treble = isRecord(input.trebleDesigns) ? input.trebleDesigns : {};
  const designs = outputDesignsOf({
    trebleDesigns: {
      eq: isTrebleDesign(treble.eq) ? treble.eq : DEFAULT_TREBLE_DESIGN,
      curves: isTrebleDesign(treble.curves)
        ? treble.curves
        : DEFAULT_TREBLE_DESIGN,
    },
    eqPhase: isCurveComparison(input.eqPhase) ? input.eqPhase : undefined,
    curvePhase: isCurveComparison(input.curvePhase)
      ? input.curvePhase
      : undefined,
  });
  return {
    dsp:
      input.dsp === undefined
        ? undefined
        : clampDspSettings(isRecord(input.dsp) ? input.dsp : {}),
    eqCuts:
      input.eqCuts === undefined
        ? undefined
        : (toEqCuts(input.eqCuts) ?? { ...DEFAULT_EQ_CUTS }),
    trebleDesigns:
      input.trebleDesigns === undefined ? undefined : designs.trebleDesigns,
    eqPhase: input.eqPhase === undefined ? undefined : designs.eqPhase,
    curvePhase: input.curvePhase === undefined ? undefined : designs.curvePhase,
  };
};

/** Monitor switches are session actions, never a cold-start sound choice. */
export const restoreOutputSound = (value: unknown): IOutputSound => {
  const sound = sanitizeOutputSound(value);
  if (sound.dsp) {
    sound.dsp.eq.isolate = false;
    sound.dsp.exciter.isolate = false;
    sound.dsp.bassForge.isolate = false;
    sound.dsp.bassPunch.isolate = false;
    sound.dsp.denoise.isolate = false;
  }
  return sound;
};

export const defaultOutputSound = (): Required<IOutputSound> => ({
  dsp: clampDspSettings(DSP_DEFAULTS),
  eqCuts: { ...DEFAULT_EQ_CUTS },
  ...outputDesignsOf({}),
});

const profileSounds = new Map<
  string,
  { contents: string; sound: IOutputSound }
>();

/**
 * Config flushes read saved profiles after every edit. Re-applying cold-start
 * monitor clearing there would turn an active isolate off at the next EQ drag.
 */
export const readProfileOutputSound = (
  filePath: string,
  contents: string,
  value: unknown,
): IOutputSound => {
  const key = path.resolve(filePath);
  const cached = profileSounds.get(key);
  if (cached?.contents === contents) {
    return sanitizeOutputSound(cached.sound);
  }
  const sound = restoreOutputSound(value);
  profileSounds.set(key, { contents, sound });
  return sanitizeOutputSound(sound);
};

export const rememberProfileOutputSound = (
  filePath: string,
  contents: string,
  value: unknown,
): void => {
  profileSounds.set(path.resolve(filePath), {
    contents,
    sound: sanitizeOutputSound(value),
  });
};

export const forgetProfileOutputSound = (filePath: string): void => {
  profileSounds.delete(path.resolve(filePath));
};

export const moveProfileOutputSound = (
  oldPath: string,
  newPath: string,
): void => {
  const oldKey = path.resolve(oldPath);
  const newKey = path.resolve(newPath);
  const cached = profileSounds.get(oldKey);
  profileSounds.delete(oldKey);
  if (cached) {
    profileSounds.set(newKey, cached);
  } else {
    profileSounds.delete(newKey);
  }
};
