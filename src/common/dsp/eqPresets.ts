/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

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
  /** One gain in dB per band, low to high. Always `EQ_BAND_COUNT` long. */
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
 */
/*        32   50   80  125  200  315  500  800  1k2  2k   3k1  5k   8k  12k5 16k */
export const EQ_PRESETS: readonly IEqPreset[] = [
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
  {
    // Guitars live at 800-2k and cymbals at 8k+. The 315 dip is where a wall
    // of distorted guitar turns to mud.
    id: 'rock',
    labelKey: 'dsp.eqPreset.rock',
    group: 'genre',
    gains: [3, 3, 2, 1, 0, -1.5, -1, 0, 1, 1.5, 2, 2, 2.5, 2, 1],
    setup: { ...PROTECTED, model: 'proportional' },
  },
  {
    // Vocal-forward: the 2-4k lift is presence, the 250 cut is the boxiness
    // that hides a lead voice.
    id: 'pop',
    labelKey: 'dsp.eqPreset.pop',
    group: 'genre',
    gains: [2, 2, 1, 0, -1, -1, 0, 1, 2, 2.5, 2.5, 2, 1.5, 1, 0.5],
    setup: { ...PROTECTED, model: 'proportional' },
  },
  {
    // Nearly flat by design. Upright bass at 80, brushed cymbals at 10k, and
    // the midrange left alone because that is where the playing is.
    id: 'jazz',
    labelKey: 'dsp.eqPreset.jazz',
    group: 'genre',
    gains: [2, 2, 1.5, 0.5, 0, 0, 0.5, 1, 0.5, 0, 0.5, 1, 1.5, 1.5, 1],
    setup: { ...PROTECTED, model: 'wide' },
  },
  {
    // The flattest curve here, and deliberately: a concert recording is
    // already balanced. Only a touch of hall at the bottom and air at the top.
    id: 'classical',
    labelKey: 'dsp.eqPreset.classical',
    group: 'genre',
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
    group: 'genre',
    gains: [
      3.4, 3, 2, 0.7, -0.7, -1.3, -1.3, -0.7, 0, 0.7, 1.3, 1.7, 2, 2.4, 2,
    ],
    setup: { model: 'wide', subsonicHz: 25, monoBelowHz: 80 },
  },
  {
    // 50-80 is where an 808 lives. The 3k lift keeps the vocal on top of it.
    id: 'hiphop',
    labelKey: 'dsp.eqPreset.hiphop',
    group: 'genre',
    gains: [
      2.5, 2.7, 2.2, 1.1, 0, -0.6, -0.6, 0, 0.6, 1.1, 1.4, 0.8, 0.6, 0.6, 0.3,
    ],
    // Sub-bass this heavy is where cancellation actually costs something,
    // so the mono corner sits above the fundamental rather than under it.
    setup: { model: 'wide', subsonicHz: 25, monoBelowHz: 90 },
  },
  {
    // Body at 125-250 for the guitar's soundboard, and string detail up top.
    id: 'acoustic',
    labelKey: 'dsp.eqPreset.acoustic',
    group: 'genre',
    gains: [
      0.9, 1.4, 1.7, 1.7, 0.9, 0, 0.5, 0.9, 1.4, 1.4, 1.7, 1.7, 2.2, 1.7, 1.4,
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
    gains: [-8, -6, -3, 0, 0.5, 1, 2, 2.5, 3, 2.5, 1.5, -6, -6, -1, -1],
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
    // The opposite: bass cut hard so it does not travel through a wall, and
    // presence lifted so quiet dialogue still lands.
    id: 'lateNight',
    labelKey: 'dsp.eqPreset.lateNight',
    group: 'scene',
    gains: [-6.8, -6, -4.3, -2.6, -0.9, 0, 0.9, 1.6, 2, 2, 1.6, 0.9, 0.4, 0, 0],
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
      1.3, 0.7, -0.7, -1.3, -1, 0, 0.3, 0.7, 1, 1.3, 1.6, 1.9, 2.2, 1.9, 1.3,
    ],
    setup: { model: 'wide', subsonicHz: 30, monoBelowHz: 100 },
  },
  {
    // Footsteps and reloads sit at 3-6k; the sub lift keeps explosions
    // physical without burying them.
    id: 'gaming',
    labelKey: 'dsp.eqPreset.gaming',
    group: 'scene',
    gains: [2.9, 2.5, 1, 0, -1, -1, 0, 1.5, 2.5, 3.4, 3.9, 2.9, 2, 1.5, 1],
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
      1.4, 1.1, 0, -1.1, -1.4, -0.7, 0.4, 1.4, 2.1, 2.1, 1.8, 1.1, 0.7, 0.7,
      0.4,
    ],
    setup: {
      model: 'wide',
      subsonicHz: 20,
      monoBelowHz: 60,
    },
  },
  {
    // Second-harmonic warmth, done with an EQ rather than distortion: lift
    // the low mids, ease the upper mids that make a mix sound like glass.
    id: 'warm',
    labelKey: 'dsp.eqPreset.warm',
    group: 'character',
    gains: [
      0.7, 1.1, 1.9, 2.2, 1.9, 1.1, 0.4, 0, -0.4, -1.1, -1.5, -1.1, -0.4, 0, 0,
    ],
    // Warm is a broad tilt, not saturation. Fuzz here was compounded by any
    // later character stage and was the grit reported from the full chain.
    setup: { ...PROTECTED, model: 'wide' },
  },
  {
    // The top two octaves only. What a lossy file lost, insofar as an EQ can
    // lift what survived — it cannot put back what the encoder discarded.
    id: 'air',
    labelKey: 'dsp.eqPreset.air',
    group: 'character',
    gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.5, 1.5, 3, 4, 4.5],
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
    // Low mids up, top rolled off, and the one thing filters cannot do added
    // on the end. The tilt is what tape does to a spectrum; the harmonics are
    // what it does that no arrangement of bands could.
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
    // end that gives up gently rather than at a wall.
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
    // recordings are. The 200-400 lift is the cellos and the room they are
    // in, and the reason it is small is that a concert recording is already
    // balanced — the mistake here is always doing too much.
    id: 'orchestra',
    labelKey: 'dsp.eqPreset.orchestra',
    group: 'genre',
    gains: [1, 1.2, 1.4, 1.6, 1.4, 0.8, 0.3, 0, 0, 0.3, 0.8, 1.2, 1.6, 2, 2],
    setup: { subsonicHz: 20, monoBelowHz: 0, model: 'clean' },
  },
  {
    // The 315 scoop is where a wall of distorted guitar turns to mud, and
    // the 3-5k lift is pick attack — the thing that makes a riff readable
    // rather than merely loud. Kick and snare keep their fundamentals.
    id: 'metal',
    labelKey: 'dsp.eqPreset.metal',
    group: 'genre',
    gains: [3, 3, 2, 0.5, -1, -2.5, -1.5, 0, 1, 2, 2.5, 2.5, 2, 1.5, 1],
    setup: { ...PROTECTED, model: 'proportional' },
  },
  {
    // Recorded fast and mixed faster. Everything it needs is between 100 and
    // 4k, so the ends come down rather than the middle going up.
    id: 'punk',
    labelKey: 'dsp.eqPreset.punk',
    group: 'genre',
    gains: [1, 1.5, 2, 2, 0.5, -1, -0.5, 0.5, 1.5, 2, 2, 1, 0, -1, -2],
    setup: { ...PROTECTED, model: 'proportional' },
  },
  {
    // The bass IS the arrangement, and it is a fundamental rather than a
    // click: 50-80 rather than the 100+ a modern mix leans on. The 315 dip
    // keeps the skank guitar from crowding it.
    id: 'reggae',
    labelKey: 'dsp.eqPreset.reggae',
    group: 'genre',
    gains: [2.6, 2.8, 2.2, 1, 0, -1.5, -0.5, 0.3, 0.6, 0.6, 1, 1, 0.6, 0.3, 0],
    setup: { model: 'wide', subsonicHz: 25, monoBelowHz: 80 },
  },
  {
    // Acoustic guitar body at 125-200, vocal presence at 2-3k, and the
    // string and brush detail that lives above 8k. Nothing scooped: this is
    // music that is mixed to be heard whole.
    id: 'country',
    labelKey: 'dsp.eqPreset.country',
    group: 'genre',
    gains: [
      0.9, 1.1, 1.7, 1.8, 1.1, 0.3, 0.5, 0.9, 1.4, 1.8, 1.8, 1.7, 1.8, 1.8, 1.4,
    ],
    setup: { ...PROTECTED, model: 'wide' },
  },
  {
    // Valve amplifiers and a voice. The 800-1k25 lift is the honk that makes
    // a cranked amp sound cranked, and taking it out is what makes most
    // blues playback sound polite.
    id: 'blues',
    labelKey: 'dsp.eqPreset.blues',
    group: 'genre',
    gains: [1.5, 2, 2, 1.5, 0.5, 0, 0.8, 1.8, 2, 1.5, 1, 0.8, 0.8, 0.5, 0],
    setup: { ...PROTECTED, model: 'wide' },
  },
  {
    // Deliberately narrowed: the ends give up early and the middle carries
    // everything, which is what a sampled record through a cheap chain does.
    // The fuzz is the part no filter could produce.
    id: 'lofi',
    labelKey: 'dsp.eqPreset.lofi',
    group: 'genre',
    gains: [-2, -1, 0.5, 2, 2, 1.2, 0.5, 0.5, 0.5, 0, -1, -2.5, -4, -5.5, -7],
    setup: { ...PROTECTED, model: 'wide', fuzzAmount: 0.3 },
  },
  {
    // Nothing here is a transient, so nothing needs presence. Sub and air,
    // and the midrange left exactly alone so the pads keep their shape.
    id: 'ambient',
    labelKey: 'dsp.eqPreset.ambient',
    group: 'genre',
    gains: [2.5, 2.5, 1.8, 1, 0.3, 0, 0, 0, 0, 0, 0.3, 1, 1.8, 2.5, 3],
    setup: { model: 'wide', subsonicHz: 20, monoBelowHz: 40 },
  },
  {
    // An 808 is a sine wave with a long tail, and it lives below where most
    // speakers stop. The 250-500 cut is the room the hi-hats need.
    id: 'trap',
    labelKey: 'dsp.eqPreset.trap',
    group: 'genre',
    gains: [
      3.4, 3, 2.1, 0.7, -1, -2, -1.5, -0.5, 0.3, 1, 1.4, 1.4, 1.7, 1.4, 0.7,
    ],
    setup: { model: 'wide', subsonicHz: 25, monoBelowHz: 90 },
  },
  {
    // Two things at once: a sub that has to be felt and a break that has to
    // be heard. The 2-5k lift is the break, the 315 cut is what stops the
    // two fighting.
    id: 'drumBass',
    labelKey: 'dsp.eqPreset.drumBass',
    group: 'genre',
    gains: [3.6, 3.2, 2, 0.4, -1.5, -2, -1, 0, 0.8, 1.6, 2, 2, 1.6, 1.2, 0.8],
    setup: { model: 'wide', subsonicHz: 25, monoBelowHz: 90 },
  },
  {
    // A piano covers nearly the whole band, so this is mostly restraint. The
    // 250-400 dip is the soundboard boom a close mic always picks up, and
    // the 8k lift is hammer felt rather than brightness.
    id: 'piano',
    labelKey: 'dsp.eqPreset.piano',
    group: 'genre',
    gains: [1, 1.2, 1.4, 1, -0.5, -1, 0, 0.5, 1, 1.2, 1.4, 1.6, 2, 1.8, 1.2],
    setup: { ...PROTECTED, model: 'clean' },
  },
  {
    // Bowed strings turn harsh at 2-4k before they turn bright, which is why
    // this lifts either side of that and not through it.
    id: 'strings',
    labelKey: 'dsp.eqPreset.strings',
    group: 'genre',
    gains: [
      0.5, 1, 1.5, 2, 1.5, 0.8, 0.5, 0.5, 0, -0.8, -1, 0.5, 1.5, 2.2, 2.5,
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
    gains: [-10, -9, -6, -2, 1.5, 2.5, 1.5, 1, 1.5, 2, 2.5, 2, 1.5, 0, -1],
    setup: { model: 'proportional', subsonicHz: 40, monoBelowHz: 200 },
  },
  {
    // An open headphone already has the stage; what it lacks is the bottom
    // two octaves, because there is no seal to hold them. Nothing is added
    // up top — that is the one thing these do not need.
    id: 'openBack',
    labelKey: 'dsp.eqPreset.openBack',
    group: 'device',
    gains: [3.1, 2.7, 1.9, 0.9, 0.2, 0, 0, 0, 0, 0.2, 0.4, 0.2, 0, -0.5, -1],
    setup: { model: 'wide', subsonicHz: 20, monoBelowHz: 40 },
  },
  {
    // One voice, often recorded badly, listened to for hours. Everything
    // under 100 is room; the reacting cut at 5-8k is what makes a long
    // session bearable without dulling the words.
    id: 'audiobook',
    labelKey: 'dsp.eqPreset.audiobook',
    group: 'voice',
    gains: [-9, -7, -4, 0, 1, 1.5, 2.5, 3, 3, 2.5, 1.5, -5, -5, -2, -2],
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
 * remains the user's decision.
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
    presetId: preset.id,
    bands,
    sourceBands: bands.map((band) => ({ ...band })),
  };
};
