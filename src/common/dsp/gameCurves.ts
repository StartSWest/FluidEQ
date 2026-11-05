/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IVoicingSettings } from '../constants';
import type { TranslationKey } from '../i18n/en';
import { DSP_DEFAULTS, IEqSettings } from './chain';
import { EQ_PRESETS, eqSettingsForPreset, IEqPreset } from './eqPresets';
import type { IFootstepsPreset } from './footstepsPresets';
import { presetCurve } from './presetCurve';
import { dspPresetVoicing } from './presetVoicing';

/**
 * The curves a game's own sound starts from, one per kind of game (Ivan,
 * 2026-11-03: "we draw our own curves" instead of every Gaming profile
 * inheriting the one curve the Gaming chains share, and "make sure those
 * gaming curves show with their name"). A game's copy plays its profile's
 * curve as its Preset layer, named here — "Competitive", "Any game" — and
 * Reset goes back to it; the Gaming chains on the EQ page keep theirs.
 *
 * Fifteen gains on the canonical rack, built as every factory curve is
 * (`eqSettingsForPreset`, then `presetCurve`) on the Gaming curve's own
 * model, so a game curve and the Gaming curve differ in shape and in
 * nothing else. Each is level with the Gaming curve as the ear weighs it:
 * `heardLevel` of `withCurve` (`.erb/scripts/preset-hearing.ts`) over thirty
 * seconds of each of 22 recorded matches of 21 titles, every curve shifted
 * as a whole (-0.5 to +0.9 dB), never reshaped, and left within 0.04 dB of
 * the Gaming curve, the matches agreeing within 0.16 dB. None of them wins a
 * comparison by being louder. Retune a shape, measure it again the same way.
 */

export const GAME_CURVE_IDS = [
  'competitive',
  'battle',
  'tactical',
  'moba',
  'rpg',
  'story',
  'any',
] as const;

export type TGameCurveId = (typeof GAME_CURVE_IDS)[number];

interface IGameCurveDef {
  labelKey: TranslationKey;
  /**
   * One gain in dB per band of the canonical rack, as `IEqPreset.gains`:
   * 32, 50, 80, 125, 200, 315, 500 and 800 Hz, then 1.25, 2, 3.15, 5, 8,
   * 12.5 and 16 kHz.
   */
  gains: readonly number[];
}

const GAME_CURVE_TABLE: Record<TGameCurveId, IGameCurveDef> = {
  // Steps and reloads at 2-8 kHz forward, the 125-500 Hz an explosion fills
  // the room with down (most at 200-315), no sub lift; the top kept, where a
  // game's own 3D sound says above and behind.
  competitive: {
    labelKey: 'dsp.footstepsPreset.competitive',
    gains: [-2.5, -2, -1, -2, -4, -4, -2.5, -1, 0, 2, 3, 2.5, 2, 1, 0],
  },
  // Far steps under explosions that never stop: the deepest cut below
  // 500 Hz and the most lift at 3.15-5 kHz.
  battle: {
    labelKey: 'dsp.footstepsPreset.battleRoyale',
    gains: [
      -3.3, -2.8, -1.8, -2.8, -4.3, -3.8, -2.3, -0.8, 0.2, 2.2, 3.7, 3.2, 1.7,
      0.7, -0.3,
    ],
  },
  // A world kept as it sounds: boots, hooves and vehicles keep their weight
  // (125-500 Hz cut by 2 dB at most), the cues forward without a shooter's
  // edge.
  tactical: {
    labelKey: 'dsp.footstepsPreset.tactical',
    gains: [
      0.5, 0.5, 0, -1, -1.5, -2, -1.5, -0.5, 0.5, 1.5, 2.5, 2, 1.5, 1, 0.5,
    ],
  },
  // Seen from above, nothing behind anybody: ability cues and hero lines at
  // 1.25-5 kHz clear of the team fight, little bass.
  moba: {
    labelKey: 'dsp.footstepsPresetGroup.moba',
    gains: [
      -0.6, -0.6, -0.1, -0.1, -0.6, -1.1, -0.6, 0.4, 1.4, 1.9, 2.4, 1.9, 1.4,
      0.9, 0.4,
    ],
  },
  // A world to be in: the score and the spells keep their size, quest
  // dialogue a little forward, the top's air kept.
  rpg: {
    labelKey: 'dsp.footstepsPresetGroup.rpg',
    gains: [
      1.7, 1.7, 1.2, 0.2, -0.8, -1.3, -0.8, 0.2, 0.7, 1.2, 1.7, 1.2, 1.2, 1.2,
      0.7,
    ],
  },
  // The dread in the sub, every line of dialogue forward at 1.25-3.15 kHz,
  // the steps of whatever hunts you lifted, the top falling away so a scream
  // does not bite.
  story: {
    labelKey: 'dsp.footstepsPreset.story',
    gains: [
      2.6, 2.1, 1.1, 0.1, -0.9, -1.4, -0.4, 0.6, 1.6, 2.6, 2.6, 2.1, 1.1, 0.6,
      0.1,
    ],
  },
  // For a game nobody tuned for: a little weight, the mud out, cues and
  // voices a touch forward.
  any: {
    labelKey: 'gaming.curve.any',
    gains: [
      1.3, 1.3, 0.8, -0.2, -1.2, -1.7, -0.7, 0.3, 0.8, 1.5, 1.8, 1.5, 1.3, 1.1,
      0.6,
    ],
  },
};

/** What a game curve's Preset layer is called after `dsp:`. */
const VOICING_PREFIX = 'game-';

