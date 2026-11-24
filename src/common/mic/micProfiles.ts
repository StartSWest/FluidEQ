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
 * Every profile is named stage presets and a tone: the low cut, cleaner,
 * gate, Voice level and Reverb from `micStagePresets.ts`, the de-esser,
 * compressor and limiter from the DSP catalogues' Mic group, and an EQ
 * curve of its own. A profile picked therefore leaves every stage on a
 * preset it can name (Ivan, 2026-11-24: each filter shows which preset it
 * is on), as a DSP chain does with its stage profiles.
 *
 * What every profile shares, and why:
 * - Low lag always (`gameMode`): the Maximizer at its shortest look-ahead,
 *   and the voice cleaner one device block ahead (engine 1.31).
 * - The de-esser listens to the whole voice, not the centre of a stereo
 *   picture: most mics are mono, and a stereo array's "centre" is the voice
 *   anyway.
 * - Voice level does the lifting and the limiter only catches: a limiter's
 *   drive lifts the room between words as much as the voice, and Voice
 *   level never lifts a room on its own (`voice_level.h`). "It lowers the
 *   volume, it makes it more gated" (Ivan, 2026-11-24) was the stock racks
 *   pressing with nothing giving the level back, and a gate in every one.
 * - Only Noisy room carries a gate, an expander of 12 dB.
 *
 * The values are starting points from broadcast and podcast practice, to be
 * measured on recorded voices before they are called finished.
 */

import { DSP_DEFAULTS } from '../dsp/chainDefaults';
import type { IDspSettings, IEqBandSettings } from '../dsp/chainSettings';
import { MAXIMIZER_MIN_LOOK_AHEAD_MS } from '../dsp/chainStageSettings';
import { deEsserPresetSettings, TDeEsserPresetId } from '../dsp/deEsserPresets';
import {
  dynamicsPresetSettings,
  TDynamicsPresetId,
} from '../dsp/dynamicsPresets';
import type { IDynamicsBand } from '../dsp/dynamicsStage';
import {
  maximizerPresetSettings,
  TMaximizerPresetId,
} from '../dsp/maximizerPresets';
import { REVERB_DEFAULTS } from '../dsp/reverbStage';
import { VOICE_DEFAULTS } from '../dsp/voiceStage';
import { micStagePreset, TMicPresetStage } from './micStagePresets';

export const MIC_PROFILE_GROUPS = ['use', 'mic', 'singing', 'fx'] as const;
export type TMicProfileGroup = (typeof MIC_PROFILE_GROUPS)[number];

/** [type, frequency, gain dB, Q] — the rack's own band types. */
type TBand = readonly [
  'PK' | 'LSC' | 'HSC' | 'HPQ' | 'LPQ',
  number,
  number,
  number,
];

interface IMicProfileRecipe {
  group: TMicProfileGroup;
  /** Stage presets by id (`micStagePresets.ts`); null is that stage off. */
  lowCut: string;
  cleaner: string | null;
  gate: string | null;
  level: string | null;
  reverb: string | null;
  /** The DSP catalogues' Mic group. */
  deEsser: TDeEsserPresetId | null;
  dynamics: TDynamicsPresetId | null;
  limiter: TMaximizerPresetId | null;
  eq: readonly TBand[];
}

/** The tones of the four that sing or talk to a room of their own. */
const SING_EQ: readonly TBand[] = [
  ['PK', 250, -2, 1],
  ['PK', 5000, 1.5, 1],
  ['HSC', 12000, 3, 0.7],
];
const STREAM_EQ: readonly TBand[] = [
  ['LSC', 120, 2, 0.7],
  ['PK', 320, -2.5, 1.2],
  ['PK', 3500, 3, 1],
  ['HSC', 10000, 2, 0.7],
];

const sing = (reverb: string): IMicProfileRecipe => ({
  group: 'singing',
  lowCut: 'deep',
  cleaner: null,
  gate: null,
  level: 'gentle',
  reverb,
  deEsser: 'micSoft',
  dynamics: 'micSinging',
  limiter: 'micCatch',
  eq: SING_EQ,
});

