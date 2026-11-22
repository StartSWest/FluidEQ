/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Ready-made mic profiles, like Gaming's per-game sounds: each one a whole
 * mic rack built from the rack's own stages, never changed by tuning (a mic
 * keeps its own copy in `mic-sound.json`).
 *
 * What every profile shares, and why:
 * - Low lag always (`gameMode`): the Maximizer at its shortest look-ahead,
 *   and the voice cleaner one device block ahead (engine 1.31).
 * - The de-esser listens to the whole voice, not the centre of a stereo
 *   picture: most mics are mono, and a stereo array's "centre" is the voice
 *   anyway.
 * - The rack's EQ carries the tone; the Voice stage the low cut, the
 *   proximity shelf, the pop guard and the gate.
 *
 * The values are starting points from broadcast and podcast practice, to be
 * measured on recorded voices before they are called finished.
 */

import { DSP_DEFAULTS } from './chainDefaults';
import type { IDspSettings, IEqBandSettings } from './chainSettings';
import { MAXIMIZER_MIN_LOOK_AHEAD_MS } from './chainStageSettings';
import { deEsserPresetSettings, TDeEsserPresetId } from './deEsserPresets';
import { dynamicsPresetSettings, TDynamicsPresetId } from './dynamicsPresets';
import { IVoiceSettings, VOICE_DEFAULTS } from './voiceStage';

export const MIC_PROFILE_GROUPS = ['use', 'mic'] as const;
export type TMicProfileGroup = (typeof MIC_PROFILE_GROUPS)[number];

/** [type, frequency, gain dB, Q] — the rack's own band types. */
type TBand = readonly ['PK' | 'LSC' | 'HSC', number, number, number];

interface IMicProfileRecipe {
  group: TMicProfileGroup;
  voice: Partial<IVoiceSettings>;
  /** 0 is off; otherwise how much of the voice cleaner. */
  cleaner: number;
  deEsser: TDeEsserPresetId | null;
  eq: readonly TBand[];
  dynamics: TDynamicsPresetId | null;
  /** The Maximizer's ceiling, dB, or null for none. */
  limiter: number | null;
}

const gate = (thresholdDb: number, rangeDb: number) => ({
  gateEnabled: true,
  gateThresholdDb: thresholdDb,
  gateRangeDb: rangeDb,
});

export const MIC_PROFILE_BY_ID = {
  stream: {
    group: 'use',
    voice: { lowCutHz: 80, proximityDb: 2, deplosive: 0.6, ...gate(-52, 12) },
    cleaner: 0.55,
    deEsser: 'podcast',
    eq: [
      ['LSC', 120, 2, 0.7],
      ['PK', 320, -2.5, 1.2],
      ['PK', 3500, 3, 1],
      ['HSC', 10000, 2, 0.7],
    ],
    dynamics: 'speech',
    limiter: -1,
  },
  podcast: {
    group: 'use',
    voice: { lowCutHz: 70, proximityDb: 1.5, deplosive: 0.6, ...gate(-56, 8) },
    cleaner: 0.4,
    deEsser: 'podcast',
    eq: [
      ['PK', 200, -1.5, 1],
      ['PK', 4000, 2, 1],
      ['HSC', 12000, 1.5, 0.7],
    ],
    dynamics: 'speech',
    limiter: -1,
  },
  chat: {
    group: 'use',
    voice: { lowCutHz: 120, deplosive: 0.8, ...gate(-45, 30) },
    cleaner: 0.8,
    deEsser: 'gameCallouts',
    eq: [
      ['LSC', 150, -3, 0.7],
      ['PK', 2500, 4, 0.9],
      ['HSC', 8000, -1, 0.7],
    ],
    dynamics: 'speech',
    limiter: -3,
  },
  sing: {
    group: 'use',
    voice: { lowCutHz: 60, deplosive: 0.4 },
    cleaner: 0,
    deEsser: 'vocalMusic',
    eq: [
      ['PK', 250, -2, 1],
      ['PK', 5000, 1.5, 1],
      ['HSC', 12000, 3, 0.7],
    ],
    dynamics: 'vocal',
    limiter: -1,
  },
  broadcast: {
    group: 'use',
    voice: { lowCutHz: 75, deplosive: 0.7, ...gate(-50, 10) },
    cleaner: 0.3,
    deEsser: 'harshStreams',
    eq: [
      ['LSC', 110, 3, 0.7],
      ['PK', 420, -3, 1.1],
      ['PK', 3000, 2.5, 1],
      ['HSC', 10000, 2, 0.7],
    ],
    dynamics: 'lateNight',
    limiter: -1,
  },
  noisy: {
    group: 'use',
    voice: { lowCutHz: 140, deplosive: 0.8, ...gate(-40, 40) },
    cleaner: 1,
    deEsser: 'podcast',
    eq: [
      ['PK', 3000, 3, 1],
      ['HSC', 9000, -2, 0.7],
    ],
    dynamics: 'speech',
    limiter: -2,
  },
  meet: {
    group: 'use',
    // Teams and Zoom clean the voice again on their side: a gentler hand
    // here, and no gate, which theirs would fight.
    voice: { lowCutHz: 100, deplosive: 0.6 },
    cleaner: 0.5,
    deEsser: null,
    eq: [
      ['PK', 2000, 2, 1],
      ['HSC', 8000, 1, 0.7],
    ],
    dynamics: 'speech',
    limiter: -3,
  },
  laptop: {
    group: 'mic',
    voice: { lowCutHz: 130, deplosive: 0.4, ...gate(-48, 18) },
    cleaner: 0.85,
    deEsser: 'podcast',
    eq: [
      ['LSC', 200, 3, 0.7],
      ['PK', 1200, -2, 1.2],
      ['PK', 3500, 2, 1],
    ],
    dynamics: 'speech',
    limiter: -2,
  },
  headset: {
    group: 'mic',
    voice: { lowCutHz: 100, proximityDb: 4, deplosive: 0.9, ...gate(-50, 15) },
    cleaner: 0.6,
    deEsser: 'podcast',
    eq: [
      ['LSC', 180, 2.5, 0.7],
      ['PK', 2800, -1.5, 1.4],
      ['HSC', 9000, 1, 0.7],
    ],
    dynamics: 'speech',
    limiter: -2,
  },
} as const satisfies Record<string, IMicProfileRecipe>;

