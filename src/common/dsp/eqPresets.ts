/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { EQ_BAND_COUNT } from './chain';

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
 *  - **Cuts before boosts.** Every curve here peaks at or below +5 dB. A
 *    preset that adds 10 dB somewhere is not a tone control, it is a volume
 *    control with a colour, and it eats the headroom the maximizer needs.
 *  - **Nothing is symmetrical for the sake of looking tidy.** Hearing is not:
 *    the ear's sensitivity dips below 200 Hz and above 6 kHz and is most
 *    acute around 3 kHz, so a curve that is gentle at 3 kHz and generous at
 *    12 kHz is doing the same perceived work.
 */
export interface IEqPreset {
  id: string;
  labelKey: string;
  /** One gain in dB per band, low to high. Always `EQ_BAND_COUNT` long. */
  gains: readonly number[];
}

/*        32   50   80  125  200  315  500  800  1k2  2k   3k1  5k   8k  12k5 16k */
export const EQ_PRESETS: readonly IEqPreset[] = [
  {
    id: 'flat',
    labelKey: 'dsp.eqPreset.flat',
    gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  },
  {
    // The smiling curve, and the one everybody reaches for first. Scooped
    // mids, lifted ends — flattering on a quiet system and tiring on a good
    // one, which is why it is here and not the default.
    id: 'v-shape',
    labelKey: 'dsp.eqPreset.vShape',
    gains: [4, 4, 3, 2, 0, -1, -2, -2, -1, 0, 1, 2, 3, 3.5, 3],
  },
  {
    // Guitars live at 800-2k and cymbals at 8k+. The 315 dip is where a wall
    // of distorted guitar turns to mud.
    id: 'rock',
    labelKey: 'dsp.eqPreset.rock',
    gains: [3, 3, 2, 1, 0, -1.5, -1, 0, 1, 1.5, 2, 2, 2.5, 2, 1],
  },
  {
    // Vocal-forward: the 2-4k lift is presence, the 250 cut is the boxiness
    // that hides a lead voice.
    id: 'pop',
    labelKey: 'dsp.eqPreset.pop',
    gains: [2, 2, 1, 0, -1, -1, 0, 1, 2, 2.5, 2.5, 2, 1.5, 1, 0.5],
  },
  {
    // Nearly flat by design. Upright bass at 80, brushed cymbals at 10k, and
    // the midrange left alone because that is where the playing is.
    id: 'jazz',
    labelKey: 'dsp.eqPreset.jazz',
    gains: [2, 2, 1.5, 0.5, 0, 0, 0.5, 1, 0.5, 0, 0.5, 1, 1.5, 1.5, 1],
  },
  {
    // The flattest curve here, and deliberately: a concert recording is
    // already balanced. Only a touch of hall at the bottom and air at the top.
    id: 'classical',
    labelKey: 'dsp.eqPreset.classical',
    gains: [1.5, 1.5, 1, 0.5, 0, 0, 0, 0, 0, 0, 0.5, 1, 1.5, 2, 2],
  },
  {
    // Sub-bass and a hard high end, with the 200-500 range pulled well back
    // so a four-on-the-floor kick has room.
    id: 'electronic',
    labelKey: 'dsp.eqPreset.electronic',
    gains: [5, 4.5, 3, 1, -1, -2, -2, -1, 0, 1, 2, 2.5, 3, 3.5, 3],
  },
  {
    // 50-80 is where an 808 lives. The 3k lift keeps the vocal on top of it.
    id: 'hiphop',
    labelKey: 'dsp.eqPreset.hiphop',
    gains: [4.5, 5, 4, 2, 0, -1, -1, 0, 1, 2, 2.5, 1.5, 1, 1, 0.5],
  },
  {
    // Body at 125-250 for the guitar's soundboard, and string detail up top.
    id: 'acoustic',
    labelKey: 'dsp.eqPreset.acoustic',
    gains: [1, 1.5, 2, 2, 1, 0, 0.5, 1, 1.5, 1.5, 2, 2, 2.5, 2, 1.5],
  },
  {
    // A high pass in all but name: everything under 125 is rumble on a voice.
    // The 3k lift is consonants — it is what makes speech legible, not loud.
    id: 'vocal',
    labelKey: 'dsp.eqPreset.vocal',
    gains: [-6, -5, -3, -1, 0, 0.5, 1.5, 2.5, 3, 3.5, 3, 2, 1, 0, -0.5],
  },
  {
    // Podcast, and the sibilance cut at 5-8k is the point: a spoken voice
    // boosted for clarity gets harsh there long before it gets clear.
    id: 'podcast',
    labelKey: 'dsp.eqPreset.podcast',
    gains: [-8, -6, -3, 0, 0.5, 1, 2, 2.5, 3, 2.5, 1.5, -1, -1.5, -1, -1],
  },
  {
    id: 'bassBoost',
    labelKey: 'dsp.eqPreset.bassBoost',
    gains: [5, 5, 4, 3, 1.5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  },
  {
    id: 'trebleBoost',
    labelKey: 'dsp.eqPreset.trebleBoost',
    gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0.5, 1.5, 2.5, 3.5, 4, 4],
  },
  {
    // Both ends lifted because the ear loses them at low volume — the
    // equal-loudness contours, which is what a "loudness" button has always
    // been. Only worth using when playing quietly.
    id: 'loudness',
    labelKey: 'dsp.eqPreset.loudness',
    gains: [5, 4.5, 3.5, 2, 0.5, 0, 0, 0, 0, 0, 0.5, 1.5, 3, 4, 4.5],
  },
  {
    // The opposite: bass cut hard so it does not travel through a wall, and
    // presence lifted so quiet dialogue still lands.
    id: 'lateNight',
    labelKey: 'dsp.eqPreset.lateNight',
    gains: [-8, -7, -5, -3, -1, 0, 1, 2, 2.5, 2.5, 2, 1, 0.5, 0, 0],
  },
  {
    // A laptop or phone speaker reproduces nothing under about 150 Hz, so
    // boosting it only wastes excursion. The warmth is faked at 250 instead.
    id: 'smallSpeakers',
    labelKey: 'dsp.eqPreset.smallSpeakers',
    gains: [-10, -8, -4, 1, 2.5, 2, 1, 0.5, 1, 1.5, 2, 2, 1.5, 0, -1],
  },
  {
    // A car's cabin adds its own bass and eats the top. This answers both.
    id: 'car',
    labelKey: 'dsp.eqPreset.car',
    gains: [2, 1, -1, -2, -1.5, 0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 3, 2],
  },
  {
    // Footsteps and reloads sit at 3-6k; the sub lift keeps explosions
    // physical without burying them.
    id: 'gaming',
    labelKey: 'dsp.eqPreset.gaming',
    gains: [3, 2.5, 1, 0, -1, -1, 0, 1.5, 2.5, 3.5, 4, 3, 2, 1.5, 1],
  },
  {
    // Dialogue lives at 1-4k and gets buried under a score. This lifts it and
    // pulls back the 100-250 that a film mix is generous with.
    id: 'movie',
    labelKey: 'dsp.eqPreset.movie',
    gains: [2, 1.5, 0, -1.5, -2, -1, 0.5, 2, 3, 3, 2.5, 1.5, 1, 1, 0.5],
  },
  {
    // Second-harmonic warmth, done with an EQ rather than distortion: lift
    // the low mids, ease the upper mids that make a mix sound like glass.
    id: 'warm',
    labelKey: 'dsp.eqPreset.warm',
    gains: [1, 1.5, 2.5, 3, 2.5, 1.5, 0.5, 0, -0.5, -1.5, -2, -1.5, -0.5, 0, 0],
  },
  {
    // The top two octaves only. What a lossy file lost, insofar as an EQ can
    // lift what survived — it cannot put back what the encoder discarded.
    id: 'air',
    labelKey: 'dsp.eqPreset.air',
    gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.5, 1.5, 3, 4, 4.5],
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
