/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  DYNAMICS_DEFAULTS,
  IDynamicsBand,
  IDynamicsSettings,
} from './dynamicsStage';

export const DYNAMICS_PRESET_GROUPS = ['basic', 'scene', 'gaming'] as const;

export type TDynamicsPresetGroup = (typeof DYNAMICS_PRESET_GROUPS)[number];

/** A profile owns the sound, never whether the stage runs. */
export type IDynamicsPresetSettings = Omit<
  IDynamicsSettings,
  'enabled' | 'presetId'
>;

export interface IDynamicsPreset {
  id: string;
  labelKey: string;
  group: TDynamicsPresetGroup;
  settings: IDynamicsPresetSettings;
}

/** A band that does nothing. */
const OFF: IDynamicsBand = {
  upThresholdDb: -40,
  upRatio: 1,
  upMaxDb: 0,
  downThresholdDb: -20,
  downRatio: 1,
};

/** Lift under `threshold` by `ratio`, at most `max` dB. */
const up = (threshold: number, ratio: number, max: number) => ({
  upThresholdDb: threshold,
  upRatio: ratio,
  upMaxDb: max,
});

/** Hold over `threshold` by `ratio`. */
const down = (threshold: number, ratio: number) => ({
  downThresholdDb: threshold,
  downRatio: ratio,
});

const band = (part: Partial<IDynamicsBand>): IDynamicsBand => ({
  ...OFF,
  ...part,
});

const profile = (
  low: Partial<IDynamicsBand>,
  mid: Partial<IDynamicsBand>,
  high: Partial<IDynamicsBand>,
  attackMs: number,
  releaseMs: number,
  makeupDb = 0,
): IDynamicsPresetSettings => ({
  bands: [band(low), band(mid), band(high)],
  attackMs,
  releaseMs,
  mix: 1,
  makeupDb,
});

/**
 * Every level here is dBFS of the band as the engine's detector reads it (a
 * full-scale sine is 0). Measured over eight recorded matches (CS2,
 * Valorant, Warzone, Apex, Hunt, RE2, RDR2, Dead Space), the 10th, 50th and
 * 90th percentiles of each band's 10 ms level sit around -45/-29/-20 for
 * the lows, -40/-27/-18 for the middle and -55/-42/-30 for the highs: the
 * highs carry far less energy, so their thresholds sit lower. A first set at
 * -42 to -45 throughout lifted nothing a game holds — its quiet moments were
 * all above it — and the holding profiles then only made it quieter.
 */
