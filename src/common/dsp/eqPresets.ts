/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  DSP_DEFAULTS,
  EQ_BAND_COUNT,
  TEqEngine,
  TEqModel,
  TEqStereo,
} from './chain';

/**
 * The parts of the rack a preset sets besides its curve.
 *
 * A preset that moved fifteen gains and left the character, the topology and
 * the protective filters wherever the last one put them was not a preset — it
 * was a curve wearing somebody else's settings. Anything omitted here is
 * deliberately left alone.
 */
export interface IEqPresetSetup {
  model?: TEqModel;
  modelAmount?: number;
  engine?: TEqEngine;
  oversample?: number;
  stereo?: TEqStereo;
  subsonicHz?: number;
  fuzzAmount?: number;
  monoBelowHz?: number;
}

export interface IEqPreset {
  id: string;
  labelKey: string;
  /** One gain in dB per band, low to high. Always `EQ_BAND_COUNT` long. */
  gains: readonly number[];
  /** @see IEqPresetSetup */
  setup?: IEqPresetSetup;
}

/** First in the list, and the way back: everything to its default. */
export const EQ_DEFAULT_PRESET_ID = 'default';

/**
 * What every preset is measured against, and what the reset button applies.
 *
 * Read off the rack's own defaults rather than restated, so "default" cannot
 * come to mean one thing in the preset list and another in the settings.
 */
const DEFAULT_SETUP: Required<IEqPresetSetup> = {
  model: DSP_DEFAULTS.eq.model,
  modelAmount: DSP_DEFAULTS.eq.modelAmount,
  engine: DSP_DEFAULTS.eq.engine,
  oversample: DSP_DEFAULTS.eq.oversample,
  stereo: DSP_DEFAULTS.eq.stereo,
  subsonicHz: DSP_DEFAULTS.eq.subsonicHz,
  fuzzAmount: DSP_DEFAULTS.eq.fuzzAmount,
  monoBelowHz: DSP_DEFAULTS.eq.monoBelowHz,
};

export const eqPresetSetup = (preset: IEqPreset): Required<IEqPresetSetup> => ({
  ...DEFAULT_SETUP,
  ...(preset.setup ?? {}),
});

/**
 * A protective pair most music benefits from and nothing musical misses.
 *
 * 20 Hz is below hearing on any normal speaker, and the excursion spent down
 * there is excursion unavailable to bass that can be heard. 40 Hz of mono keeps
 * the very bottom from depending on the two channels agreeing, which is what
 * makes a mix survive a phone speaker.
 */
const PROTECTED: IEqPresetSetup = { subsonicHz: 20, monoBelowHz: 40 };

/**
 * The EQ's factory curves, as one gain per band in dB.
 *
 * The bands are fixed and ISO-spaced — 32, 50, 80, 125, 200, 315, 500, 800,
 * 1250, 2000, 3150, 5000, 8000, 12500, 16000 Hz — so a preset is just fifteen
 * numbers and reads as the shape it makes.
 *
 * Two rules held throughout, and they are what separate these from the preset
 * lists that ship with consumer players:
 *
 *  - **The SUM is what peaks at +6 dB, not the largest band.** These sit a
 *    third of an octave apart at the bottom, so their skirts overlap and
 *    adjacent gains add — and the rule as first written policed the wrong
 *    number. "Bass boost" obeyed it with a largest band of +5 and measured
 *    +12.15 dB summed at 69 Hz, more than twice the boost it advertised;
 *    ten of these were past +6 and none of them looked it. Every curve was
 *    scaled to bring its measured sum back under, which changes the level
 *    they are read at and not one of their shapes. The `wide` character is
 *    what makes this bite: it stacks 4-7 dB where `proportional` stacks
 *    under 2, because widening each skirt is widening the overlap.
 *  - **Nothing is symmetrical for the sake of looking tidy.** Hearing is not:
 *    the ear's sensitivity dips below 200 Hz and above 6 kHz and is most
 *    acute around 3 kHz, so a curve that is gentle at 3 kHz and generous at
 *    12 kHz is doing the same perceived work.
 */
