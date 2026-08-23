/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

/**
 * What the DSP chain is, as data.
 *
 * Declarative because two very different things build from it: the live
 * `AudioContext` graph the player hears, and the `OfflineAudioContext` that
 * renders a file. A single shape both of them read is the only thing that
 * keeps those two from drifting apart, and a drift there is silent — the
 * exported file simply does not sound like what was auditioned.
 *
 * None of this reaches Equalizer APO, and it cannot. Every APO command is
 * linear, and neither compression nor a generated harmonic is. That is the
 * reason this module exists rather than another layer in `apoRender.ts`.
 *
 * Everything defaults to bypassed. A DSP tab that colours the sound the
 * moment it is opened is one the user did not ask for.
 */

export interface IExciterBandSettings {
  enabled: boolean;
  /** Shaper drive. 1 is nearly linear, 10 is obvious. */
  drive: number;
  /** How much of the shaped band is mixed back, 0-1. */
  mix: number;
  /**
   * Which harmonics this band makes: 0 is all even, 1 is all odd.
   *
   * The axis the single-band exciter never had, and the one that decides what
   * a band is FOR. Even orders sit an octave above the fundamental and read as
   * body, which is what a low or mid band wants. Odd orders read as edge and
   * air, which is what a high band wants — and is what the old exciter did
   * everywhere, because its curve was symmetric and a symmetric curve has no
   * choice.
   */
  texture: number;
  /**
   * Whether this band's harmonics wait for a level, and which level.
   *
   * The EQ's dynamic bands brought over, with the same two fields for the same
   * reason: a flag rather than a sentinel threshold, so "off" is a state
   * rather than a magic number at the bottom of the range. A quiet passage
   * given the same excitement as a loud one ends up sounding processed,
   * because the effect is the only thing that did not change.
   */
  dynamic: boolean;
  thresholdDb: number;
}

export interface IOrganicSettings {
  enabled: boolean;
  /** How much body, 0-1. Drives asymmetry and level together. */
  amount: number;
  /** Centre of the band it works on, Hz. */
  focusHz: number;
  /**
   * How much of the spectrum it works on: 0 is the focus band, 1 is all of it.
   *
   * A bandpass alone cannot reach "everything" — drop its Q far enough to span
   * the audible range and it stops behaving like a filter long before it stops
   * rolling off at the edges. So this blends towards the unfiltered signal
   * instead, and at 1 the focus dial stops meaning anything because there is
   * no longer a band to centre.
   */
  range: number;
}

export interface IExciterSettings {
  enabled: boolean;
  /** The two corners that make three bands, Hz, ascending. */
  crossoverHz: readonly [number, number];
  /** Per band, low to high. Always three. */
  bands: readonly IExciterBandSettings[];
  /** @see IOrganicSettings */
  organic: IOrganicSettings;
  /**
   * Hear ONLY what this stage made, with the dry signal dropped.
   *
   * A harmonic generator is the hardest stage in a rack to judge, because a
   * good setting sounds like "slightly bigger" and that is indistinguishable
   * from expecting it to. This removes the doubt: what is left is exactly what
   * the stage is adding, and nothing else.
   *
   * Deliberately NOT restored from storage — `clampDspSettings` forces it
   * false. It is a monitoring mode, and quitting with it on and coming back to
   * a rack that plays only harmonics is a bug report rather than a setting.
   */
  isolate: boolean;
}

export interface IBandSettings {
  thresholdDb: number;
  ratio: number;
  attackMs: number;
  releaseMs: number;
  makeupDb: number;
}

export interface ICompressorSettings {
  enabled: boolean;
  /** The two crossover corners that make three bands, Hz, ascending. */
  crossoverHz: readonly [number, number];
  /** Per band, low to high. Always three. */
  bands: readonly IBandSettings[];
}

export interface IMaximizerSettings {
  enabled: boolean;
  /** Output ceiling in dBFS. Never above 0. */
  ceilingDb: number;
  /**
   * Look-ahead in milliseconds.
   *
   * Not cosmetic: it is the entire difference between a limiter that has
   * already turned down when the transient arrives and one that clips it.
   */
  lookAheadMs: number;
  releaseMs: number;
}

/**
 * One EQ band.
 *
 * `type` is `FilterTypeEnum`'s string, not the enum itself — this shape is
 * JSON in `localStorage` and crosses a worklet port, and a stored string that
 * no longer names a member has to survive being read by a later build.
 * `clampEqBand` is what turns it back into something trusted.
 */
export interface IEqBandSettings {
  enabled: boolean;
  type: string;
  frequency: number;
  gainDb: number;
  quality: number;
  /**
   * Act only when there is something here to act on.
   *
   * A static band is honest and blunt: a cut at 6 kHz to tame one singer's
   * sibilance also dulls every cymbal in the record, because the filter cannot
   * tell them apart. A dynamic band applies the SAME gain, but only while the
   * energy in its own passband is above `thresholdDb` — so it takes the
   * sibilant and leaves the cymbals alone.
   *
   * Per band rather than per rack, which is the whole point: a curve is
   * normally two or three bands that need to react and a dozen that must not.
   * Off by default, so every rack that existed before this behaves as it did.
   */
  dynamic: boolean;
  /**
   * Where a dynamic band starts working, in dBFS of its own passband.
   *
   * Measured on the band's input rather than its output, so moving the gain
   * dial does not move the point at which it engages — otherwise the two
   * controls fight and neither can be set.
   */
  thresholdDb: number;
}