export type TMicProfileId = keyof typeof MIC_PROFILE_BY_ID;

export const MIC_PROFILE_IDS = Object.keys(
  MIC_PROFILE_BY_ID,
) as TMicProfileId[];

export const isMicProfileId = (id: string): id is TMicProfileId =>
  Object.prototype.hasOwnProperty.call(MIC_PROFILE_BY_ID, id);

const band = ([type, frequency, gainDb, quality]: TBand): IEqBandSettings => ({
  enabled: true,
  type,
  frequency,
  gainDb,
  quality,
  dynamic: false,
  thresholdDb: -24,
});

/** The whole mic rack a profile is, every array its own. */
export const micProfileSettings = (id: TMicProfileId): IDspSettings => {
  const recipe: IMicProfileRecipe = MIC_PROFILE_BY_ID[id];
  const { denoise } = DSP_DEFAULTS;
  return {
    ...DSP_DEFAULTS,
    enabled: true,
    presetId: '',
    gameMode: true,
    voice: { ...VOICE_DEFAULTS, ...recipe.voice, enabled: true },
    denoise:
      recipe.cleaner > 0
        ? {
            ...denoise,
            enabled: true,
            // The cleaner alone: the hiss reducer is for recordings, and on a
            // live voice the cleaner already takes the room.
            hiss: { ...denoise.hiss, enabled: false },
            hum: { ...denoise.hum },
            click: { ...denoise.click },
            voice: { ...denoise.voice, enabled: true, amount: recipe.cleaner },
          }
        : DSP_DEFAULTS.denoise,
    deEsser: recipe.deEsser
      ? { ...deEsserPresetSettings(recipe.deEsser, true), centreOnly: false }
      : DSP_DEFAULTS.deEsser,
    eq: {
      ...DSP_DEFAULTS.eq,
      enabled: recipe.eq.length > 0,
      bands: recipe.eq.map(band),
      sourceBands: [],
      presetId: '',
    },
    dynamics: recipe.dynamics
      ? dynamicsPresetSettings(recipe.dynamics, true)
      : DSP_DEFAULTS.dynamics,
    maximizer:
      recipe.limiter === null
        ? DSP_DEFAULTS.maximizer
        : {
            ...DSP_DEFAULTS.maximizer,
            enabled: true,
            driveDb: 0,
            ceilingDb: recipe.limiter,
            lookAheadMs: MAXIMIZER_MIN_LOOK_AHEAD_MS,
          },
  };
};

export const micProfileGroup = (id: TMicProfileId): TMicProfileGroup =>
  MIC_PROFILE_BY_ID[id].group;

/**
 * What the mic adds in delay with this rack, ms, as the engine reports it:
 * the voice cleaner one 10 ms hop plus one device block (taken as 10 ms),
 * the De-esser's 2 ms look-ahead, the Maximizer's. Everything else adds none.
 */
export const micRackDelayMs = (settings: IDspSettings): number => {
  if (!settings.enabled) {
    return 0;
  }
  const cleaner =
    settings.denoise.enabled && settings.denoise.voice.enabled ? 20 : 0;
  const deEsser = settings.deEsser.enabled ? 2 : 0;
  const limiter = settings.maximizer.enabled
    ? settings.maximizer.lookAheadMs
    : 0;
  return cleaner + deEsser + limiter;
};
