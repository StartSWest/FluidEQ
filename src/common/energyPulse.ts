/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IRhythmState, ISceneRhythm } from './sceneRhythm';
import { getEaseFactor } from './smoothing';

/**
 * The pulse and the accent a scene is handed (`spectrumEnergy.ts`): a flash
 * on every beat, and the rare big moment.
 *
 * Once the rhythm's clock is sure of the beat (`rhythmClock.ts`), the pulse
 * is the clock's: a flash as each of its beats begins, which it places on
 * the sound. Until then it is a kick or a snare as the rhythm shows them
 * (`rhythmKit.ts`) - the same moment their lamps light - or, in music
 * without drums, an onset standing clear of its own recent history; never
 * two within two thirds of a beat, and, once the clock is a little sure,
 * only near one of its beats: a pulse let through on any drum locked onto
 * whichever came first after the spacing, and on a dembow - a kick on every
 * beat, snares three sixteenths after it - that was every snare and not one
 * kick.
 *
 * WHY THE CLOCK LEADS. Made of the drums shown, the pulse was only as good
 * as the detectors: in the Studio on a song at 148 (Ivan, 2026-09-24: "now
 * fix hit"), with the clock sure of it at 0.93 and stepping every 384 to
 * 424 ms, the pulse missed 5 of 20 beats in eight seconds - three in a row -
 * and the ones it gave landed from 62 ms before the clock's beat to 43 ms
 * after it, wherever each hit happened to be heard. Over eighteen songs it
 * fell on 54% of the beats the clock was sure of, with 45% of its gaps one
 * beat long. Led by the clock it falls on all of them, 94% of its gaps one
 * beat; and on made-up songs whose every beat is known, on the beat - the
 * median 0 ms, where the drums' pulse came 12 ms late.
 *
 * THE ACCENT is an onset that dwarfs every one of the last few seconds. It
 * was an onset standing four and a half spreads over their running mean,
 * which the analyser's frames once made a fair test; heard hop by hop, the
 * onsets are spikes over nearly nothing, every kick stood that far over, and
 * with the level read against the song's own loudest every kick was loud
 * enough too. Only the gap between two was left to decide: over eighteen
 * songs an accent landed every 7.3 to 7.6 s on every one of them, Imagine
 * included - 7.8 a minute. Against the tallest onset lately, 1.1 a minute,
 * drops included, from 0.3 to 2.3 a song.
 */

export interface IPulseState {
  /** Milliseconds of flash remaining; negative when there is none. */
  flashLeftMs: number;
  /** What the broad onsets have been running at lately, and how much they vary. */
  fluxMean: number;
  fluxVariation: number;
  /** Since the last pulse, and the gaps the pulse has been keeping. */
  sinceBeatMs: number;
  beatGapMs: number;
  /** The clock's count of beats at the last step: a new one is a pulse. */
  clockBeats: number;
  /** Whether the pulse is the clock's (WHY THE CLOCK LEADS). */
  clockLeads: boolean;
  /** The accent: its envelope, how long since the last, and its count. */
  accent: number;
  sinceAccentMs: number;
  accentSerial: number;
  /** The tallest onset lately, falling away (THE ACCENT). */
  tallOnset: number;
  /** The last drop the rhythm counted: each one is an accent, once. */
  dropSerial: number;
}

export const BEAT_FLASH_MS = 200;
/** No two pulses closer than this: 240 a minute is past any dance floor. */
export const BEAT_REFRACTORY_MS = 250;
/**
 * No pulse within this share of a beat of the last: the snare's place when it
 * lands between two kicks, an eighth, a strum. A pulse on every beat.
 */
const BEAT_SPACING = 0.66;
/**
 * How sure the rhythm's clock has to be before its beat places the pulse,
 * and, once its beat has become the pulse, how unsure before it stops being.
 */