/**
 * Which processing renders the bands.
 *
 * The same curve through different machinery, which is the whole point: dials
 * set identically sound like a different equaliser. `clean` is RBJ's cookbook
 * and is what Equalizer APO renders, so it stays the default and an exported
 * curve behaves the same on both paths. `proportional` narrows each band as it
 * is driven — the focused console character. `wide` spreads them so they
 * overlap into a tilt rather than a row of bumps.
 *
 * Named for what they do, not for the equipment they resemble: this app is
 * sold, and a mode named after somebody's console is a trademark problem
 * rather than a technical one.
 */
export type TEqModel = 'clean' | 'proportional' | 'wide';

export const EQ_MODELS: readonly TEqModel[] = ['clean', 'proportional', 'wide'];

/**
 * How the bands are put against the audio, which is a different question from
 * what shape each band is.
 *
 * `serial` cascades them — each band filters the previous band's output, so
 * phase shifts accumulate down the chain and overlapping bands depend on their
 * order. `parallel` filters the original signal with every band and adds what
 * each one changed, so no band hears another's phase and order stops
 * mattering. Same curve on the dials, a different thing done to the audio.
 */
export type TEqEngine = 'serial' | 'parallel';

/**
 * Which part of the stereo image the bands act on.
 *
 * `stereo` filters left and right alike, which is what an equaliser normally
 * does. The other two convert to mid and side first — what both speakers share,
 * and what they differ by — filter one of them, and convert back.
 *
 * That is the thing a stereo equaliser cannot do at all: brightening a centred
 * vocal without touching the reverb around it, or clearing bass out of the
 * sides while leaving the middle whole.
 */
export type TEqStereo = 'stereo' | 'mid' | 'side';

export const EQ_STEREO_MODES: readonly TEqStereo[] = ['stereo', 'mid', 'side'];

export const EQ_ENGINES: readonly TEqEngine[] = ['serial', 'parallel'];

/**
 * Whether the bands are allowed to shift phase where they change amplitude.
 *
 * `minimum` is every biquad equaliser there has ever been, and the shift is
 * not a defect: it is what makes a causal filter causal, which is why the two
 * cannot be had at once. `linear` replaces the cascade with a symmetric FIR of
 * the same magnitude, so no frequency is delayed relative to another — at the
 * cost of latency, and of ringing symmetrically about a transient instead of
 * behind it. Neither is the better one; they are two different trades.
 */
export type TEqPhase = 'minimum' | 'linear';

export const EQ_PHASE_MODES: readonly TEqPhase[] = ['minimum', 'linear'];

/**
 * How much of the input regulator to use.
 *
 * `off` is none of it: the rack is handed the signal at unity and whatever
 * it does with it is between the curve and the preamp. Honest, and the right
 * answer for anyone driving the level by hand or measuring something.
 *
 * `fixed` reserves the curve's whole worst case and holds it there, so the
 * level is dead steady for a given rack and some of it is spent on boosts
 * the record may never reach.
 *
 * `adaptive` starts from that reserve and hands back what this particular
 * song turns out not to need, which keeps the level and moves it slowly as
 * the music changes.
 */
export type TTrimMode = 'off' | 'fixed' | 'adaptive';

export const TRIM_MODES: readonly TTrimMode[] = ['off', 'fixed', 'adaptive'];

/** 1 is off. Four is the most the two-stage oversampler is built for. */
export const OVERSAMPLE_FACTORS: readonly number[] = [1, 2, 4];

