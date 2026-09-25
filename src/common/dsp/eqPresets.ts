/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { WORLD_GENRE_EQ_PRESETS } from './genreEqPresets';
import orderRelatedStyles from './presetOrder';
import {
  DSP_DEFAULTS,
  EQ_BAND_COUNT,
  IEqBandSettings,
  IEqSettings,
  TEqEngine,
  TEqModel,
  TEqPhase,
  TEqStereo,
} from './chain';

/**
 * The parts of the rack a preset sets besides its curve.
 *
 * A preset that moved fifteen gains and left the character, the topology and
 * the protective filters wherever the last one put them was not a preset — it
 * was a curve wearing somebody else's settings. Optional authoring stays terse,
 * but `eqPresetSetup` resolves every omitted field to a deliberate baseline;
 * nothing is inherited from the previously selected profile.
 */
/**
 * The sections the picker files presets under, in the order it shows them.
 *
 * Ordered from the ones somebody reaches for first: the way back to nothing,
 * then what they are listening to, then who is talking, then where they are,
 * then what they are listening on, then colour, then the four that fix a
 * specific fault.
 */
export const EQ_PRESET_GROUPS = [
  'basic',
  'genre',
  'voice',
  'scene',
  'device',
  'character',
  'repair',
] as const;

export type TEqPresetGroup = (typeof EQ_PRESET_GROUPS)[number];

export interface IEqPresetSetup {
  model?: TEqModel;
  modelAmount?: number;
  engine?: TEqEngine;
  phase?: TEqPhase;
  oversample?: number;
  stereo?: TEqStereo;
  subsonicHz?: number;
  fuzzAmount?: number;
  monoBelowHz?: number;
}

