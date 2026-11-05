/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Which parts of a game's copy have been tuned away from the profile it came
 * from, for the Gaming Lab to mark them "tuned" (Ivan, 2026-11-02: each game
 * a copy "tuned more for their taste").
 *
 * Measured against the copy as it was made (main keeps that beside it), by
 * part: the copy is saved by every edit wherever it was made — the Gaming
 * Lab, the EQ page, a profile the listener loaded — so comparing the two
 * files is the one answer that is right whatever did the tuning.
 */

import { clampDspSettings, IDspSettings } from './dsp/chain';
import type { IPresetV2 } from './profileTypes';
import { toTone } from './tone';

export const GAME_SOUND_PARTS = [
  'footsteps',
  'mainEq',
  'curve',
  'normalizer',
  'denoise',
  'deEsser',
  'exciter',
  'bassForge',
  'eq',
  'bassPunch',
  'dimension',
  'room',
  // 10. DSP's stage from engine 1.27, in the rack's order: without it here
  // the Lab drew its part with no lamp and never called it tuned.
  'dynamics',
  'maximizer',
  'master',
] as const;

export type TGameSoundPart = (typeof GAME_SOUND_PARTS)[number];

type TRackPart = Exclude<TGameSoundPart, 'mainEq' | 'curve'>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** JSON with every object's keys in order: two writes of one value agree. */
const stable = (value: unknown): string => {
  if (Array.isArray(value)) {
    return `[${value.map(stable).join(',')}]`;
  }
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .filter((key) => value[key] !== undefined)
      .map((key) => `${JSON.stringify(key)}:${stable(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
};

/**
 * A rack stage as it sounds. Isolate is a way of listening to a stage, not
 * something it does, so a stage soloed for a moment is not "tuned".
 */
const rackPart = (dsp: IDspSettings, part: TRackPart): string => {
  const settings: Record<string, unknown> = { ...dsp[part] };
  delete settings.isolate;
  return stable(settings);
};

/** The fingerprint of each part, by the rule above. */
const partsOf = (sound: IPresetV2): Record<TGameSoundPart, string> => {
  const dsp = clampDspSettings(sound.dsp);
  return {
    // The bands and the Tone, which the EQ part edits as the EQ page does
    // (its row under the bands when none is selected): the Lab lists no
    // Tone of its own (Ivan, 2026-11-03). Not the preamp: Auto normalize
    // moves it while music plays, and a level the app set is not a tuning.
    mainEq: stable({
      bands: sound.filters ?? {},
      tone: toTone(sound.tone) ?? null,
    }),
    // Every curve the Curve part shows as a chip, the profile's own game
    // curve among them (`gameCurves.ts`): taken off or turned down, the
    // game's curve is tuned.
    curve: stable({
      headphone: sound.headphone,
      eqImport: sound.eqImport,
      headset: sound.headset,
      headsetTarget: sound.headsetTarget,
      headsetSource: sound.headsetSource,
      voicing: sound.voicing,
    }),
    footsteps: rackPart(dsp, 'footsteps'),
    normalizer: rackPart(dsp, 'normalizer'),
    denoise: rackPart(dsp, 'denoise'),
    deEsser: rackPart(dsp, 'deEsser'),
    exciter: rackPart(dsp, 'exciter'),
    bassForge: rackPart(dsp, 'bassForge'),
    eq: rackPart(dsp, 'eq'),
    bassPunch: rackPart(dsp, 'bassPunch'),
    dimension: rackPart(dsp, 'dimension'),
    room: rackPart(dsp, 'room'),
    dynamics: rackPart(dsp, 'dynamics'),
    maximizer: rackPart(dsp, 'maximizer'),
    master: rackPart(dsp, 'master'),
  };
};

/** The parts of `copy` that differ from `origin`, in the Lab's order. */
export const tunedGameParts = (
  copy: IPresetV2,
  origin: IPresetV2,
): TGameSoundPart[] => {
  const now = partsOf(copy);
  const was = partsOf(origin);
  return GAME_SOUND_PARTS.filter((part) => now[part] !== was[part]);
};