export interface IEqSettings {
  enabled: boolean;
  /** @see TEqModel */
  model: TEqModel;
  /**
   * How much of the chosen character to apply, 0 to 1.
   *
   * Each character shipped at one fixed strength, so "a bit focused" was not
   * something the rack could be asked for. At 0 every character collapses to
   * the cookbook, which makes this an off switch that costs nothing.
   */
  modelAmount: number;
  /** @see TEqEngine */
  engine: TEqEngine;
  /** @see TEqPhase */
  phase: TEqPhase;
  /** @see TEqStereo */
  stereo: TEqStereo;
  /**
   * Sum everything below this frequency to mono, in Hz, or 0 for off.
   *
   * The fix for phase cancellation, and the one place it actually bites. Bass
   * recorded or widened out of phase disappears the moment the two channels are
   * summed — which is what a phone speaker, a mono PA and most Bluetooth
   * speakers do — so a mix can sound enormous on headphones and gutless
   * everywhere else.
   *
   * Removing the SIDE content below the corner leaves the middle untouched, so
   * the bass stops depending on the two channels agreeing. Above the corner the
   * stereo image is left exactly as it was: width is worth keeping where it
   * cannot cancel.
   */
  monoBelowHz: number;
  /**
   * Run the bands at twice the rate.
   *
   * Orthogonal to the engine on purpose: it is not a third topology, it is the
   * same topology given room. A biquad is linear and cannot alias, so this buys
   * no headroom — it buys distance from Nyquist, where the bilinear transform
   * squeezes a high band's upper skirt flat. Measured at 44.1 kHz, a 16 kHz
   * bell asked for +6 dB carries 0.6 dB an octave below and 0.03 above; at
   * double rate those come back together.
   *
   * Off by default, because it costs roughly double the EQ's arithmetic plus a
   * 63-tap filter each way for a difference that lives in the top octave.
   */
  /**
   * How many times the base rate the bands run at: 1, 2 or 4.
   *
   * Four is two halvings rather than one longer filter, so each stage only has
   * to reject the octave above it.
   */
  oversample: number;
  /**
   * A high pass below the audible band, in Hz, or 0 for none.
   *
   * Not tone shaping — cone protection and headroom. Rumble, DC offset and
   * footfall below about 20 Hz are inaudible on any normal speaker but still
   * cost real excursion: the woofer is moving that far for content nobody can
   * hear, and every millimetre spent there is unavailable to the bass that can
   * be. Removing it makes the same amplifier sound tighter without touching
   * anything audible, which is why mastering chains and PA processors have had
   * this switch for decades.
   */
  subsonicHz: number;
  /**
   * A little harmonic colour, 0 to 1, and 0 costs nothing.
   *
   * The one thing no arrangement of filters can produce: biquads cannot invent
   * a frequency that was not already there. A fixed "warm" mode was built and
   * rejected for being too much of it — an amount is the same idea with the
   * decision left where it belongs.
   *
   * Asymmetric, so it makes EVEN harmonics as well as odd. Even ones read as
   * warmth; odd alone reads as edge.
   */
  fuzzAmount: number;
  /**
   * `EQ_BAND_COUNT` by default, and as many as an imported file asked for up
   * to `EQ_MAX_BAND_COUNT`.
   */
  bands: readonly IEqBandSettings[];
  /**
   * The curve the rack sizes are resampled FROM, rather than from each other.
   *
   * Resampling the live rack each time compounds its own error: ten bands read
   * down to six lose the detail between them, and reading those six back up to
   * thirty-one cannot invent it again — so a round trip through a smaller rack
   * quietly flattened an imported curve, and going back to the size it came in
   * at did not restore it.
   *
   * This holds the last curve somebody actually authored — what was imported,
   * what a preset supplied, or what they dialled in by hand — and every rack
   * change interpolates from here. Switching 10 → 6 → 31 → 10 now ends where
   * it started.
   *
   * Empty means "the bands are the source", which is what a stored setting
   * from before this existed looks like.
   */
  sourceBands: readonly IEqBandSettings[];
  /**
   * The user's own offset at the input, in dB, on top of the regulator.
   *
   * Every published correction curve carries a preamp, and it is not
   * decoration: a curve with a +4.7 dB boost in it clips without the -5.4 dB
   * the file asks for in front. An import still sets this, because the figure
   * in the file is the author's judgement of their own curve.
   *
   * With `autoPreamp` on, the headroom the curve needs is already taken care
   * of by `trimDb`, so zero here is the neutral position rather than a
   * gamble — and turning it up is a deliberate decision to run hot rather than
   * an accident of which preset was chosen.
   */
  preampDb: number;
  /**
   * The input regulator's gain, in dB. Derived, never edited, always on.
   *
   * The bands sit a third of an octave apart at the bottom, so their skirts
   * overlap and adjacent gains ADD: "Bass boost", whose largest band was +5 dB,
   * measured +12.15 dB summed at 69 Hz. Nothing in the rack was wrong — the
   * number on the dial was simply never the number leaving the stage, and with
   * nothing in front of it that was twelve decibels past full scale on the
   * loudest part of the material, which is the distortion the presets were
   * reported for.
   *
   * Held at minus the curve's own measured peak, so the loudest point of the
   * rack lands exactly at unity and no arrangement of boosts can clip by
   * itself. There is no switch: an "off" position is a position that clips, and
   * the control that answers "I want it hotter than that" already exists one
   * dial along.
   *
   * Kept separate from `preampDb` rather than written into it, because the two
   * answer different questions and one number cannot hold both. Folding them
   * together meant every recomputation overwrote whatever had been dialled in,
   * so the automatic half fought the manual half and the dial's zero meant
   * nothing in particular. Apart, zero on the preamp is the sweet spot by
   * construction: the rack at unity, nothing given away.
   *
   * Stored because the worklet only ever sees this object, and it is a cache of
   * a pure function of the bands — anything that changes them passes through
   * `withInputTrim`, which is where it is refreshed.
   */
  trimDb: number;
  /**
   * How much of the input regulator to use. @see TTrimMode
   *
   * Off, the reserve is the curve's whole peak whatever is playing: the level
   * holds perfectly still for a given rack and some of it is spent on boosts
   * the record never reaches. On, the reserve is handed back as the song turns
   * out not to need it, which keeps the level — and moves it, slowly, as the
   * music changes. That movement is the reason this is a switch: it is an
   * improvement to some ears and a distraction to others, and neither is
   * wrong.
   *
   * A listening preference rather than a property of the curve, so no preset
   * sets it — the same reasoning that keeps the preamp out of them.
   *
   * Off by default. A rack that holds a steady level is what somebody expects
   * from an equaliser, and a level that moves on its own — however well — is
   * a thing to opt into rather than to discover.
   */
  trimMode: TTrimMode;
  /**
   * The factory preset last applied, or empty for a hand-made curve.
   *
   * Stored rather than derived so it survives a reload: the bands alone cannot
   * say whether a curve came from "Rock" or was dialled in by hand, and coming
   * back to a session with the picker blank makes the app look like it forgot.
   * Cleared the moment a band is touched, because at that point it did.
   */
  presetId: string;
}