export interface IEqPreset {
  id: string;
  labelKey: string;
  /**
   * Which heading it files under in the picker.
   *
   * Here rather than in the picker because both menus that show these read it,
   * and a list of forty-seven with no sections is a list nobody reads to the
   * bottom of. Adding a preset without one is a type error, which is the point:
   * an ungrouped entry would silently land under whatever heading came before.
   */
  group: TEqPresetGroup;
  /**
   * One gain in dB per band, low to high. Always `EQ_BAND_COUNT` long.
   *
   * A curve is a TILT, and the level it happens to add is not part of it:
   * every curve a chain plays is set as a whole so that it adds no loudness
   * to that chain — K-weighted, heard against the chain's rack alone —
   * shifted rather than reshaped, so the tone is untouched and only the
   * volume moves. This matters more than it sounds: louder wins every
   * comparison it is in, so a hot curve reads as "better" while the listener
   * has not heard what it did to the tone yet. Six of these were between two
   * and four decibels hot before anyone measured them, and each one felt like
   * the best preset in its section. Where a chain then lands against DSP Off
   * is its rack's business: its Maximizer takes a loud master down by its
   * overs and a quiet one not at all, which no fixed curve could follow.
   */
  gains: readonly number[];
  /**
   * Per band: the level its gain should wait for, or `null` to always apply.
   *
   * Parallel to `gains` and the same length when present. Almost every preset
   * omits it, and that is the point rather than an oversight — a tone curve is
   * meant to hold still. Only a curve whose problem is intermittent has any
   * business reacting, and there are two of those here.
   */
  dynamic?: readonly (number | null)[];
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
  phase: DSP_DEFAULTS.eq.phase,
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
 *    A test measures this now. It did not before, and five curves had drifted
 *    back over the line by a tenth of a decibel — which is how a limit with
 *    nothing watching it decays.
 *  - **Nothing is symmetrical for the sake of looking tidy.** Hearing is not:
 *    the ear's sensitivity dips below 200 Hz and above 6 kHz and is most
 *    acute around 3 kHz, so a curve that is gentle at 3 kHz and generous at
 *    12 kHz is doing the same perceived work.
 *  - **A genre curve does not add what the genre's records already carry.**
 *    Held against published genre research on 2026-09-23, which found the
 *    sub of trap, drum & bass, hip-hop and electronic lifted, lo-fi and blues
 *    records that are dark already darkened by 5 to 9 dB more, a mid scoop on
 *    jazz and orchestra, acoustic's boom and 4-6 kHz brittleness left in and
 *    classical coloured. Each changed row kept the loudness it had, measured
 *    through its model's bands — which is how the Preset layer plays them now
 *    (`presetVoicing.ts`). On 2026-09-24 the genre notes, which quote that
 *    research to the listener, found metal still lifted under 75 Hz, trap
 *    and drum & bass at 50 and the orchestra's bass: each is level or under
 *    there now, and the loudness that took is not paid back elsewhere.
 */
/*        32   50   80  125  200  315  500  800  1k2  2k   3k1  5k   8k  12k5 16k */
const EQ_PRESET_ENTRIES: readonly IEqPreset[] = [
  {
    // Everything back where it started. First, because it is the way out of
    // whatever the others set.
    id: EQ_DEFAULT_PRESET_ID,
    labelKey: 'dsp.eqPreset.default',
    group: 'basic',
    gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    setup: DEFAULT_SETUP,
  },
  {
    id: 'flat',
    labelKey: 'dsp.eqPreset.flat',
    group: 'basic',
    gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    setup: PROTECTED,
  },
  {
    // The smiling curve, and the one everybody reaches for first. Scooped
    // mids, lifted ends — flattering on a quiet system and tiring on a good
    // one, which is why it is here and not the default.
    id: 'v-shape',
    labelKey: 'dsp.eqPreset.vShape',
    group: 'basic',
    gains: [
      2.7, 2.7, 2, 1.4, 0, -0.7, -1.4, -1.4, -0.7, 0, 0.7, 1.4, 2, 2.4, 2,
    ],
    // Broad, because a smile made of narrow bells is a row of bumps.
    setup: { ...PROTECTED, model: 'wide', monoBelowHz: 60 },
  },
  ...WORLD_GENRE_EQ_PRESETS,
  {
    // The kick and the bass guitar at 80, the guitars' bite at 1-3k, the
    // cymbals left as they are. The 315-500 dip is where a wall of distorted
    // guitar turns to mud.
    id: 'rock',
    labelKey: 'dsp.eqPreset.rock',
    group: 'genre',
    gains: [
      0.5, 0.5, 1.6, 0.9, -1.2, -2.9, -2.2, -0.3, 0.4, 0.8, 1.1, 0.6, 0.1, -0.1,
      -0.3,
    ],
    setup: { ...PROTECTED, model: 'proportional' },
  },
  {
    // Vocal-forward over a punchy low end: the 3-8k lift is presence and
    // sheen, the 250-500 cut is the boxiness that hides a lead voice.
    id: 'pop',
    labelKey: 'dsp.eqPreset.pop',
    group: 'genre',
    gains: [
      2.1, 1.2, 1.5, 0.6, -1.3, -2.9, -2.4, -0.9, -0.4, 0.3, 1.3, 1.6, 1.5, 1,
      0.3,
    ],
    // Mono under 140 Hz, as pop masters are made (the research's "side mono
    // <140 Hz"): Dimension's low width alone only narrows the side there, and
    // through a one-pole split that still leaves most of it at 50 Hz.
    setup: { ...PROTECTED, model: 'proportional', monoBelowHz: 140 },
  },
  {
    // The upright's warmth at 125-200 and the ride cymbal's air above 8k,
    // with the 1-2k honk eased rather than lifted: the playing is in the
    // mids, and what it wants there is room, not help.
    id: 'jazz',
    labelKey: 'dsp.eqPreset.jazz',
    group: 'genre',
    gains: [
      -1.8, -0.7, 0.9, 1.9, 1.3, -0.8, -1, -0.7, -0.9, -0.9, -0.7, -0.3, 1.2,
      1.6, 1.7,
    ],
    setup: { ...PROTECTED, model: 'wide' },
  },
  {
    // Among the gentlest curves here, and deliberately: a concert recording
    // is already balanced. A touch of hall at the bottom and air at the top,
    // paid for by a decibel out of the middle rather than added on.
    id: 'classical',
    labelKey: 'dsp.eqPreset.classical',
    group: 'genre',
    gains: [
      0.3, 0.5, 1, 0.9, 0.4, -0.5, -1, -1.2, -1.1, -0.8, -0.1, 1.1, 1.1, 1.3,
      1.1,
    ],
    // No mono-below: the hall IS the recording, and summing its bottom end
    // throws away the space it was captured in.
    setup: { subsonicHz: 20, monoBelowHz: 0 },
  },
  {
    // Sub-bass and a hard high end, with the 200-500 range pulled well back
    // so a four-on-the-floor kick has room.
    id: 'electronic',
    labelKey: 'dsp.eqPreset.electronic',
    group: 'genre',
    gains: [
      2, 1.5, 1.2, -0.2, -1.8, -2.2, -2, -1.3, -0.4, 0, 0.3, 1.1, 1.7, 1.3, 0.5,
    ],
    // Mono under 150 Hz, where a club system sums everything anyway.
    setup: { model: 'wide', subsonicHz: 25, monoBelowHz: 150 },
  },
  {
    // 30-80 is where the kick and the 808 live, the 3k lift keeps the vocal
    // on top of them, and the top is left dusty, the way a beat built from
    // sampled records sounds.
    id: 'hiphop',
    labelKey: 'dsp.eqPreset.hiphop',
    group: 'genre',
    gains: [
      1.9, 1.1, 1.1, 1.1, -0.5, -2.4, -2.2, -0.9, -0.6, 0.3, 1.2, 0.4, -1, -1.7,
      -2.2,
    ],
    // Mono under 120 Hz, as the research has it: kick, snare, bass and voice
    // are mixed in the middle, and sub-bass this heavy is where cancellation
    // actually costs something.
    setup: { model: 'wide', subsonicHz: 25, monoBelowHz: 120 },
  },
  {
    // The boom under 50 eased and the soundboard's body at 125 kept, the
    // 300-500 boxiness a close microphone adds taken out, the pick at 2-3k,
    // the 4-6k brittleness of a steel string tamed, and air from 12k.
    id: 'acoustic',
    labelKey: 'dsp.eqPreset.acoustic',
    group: 'genre',
    gains: [
      -1.1, -0.4, 0.6, 1.1, -0.3, -0.7, -0.7, -0.3, 0.2, 0.9, 1.1, -1.9, -0.2,
      1.6, 1.6,
    ],
    setup: { ...PROTECTED, model: 'wide' },
  },
  {
    // A high pass in all but name: everything under 125 is rumble on a voice.
    // The 3k lift is consonants — it is what makes speech legible, not loud.
    id: 'vocal',
    labelKey: 'dsp.eqPreset.vocal',
    group: 'voice',
    gains: [-6, -5, -3, -1, 0, 0.5, 1.5, 2.5, 3, 3.5, 3, 2, 1, 0, -0.5],
    setup: {
      ...PROTECTED,
      model: 'proportional',
    },
  },
  {
    // Podcast, and the sibilance cut at 5-8k is the point: a spoken voice
    // boosted for clarity gets harsh there long before it gets clear.
    id: 'podcast',
    // The 5k and 8k cuts are deeper than a static curve could carry, because
    // they are not always applied: -6 dB across a whole episode is a dull
    // episode, while -6 dB on the sibilants alone is a de-esser. That is the
    // trade dynamics buy, and this is the preset that most wants it.
    gains: [
      -10.5, -8.6, -5.2, -0.7, -0.1, -0.5, 0.9, 1.8, 2.8, 2.5, 1.6, -8.7, -10,
      -6.4, -6.4,
    ],
    labelKey: 'dsp.eqPreset.podcast',
    group: 'voice',
    dynamic: [
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      -26,
      -26,
      null,
      null,
    ],
    // Speech has nothing below 40 Hz except the room.
    setup: {
      model: 'proportional',
      subsonicHz: 40,
      monoBelowHz: 0,
    },
  },
  {
    id: 'bassBoost',
    labelKey: 'dsp.eqPreset.bassBoost',
    group: 'character',
    gains: [2.5, 2.4, 1.9, 1.5, 0.7, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    setup: { model: 'wide', subsonicHz: 30, monoBelowHz: 100 },
  },
  {
    id: 'trebleBoost',
    labelKey: 'dsp.eqPreset.trebleBoost',
    group: 'character',
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
    group: 'scene',
    gains: [2.9, 2.5, 2, 1.2, 0.3, 0, 0, 0, 0, 0, 0.3, 0.9, 1.7, 2.3, 2.6],
    setup: { model: 'wide', subsonicHz: 25, monoBelowHz: 70 },
  },
  {
    // The opposite: bass cut hard so it does not travel through a wall, the
    // 500-2k middle where speech sits lifted a decibel so quiet dialogue
    // still lands, and the top eased so nothing sharp carries either.
    id: 'lateNight',
    labelKey: 'dsp.eqPreset.lateNight',
    group: 'scene',
    gains: [
      -9, -8, -5, -2.2, -0.4, 0.3, 0.6, 0.9, 1.1, 0.5, -0.2, -1.7, -1.7, -2.2,
      -2.7,
    ],
    // What travels through a wall is the loud bass, not all of it. Static, the
    // bass is gone all evening; waiting for a threshold means a quiet passage
    // keeps its bottom end and only the hits that would carry get held down.
    dynamic: [
      -32,
      -32,
      -32,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
    ],
    setup: {
      ...PROTECTED,
      model: 'wide',
    },
  },
  {
    // A laptop or phone speaker reproduces nothing under about 150 Hz, so
    // boosting it only wastes excursion. The warmth is faked at 250 instead.
    id: 'smallSpeakers',
    labelKey: 'dsp.eqPreset.smallSpeakers',
    group: 'device',
    gains: [-10, -8, -4, 1, 2.5, 2, 1, 0.5, 1, 1.5, 2, 2, 1.5, 0, -1],
    // A small cone cannot use anything under 40 Hz and cannot survive bass
    // that cancels, so both filters sit high.
    setup: { model: 'proportional', subsonicHz: 40, monoBelowHz: 120 },
  },
  {
    // A car's cabin adds its own bass and eats the top. This answers both.
    id: 'car',
    labelKey: 'dsp.eqPreset.car',
    group: 'device',
    gains: [
      0.9, 0.3, -1.2, -1.3, -1, -0.6, -0.2, 0, 0.7, 0.7, 0.9, 1, 1.4, 1.1, 0.5,
    ],
    setup: { model: 'wide', subsonicHz: 30, monoBelowHz: 100 },
  },
  {
    /**
     * Footsteps and reloads sit at 2-6k, and what buries them is the 200-500
     * an explosion fills the room with, not the explosion's own bottom.
     *
     * So the cut moved down and got deeper (-3.7 at 200 and 315 now, against
     * the -1 it was), the lift moved to where the cues are, and the sub lift
     * came back. All of it measured on the fair programme rather than the
     * mono-safe one, which is what made the old curve look reasonable — and
     * the whole of it then set 0.7 dB lower, where it adds no loudness: a
     * gaming preset that is simply louder wins for the wrong reason.
     */
    id: 'gaming',
    labelKey: 'dsp.eqPreset.gaming',
    group: 'scene',
    gains: [
      1.3, 1.1, 0.1, -1.7, -3.7, -3.7, -2.2, -0.2, 0.8, 2.3, 2.8, 2.3, 1.3, 0.8,
      0.3,
    ],
    setup: {
      ...PROTECTED,
      model: 'proportional',
    },
  },
  {
    // Dialogue lives at 1-4k and gets buried under a score. This lifts it and
    // pulls back the 100-250 that a film mix is generous with.
    id: 'movie',
    labelKey: 'dsp.eqPreset.movie',
    group: 'scene',
    gains: [
      0.7, 0.5, -0.4, -1.7, -1.8, -1, -0.2, 0.6, 1.3, 1.2, 1.1, 0.1, -0.4, -0.4,
      -0.7,
    ],
    setup: {
      model: 'wide',
      subsonicHz: 20,
      monoBelowHz: 60,
    },
  },
  {
    /**
     * The everyday curve: a little of everything, and nothing anybody would
     * name if it were not pointed out.
     *
     * The chain it belongs to used a flat one until 2026-09-19, which meant
     * the default profile measured as doing nothing at all outside the
     * Library — the Master's loudness makeup is zero system-wide, and there
     * was nothing else in it. Weight at the bottom, a decibel out of the
     * 300 Hz that makes a mix sound closed in, and air.
     */
    id: 'balanced',
    labelKey: 'dsp.eqPreset.balanced',
    group: 'basic',
    gains: [
      1.4, 1.4, -0.9, 0.5, 0.2, -1.7, -0.7, 0.3, 0.2, -0.3, -0.5, 0.5, 0.7, 0.9,
      0.9,
    ],
    setup: { ...PROTECTED, model: 'wide' },
  },
  {
    /**
     * Two boxes in a room, which start narrow and lose the ends.
     *
     * Weight low down for a cabinet that has none, a decibel out of the low
     * mid a room adds back by itself, and presence for a listener sitting
     * further away than a pair of headphones ever puts them.
     */
    id: 'speakers',
    labelKey: 'dsp.dimensionPreset.speakers',
    group: 'device',
    gains: [
      1.5, 1.5, 0.1, 0.2, -0.4, -1.4, -1, -0.1, 0.3, -0.1, -0.1, 0.6, 0.4, 0.3,
      0,
    ],
    setup: { ...PROTECTED, model: 'wide' },
  },
  {
    /**
     * Room for a kick to be heard in, rather than a bass boost.
     *
     * A hit reads by contrast: the 315 dip is the low mid a kick has to cut
     * through, the decibel at 80 is its body, and 3-5k is the beater rather
     * than the note. What is deliberately absent is a shelf underneath —
     * nothing at 32, barely anything at 50 — because Bass Punch is shaping
     * the hit down there and lifting the whole band it lives in only makes
     * that hit harder to hear.
     */
    id: 'punch',
    labelKey: 'dsp.maximizerPreset.punch',
    group: 'character',
    gains: [
      -0.3, 0.2, 0.9, 0.5, -0.8, -2.3, -1.8, -0.3, 0.2, 0.7, 1.7, 1.7, 0.7, 0.2,
      -0.3,
    ],
    setup: { ...PROTECTED, model: 'proportional' },
  },
  {
    // Second-harmonic warmth, done with an EQ rather than distortion: lift
    // the low mids, ease the upper mids that make a mix sound like glass.
    id: 'warm',
    labelKey: 'dsp.eqPreset.warm',
    group: 'character',
    gains: [
      0.5, 0.9, 0.3, 0.6, 0.3, 0.9, -0.6, -1.1, 0.2, -0.8, -1.3, -0.8, -0.5,
      -0.5, -0.5,
    ],
    // Warm is a broad tilt, not saturation. Fuzz here was compounded by any
    // later character stage and was the grit reported from the full chain.
    setup: { ...PROTECTED, model: 'wide' },
  },
  {
    // The top two octaves opened up, and nothing else: air as a character,
    // for a record that is whole but closed-in. It was the lossy repair's
    // curve as well until 2026-09-23, and a lossy file is the one record
    // where lifting 12-16 kHz this far brings up what the encoder left
    // there — its swirl — rather than any air (`lossyRestore`).
    id: 'air',
    labelKey: 'dsp.eqPreset.air',
    group: 'character',
    gains: [
      -0.3, -0.3, -0.3, -0.3, -0.3, -0.3, -0.3, -0.3, -0.3, -0.3, 0.2, 1.2, 2.7,
      3.7, 4.2,
    ],
    setup: { ...PROTECTED, model: 'proportional', oversample: 2 },
  },
  {
    // The tool this whole capability was built for, and the clearest thing to
    // hear it on. Flat everywhere except two deep cuts that are absent until a
    // sibilant arrives — as a static curve it would be a dull record, and as a
    // dynamic one it is a de-esser.
    id: 'deEss',
    labelKey: 'dsp.eqPreset.deEss',
    group: 'repair',
    gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -8, -8, 0, 0],
    dynamic: [
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      -26,
      -26,
      null,
      null,
    ],
    setup: { ...PROTECTED, model: 'proportional' },
  },
  {
    // One note on a bass, or one corner of a room, ringing where nothing else
    // does. A static cut here thins every note to fix the one that booms.
    id: 'tameBoom',
    labelKey: 'dsp.eqPreset.tameBoom',
    group: 'repair',
    gains: [0, 0, 0, -7, -6, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    dynamic: [
      null,
      null,
      null,
      -22,
      -22,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
    ],
    setup: { ...PROTECTED, model: 'proportional' },
  },
  {
    // A cassette or a reel transfer put back, not made to sound like one:
    // the rumble and the head bump's excess taken out below 60 Hz, and what
    // survived of the top lifted gently from 2 kHz — the rest of the top is
    // the Tape repair chain's Exciter's, regenerated after the hiss is gone.
    // No harmonics of its own. Tape already put its saturation on the
    // recording, and a repair that adds more is adding distortion. It was
    // the Character group's Tape until 2026-09-23, which made picking that
    // one a repair and gave this chain the character's grit.
    id: 'tapeRestore',
    labelKey: 'dsp.eqPreset.tapeRestore',
    group: 'repair',
    gains: [
      -4.4, -1.9, 0.4, 0.2, 0, -0.1, -0.1, 0.1, 0.4, 0.6, 0.8, 1.1, 1.1, 0.6,
      0.1,
    ],
    setup: { ...PROTECTED, model: 'wide' },
  },
  {
    // A record's rip put back: rumble out below the groove, the bottom summed
    // as the lathe cut it (bass that differs between the walls of the groove
    // is the stylus riding rumble and warp, not music), the bass the rumble
    // filter spared lifted, and a worn top end helped a little. Split from
    // the Character group's Vinyl for the reason Tape repair was, and without
    // its harmonics.
    id: 'vinylRestore',
    labelKey: 'dsp.eqPreset.vinylRestore',
    group: 'repair',
    gains: [
      -4.6, -4.2, 3.6, 0.2, -0.2, -0.5, -0.5, -0.1, 0.2, 0.5, -0.3, 0.4, 1, 1.4,
      0.3,
    ],
    setup: { model: 'wide', subsonicHz: 30, monoBelowHz: 150 },
  },
  {
    // A lossy file's top put back as far as an EQ honestly can. An encoder
    // cuts everything above its band — about 16 kHz at 128 kbps — and leaves
    // its artifacts, the swirl, in the octave under the cut. So what
    // survived of the top is lifted from 3 kHz, most around 8-12 kHz where
    // the dullness is heard, and eased again at 16 kHz rather than pushed
    // into the swirl; above the cut the chain's Exciter makes the missing
    // harmonics from the band under it, which is what the restoration tools
    // do (spectral recovery, a codec's own band replication) and which no
    // boost can, there being nothing up there to boost.
    id: 'lossyRestore',
    labelKey: 'dsp.preset.lossyRepair',
    group: 'repair',
    gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.3, 1, 1.8, 2, 1],
    setup: { ...PROTECTED, model: 'proportional' },
  },
  {
    // Low mids up, top rolled off, and the one thing filters cannot do added
    // on the end. The tilt is what tape does to a spectrum; the harmonics are
    // what it does that no arrangement of bands could. The curve it shipped
    // with on 2026-08-22, back from the repair the Tape repair chain had
    // made of it.
    id: 'tape',
    labelKey: 'dsp.eqPreset.tape',
    group: 'character',
    gains: [
      0.8, 1.2, 1.8, 2.2, 1.8, 0.9, 0, -0.4, -0.8, -1.2, -1.6, -2, -2.6, -3.2,
      -3.8,
    ],
    setup: { ...PROTECTED, model: 'wide', fuzzAmount: 0.35 },
  },
  {
    // What a record player does to a record, minus the wear: nothing below the
    // groove, the bottom summed the way a cutting lathe demands it, and a top
    // end that gives up gently rather than at a wall. Its 2026-08-22 curve,
    // back from the repair, like Tape's.
    id: 'vinyl',
    labelKey: 'dsp.eqPreset.vinyl',
    group: 'character',
    gains: [
      0, 0.4, 0.9, 1.3, 0.9, 0.4, 0, 0, -0.4, -0.9, -1.3, -1.8, -2.4, -3.2,
      -4.2,
    ],
    setup: {
      model: 'wide',
      subsonicHz: 30,
      // A lathe cannot cut bass that differs between the walls of the groove,
      // so a record never had any. 150 is where that stops being true.
      monoBelowHz: 150,
      fuzzAmount: 0.15,
    },
  },
  {
    // Both directions at once, which is the thing only a dynamic band can do:
    // presence that arrives when the voice does, and sibilance held down when
    // it does not. The static version of this preset is a harsh one.
    id: 'liveVocal',
    labelKey: 'dsp.eqPreset.liveVocal',
    group: 'voice',
    gains: [-6, -5, -3, -1, 0, 0.5, 1, 1.5, 2, 2, 3, -6, -6, 0, -0.5],
    dynamic: [
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      -30,
      -26,
      -26,
      null,
      null,
    ],
    setup: {
      ...PROTECTED,
      model: 'proportional',
    },
  },
  {
    // A hall recorded from the audience, which is what most orchestral
    // recordings are: the 500-1k25 a full hall already fills eased back, and
    // a little air. Nothing under 250 is lifted — the research's "no bass
    // boost", because a timpani roll or a gran cassa lifted is only pushed
    // into the ceiling — where until 2026-09-24 the basses and the room
    // under them were a decibel up to 200.
    id: 'orchestra',
    labelKey: 'dsp.eqPreset.orchestra',
    group: 'genre',
    gains: [
      0, 0.1, -0.6, -0.3, 0.2, -0.3, -0.8, -1, -0.8, -0.4, -0.2, -0.1, 0.7, 1.1,
      1.1,
    ],
    setup: { subsonicHz: 20, monoBelowHz: 0, model: 'clean' },
  },
  {
    // The 315-500 scoop is where a wall of distorted guitar turns to mud, and
    // the 2-5k lift is pick attack — the thing that makes a riff readable
    // rather than merely loud. Nothing under 75 Hz is lifted — the
    // research's own line, because down-tuned guitars already own the bottom
    // and a lifted sub blurs a double kick into one note — so the rumble
    // comes down and the kick's weight is left level at 80. The bands are
    // too broad to lift 80 and hold 75, and the 80 Hz lift of up to
    // 2026-09-24 put +0.7 dB at 63.
    id: 'metal',
    labelKey: 'dsp.eqPreset.metal',
    group: 'genre',
    gains: [
      -1.5, -3.1, 0.7, 1.1, -2.3, -4.4, -3.8, -1.5, 0.3, 1.8, 3, 2.6, 0.7, -0.2,
      -0.8,
    ],
    setup: { ...PROTECTED, model: 'proportional' },
  },
  {
    // Recorded fast and mixed faster. Everything it needs is between 100 and
    // 2k — the bass guitar's body and the guitars' raw mids — so the ends
    // come down, and the 315 dip keeps the wall of guitars out of the mud.
    id: 'punk',
    labelKey: 'dsp.eqPreset.punk',
    group: 'genre',
    gains: [
      -2.8, -0.9, 1.3, 0.7, -1.1, -2.2, -1.5, 0.5, 2, 2, 0.1, -2.5, -2.5, -1.5,
      -0.7,
    ],
    setup: { ...PROTECTED, model: 'proportional' },
  },
  {
    // The bass IS the arrangement, and it is a fundamental rather than a
    // click: 30-125 lifted, the most at 80. The 315-800 dip keeps the skank
    // guitar from crowding it, and the top stays warm, the way roots records
    // were cut.
    id: 'reggae',
    labelKey: 'dsp.eqPreset.reggae',
    group: 'genre',
    gains: [
      1.9, 1.3, 1.9, 1.8, -0.2, -1.7, -2.1, -1.5, -1.4, -0.7, -0.3, -0.6, -1.3,
      -1.7, -2.2,
    ],
    setup: { model: 'wide', subsonicHz: 25, monoBelowHz: 80 },
  },
  {
    // Acoustic guitar body at 125, the voice and the twang at 2-4k, and the
    // string and brush detail above 8k kept. The 500-800 is eased a little
    // to let the voice through, not scooped: this is music mixed to be
    // heard whole.
    id: 'country',
    labelKey: 'dsp.eqPreset.country',
    group: 'genre',
    gains: [
      -0.5, -0.3, 0.2, 0.6, 0.2, -1.2, -2, -1.6, -0.1, 1.7, 2.1, 0.7, 0.1, 0,
      -0.2,
    ],
    setup: { ...PROTECTED, model: 'wide' },
  },
  {
    // Valve amplifiers and a voice. The mids from 125 to 1k25 are carried
    // above everything else — the honk that makes a cranked amp sound
    // cranked, and taking it out is what makes most blues playback sound
    // polite — with the boom under 50 out and everything from 2k up a
    // decibel down, where a guitar speaker gives up.
    id: 'blues',
    labelKey: 'dsp.eqPreset.blues',
    group: 'genre',
    gains: [
      -2.2, -1.1, 0.3, 0.8, 0.7, 0.3, 0.4, 0.6, 0.2, -0.8, -0.7, -1.1, -1.1,
      -0.9, -0.7,
    ],
    setup: { ...PROTECTED, model: 'wide' },
  },
  {
    // Deliberately narrowed: the ends give up early and the middle carries
    // everything, which is what a sampled record through a cheap chain does.
    // No fuzz since 2026-09-23: a lo-fi record already carries its tape and
    // sampler grit, the genre's research says to add no harmonics to it (its
    // Exciter is offered and left off for the same reason), and this was the
    // last curve in the catalogue adding distortion of its own.
    id: 'lofi',
    labelKey: 'dsp.eqPreset.lofi',
    group: 'genre',
    gains: [
      -2.4, -1.3, 0.5, 1.6, 1.6, 1, 0.3, -0.2, -0.8, -1.3, -1.8, -1, -1.5, -1.8,
      -1.8,
    ],
    // Mono under 120 Hz, as the research has it for a filtered bass under a
    // modest stereo picture.
    setup: { ...PROTECTED, model: 'wide', monoBelowHz: 120 },
  },
  {
    // Nothing here is a transient, so nothing needs presence. Sub and air,
    // paid for with a broad, shallow dip through the mids rather than any
    // one band, so the pads keep their shape.
    id: 'ambient',
    labelKey: 'dsp.eqPreset.ambient',
    group: 'genre',
    gains: [
      1.8, 1.6, 1.3, 0.2, -0.5, -1.3, -1.4, -1, -1, -1, -1.2, -0.1, 1.6, 1.8,
      1.6,
    ],
    setup: { model: 'wide', subsonicHz: 20, monoBelowHz: 40 },
  },
  {
    // An 808 is a sine wave with a long tail, and it lives below where most
    // speakers stop. The 200-500 cut clears the space between it and the
    // voice, and the hi-hats get their 8-12k. Nothing from 20 to 60 Hz is
    // lifted: the research says never to boost 30-60 on a full-range system,
    // where the 808 is already the loudest thing in the record, and a small
    // speaker gets its note from Bass Forge's overtones instead. Until
    // 2026-09-24 this lifted 50 Hz by 1.5 dB.
    id: 'trap',
    labelKey: 'dsp.eqPreset.trap',
    group: 'genre',
    gains: [
      -0.9, 0, 0.7, 0.4, -1.2, -2.5, -1.9, -0.7, -0.3, -0.1, 0.4, 1.5, 1.2, 1.2,
      2,
    ],
    // Mono under 120 Hz, as trap is mixed: the hats and synths are wide, the
    // 808 never.
    setup: { model: 'wide', subsonicHz: 25, monoBelowHz: 120 },
  },
  {
    // Two things at once: a sub that has to be felt and a break that has to
    // be heard. The 3-5k lift is the break, the 315-500 cut is what stops the
    // two fighting. The sine sub is left level, never lifted — the research's
    // "sub mono not boosted", which the 1.7 dB at 50 Hz of up to 2026-09-24
    // was not.
    id: 'drumBass',
    labelKey: 'dsp.eqPreset.drumBass',
    group: 'genre',
    gains: [
      -0.6, 0.1, 0.4, 0.3, -0.6, -2.5, -2.7, -1.6, -0.1, 0.9, 1.1, 2.1, 0.9,
      -0.2, -1.2,
    ],
    setup: { model: 'wide', subsonicHz: 25, monoBelowHz: 90 },
  },
  {
    // A piano covers nearly the whole band, so this is mostly restraint. The
    // 315-500 dip is the soundboard boom a close mic always picks up, and
    // the 3-8k lift is the hammers rather than brightness.
    id: 'piano',
    labelKey: 'dsp.eqPreset.piano',
    group: 'genre',
    gains: [
      -0.2, -0.1, 0.8, 1.3, 0, -2.4, -1.7, 0, -0.6, -0.3, 1.1, 1.9, 1.4, 0.6, 0,
    ],
    setup: { ...PROTECTED, model: 'clean' },
  },
  {
    // Bowed strings turn harsh at 2-4k before they turn bright, which is why
    // this lifts either side of that and not through it.
    id: 'strings',
    labelKey: 'dsp.eqPreset.strings',
    group: 'genre',
    gains: [
      -0.8, -0.5, -0.2, 0.6, 1.3, 1.1, 0.5, -0.5, -1.8, -2.3, -1.9, -0.4, 1.4,
      1.9, 1.9,
    ],
    setup: { ...PROTECTED, model: 'wide' },
  },
  {
    // The de-esser with a wider reach, for a whole record rather than one
    // voice: three reacting bands across the range where cymbals, consonants
    // and cheap converters all turn hard.
    id: 'sibilance',
    labelKey: 'dsp.eqPreset.sibilance',
    group: 'repair',
    gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -4, -7, -7, 0, 0],
    dynamic: [
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      -22,
      -24,
      -24,
      null,
      null,
    ],
    setup: { ...PROTECTED, model: 'proportional' },
  },
  {
    // The single most common problem in a home recording, and it is
    // intermittent: the boxiness only appears when several instruments hit
    // the same low mid at once. Static, this is a thin record.
    id: 'mudCut',
    labelKey: 'dsp.eqPreset.mudCut',
    group: 'repair',
    gains: [0, 0, 0, -4, -5, -4, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    dynamic: [
      null,
      null,
      null,
      -24,
      -24,
      -24,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
    ],
    setup: { ...PROTECTED, model: 'proportional' },
  },
  {
    // 2-4k is where the ear is most sensitive and where a loud master gets
    // tiring. Reacting rather than static, so quiet passages keep the
    // presence that makes them legible.
    id: 'harshTamer',
    labelKey: 'dsp.eqPreset.harshTamer',
    group: 'repair',
    gains: [0, 0, 0, 0, 0, 0, 0, 0, -3, -5, -5, 0, 0, 0, 0],
    dynamic: [
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      -20,
      -20,
      -20,
      null,
      null,
      null,
      null,
    ],
    setup: { ...PROTECTED, model: 'proportional' },
  },
  {
    // A sealed tip exaggerates its own bass and loses everything above 10k.
    // This answers both, and the mono corner is high because a tip that has
    // broken its seal cancels below it.
    id: 'earbuds',
    labelKey: 'dsp.eqPreset.earbuds',
    group: 'device',
    gains: [-3, -2.5, -1.5, 0, 1, 1.2, 0.8, 0.5, 1, 1.5, 2, 2, 2.5, 3, 3],
    setup: { model: 'proportional', subsonicHz: 30, monoBelowHz: 100 },
  },
  {
    // A laptop speaker reproduces almost nothing under 200 Hz, so lifting it
    // only wastes excursion and adds rattle. The warmth is faked at 315
    // instead, and the presence lift is what makes speech survive a fan.
    id: 'laptop',
    labelKey: 'dsp.eqPreset.laptop',
    group: 'device',
    // Set as a whole like every curve here (see `gains`), and the one that
    // shows why: the lift sits where the energy is, so this curve averaging
    // flat once played 2.5 dB louder than DSP Off. The shape is untouched —
    // the bottom stays as far below the lift as it was.
    gains: [
      -8.2, -7.2, -4.4, -2.2, 1.3, 1.2, 0.5, 0.4, 0.9, 1.2, 1.5, 0.8, 0.4, -1.1,
      -2,
    ],
    setup: { model: 'proportional', subsonicHz: 40, monoBelowHz: 200 },
  },
  {
    // An open headphone already has the stage; what it lacks is the bottom
    // two octaves, because there is no seal to hold them. Nothing is added
    // up top — that is the one thing these do not need.
    id: 'openBack',
    labelKey: 'dsp.eqPreset.openBack',
    group: 'device',
    gains: [
      1.7, 1.3, 0.6, 0.2, -0.5, -0.6, -0.8, -0.6, -0.1, -0.4, -0.4, 0, 0.3, 0.4,
      -0.1,
    ],
    setup: { model: 'wide', subsonicHz: 20, monoBelowHz: 40 },
  },
  {
    // One voice, often recorded badly, listened to for hours. Everything
    // under 100 is room; the reacting cut at 5-8k is what makes a long
    // session bearable without dulling the words.
    id: 'audiobook',
    labelKey: 'dsp.eqPreset.audiobook',
    group: 'voice',
    gains: [
      -9.4, -7.4, -5.5, -0.2, 0.6, 1.9, 1.7, 1.1, 1.3, 0.6, -0.4, -9.5, -9.2,
      -6.5, -6.5,
    ],
    dynamic: [
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      -26,
      -26,
      null,
      null,
    ],
    setup: {
      model: 'proportional',
      subsonicHz: 40,
      monoBelowHz: 0,
    },
  },
  {
    // Dialogue kept, explosions held down, and the bass held down only when
    // it is loud enough to travel — which is the whole difference between a
    // film at night and a film with no bass.
    id: 'nightMovie',
    labelKey: 'dsp.eqPreset.nightMovie',
    group: 'scene',
    gains: [-6, -6, -4, -2, -0.5, 0.3, 1.3, 1.9, 2.2, 1.9, 1.3, 0.6, 0.3, 0, 0],
    dynamic: [
      -30,
      -30,
      -30,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
    ],
    setup: {
      ...PROTECTED,
      model: 'wide',
    },
  },
];

export const EQ_PRESETS: readonly IEqPreset[] =
  orderRelatedStyles(EQ_PRESET_ENTRIES);

/**
 * Every preset carries exactly one gain per band.
 *
 * Checked here rather than trusted, because a short array would silently leave
 * the last bands at whatever the user had — a preset that half-applies is
 * worse than one that does not exist.
 */
export const isCompleteEqPreset = (preset: IEqPreset): boolean =>
  preset.gains.length === EQ_BAND_COUNT &&
  // Checked on the same terms: a short thresholds array would leave the last
  // bands static while the gains that need them were applied in full, which is
  // a de-esser that quietly became a dull EQ.
  (preset.dynamic === undefined || preset.dynamic.length === EQ_BAND_COUNT);

/**
 * Materialise one factory preset into the complete EQ state it owns.
 *
 * Factory profiles are voiced on the canonical fifteen-band rack. Fitting the
 * gains onto whatever rack happened to be open preserved that rack's types,
 * Qs, enabled flags and dynamic state, so the same preset could sound different
 * depending on the edit made immediately before it. A preset is deterministic:
 * every audible value is assigned here, while only the processor's power state
 * and its Treble choice remain the user's decision — the Treble is how every
 * band plays near the top, not a part of any one curve, as the main EQ's is.
 */
export const eqSettingsForPreset = (
  current: IEqSettings,
  preset: IEqPreset,
): IEqSettings => {
  if (!isCompleteEqPreset(preset)) {
    return current;
  }

  if (preset.id === EQ_DEFAULT_PRESET_ID) {
    return {
      ...DSP_DEFAULTS.eq,
      enabled: current.enabled,
      isolate: false,
      treble: current.treble,
      presetId: preset.id,
      bands: DSP_DEFAULTS.eq.bands.map((band) => ({ ...band })),
    };
  }

  const setup = eqPresetSetup(preset);
  const bands: IEqBandSettings[] = DSP_DEFAULTS.eq.bands.map((band, index) => {
    const threshold = preset.dynamic?.[index] ?? null;
    return {
      ...band,
      gainDb: preset.gains[index],
      dynamic: threshold !== null,
      thresholdDb: threshold ?? band.thresholdDb,
    };
  });

  return {
    ...DSP_DEFAULTS.eq,
    ...setup,
    enabled: current.enabled,
    isolate: false,
    treble: current.treble,
    presetId: preset.id,
    bands,
    sourceBands: bands.map((band) => ({ ...band })),
  };
};
