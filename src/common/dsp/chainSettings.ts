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

import { TTrebleDesign } from '../filterDesign';
import {
  IBassForgeSettings,
  IBassPunchSettings,
  ICrossfadeSettings,
  IDenoiseSettings,
  IDimensionSettings,
  IExciterSettings,
  IInputNormalizerSettings,
  IMaximizerSettings,
} from './chainStageSettings';

// The rest of the rack's settings - the Master, the EQ and its bands, the
// Room, surround - and IDspSettings, the whole rack as one value. chain.ts
// re-exports all of it.

/**
 * The transparent output stage after every creative processor.
 *
 * `outputTrimDb` is deliberately not called a preamp: it changes the finished
 * chain rather than the level that drives a nonlinear stage. LUFS maximize
 * owns the final true-peak boundary: average-loudness makeup cannot be safe
 * without peak control, and disabling it returns the complete stage to unity.
 */
export interface IMasterSettings {
  enabled: boolean;
  /** The chosen delivery target, or '' once any of its numbers is moved. */
  presetId: string;
  outputTrimDb: number;
  /** Constant source-LUFS gain with its required true-peak control last. */
  loudnessMaximize: boolean;
  loudnessTargetLufs: number;
  /** User ceiling in dBTP, applied only while LUFS maximize is enabled. */
  ceilingDb: number;
  releaseMs: number;
  /**
   * How much gain reduction the loudness target is allowed to buy, in dB.
   *
   * The makeup used to be capped at the true-peak room the track had left,
   * which under the shipped defaults — the Normalizer holding peaks at
   * -1 dBTP and this stage's ceiling also at -1 dBTP — is exactly zero
   * decibels on every commercially mastered record. The target was therefore
   * unreachable by construction, and on quiet material it landed somewhere
   * different for every track, which is why the loudness still moved.
   *
   * Auto Headroom is the look-ahead true-peak limiter that runs immediately
   * before the master gain, and only while LUFS maximize is on. It already
   * reserves the gain still to come, so makeup beyond the peak room is safe —
   * it costs limiting, not clipping. This says how much of that cost the
   * target may incur. At 0 the old peak-safe behaviour returns exactly.
   */
  peakLimitingDb: number;
  /**
   * Play the maximized result at the loudness it had before maximizing.
   *
   * The limiting is unchanged and only the final level moves, so A/B against a
   * bypassed Master compares the sound rather than the volume. Without it the
   * louder side wins every comparison, which is the oldest way to be wrong
   * about a master.
   */
  matchedBypass: boolean;
}

/** Signed whole-track correction accepted by the renderer/worklet boundary. */
export const MASTER_LOUDNESS_GAIN_MIN_DB = -48;

export const MASTER_LOUDNESS_GAIN_MAX_DB = 12;

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
export type TEqModel = 'clean' | 'proportional' | 'wide' | 'asymmetric';

/**
 * Append-only: the wire carries an index into this list, so an insert would
 * hand a running engine somebody else's character.
 *
 * `asymmetric` came last and is the main equaliser's fourth mode, brought
 * here because the two pages offering different characters under the same
 * heading is the kind of difference nobody can hear a reason for.
 */
export const EQ_MODELS: readonly TEqModel[] = [
  'clean',
  'proportional',
  'wide',
  'asymmetric',
];

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

/** 1 is off. Four is the most the two-stage oversampler is built for. */
export const OVERSAMPLE_FACTORS: readonly number[] = [1, 2, 4];

export interface IEqSettings {
  enabled: boolean;
  /**
   * Hear only the curve and colour this EQ changes.
   *
   * The monitor is magnitude-matched across phase modes and its dry reference
   * carries the same input gain, so phase rotation and preset headroom cannot
   * masquerade as a copy of the song.
   */
  isolate: boolean;
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
   * How the bands play near the top, the main EQ's Treble choice
   * (`filterDesign.ts`) given to the rack's own EQ.
   *
   * Precise builds every band that has a matched design analog-matched —
   * bells, the pass filters and Butterworth shelves (`biquadMatched.ts`,
   * `feq_biquad_coefficients_designed`) — so a treble band plays as drawn:
   * the cookbook leaves a +6 dB, Q 2 bell at 16 kHz 3 dB short on a 48 kHz
   * stream, and more at 44.1. Classic keeps the cookbook, the way Equalizer
   * APO plays a band. Orthogonal to oversampling, which buys the same
   * distance from Nyquist by running the cascade faster, at twice the cost
   * and a filter's delay each way; matched costs nothing per sample.
   */
  treble: TTrebleDesign;
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
  /** Root bypass. Individual processor states remain untouched underneath. */
  enabled: boolean;
  /** Which whole-rack profile is loaded, or '' after any stage is edited. */
  presetId: string;
  normalizer: IInputNormalizerSettings;
  denoise: IDenoiseSettings;
  crossfade: ICrossfadeSettings;
  eq: IEqSettings;
  exciter: IExciterSettings;
  bassForge: IBassForgeSettings;
  bassPunch: IBassPunchSettings;
  dimension: IDimensionSettings;
  maximizer: IMaximizerSettings;
  master: IMasterSettings;
  room: IRoomSettings;
  surround: ISurroundSettings;
  /**
   * Game mode: the whole path gives up the delay it only carries for
   * comfort, so what is heard lands as close to what is seen as it can.
   *
   * One shared switch on EQ and DSP. Gaming presets turn it on; other
   * factory presets turn it off. Manual changes and the rack's power stay
   * independent of the selected sound, whose saved settings are kept. The
   * user's own choices (a linear-phase EQ, Bass Punch) are never rewritten:
   * the engine runs them without the standby delay while this is on, and
   * exactly as chosen when it is off, so there is nothing to put back.
   */
  gameMode: boolean;
}