/**
 * Fifteen is what the rack starts with.
 *
 * A mixing-desk spread that gives every band somewhere useful to start. It is
 * no longer a ceiling: a published correction file decides its own band count,
 * and truncating one to fifteen threw away filters the author put there — the
 * curve that came out was not the curve on the page.
 *
 * Fifteen cascaded biquads is well within budget — 15 × 2 channels × 5
 * multiply-adds is about 7 million operations a second at 48 kHz, against a
 * render quantum's budget of far more — and each one keeps its state in a
 * JavaScript number, which is float64. Precision does not degrade down the
 * chain the way it would in a 32-bit fixed-point cascade.
 */
export const EQ_BAND_COUNT = 15;

/**
 * One setting changed, and the preset picker told the truth about it.
 *
 * A preset carries the character, the topology, the oversampling and the
 * protective filters as well as the fifteen gains, so touching any of them
 * means the rack is no longer the preset it is still labelled with. Only a band
 * edit used to clear the label, which was right while a preset was nothing but
 * gains and became a lie the moment it was more.
 *
 * Not for the preamp: that is headroom rather than part of the curve, and
 * trimming it must not make the picker claim the preset was abandoned.
 */
export const eqEdited = (
  eq: IEqSettings,
  next: Partial<IEqSettings>,
): IEqSettings => ({ ...eq, ...next, presetId: '' });

/**
 * The ceiling an import cannot cross.
 *
 * Not a format limit — it is a budget. Published curves run to about twenty
 * filters and the longest seen is in the thirties, so sixty-four leaves room
 * without letting a malformed file allocate a biquad per line and stall the
 * audio thread.
 */
export const EQ_MAX_BAND_COUNT = 64;

export interface IDspSettings {
  eq: IEqSettings;
  exciter: IExciterSettings;
  compressor: ICompressorSettings;
  maximizer: IMaximizerSettings;
}

interface IRange {
  min: number;
  max: number;
}

const RANGES = {
  exciterCrossoverHz: { min: 120, max: 12_000 },
  exciterDrive: { min: 1, max: 10 },
  exciterMix: { min: 0, max: 1 },
  exciterTexture: { min: 0, max: 1 },
  organicAmount: { min: 0, max: 1 },
  organicRange: { min: 0, max: 1 },
  // The whole audible band, not the midrange it was first scoped to.
  //
  // It started at 150-2500 on the reasoning that a thin midrange is what this
  // stage is for. That reasoning was right about the common case and wrong as
  // a limit: a driver can be hollow anywhere, and refusing to put body under
  // 150 Hz or above 2.5k is answering a question the user was asking. Paired
  // with `range`, which widens the band until the focus stops mattering at
  // all, this now covers everything.
  organicFocusHz: { min: 40, max: 16_000 },
  compressorLowHz: { min: 60, max: 600 },
  compressorHighHz: { min: 1_000, max: 10_000 },
  thresholdDb: { min: -60, max: 0 },
  ratio: { min: 1, max: 20 },
  attackMs: { min: 0.1, max: 200 },
  releaseMs: { min: 5, max: 2_000 },
  makeupDb: { min: 0, max: 24 },
  // Down to where a quiet passage lives and up to just under full scale.
  // Below -60 nothing musical ever falls under the threshold, so the band
  // would be permanently engaged and indistinguishable from a static one.
  eqThresholdDb: { min: -60, max: 0 },
  ceilingDb: { min: -12, max: 0 },
  lookAheadMs: { min: 0, max: 20 },
  maximizerReleaseMs: { min: 5, max: 1_000 },
  eqFrequency: { min: 20, max: 20_000 },
  eqGainDb: { min: -24, max: 24 },
  eqQuality: { min: 0.1, max: 18 },
} as const satisfies Record<string, IRange>;

const clampNumber = (
  value: unknown,
  range: IRange,
  fallback: number,
): number =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.min(range.max, Math.max(range.min, value))
    : fallback;

const clampBoolean = (value: unknown, fallback: boolean): boolean =>
  typeof value === 'boolean' ? value : fallback;

const DEFAULT_BAND: IBandSettings = {
  thresholdDb: -18,
  ratio: 2,
  attackMs: 10,
  releaseMs: 120,
  makeupDb: 0,
};

