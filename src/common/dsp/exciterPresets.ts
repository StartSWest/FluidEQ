/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { IExciterSettings } from './chain';
import { EXCITER_GENRE_PRESETS } from './exciterGenrePresets';
import { IExciterPreset, exciterProfile } from './exciterProfile';

export { EXCITER_PRESET_GROUPS, exciterProfile } from './exciterProfile';
export type {
  IExciterPreset,
  IExciterPresetSettings,
  TExciterPresetGroup,
} from './exciterProfile';

/**
 * Processor-local profiles, keyed by the stable id a chain preset references.
 *
 * Matching an EQ id is intentional: `rock` means the same musical target in
 * both catalogs without coupling their parameters. Amounts stay moderate
 * because these are designed to be combined with EQ, compression and a limiter;
 * no profile relies on being the only processor producing the final sound.
 *
 * Every Amount here was re-measured when the harmonic generator landed, and
 * they all moved up. They used to scale a return that was a whole copy of its
 * own filtered band, so what separated one profile from another was mostly how
 * much LEVEL each added — and the amounts had to stay small or the stage became
 * an equaliser. A return is harmonics over an 18% carrier now, so the old
 * numbers all collapsed toward the same thing: measured across the catalogue,
 * every profile sat within five decibels of every other, from `classical` to
 * `loud`.
 *
 * The figures below are chosen against the measured harmonic level at each
 * band's own centre, which is what a listener actually hears these differ by:
 * roughly -33 dB under the note for the transparent profiles, -26 for the
 * moderate ones and -21 for the forward ones. Nothing in the catalogue moves
 * the programme's level by more than 1.2 dB, and that one is `broadcast`, where
 * a presence lift is the point.
 */