/**
 * The top three bands, 8 to 16 kHz: where a game's own headphone mode
 * puts above and behind, which a title rendering its own 3D sound
 * (`room: 'own3d'`) never has eased. On these curves that is Battle
 * royale's 16 kHz alone (Call of Duty, Fortnite, PUBG, Battlefield 6);
 * written as a rule so a retuned curve keeps it. A level shift that small
 * (one band, 0.3 dB at 16 kHz) moves no loudness worth matching.
 */
const OWN_3D_TOP = [12, 13, 14];

const ownTopKept = (gains: readonly number[]): number[] =>
  gains.map((gain, band) =>
    OWN_3D_TOP.includes(band) ? Math.max(gain, 0) : gain,
  );

/** The Gaming curve's setup: the model its shape was drawn through. */
const GAMING_SETUP = EQ_PRESETS.find((preset) => preset.id === 'gaming')?.setup;

/** A curve from fifteen gains, as a factory preset's is made. */
export const gameCurveOfGains = (
  id: string,
  gains: readonly number[],
): IEqSettings | undefined => {
  const entry: IEqPreset = {
    id,
    labelKey: '',
    group: 'scene',
    gains,
    setup: GAMING_SETUP,
  };
  return presetCurve(
    eqSettingsForPreset({ ...DSP_DEFAULTS.eq, enabled: true }, entry),
  );
};

export interface IGameCurve {
  /** The Preset layer's id after `dsp:`, `game-<curve>` or `game-<curve>-3d`. */
  voicingId: string;
  curveId: TGameCurveId;
  labelKey: TranslationKey;
  gains: readonly number[];
}

const curveFor = (curveId: TGameCurveId, own3d: boolean): IGameCurve => {
  const { labelKey, gains } = GAME_CURVE_TABLE[curveId];
  const kept = own3d ? ownTopKept(gains) : [...gains];
  const isVariant = kept.some((gain, band) => gain !== gains[band]);
  return {
    voicingId: `${VOICING_PREFIX}${curveId}${isVariant ? '-3d' : ''}`,
    curveId,
    labelKey,
    gains: kept,
  };
};

/** The Preset layer's id a game curve plays as, as its chip names it. */
export const gameCurveVoicingId = (curveId: TGameCurveId): string =>
  curveFor(curveId, false).voicingId;

/** Every curve a Preset layer can name, the own-3D variants included. */
const ALL_CURVES: readonly IGameCurve[] = GAME_CURVE_IDS.flatMap((id) => {
  const plain = curveFor(id, false);
  const kept = curveFor(id, true);
  return kept.voicingId === plain.voicingId ? [plain] : [plain, kept];
});

/** The game curve a Preset layer's id names, or undefined for any other. */
export const gameCurveOfVoicing = (
  voicingId: string | undefined,
): IGameCurve | undefined =>
  voicingId === undefined
    ? undefined
    : ALL_CURVES.find((curve) => curve.voicingId === voicingId);

/** Whether a Preset layer's id names a game curve. */
export const isGameCurveVoicing = (voicingId: string | undefined): boolean =>
  gameCurveOfVoicing(voicingId) !== undefined;

/** A game curve's bands, for its Preset layer. */
export const gameCurveSettings = (curve: IGameCurve): IEqSettings | undefined =>
  gameCurveOfGains(curve.voicingId, curve.gains);

/** The Preset layer a game curve plays as, named by its own id. */
export const gameCurveVoicing = (
  voicingId: string,
): IVoicingSettings | undefined => {
  const curve = gameCurveOfVoicing(voicingId);
  const settings = curve ? gameCurveSettings(curve) : undefined;
  return curve && settings
    ? dspPresetVoicing(curve.voicingId, settings)
    : undefined;
};

// Top-down (MOBA, RTS, strategy) and Worlds (MMO, open-world RPG) are the
// title groups' own kinds; Speed (racing) and Impact (fighting, action,
// sports) have no curve drawn for them yet and start from Any game until
// one is (2026-11-03, the day 10. DSP added the four).
const KIND_CURVES: Readonly<Record<string, TGameCurveId>> = {
  competitive: 'competitive',
  battleRoyale: 'battle',
  tactical: 'tactical',
  story: 'story',
  immersive: 'any',
  topDown: 'moba',
  worlds: 'rpg',
  speed: 'any',
  impact: 'any',
};

const GROUP_CURVES: Readonly<Record<string, TGameCurveId>> = {
  competitive: 'competitive',
  battle: 'battle',
  tactical: 'tactical',
  moba: 'moba',
  rpg: 'rpg',
  story: 'story',
};

/**
 * The curve a ready-made Gaming profile starts a game from: its kind's, or
 * its title's group's, with the top kept for a title that renders its own
 * 3D sound. None for a title kept as it was mixed (`room: 'none'`, Alien:
 * Isolation — Ivan, 2026-11-01: more frightening as it was mixed), which
 * plays no curve either. A kind or a group added later with no curve of its
 * own starts from Any game rather than from nothing: four kinds arrived in
 * one afternoon, and a missing entry played them flat with no word of it.
 */
export const gameCurveForProfile = (
  preset: IFootstepsPreset,
): IGameCurve | undefined => {
  if (preset.room === 'none') {
    return undefined;
  }
  const id =
    (preset.group === 'kinds'
      ? KIND_CURVES[preset.id]
      : GROUP_CURVES[preset.group]) ?? 'any';
  return curveFor(id, preset.room === 'own3d');
};