/**
 * The six bands, spread the way a mixing desk lays them out.
 *
 * Shelves at the ends and bells between, spaced roughly two octaves apart so
 * every band starts somewhere useful and none of them start on top of each
 * other. All at 0 dB, so opening the EQ changes nothing until something is
 * moved.
 */
const DEFAULT_EQ_BANDS: readonly IEqBandSettings[] = [
  {
    enabled: true,
    type: 'LSC',
    frequency: 32,
    gainDb: 0,
    quality: 0.7,
    dynamic: false,
    thresholdDb: -24,
  },
  {
    enabled: true,
    type: 'PK',
    frequency: 50,
    gainDb: 0,
    quality: 1.4,
    dynamic: false,
    thresholdDb: -24,
  },
  {
    enabled: true,
    type: 'PK',
    frequency: 80,
    gainDb: 0,
    quality: 1.4,
    dynamic: false,
    thresholdDb: -24,
  },
  {
    enabled: true,
    type: 'PK',
    frequency: 125,
    gainDb: 0,
    quality: 1.4,
    dynamic: false,
    thresholdDb: -24,
  },
  {
    enabled: true,
    type: 'PK',
    frequency: 200,
    gainDb: 0,
    quality: 1.4,
    dynamic: false,
    thresholdDb: -24,
  },
  {
    enabled: true,
    type: 'PK',
    frequency: 315,
    gainDb: 0,
    quality: 1.4,
    dynamic: false,
    thresholdDb: -24,
  },
  {
    enabled: true,
    type: 'PK',
    frequency: 500,
    gainDb: 0,
    quality: 1.4,
    dynamic: false,
    thresholdDb: -24,
  },
  {
    enabled: true,
    type: 'PK',
    frequency: 800,
    gainDb: 0,
    quality: 1.4,
    dynamic: false,
    thresholdDb: -24,
  },
  {
    enabled: true,
    type: 'PK',
    frequency: 1_250,
    gainDb: 0,
    quality: 1.4,
    dynamic: false,
    thresholdDb: -24,
  },
  {
    enabled: true,
    type: 'PK',
    frequency: 2_000,
    gainDb: 0,
    quality: 1.4,
    dynamic: false,
    thresholdDb: -24,
  },
  {
    enabled: true,
    type: 'PK',
    frequency: 3_150,
    gainDb: 0,
    quality: 1.4,
    dynamic: false,
    thresholdDb: -24,
  },
  {
    enabled: true,
    type: 'PK',
    frequency: 5_000,
    gainDb: 0,
    quality: 1.4,
    dynamic: false,
    thresholdDb: -24,
  },
  {
    enabled: true,
    type: 'PK',
    frequency: 8_000,
    gainDb: 0,
    quality: 1.4,
    dynamic: false,
    thresholdDb: -24,
  },
  {
    enabled: true,
    type: 'PK',
    frequency: 12_500,
    gainDb: 0,
    quality: 1.4,
    dynamic: false,
    thresholdDb: -24,
  },
  {
    enabled: true,
    type: 'HSC',
    frequency: 16_000,
    gainDb: 0,
    quality: 0.7,
    dynamic: false,
    thresholdDb: -24,
  },
];

/**
 * The rack sizes offered, and the ISO centres each one lands on.
 *
 * Not arbitrary counts with the range divided up: these are the frequencies
 * graphic equalisers have used for fifty years, so a curve set here looks the
 * same as the same curve set anywhere else. Ten is the ISO octave series,
 * thirty-one the third-octave series, and fifteen is the two-thirds-octave
 * spread the rack already shipped with — left exactly as it was, because the
 * factory presets are fifteen gains written against these frequencies.
 */
const RACK_FREQUENCIES: Record<number, readonly number[]> = {
  6: [63, 160, 400, 1_000, 4_000, 12_000],
  10: [31.5, 63, 125, 250, 500, 1_000, 2_000, 4_000, 8_000, 16_000],
  15: DEFAULT_EQ_BANDS.map((band) => band.frequency),
  31: [
    20, 25, 31.5, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400, 500, 630,
    800, 1_000, 1_250, 1_600, 2_000, 2_500, 3_150, 4_000, 5_000, 6_300, 8_000,
    10_000, 12_500, 16_000, 20_000,
  ],
};

export const EQ_RACK_SIZES = [6, 10, 15, 31] as const;

/**
 * Q for a rack whose bands sit `octaves` apart.
 *
 * The standard relation, Q = 1 / (2^(n/2) - 2^(-n/2)). It is what makes a
 * graphic EQ's bands meet at their skirts instead of leaving holes between
 * them (Q too high) or piling three bands onto one frequency (Q too low), and
 * it is why a 31-band rack wants Q≈4.3 where a 10-band wants Q≈1.4.
 */
const qForSpacing = (octaves: number): number =>
  Math.round((1 / (2 ** (octaves / 2) - 2 ** (-octaves / 2))) * 100) / 100;