/*        32   50   80  125  200  315  500  800  1k2  2k   3k1  5k   8k  12k5 16k */
export const EQ_PRESETS: readonly IEqPreset[] = [
  {
    // Everything back where it started. First, because it is the way out of
    // whatever the others set.
    id: EQ_DEFAULT_PRESET_ID,
    labelKey: 'dsp.eqPreset.default',
    gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    setup: DEFAULT_SETUP,
  },
  {
    id: 'flat',
    labelKey: 'dsp.eqPreset.flat',
    gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    setup: PROTECTED,
  },
  {
    // The smiling curve, and the one everybody reaches for first. Scooped
    // mids, lifted ends — flattering on a quiet system and tiring on a good
    // one, which is why it is here and not the default.
    id: 'v-shape',
    labelKey: 'dsp.eqPreset.vShape',
    gains: [
      2.7, 2.7, 2, 1.4, 0, -0.7, -1.4, -1.4, -0.7, 0, 0.7, 1.4, 2, 2.4, 2,
    ],
    // Broad, because a smile made of narrow bells is a row of bumps.
    setup: { ...PROTECTED, model: 'wide', monoBelowHz: 60 },
  },
  {
    // Guitars live at 800-2k and cymbals at 8k+. The 315 dip is where a wall
    // of distorted guitar turns to mud.
    id: 'rock',
    labelKey: 'dsp.eqPreset.rock',
    gains: [3, 3, 2, 1, 0, -1.5, -1, 0, 1, 1.5, 2, 2, 2.5, 2, 1],
    setup: { ...PROTECTED, model: 'proportional' },
  },
  {
    // Vocal-forward: the 2-4k lift is presence, the 250 cut is the boxiness
    // that hides a lead voice.
    id: 'pop',
    labelKey: 'dsp.eqPreset.pop',
    gains: [2, 2, 1, 0, -1, -1, 0, 1, 2, 2.5, 2.5, 2, 1.5, 1, 0.5],
    setup: { ...PROTECTED, model: 'proportional' },
  },
  {
    // Nearly flat by design. Upright bass at 80, brushed cymbals at 10k, and
    // the midrange left alone because that is where the playing is.
    id: 'jazz',
    labelKey: 'dsp.eqPreset.jazz',
    gains: [2, 2, 1.5, 0.5, 0, 0, 0.5, 1, 0.5, 0, 0.5, 1, 1.5, 1.5, 1],
    setup: { ...PROTECTED, model: 'wide' },
  },
  {
    // The flattest curve here, and deliberately: a concert recording is
    // already balanced. Only a touch of hall at the bottom and air at the top.
    id: 'classical',
    labelKey: 'dsp.eqPreset.classical',
    gains: [1.5, 1.5, 1, 0.5, 0, 0, 0, 0, 0, 0, 0.5, 1, 1.5, 2, 2],
    // No mono-below: the hall IS the recording, and summing its bottom end
    // throws away the space it was captured in.
    setup: { subsonicHz: 20, monoBelowHz: 0 },
  },
  {
    // Sub-bass and a hard high end, with the 200-500 range pulled well back
    // so a four-on-the-floor kick has room.
    id: 'electronic',
    labelKey: 'dsp.eqPreset.electronic',
    gains: [
      3.4, 3, 2, 0.7, -0.7, -1.3, -1.3, -0.7, 0, 0.7, 1.3, 1.7, 2, 2.4, 2,
    ],
    setup: { model: 'wide', subsonicHz: 25, monoBelowHz: 80 },
  },
  {
    // 50-80 is where an 808 lives. The 3k lift keeps the vocal on top of it.
    id: 'hiphop',
    labelKey: 'dsp.eqPreset.hiphop',
    gains: [
      2.5, 2.8, 2.2, 1.1, 0, -0.6, -0.6, 0, 0.6, 1.1, 1.4, 0.8, 0.6, 0.6, 0.3,
    ],
    // Sub-bass this heavy is where cancellation actually costs something,
    // so the mono corner sits above the fundamental rather than under it.
    setup: { model: 'wide', subsonicHz: 25, monoBelowHz: 90 },
  },
  {
    // Body at 125-250 for the guitar's soundboard, and string detail up top.
    id: 'acoustic',
    labelKey: 'dsp.eqPreset.acoustic',
    gains: [
      0.9, 1.4, 1.8, 1.8, 0.9, 0, 0.5, 0.9, 1.4, 1.4, 1.8, 1.8, 2.3, 1.8, 1.4,
    ],
    setup: { ...PROTECTED, model: 'wide' },
  },
  {
    // A high pass in all but name: everything under 125 is rumble on a voice.
    // The 3k lift is consonants — it is what makes speech legible, not loud.
    id: 'vocal',
    labelKey: 'dsp.eqPreset.vocal',
    gains: [-6, -5, -3, -1, 0, 0.5, 1.5, 2.5, 3, 3.5, 3, 2, 1, 0, -0.5],
    setup: { ...PROTECTED, model: 'proportional' },
  },
  {
    // Podcast, and the sibilance cut at 5-8k is the point: a spoken voice
    // boosted for clarity gets harsh there long before it gets clear.
    id: 'podcast',
    labelKey: 'dsp.eqPreset.podcast',
    gains: [-8, -6, -3, 0, 0.5, 1, 2, 2.5, 3, 2.5, 1.5, -1, -1.5, -1, -1],
    // Speech has nothing below 40 Hz except the room.
    setup: { model: 'proportional', subsonicHz: 40, monoBelowHz: 0 },
  },
  {
    id: 'bassBoost',
    labelKey: 'dsp.eqPreset.bassBoost',
    gains: [2.5, 2.5, 2, 1.5, 0.7, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    setup: { model: 'wide', subsonicHz: 30, monoBelowHz: 100 },
  },
  {
    id: 'trebleBoost',
    labelKey: 'dsp.eqPreset.trebleBoost',
    gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0.5, 1.5, 2.5, 3.5, 4, 4],
    // Doubled rate: this is the one curve whose work is all in the octave
    // where the cookbook squeezes a band against Nyquist.
    setup: { ...PROTECTED, model: 'proportional', oversample: 2 },
  },
  {
    // Both ends lifted because the ear loses them at low volume — the
    // equal-loudness contours, which is what a "loudness" button has always
    // been. Only worth using when playing quietly.
    id: 'loudness',
    labelKey: 'dsp.eqPreset.loudness',
    gains: [2.9, 2.6, 2, 1.2, 0.3, 0, 0, 0, 0, 0, 0.3, 0.9, 1.7, 2.3, 2.6],
    setup: { model: 'wide', subsonicHz: 25, monoBelowHz: 70 },
  },
  {
    // The opposite: bass cut hard so it does not travel through a wall, and
    // presence lifted so quiet dialogue still lands.
    id: 'lateNight',
    labelKey: 'dsp.eqPreset.lateNight',
    gains: [
      -6.8, -6, -4.3, -2.6, -0.9, 0, 0.9, 1.7, 2.1, 2.1, 1.7, 0.9, 0.4, 0, 0,
    ],
    setup: { ...PROTECTED, model: 'wide' },
  },
  {
    // A laptop or phone speaker reproduces nothing under about 150 Hz, so
    // boosting it only wastes excursion. The warmth is faked at 250 instead.
    id: 'smallSpeakers',
    labelKey: 'dsp.eqPreset.smallSpeakers',
    gains: [-10, -8, -4, 1, 2.5, 2, 1, 0.5, 1, 1.5, 2, 2, 1.5, 0, -1],
    // A small cone cannot use anything under 40 Hz and cannot survive bass
    // that cancels, so both filters sit high.
    setup: { model: 'proportional', subsonicHz: 40, monoBelowHz: 120 },
  },
  {
    // A car's cabin adds its own bass and eats the top. This answers both.
    id: 'car',
    labelKey: 'dsp.eqPreset.car',
    gains: [1.3, 0.7, -0.7, -1.3, -1, 0, 0.3, 0.7, 1, 1.3, 1.6, 2, 2.3, 2, 1.3],
    setup: { model: 'wide', subsonicHz: 30, monoBelowHz: 100 },
  },
  {
    // Footsteps and reloads sit at 3-6k; the sub lift keeps explosions
    // physical without burying them.
    id: 'gaming',
    labelKey: 'dsp.eqPreset.gaming',
    gains: [2.9, 2.5, 1, 0, -1, -1, 0, 1.5, 2.5, 3.4, 3.9, 2.9, 2, 1.5, 1],
    setup: { ...PROTECTED, model: 'proportional' },
  },
  {
    // Dialogue lives at 1-4k and gets buried under a score. This lifts it and
    // pulls back the 100-250 that a film mix is generous with.
    id: 'movie',
    labelKey: 'dsp.eqPreset.movie',
    gains: [
      1.4, 1.1, 0, -1.1, -1.4, -0.7, 0.4, 1.4, 2.1, 2.1, 1.8, 1.1, 0.7, 0.7,
      0.4,
    ],
    setup: { model: 'wide', subsonicHz: 20, monoBelowHz: 60 },
  },
  {
    // Second-harmonic warmth, done with an EQ rather than distortion: lift
    // the low mids, ease the upper mids that make a mix sound like glass.
    id: 'warm',
    labelKey: 'dsp.eqPreset.warm',
    gains: [
      0.7, 1.1, 1.9, 2.2, 1.9, 1.1, 0.4, 0, -0.4, -1.1, -1.5, -1.1, -0.4, 0, 0,
    ],
    // The one preset that asks for harmonic colour, and only a little.
    setup: { ...PROTECTED, model: 'wide', fuzzAmount: 0.25 },
  },
  {
    // The top two octaves only. What a lossy file lost, insofar as an EQ can
    // lift what survived — it cannot put back what the encoder discarded.
    id: 'air',
    labelKey: 'dsp.eqPreset.air',
    gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.5, 1.5, 3, 4, 4.5],
    setup: { ...PROTECTED, model: 'proportional', oversample: 2 },
  },
];

/**
 * Every preset carries exactly one gain per band.
 *
 * Checked here rather than trusted, because a short array would silently leave
 * the last bands at whatever the user had — a preset that half-applies is
 * worse than one that does not exist.
 */
export const isCompleteEqPreset = (preset: IEqPreset): boolean =>
  preset.gains.length === EQ_BAND_COUNT;