export const DYNAMICS_PRESET_BY_ID = {
  gentle: {
    id: 'gentle',
    labelKey: 'dsp.dynamicsPreset.gentle',
    group: 'basic',
    // A little of both ways on every band, slowly: the quiet passages of a
    // record a few dB up, the loud ones a little down, nothing heard moving.
    settings: profile(
      { ...up(-31, 1.4, 4), ...down(-19, 1.5) },
      { ...up(-27, 1.4, 4), ...down(-17, 1.5) },
      { ...up(-44, 1.4, 4), ...down(-30, 1.5) },
      15,
      300,
      0.5,
    ),
  },
  transparent: {
    id: 'transparent',
    labelKey: 'dsp.maximizerPreset.transparent',
    group: 'basic',
    // Small holds on the loudest passages, with no quiet-band lift.
    settings: profile(down(-18, 1.3), down(-16, 1.2), down(-28, 1.3), 30, 400),
  },
  punch: {
    id: 'punch',
    labelKey: 'dsp.maximizerPreset.punch',
    group: 'basic',
    // Slow attack lets the hit through; the body recovers before the next beat.
    settings: profile(
      down(-24, 2.5),
      down(-20, 1.8),
      down(-32, 1.5),
      40,
      100,
      1,
    ),
  },
  acoustic: {
    id: 'acoustic',
    labelKey: 'dsp.eqPreset.acoustic',
    group: 'basic',
    // Gently lift quiet string detail without filling the bass or flattening hits.
    settings: profile({}, up(-30, 1.3, 3), up(-46, 1.4, 3), 35, 450),
  },
  vocal: {
    id: 'vocal',
    labelKey: 'dsp.eqPreset.vocal',
    group: 'scene',
    // Stabilize the voice's body while holding boom and a sharp top.
    settings: profile(
      down(-25, 2),
      { ...up(-29, 1.6, 5), ...down(-18, 2) },
      down(-32, 2),
      12,
      220,
      0.5,
    ),
  },
  warm: {
    id: 'warm',
    labelKey: 'dsp.eqPreset.warm',
    group: 'basic',
    // Fill a quiet bass body; restrain bright passages rather than adding harmonics.
    settings: profile(up(-33, 1.5, 3), {}, down(-35, 2.5), 18, 350),
  },
  movie: {
    id: 'movie',
    labelKey: 'dsp.eqPreset.movie',
    group: 'scene',
    // Dialogue stays present between effects, with gentler control than Late night.
    settings: profile(
      down(-22, 2.5),
      { ...up(-30, 1.7, 6), ...down(-16, 1.8) },
      { ...up(-46, 1.3, 3), ...down(-29, 2) },
      10,
      300,
      0.8,
    ),
  },
  lateNight: {
    id: 'lateNight',
    labelKey: 'dsp.eqPreset.lateNight',
    group: 'scene',
    // The bass that travels through a wall held hard; the middle, where
    // speech is, brought up from quiet and held from loud; the top a little.
    settings: profile(
      down(-24, 4),
      { ...up(-27, 2, 10), ...down(-19, 3) },
      { ...up(-42, 1.6, 6), ...down(-30, 3) },
      5,
      200,
      2.3,
    ),
  },
  speech: {
    id: 'speech',
    labelKey: 'dsp.dynamicsPreset.speech',
    group: 'scene',
    // A talk, a podcast, a film's dialogue: a quiet voice brought to the
    // level of a loud one, the boom of a close microphone held.
    settings: profile(
      down(-26, 3),
      { ...up(-27, 1.8, 8), ...down(-17, 2.5) },
      { ...up(-42, 1.5, 5), ...down(-28, 2) },
      8,
      250,
      1.6,
    ),
  },

  // Gaming (the Gaming tab's only; `presetScope.tsx`).
  gameQuietLift: {
    id: 'gameQuietLift',
    labelKey: 'dsp.gamingPreset.quietLift',
    group: 'gaming',
    // Everything quiet over 150 Hz up — a distant voice, a creak, the room
    // around you — while the lows are left alone, so a quiet scene does not
    // fill with rumble. The Game filter lifts a step as it arrives; this
    // lifts what stays quiet.
    settings: profile({}, up(-26, 2, 10), up(-38, 2, 10), 8, 250),
  },
  gameBlastGuard: {
    id: 'gameBlastGuard',
    labelKey: 'dsp.gamingPreset.blastGuard',
    group: 'gaming',
    // A blast held where it happens: the lows hard and fast, the middle a
    // little, the top untouched so the cues over a fight keep their edge.
    // Released in 120 ms, so the step after it is heard.
    settings: profile(down(-24, 4), down(-18, 2.5), {}, 1, 120, 1.6),
  },
  gameNight: {
    id: 'gameNight',
    labelKey: 'dsp.eqPreset.lateNight',
    group: 'gaming',
    // Midnight: everything quiet up as far as 12 dB, everything loud held
    // at 6:1, so the whole game sits in a narrow band at a low volume.
    settings: profile(
      { ...up(-28, 2, 10), ...down(-24, 6) },
      { ...up(-25, 2, 12), ...down(-20, 6) },
      { ...up(-38, 2, 12), ...down(-32, 6) },
      3,
      180,
      2.9,
    ),
  },
  gameLongSession: {
    id: 'gameLongSession',
    labelKey: 'dsp.gamingPreset.longSession',
    group: 'gaming',
    // Hours of play: a gentle 1.5:1 both ways around the middle of the mix,
    // slow enough that nothing is heard working, so the ears tire less.
    settings: profile(
      { ...up(-30, 1.5, 6), ...down(-24, 1.5) },
      { ...up(-26, 1.5, 6), ...down(-20, 1.5) },
      { ...up(-40, 1.5, 6), ...down(-32, 1.5) },
      40,
      600,
      1.1,
    ),
  },
  gameCompetitiveLight: {
    id: 'gameCompetitiveLight',
    labelKey: 'dsp.gamingPreset.competitiveLight',
    group: 'gaming',
    // As little as helps: the lows held so a blast does not mask, the top
    // lifted a few dB where a step's detail is, the middle — voices, guns,
    // where distance is judged — never touched.
    settings: profile(down(-24, 3), {}, up(-44, 1.6, 5), 3, 150, 0.6),
  },
} satisfies Record<string, IDynamicsPreset>;

export type TDynamicsPresetId = keyof typeof DYNAMICS_PRESET_BY_ID;

export const DYNAMICS_PRESETS: readonly IDynamicsPreset[] = Object.values(
  DYNAMICS_PRESET_BY_ID,
);

export const isDynamicsPresetId = (id: string): id is TDynamicsPresetId =>
  Object.prototype.hasOwnProperty.call(DYNAMICS_PRESET_BY_ID, id);

/** The stage set to a profile; its own arrays, never the table's. */
export const dynamicsSettingsOf = (
  preset: IDynamicsPreset,
  enabled: boolean,
): IDynamicsSettings => ({
  ...DYNAMICS_DEFAULTS,
  ...preset.settings,
  bands: [
    { ...preset.settings.bands[0] },
    { ...preset.settings.bands[1] },
    { ...preset.settings.bands[2] },
  ],
  enabled,
  presetId: preset.id,
});

/** A fresh stage from a profile id, for a chain that names one. */
export const dynamicsPresetSettings = (
  id: TDynamicsPresetId,
  enabled: boolean,
): IDynamicsSettings => dynamicsSettingsOf(DYNAMICS_PRESET_BY_ID[id], enabled);