export const MIC_PROFILE_BY_ID = {
  stream: {
    group: 'use',
    lowCut: 'speech',
    cleaner: 'studio',
    gate: null,
    level: 'stream',
    reverb: null,
    deEsser: 'micPodcast',
    dynamics: 'micBroadcast',
    limiter: 'micStream',
    eq: STREAM_EQ,
  },
  podcast: {
    group: 'use',
    lowCut: 'deep',
    cleaner: 'light',
    gate: null,
    level: 'podcast',
    reverb: null,
    deEsser: 'micPodcast',
    dynamics: 'micGentle',
    limiter: 'micCalls',
    eq: [
      ['PK', 200, -1.5, 1],
      ['PK', 4000, 2, 1],
      ['HSC', 12000, 1.5, 0.7],
    ],
  },
  chat: {
    group: 'use',
    lowCut: 'rumble',
    cleaner: 'noisy',
    gate: null,
    level: 'stream',
    reverb: null,
    deEsser: 'micBright',
    dynamics: 'micCallouts',
    limiter: 'micLoud',
    eq: [
      ['LSC', 150, -3, 0.7],
      ['PK', 2500, 4, 0.9],
      ['HSC', 8000, -1, 0.7],
    ],
  },
  sing: {
    group: 'use',
    lowCut: 'deep',
    cleaner: null,
    gate: null,
    level: 'gentle',
    reverb: null,
    deEsser: 'micSoft',
    dynamics: 'micSinging',
    limiter: 'micCatch',
    eq: SING_EQ,
  },
  broadcast: {
    group: 'use',
    lowCut: 'speech',
    cleaner: 'light',
    gate: null,
    level: 'podcast',
    reverb: null,
    deEsser: 'micBright',
    dynamics: 'micBroadcast',
    limiter: 'micStream',
    eq: [
      ['LSC', 110, 3, 0.7],
      ['PK', 420, -3, 1.1],
      ['PK', 3000, 2.5, 1],
      ['HSC', 10000, 2, 0.7],
    ],
  },
  noisy: {
    group: 'use',
    lowCut: 'rumble',
    cleaner: 'fan',
    gate: 'calls',
    level: 'calls',
    reverb: null,
    deEsser: 'micPodcast',
    dynamics: 'micCallouts',
    limiter: 'micCalls',
    eq: [
      ['PK', 3000, 3, 1],
      ['HSC', 9000, -2, 0.7],
    ],
  },
  meet: {
    group: 'use',
    // Teams and Zoom clean the voice again on their side: a gentler hand
    // here, and no gate, which theirs would fight.
    lowCut: 'speech',
    cleaner: 'studio',
    gate: null,
    level: 'calls',
    reverb: null,
    deEsser: null,
    dynamics: 'micGentle',
    limiter: 'micCalls',
    eq: [
      ['PK', 2000, 2, 1],
      ['HSC', 8000, 1, 0.7],
    ],
  },
  laptop: {
    group: 'mic',
    // A laptop's array is far from the mouth and close to its own fan and
    // keys: the rumble guard, the cleaner hard, and the most lift.
    lowCut: 'rumble',
    cleaner: 'noisy',
    gate: null,
    level: 'soft',
    reverb: null,
    deEsser: 'micPodcast',
    dynamics: 'micGentle',
    limiter: 'micCalls',
    eq: [
      ['LSC', 200, 3, 0.7],
      ['PK', 1200, -2, 1.2],
      ['PK', 3500, 2, 1],
    ],
  },
  headset: {
    group: 'mic',
    lowCut: 'headset',
    cleaner: 'home',
    gate: null,
    level: 'everyday',
    reverb: null,
    deEsser: 'micPodcast',
    dynamics: 'micGentle',
    limiter: 'micCalls',
    eq: [
      ['LSC', 180, 2.5, 0.7],
      ['PK', 2800, -1.5, 1.4],
      ['HSC', 9000, 1, 0.7],
    ],
  },
  // Singing, each with its space (the plan's table, 2026-11-23).
  singPlate: sing('plate'),
  singHall: sing('hall'),
  singRoom: sing('intimate'),
  // Voice effects: what each does is all in the stages the tab shows.
  streamAir: {
    group: 'fx',
    lowCut: 'speech',
    cleaner: 'studio',
    gate: null,
    level: 'stream',
    reverb: 'streamAir',
    deEsser: 'micPodcast',
    dynamics: 'micBroadcast',
    limiter: 'micStream',
    eq: STREAM_EQ,
  },
  radio: {
    group: 'fx',
    // An old receiver: the band of an AM broadcast and its pressed level.
    lowCut: 'rumble',
    cleaner: 'studio',
    gate: null,
    level: 'stream',
    reverb: null,
    deEsser: null,
    dynamics: 'micCallouts',
    limiter: 'micCalls',
    eq: [
      ['HPQ', 300, 0, 0.71],
      ['PK', 1500, 4, 0.9],
      ['LPQ', 3800, 0, 0.71],
    ],
  },
  phone: {
    group: 'fx',
    // The telephone band, 300 Hz to 3.4 kHz, steep at both ends.
    lowCut: 'rumble',
    cleaner: 'studio',
    gate: null,
    level: 'calls',
    reverb: null,
    deEsser: null,
    dynamics: 'micBroadcast',
    limiter: 'micCatch',
    eq: [
      ['HPQ', 400, 0, 1],
      ['HPQ', 400, 0, 1],
      ['PK', 1800, 3, 1],
      ['LPQ', 3400, 0, 1],
      ['LPQ', 3400, 0, 1],
    ],
  },
  whisper: {
    group: 'fx',
    // A whisper brought forward: pressed hard, lifted most, air on top.
    lowCut: 'speech',
    cleaner: 'light',
    gate: null,
    level: 'soft',
    reverb: null,
    deEsser: 'micSoft',
    dynamics: 'micCallouts',
    limiter: 'micCalls',
    eq: [['HSC', 8000, 3, 0.7]],
  },
  megaphone: {
    group: 'fx',
    // A narrow, pushed middle and a short slap of room behind it.
    lowCut: 'rumble',
    cleaner: 'studio',
    gate: null,
    level: 'stream',
    reverb: 'intimate',
    deEsser: null,
    dynamics: 'micCallouts',
    limiter: 'micStream',
    eq: [
      ['HPQ', 600, 0, 0.9],
      ['PK', 1700, 6, 1.2],
      ['LPQ', 3000, 0, 0.9],
    ],
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

/**
 * A Dynamics preset pressing down only. The music presets also lift what
 * is quiet (upward compression), which on a live mic brings the room
 * forward between words: through the engine's graph the Meetings rack
 * played a -62 dB room at -53 (`mic_profiles_test.cpp`). The Mic group's
 * own presets already lift nothing; this holds whichever is named, and
 * keeps the preset's name so the compressor shows it.
 */
const pressingOnly = (id: TDynamicsPresetId): IDspSettings['dynamics'] => {
  const preset = dynamicsPresetSettings(id, true);
  const [low, mid, high] = preset.bands;
  const flat = (each: IDynamicsBand): IDynamicsBand => ({
    ...each,
    upRatio: 1,
    upMaxDb: 0,
  });
  return { ...preset, bands: [flat(low), flat(mid), flat(high)] };
};

/** A stage preset's values, which the profile table names by id. */
const stageValues = <S extends TMicPresetStage>(stage: S, id: string) => {
  const preset = micStagePreset(stage, id);
  if (!preset) {
    throw new Error(`No ${stage} preset "${id}" for a mic profile`);
  }
  return preset.values;
};

/** The whole mic rack a profile is, every array its own. */
export const micProfileSettings = (id: TMicProfileId): IDspSettings => {
  const recipe: IMicProfileRecipe = MIC_PROFILE_BY_ID[id];
  const { denoise } = DSP_DEFAULTS;
  return {
    ...DSP_DEFAULTS,
    enabled: true,
    presetId: '',
    gameMode: true,
    voice: {
      ...VOICE_DEFAULTS,
      enabled: true,
      ...stageValues('lowCut', recipe.lowCut),
      ...(recipe.gate
        ? { gateEnabled: true, ...stageValues('gate', recipe.gate) }
        : { gateEnabled: false }),
      ...(recipe.level
        ? { levelEnabled: true, ...stageValues('level', recipe.level) }
        : { levelEnabled: false }),
    },
    denoise: recipe.cleaner
      ? {
          ...denoise,
          enabled: true,
          // The cleaner alone: the hiss reducer is for recordings, and on a
          // live voice the cleaner already takes the room.
          hiss: { ...denoise.hiss, enabled: false },
          hum: { ...denoise.hum },
          click: { ...denoise.click },
          voice: {
            ...denoise.voice,
            enabled: true,
            amount: stageValues('denoise', recipe.cleaner).amount,
          },
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
      ? pressingOnly(recipe.dynamics)
      : DSP_DEFAULTS.dynamics,
    maximizer: recipe.limiter
      ? {
          ...maximizerPresetSettings(recipe.limiter, true),
          lookAheadMs: MAXIMIZER_MIN_LOOK_AHEAD_MS,
        }
      : DSP_DEFAULTS.maximizer,
    reverb: recipe.reverb
      ? { ...stageValues('reverb', recipe.reverb), enabled: true }
      : { ...REVERB_DEFAULTS },
  };
};

export const micProfileGroup = (id: TMicProfileId): TMicProfileGroup =>
  MIC_PROFILE_BY_ID[id].group;

/**
 * What the mic adds in delay with this rack, ms, as the engine reports it:
 * the voice cleaner one 10 ms hop plus one device block (taken as 10 ms),
 * the De-esser's 2 ms look-ahead, the Maximizer's. Everything else adds
 * none, the Reverb included (wet only, `reverb.h`).
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