const BEAT_CLOCK_SURE = 0.3;
/**
 * How sure it has to be before its beat becomes the pulse, whatever the drums
 * were heard to do. Kept until it falls under BEAT_CLOCK_SURE: a song's
 * certainty sagged to 0.42 through seven seconds of a quieter part while the
 * clock went on stepping every beat, and the pulse, handed back to the drums
 * the moment it passed under this, went dark for fourteen beats.
 */
const BEAT_CLOCK_LEADS = 0.5;
/**
 * How near the clock's beat a pulse has to fall once the clock is sure, as a
 * share of a beat: a hit is heard 10 to 25 ms after it is played, and the
 * clock itself can be a little early or late.
 */
const ON_BEAT = 0.2;
/**
 * A kick or a snare shown this recently means the music has drums, and the
 * pulse is theirs alone; without, an onset of any kind is one.
 */
const DRUMS_LATELY_MS = 2_500;
/** How far above its recent run an onset has to stand to be a pulse, with no drums. */
export const BEAT_FLUX_MARGIN = 1.6;
/**
 * What the onsets are taken to have been running at before anything is
 * heard. Set to nothing, the first moments of any rise stood above a
 * threshold of nothing and counted as onsets - a fade-in fired ten of them.
 * Starting the memory above what music reaches lets it fall to the real
 * level within a second while nothing can beat it on the way.
 */
export const FLUX_MEMORY_START = 0.03;
export const FLUX_SPREAD_START = 0.015;
/** Below this, nothing is an onset whatever the memory says: this is silence. */
export const MIN_ONSET_FLUX = 0.002;
/**
 * A moment has to be this many times the tallest onset lately to be an
 * accent, and "lately" halves every ACCENT_TALL_HALF_LIFE_MS. Over the same
 * eighteen songs, 1.5 times over four seconds let 3.1 a minute through -
 * Imagine 3.8 - and 2.5 times over two, 0.8, most of them drops.
 */
export const ACCENT_DWARFS = 2;
const ACCENT_TALL_HALF_LIFE_MS = 3_000;
/**
 * The tallest onset taken to have been heard before anything is: above what
 * a fade-in's first rises reach, so a song easing in is no moment, and under
 * what a song starting on a hit is.
 */
const ACCENT_TALL_START = 0.1;
export const ACCENT_GAP_MS = 7_000;
/** And the music has to be somewhere near its own loudest, not merely busy. */
export const ACCENT_LEVEL = 0.55;
export const ACCENT_FALL_MS = 1_500;
/**
 * How long the moment takes to arrive. Measured against the brightness
 * limiter every member's scene is drawn through: a scene may move the average
 * brightness of a quarter of the frame by half of full scale per second, and
 * a moment that fills a third of a cell with light has to take at least a
 * fifth of a second to do it or the limiter blends the picture into the last
 * one and the scene smears. At 90 ms, Crystal's band of light across the
 * floor measured seven times over that limit and only a seventh of each new
 * frame reached the panel.
 */
export const ACCENT_RISE_MS = 300;

export const createPulseState = (): IPulseState => ({
  flashLeftMs: -1,
  fluxMean: FLUX_MEMORY_START,
  fluxVariation: FLUX_SPREAD_START,
  sinceBeatMs: BEAT_REFRACTORY_MS,
  beatGapMs: 500,
  clockBeats: 0,
  clockLeads: false,
  accent: 0,
  sinceAccentMs: ACCENT_GAP_MS,
  accentSerial: 0,
  tallOnset: ACCENT_TALL_START,
  dropSerial: 0,
});

/** The pulse's flash: 1 at the beat, 0 once it is over. */
export const pulseOf = (state: IPulseState) =>
  state.flashLeftMs > 0 ? state.flashLeftMs / BEAT_FLASH_MS : 0;

/**
 * One step of the pulse and the accent, after the rhythm's step: `rhythm` is
 * its state, `heard` its reading, `level` the music's overall level now.
 */