export const EXCITER_PRESET_BY_ID = {
  none: {
    id: 'none',
    labelKey: 'dsp.eqModel.clean',
    group: 'basic',
    // None clears every sound-producing section but leaves the stage's own
    // On/Off state alone. The reset values remain available behind the off
    // section toggles, so the user starts from a known neutral rack.
    settings: exciterProfile(
      [{ enabled: false }, { enabled: false }, { enabled: false }],
      { enabled: false },
      { enabled: false },
    ),
  },
  default: {
    id: 'default',
    labelKey: 'dsp.eqPreset.default',
    group: 'basic',
    settings: exciterProfile(),
  },
  timing: {
    id: 'timing',
    labelKey: 'dsp.exciter.align',
    group: 'basic',
    /**
     * The only profile here that generates nothing at all.
     *
     * Every other one adds harmonics; this one just puts the bottom of the
     * record back in time with the top, which is the half of a hardware
     * "maximizer" that was never about brightness — BBE built theirs around
     * loudspeaker phase smear, not around harmonics. It is the profile to
     * reach for when a mix is dull in a way that adding sparkle does not fix,
     * and the safe one on material already too bright to excite.
     *
     * Rendered against DSP Off, the difference signal it leaves sits 2.3 dB
     * under the programme itself: a phase rotation changes nearly every
     * sample, which is worth knowing before reading any level meter for what
     * this does. What it changes in LEVEL is nothing at all.
     */
    settings: exciterProfile(
      [{ enabled: false }, { enabled: false }, { enabled: false }],
      { enabled: false },
      { enabled: true, amount: 0.5 },
    ),
  },
  ...EXCITER_GENRE_PRESETS,
  vocal: {
    id: 'vocal',
    labelKey: 'dsp.eqPreset.vocal',
    group: 'voice',
    settings: exciterProfile(
      [
        { enabled: false },
        { freqHz: 850, range: 0.25, mix: 0.29, texture: 0.12 },
        {
          freqHz: 6_500,
          range: 0.18,
          drive: 2.45,
          mix: 0.42,
          texture: 0.56,
        },
      ],
      {
        enabled: true,
        amount: 0.12,
        focusHz: 260,
        range: 0.22,
      },
      {},
      'mid',
    ),
  },
  audiobook: {
    id: 'audiobook',
    labelKey: 'dsp.eqPreset.audiobook',
    group: 'voice',
    settings: exciterProfile(
      [
        { enabled: false },
        { freqHz: 1_000, range: 0.24, mix: 0.18, texture: 0.1 },
        { freqHz: 5_500, drive: 2.25, mix: 0.2, texture: 0.48 },
      ],
      { enabled: true, amount: 0.08, focusHz: 250, range: 0.2 },
      {},
      'mid',
    ),
  },
  gaming: {
    id: 'gaming',
    labelKey: 'dsp.eqPreset.gaming',
    group: 'scene',
    settings: exciterProfile(
      [
        { drive: 2.05, mix: 0.18 },
        { freqHz: 1_500, mix: 0.14, texture: 0.25 },
        { freqHz: 5_500, drive: 2.7, mix: 0.46, texture: 0.64 },
      ],
      {},
      { enabled: true, amount: 0.3 },
    ),
  },
  movie: {
    id: 'movie',
    labelKey: 'dsp.eqPreset.movie',
    group: 'scene',
    settings: exciterProfile(
      [{ mix: 0.1 }, { mix: 0.19 }, { drive: 2.4, mix: 0.36 }],
      {
        enabled: true,
        amount: 0.14,
        focusHz: 350,
        range: 0.3,
      },
      { enabled: true, amount: 0.15 },
      'mid',
    ),
  },
  lateNight: {
    id: 'lateNight',
    labelKey: 'dsp.eqPreset.lateNight',
    group: 'scene',
    // Body helps quiet listening; a forward air band would do the opposite by
    // making sibilance and effects the first things heard at low level.
    settings: exciterProfile(
      [{ mix: 0.1 }, { mix: 0.18, texture: 0.1 }, { mix: 0.12 }],
      { enabled: true, amount: 0.18, focusHz: 350, range: 0.32 },
    ),
  },
  warm: {
    id: 'warm',
    labelKey: 'dsp.eqPreset.warm',
    group: 'character',
    settings: exciterProfile(
      // Even orders forward on Low and Mid, High deliberately held back: warmth
      // is body without the air that would read as brightness.
      [
        { mix: 0.17, texture: 0.02 },
        { drive: 2.1, mix: 0.33, texture: 0.08 },
        { drive: 2.1, mix: 0.09, texture: 0.35 },
      ],
      { enabled: true, amount: 0.3, focusHz: 420, range: 0.4 },
    ),
  },
  air: {
    id: 'air',
    labelKey: 'dsp.eqPreset.air',
    group: 'character',
    settings: exciterProfile([
      { enabled: false },
      { enabled: false },
      {
        freqHz: 7_500,
        range: 0.24,
        drive: 2.5,
        mix: 0.76,
        texture: 0.65,
      },
    ]),
  },
  tape: {
    id: 'tape',
    labelKey: 'dsp.eqPreset.tape',
    group: 'repair',
    /**
     * The top a cassette lost, rebuilt from the band under it.
     *
     * This is the one restoration an enhancer is actually documented for —
     * bringing back highs lost to duplication or to a noise-reduction
     * mismatch — and the reason it works here rather than making things worse
     * is the order of the rack: the Exciter runs AFTER the restoration, so it
     * generates from de-hissed audio. In front of it, the same profile would
     * be a hiss enhancer.
     *
     * Centred lower and mixed at half of what `lossy-repair` uses: tape rolls
     * off gradually from around 8 kHz rather than stopping dead at an
     * encoder's cut-off, so there is real material either side of this band
     * and only a little is missing.
     */
    settings: exciterProfile([
      { enabled: false },
      { enabled: false },
      { freqHz: 6_500, range: 0.24, drive: 2.45, mix: 0.4, texture: 0.55 },
    ]),
  },
  'lossy-repair': {
    id: 'lossy-repair',
    labelKey: 'dsp.preset.lossyRepair',
    group: 'repair',
    settings: exciterProfile([
      { enabled: false },
      { enabled: false },
      {
        enabled: true,
        // Below a lossy encoder's usual top cut, where material still exists
        // to generate the missing upper harmonics from.
        freqHz: 7_000,
        range: 0.22,
        drive: 2.55,
        mix: 0.7,
        texture: 0.6,
      },
    ]),
  },
  loud: {
    id: 'loud',
    labelKey: 'dsp.preset.loud',
    group: 'character',
    settings: exciterProfile(
      [
        { enabled: false },
        { enabled: false },
        {
          enabled: true,
          freqHz: 7_500,
          range: 0.24,
          drive: 2.75,
          mix: 0.8,
          texture: 0.62,
        },
      ],
      { enabled: true, amount: 0.22, focusHz: 650, range: 0.36 },
    ),
  },
  broadcast: {
    id: 'broadcast',
    labelKey: 'dsp.preset.broadcast',
    group: 'character',
    /**
     * The presence work moved to Mid, where it fits.
     *
     * It was a High band centred at 3 kHz, which is the very bottom of the High
     * region — so `constrainExciterBandPosition` had almost no room to give it
     * and clamped the authored 0.22 range down to 0.003. What shipped was a
     * 2.5-3.6 kHz sliver rather than the wide presence lift the numbers read
     * like, and nothing said so. Mid reaches 7 kHz, so the same centre gets its
     * full width there, and High goes back to making air.
     */
    settings: exciterProfile(
      [
        { enabled: false },
        {
          enabled: true,
          freqHz: 3_000,
          range: 0.2,
          drive: 2.8,
          mix: 0.45,
          texture: 0.55,
        },
        {
          enabled: true,
          freqHz: 7_500,
          range: 0.24,
          drive: 2.6,
          mix: 0.5,
          texture: 0.6,
        },
      ],
      { enabled: true, amount: 0.3, focusHz: 320, range: 0.3 },
      { enabled: true, amount: 0.45 },
    ),
  },
} satisfies Record<string, IExciterPreset>;

export type TExciterPresetId = keyof typeof EXCITER_PRESET_BY_ID;

export const EXCITER_PRESETS: readonly IExciterPreset[] =
  Object.values(EXCITER_PRESET_BY_ID);

export const isExciterPresetId = (id: string): id is TExciterPresetId =>
  Object.prototype.hasOwnProperty.call(EXCITER_PRESET_BY_ID, id);

/** Build a fresh live processor state without sharing a preset's nested data. */
export const exciterPresetSettings = (
  id: TExciterPresetId,
  enabled: boolean,
): IExciterSettings => {
  const preset = EXCITER_PRESET_BY_ID[id];
  return {
    enabled,
    presetId: id,
    stereo: preset.settings.stereo,
    bands: preset.settings.bands.map((band) => ({ ...band })),
    organic: { ...preset.settings.organic },
    align: { ...preset.settings.align },
    isolate: false,
  };
};