/**
 * A full rack at one of the offered sizes.
 *
 * Bells throughout, which is both what a real graphic equaliser is and what
 * the measurements in the roadmap force. A rack ending in a high shelf would
 * put that shelf at 16 kHz on the ten-band and 20 kHz on the thirty-one, and
 * `dspBiquad.test.ts` records what the cookbook does there: a 16 kHz shelf
 * asked for +6 dB delivers between 3 and 6, because the response is forced
 * flat at Nyquist and a shelf that high has nowhere left to rise. At 20 kHz
 * against a 44.1 kHz rate it would deliver almost nothing at all — a control
 * that visibly moves and inaudibly does nothing.
 *
 * The fifteen-band rack keeps its shelves and is not built here: its
 * frequencies are what the factory presets are written against, and its top
 * shelf is a known cost recorded in the roadmap rather than a new one.
 */
export const buildEqRack = (count: number): readonly IEqBandSettings[] => {
  const frequencies = RACK_FREQUENCIES[count];
  if (!frequencies) {
    return DEFAULT_EQ_BANDS;
  }
  if (count === EQ_BAND_COUNT) {
    return DEFAULT_EQ_BANDS;
  }
  // Total span in octaves divided by the gaps between bands.
  const octaves =
    Math.log2(frequencies[frequencies.length - 1] / frequencies[0]) /
    Math.max(1, frequencies.length - 1);
  const quality = qForSpacing(octaves);
  return frequencies.map((frequency) => ({
    enabled: true,
    dynamic: false,
    thresholdDb: -24,
    type: 'PK',
    frequency,
    gainDb: 0,
    quality,
  }));
};