export const followPulse = (
  state: IPulseState,
  rhythm: IRhythmState,
  heard: ISceneRhythm,
  level: number,
  stepMs: number,
) => {
  const { broad, kick, snare, drumsSinceMs } = rhythm.step;
  const memory = getEaseFactor(stepMs, 700);
  const excess = Math.abs(broad - state.fluxMean);
  state.fluxMean += (broad - state.fluxMean) * memory;
  state.fluxVariation += (excess - state.fluxVariation) * memory;
  const standsOut = (margin: number) =>
    broad > state.fluxMean + margin * state.fluxVariation &&
    broad > MIN_ONSET_FLUX;

  state.sinceBeatMs += stepMs;
  state.sinceAccentMs += stepMs;
  const onset =
    drumsSinceMs < DRUMS_LATELY_MS
      ? kick || snare
      : standsOut(BEAT_FLUX_MARGIN);
  const clockSure = rhythm.tempo > 0 && rhythm.confidence >= BEAT_CLOCK_SURE;
  const period = clockSure ? 60_000 / rhythm.tempo : state.beatGapMs;
  const spaced =
    state.sinceBeatMs >= Math.max(BEAT_REFRACTORY_MS, BEAT_SPACING * period);
  // A beat the clock began this step. Counted back a beat when it is steered
  // back across one, and never twice inside the spacing when it crosses again.
  const newBeat = rhythm.beats > state.clockBeats;
  state.clockBeats = rhythm.beats;
  if (!heard.running || !clockSure) {
    state.clockLeads = false;
  } else if (rhythm.confidence >= BEAT_CLOCK_LEADS) {
    state.clockLeads = true;
  }
  let pulse: boolean;
  if (state.clockLeads) {
    pulse = newBeat && spaced;
  } else {
    const nearBeat =
      !clockSure ||
      Math.abs(rhythm.phase - Math.round(rhythm.phase)) <= ON_BEAT;
    pulse = onset && nearBeat && spaced;
  }
  if (pulse) {
    state.beatGapMs += (state.sinceBeatMs - state.beatGapMs) * 0.25;
    state.beatGapMs = Math.max(250, Math.min(1_500, state.beatGapMs));
    state.sinceBeatMs = 0;
    state.flashLeftMs = BEAT_FLASH_MS;
  } else {
    state.flashLeftMs -= stepMs;
  }

  // An accent is an onset that dwarfs the ones around it, near the song's
  // loudest, and they are kept apart so a scene can lean on one: a chorus
  // arriving, not every crash. A drop is always one, as soon as the last
  // has faded: it is the biggest moment a song has.
  const dwarfs =
    broad > MIN_ONSET_FLUX && broad > ACCENT_DWARFS * state.tallOnset;
  state.tallOnset = Math.max(
    broad,
    state.tallOnset * 2 ** (-stepMs / ACCENT_TALL_HALF_LIFE_MS),
  );
  const dropped = heard.dropSerial !== state.dropSerial;
  state.dropSerial = heard.dropSerial;
  if (
    (dropped && state.sinceAccentMs >= ACCENT_FALL_MS) ||
    (dwarfs && level >= ACCENT_LEVEL && state.sinceAccentMs >= ACCENT_GAP_MS)
  ) {
    state.sinceAccentMs = 0;
    state.accentSerial = (state.accentSerial + 1) % 4096;
  }
  // Its envelope rises over a few frames rather than in one, because a scene
  // is free to put it in an angle, and a number that goes from nothing to one
  // between two frames moves a stone as fast as the frames are short.
  const wanted = state.sinceAccentMs < ACCENT_FALL_MS ? 1 : 0;
  const shape = getEaseFactor(
    stepMs,
    wanted > state.accent ? ACCENT_RISE_MS : ACCENT_FALL_MS / 3,
  );
  state.accent += (wanted - state.accent) * shape;
  if (state.accent < 0.002) {
    state.accent = 0;
  }
};