/**
 * What the rack does with an output that has more than two channels.
 *
 * Windows hands the system-wide engine whatever the output is set to — 2.1,
 * quad, 5.1, 7.1 — and with this on the rack runs on every one of those
 * channels, with one level decision for all of them so the mix never pumps
 * out of balance. Off keeps the rack on the front pair and passes the rest
 * through it untouched, which is how every version before this behaved.
 * The Library player is stereo either way.
 */
/** A whole room each; `custom` once any dial or speaker has been moved. */
export type TRoomPreset =
  | 'studio'
  | 'livingRoom'
  | 'cinema'
  | 'frontStage'
  | 'nearField'
  | 'homeTheatre'
  | 'gaming'
  | 'concertHall'
  | 'jazzClub'
  | 'club'
  | 'openAir'
  | 'custom'
  | 'referenceV2'
  | 'musicSpaceV2'
  | 'cinemaV2'
  | 'gameWorldV2'
  | 'competitiveV2'
  | 'liveVenueV2'
  | 'closeUpV2'
  | 'wideStageV2'
  | 'allAroundV2'
  | 'balconyV2'
  | 'nightCinemaV2'
  | 'conductorV2'
  | 'rearGuardV2';

/**
 * In wire order: the engine logs the index, so an index keeps its meaning for
 * good. The eleven classic rooms and `custom` are the first twelve; the
 * featured rooms came after `custom` was already the twelfth, so they go
 * after it, and anything newer goes after them — never between.
 */
export const ROOM_PRESETS: readonly TRoomPreset[] = [
  'studio',
  'livingRoom',
  'cinema',
  'frontStage',
  'nearField',
  'homeTheatre',
  'gaming',
  'concertHall',
  'jazzClub',
  'club',
  'openAir',
  'custom',
  'referenceV2',
  'musicSpaceV2',
  'cinemaV2',
  'gameWorldV2',
  'competitiveV2',
  'liveVenueV2',
  'closeUpV2',
  'wideStageV2',
  'allAroundV2',
  'balconyV2',
  'nightCinemaV2',
  'conductorV2',
  'rearGuardV2',
];

/** The three shipped heads, by the head width each was measured on. */
export type TRoomHead = 'small' | 'medium' | 'large';

export const ROOM_HEADS: readonly TRoomHead[] = ['small', 'medium', 'large'];

/** FL, FR, C, SL, SR, RL, RR: the order of `angles` and `levels`. */
export const ROOM_SPEAKERS = 7;

/**
 * The Room: every channel of the output a speaker around the listener's
 * head, rendered on headphones through a measured head and the room's own
 * early reflections. Stereo is two speakers in front, 5.1 and 7.1 the ring,
 * decided by the stream, not by a setting here. The engine runs it on
 * system audio and the Library player on Library music.
 */
export interface IRoomSettings {
  /** Missing versions retain the original renderer and its sound. */
  rendererVersion: 1 | 2;
  /** -60 is exact off in renderer 2. */
  earlyReflectionDb: number;
  ambienceMix: number;
  ambienceDecayS: number;
  ambienceDampingHz: number;
  preservePosition: boolean;
  /**
   * The engine's comparison with the original, and its stepping aside for a
   * source marked as already spatial. Both had a control on the Room's page
   * and both came off it on 2026-09-19 (Ivan: each is the Room's own switch
   * by another name — "is same as off"). The engine still reads them and
   * the wire still carries them, so they stay in the shape of a room, and
   * `clampDspSettings` holds them off: a room saved with one on would
   * otherwise pass the sound through with nothing on the page to say why.
   */
  compareOriginal: boolean;
  sourceAlreadySpatial: boolean;
  enabled: boolean;
  presetId: TRoomPreset;
  /** The shoebox's side in metres, 2 to 12; the listener sits in the middle. */
  sizeM: number;
  /** 0 hard walls (full reflections) to 1 dead walls (none). */
  walls: number;
  /** Listener to every speaker, metres. */
  distanceM: number;
  centreDb: number;
  subDb: number;
  head: TRoomHead;
  /** Each speaker's azimuth, degrees clockwise from straight ahead. */
  angles: number[];
  levels: number[];
  /**
   * Everything under the crossover leaves the speakers for the sub's path,
   * as a receiver does it; the listener's, like the head, so no preset or
   * saved room touches it.
   */
  bassManagement: boolean;
  crossoverHz: number;
  /**
   * Stereo music fills the whole ring instead of standing on the front
   * pair; the amount scales the derived feeds. The listener's, like the
   * head and bass management.
   */
  musicUpmix: boolean;
  upmixAmount: number;
  /** Each speaker's own distance in metres; the Distance dial sets all seven. */
  distances: number[];
  /**
   * FL FR C SL SR RL RR then the sub: a muted one is silent. The room's, like
   * every speaker's level and distance: kept by a saved room, and put back by
   * a preset or Reset. A solo is not a second state beside these — it IS
   * these: the other six muted and its own speaker open (`roomSpeakers.ts`).
   */
  mutes: boolean[];
}

export interface ISurroundSettings {
  allChannels: boolean;
}

export interface IRange {
  min: number;
  max: number;
}