export const DSP_DEFAULTS: IDspSettings = {
  eq: {
    enabled: false,
    model: 'clean',
    modelAmount: 1,
    engine: 'serial',
    phase: 'minimum',
    stereo: 'stereo',
    monoBelowHz: 0,
    oversample: 1,
    subsonicHz: 0,
    fuzzAmount: 0,
    bands: DEFAULT_EQ_BANDS,
    sourceBands: [],
    presetId: '',
    preampDb: 0,
    trimDb: 0,
    trimMode: 'fixed',
  },
  exciter: {
    enabled: false,
    // 300 Hz and 3 kHz: the classic body / presence / air split, and the same
    // three regions a listener describes without being taught them.
    crossoverHz: [300, 3_000],
    bands: [
      // Low: even orders only. Odd harmonics down here are the definition of
      // a muddy bottom end, and the low band exists to add weight, not edge.
      {
        enabled: false,
        drive: 2,
        mix: 0.2,
        texture: 0,
        dynamic: false,
        thresholdDb: -24,
      },
      // Mid: mostly even, which is where body lives.
      {
        enabled: false,
        drive: 2.5,
        mix: 0.25,
        texture: 0.25,
        dynamic: false,
        thresholdDb: -24,
      },
      // High: mostly odd, which is what the old single-band exciter was, and
      // it was right about this band — odd orders up here read as air.
      {
        enabled: true,
        drive: 3,
        mix: 0.3,
        texture: 0.85,
        dynamic: false,
        thresholdDb: -24,
      },
    ],
    // A little wider than the focus band by default: a stage that arrives
    // audibly working on one narrow slice reads as a resonance rather than as
    // body, and body is the point.
    organic: { enabled: false, amount: 0.4, focusHz: 700, range: 0.35 },
    isolate: false,
  },
  compressor: {
    enabled: false,
    crossoverHz: [200, 3_000],
    bands: [DEFAULT_BAND, DEFAULT_BAND, DEFAULT_BAND],
  },
  maximizer: {
    enabled: false,
    ceilingDb: -1,
    lookAheadMs: 5,
    releaseMs: 100,
  },
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const clampBand = (value: unknown, fallback: IBandSettings): IBandSettings => {
  if (!isRecord(value)) {
    return fallback;
  }
  return {
    thresholdDb: clampNumber(
      value.thresholdDb,
      RANGES.thresholdDb,
      fallback.thresholdDb,
    ),
    ratio: clampNumber(value.ratio, RANGES.ratio, fallback.ratio),
    attackMs: clampNumber(value.attackMs, RANGES.attackMs, fallback.attackMs),
    releaseMs: clampNumber(
      value.releaseMs,
      RANGES.releaseMs,
      fallback.releaseMs,
    ),
    makeupDb: clampNumber(value.makeupDb, RANGES.makeupDb, fallback.makeupDb),
  };
};

const clampExciterBand = (
  value: unknown,
  fallback: IExciterBandSettings,
): IExciterBandSettings => {
  if (!isRecord(value)) {
    return fallback;
  }
  return {
    enabled: clampBoolean(value.enabled, fallback.enabled),
    drive: clampNumber(value.drive, RANGES.exciterDrive, fallback.drive),
    mix: clampNumber(value.mix, RANGES.exciterMix, fallback.mix),
    texture: clampNumber(
      value.texture,
      RANGES.exciterTexture,
      fallback.texture,
    ),
    dynamic: clampBoolean(value.dynamic, fallback.dynamic),
    thresholdDb: clampNumber(
      value.thresholdDb,
      RANGES.thresholdDb,
      fallback.thresholdDb,
    ),
  };
};

/**
 * Read a settings blob from anywhere and return something usable.
 *
 * Clamps rather than rejects, and falls back field by field rather than
 * wholesale: a preset saved by a later build carrying one value this build
 * does not understand should cost the user that value, not every other
 * setting sitting beside it.
 */
/** The filter shapes an EQ band may claim to be. */
const EQ_TYPES = ['PK', 'NO', 'LSC', 'HSC', 'LPQ', 'HPQ', 'BP'] as const;

/** For a stored band past the default rack, which has no counterpart there. */
const FALLBACK_EQ_BAND: IEqBandSettings = {
  enabled: true,
  type: 'PK',
  frequency: 1_000,
  gainDb: 0,
  dynamic: false,
  thresholdDb: -24,
  quality: 1.4,
};

const clampEqBand = (
  value: unknown,
  fallback: IEqBandSettings,
): IEqBandSettings => {
  if (!isRecord(value)) {
    return fallback;
  }
  return {
    enabled: clampBoolean(value.enabled, fallback.enabled),
    // A stored string that no longer names a shape falls back rather than
    // reaching the coefficient maths, where an unknown type would silently
    // become a high shelf.
    type:
      typeof value.type === 'string' &&
      (EQ_TYPES as readonly string[]).includes(value.type)
        ? value.type
        : fallback.type,
    frequency: clampNumber(
      value.frequency,
      RANGES.eqFrequency,
      fallback.frequency,
    ),
    gainDb: clampNumber(value.gainDb, RANGES.eqGainDb, fallback.gainDb),
    quality: clampNumber(value.quality, RANGES.eqQuality, fallback.quality),
    dynamic: clampBoolean(value.dynamic, fallback.dynamic),
    thresholdDb: clampNumber(
      value.thresholdDb,
      RANGES.eqThresholdDb,
      fallback.thresholdDb,
    ),
  };
};

export const clampDspSettings = (value: unknown): IDspSettings => {
  if (!isRecord(value)) {
    return DSP_DEFAULTS;
  }
  const eq = isRecord(value.eq) ? value.eq : {};
  const storedEqBands = Array.isArray(eq.bands) ? eq.bands : [];
  const exciter = isRecord(value.exciter) ? value.exciter : {};
  const compressor = isRecord(value.compressor) ? value.compressor : {};
  const maximizer = isRecord(value.maximizer) ? value.maximizer : {};
  const storedBands = Array.isArray(compressor.bands) ? compressor.bands : [];
  const storedCorners = Array.isArray(compressor.crossoverHz)
    ? compressor.crossoverHz
    : [];
  const storedOrganic = isRecord(exciter.organic) ? exciter.organic : {};

  /**
   * A stored single-band exciter becomes this one's high band.
   *
   * The exciter was one crossover, one drive and one mix, and every one of
   * those still exists here — they are the third band. Falling back to the
   * defaults instead would silently discard a setting somebody had tuned by
   * ear, and would do it on upgrade, where nobody is watching for it.
   *
   * The old corner was the frequency ABOVE which harmonics were generated,
   * which is exactly what the upper of two corners means, so it carries across
   * without reinterpretation. Its old range started at 1 kHz and this one
   * starts at 120, so no stored value can fall outside.
   */
  const isLegacyExciter = typeof exciter.crossoverHz === 'number';
  const storedExciterCorners = Array.isArray(exciter.crossoverHz)
    ? exciter.crossoverHz
    : [
        DSP_DEFAULTS.exciter.crossoverHz[0],
        isLegacyExciter
          ? exciter.crossoverHz
          : DSP_DEFAULTS.exciter.crossoverHz[1],
      ];
  const storedExciterBands = Array.isArray(exciter.bands)
    ? exciter.bands
    : [
        undefined,
        undefined,
        isLegacyExciter
          ? {
              ...DSP_DEFAULTS.exciter.bands[2],
              drive: exciter.drive,
              mix: exciter.mix,
            }
          : undefined,
      ];

  return {
    eq: {
      enabled: clampBoolean(eq.enabled, DSP_DEFAULTS.eq.enabled),
      // A stored name that no longer exists falls back rather than reaching
      // the coefficient maths, where an unknown model would silently become
      // whichever branch happens to be last.
      model: EQ_MODELS.includes(eq.model as TEqModel)
        ? (eq.model as TEqModel)
        : 'clean',
      modelAmount: clampNumber(eq.modelAmount, { min: 0, max: 1 }, 1),
      engine: EQ_ENGINES.includes(eq.engine as TEqEngine)
        ? (eq.engine as TEqEngine)
        : 'serial',
      phase: EQ_PHASE_MODES.includes(eq.phase as TEqPhase)
        ? (eq.phase as TEqPhase)
        : 'minimum',
      stereo: EQ_STEREO_MODES.includes(eq.stereo as TEqStereo)
        ? (eq.stereo as TEqStereo)
        : 'stereo',
      // Zero is off. Above 300 Hz this stops being a safety measure and starts
      // collapsing the image somewhere people can hear it.
      monoBelowHz:
        typeof eq.monoBelowHz === 'number' && eq.monoBelowHz > 0
          ? Math.min(300, Math.max(40, eq.monoBelowHz))
          : 0,
      // A stored `true` predates the factor and meant twice, so it still does.
      oversample: OVERSAMPLE_FACTORS.includes(eq.oversample as number)
        ? (eq.oversample as number)
        : (eq.oversample === true && 2) || 1,
      // Zero means off, and any other value is pulled into a range where a
      // high pass is protective rather than audible.
      subsonicHz:
        typeof eq.subsonicHz === 'number' && eq.subsonicHz > 0
          ? Math.min(40, Math.max(10, eq.subsonicHz))
          : 0,
      fuzzAmount: clampNumber(eq.fuzzAmount, { min: 0, max: 1 }, 0),
      presetId: typeof eq.presetId === 'string' ? eq.presetId : '',
      preampDb: clampNumber(eq.preampDb, RANGES.eqGainDb, 0),
      // Zero for a setting written before this existed — those are the
      // sessions that have been clipping — and recomputed on the next change
      // either way.
      trimDb: clampNumber(eq.trimDb, RANGES.eqGainDb, 0),
      // A stored boolean predates the third position: `true` meant adaptive
      // and `false` meant the fixed reserve, which is what those two names
      // still mean.
      trimMode: TRIM_MODES.includes(eq.trimMode as TTrimMode)
        ? (eq.trimMode as TTrimMode)
        : (eq.adaptiveTrim === true && 'adaptive') || 'fixed',
      // The stored rack decides its own length now, so an imported ten-filter
      // curve comes back as ten bands rather than being padded out to fifteen
      // with silent ones. A band past the default rack has no fallback of its
      // own, so it borrows the generic bell — reached only when a stored entry
      // is corrupt, since a sound one supplies every field itself.
      bands: Array.from(
        {
          length: Math.min(
            EQ_MAX_BAND_COUNT,
            Math.max(1, storedEqBands.length || DSP_DEFAULTS.eq.bands.length),
          ),
        },
        (_, index) =>
          clampEqBand(
            storedEqBands[index],
            DSP_DEFAULTS.eq.bands[index] ?? FALLBACK_EQ_BAND,
          ),
      ),
      sourceBands: (Array.isArray(eq.sourceBands) ? eq.sourceBands : [])
        .slice(0, EQ_MAX_BAND_COUNT)
        .map((band) => clampEqBand(band, FALLBACK_EQ_BAND)),
    },
    exciter: {
      enabled: clampBoolean(exciter.enabled, DSP_DEFAULTS.exciter.enabled),
      crossoverHz: [
        clampNumber(
          storedExciterCorners[0],
          RANGES.exciterCrossoverHz,
          DSP_DEFAULTS.exciter.crossoverHz[0],
        ),
        clampNumber(
          storedExciterCorners[1],
          RANGES.exciterCrossoverHz,
          DSP_DEFAULTS.exciter.crossoverHz[1],
        ),
      ],
      bands: DSP_DEFAULTS.exciter.bands.map((fallback, index) =>
        clampExciterBand(storedExciterBands[index], fallback),
      ),
      organic: {
        enabled: clampBoolean(
          storedOrganic.enabled,
          DSP_DEFAULTS.exciter.organic.enabled,
        ),
        amount: clampNumber(
          storedOrganic.amount,
          RANGES.organicAmount,
          DSP_DEFAULTS.exciter.organic.amount,
        ),
        focusHz: clampNumber(
          storedOrganic.focusHz,
          RANGES.organicFocusHz,
          DSP_DEFAULTS.exciter.organic.focusHz,
        ),
        range: clampNumber(
          storedOrganic.range,
          RANGES.organicRange,
          DSP_DEFAULTS.exciter.organic.range,
        ),
      },
      // Never restored, whatever the stored blob says. @see IExciterSettings
      // — quitting with the monitoring mode on and coming back to a rack that
      // plays only harmonics is a bug report, not a preference.
      isolate: false,
    },
    compressor: {
      enabled: clampBoolean(
        compressor.enabled,
        DSP_DEFAULTS.compressor.enabled,
      ),
      crossoverHz: [
        clampNumber(
          storedCorners[0],
          RANGES.compressorLowHz,
          DSP_DEFAULTS.compressor.crossoverHz[0],
        ),
        clampNumber(
          storedCorners[1],
          RANGES.compressorHighHz,
          DSP_DEFAULTS.compressor.crossoverHz[1],
        ),
      ],
      bands: DSP_DEFAULTS.compressor.bands.map((fallback, index) =>
        clampBand(storedBands[index], fallback),
      ),
    },
    maximizer: {
      enabled: clampBoolean(maximizer.enabled, DSP_DEFAULTS.maximizer.enabled),
      ceilingDb: clampNumber(
        maximizer.ceilingDb,
        RANGES.ceilingDb,
        DSP_DEFAULTS.maximizer.ceilingDb,
      ),
      lookAheadMs: clampNumber(
        maximizer.lookAheadMs,
        RANGES.lookAheadMs,
        DSP_DEFAULTS.maximizer.lookAheadMs,
      ),
      releaseMs: clampNumber(
        maximizer.releaseMs,
        RANGES.maximizerReleaseMs,
        DSP_DEFAULTS.maximizer.releaseMs,
      ),
    },
  };
};
