/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { RISE_LAG_MS } from './rhythmDrums';

/**
 * What each drum is doing, read from the two windows every hop of the sound
 * is transformed over (`soundHops.ts`), for `sceneRhythm.ts`: how far each
 * part of the spectrum rose over the last RISE_LAG_MS, in decibels, and
 * where the energy that is new landed.
 *
 * A drum is a noise burst or a thump across a whole region at once, where
 * the things that fool a drum detector - a bass note, a voice, a strummed
 * chord, a piano - lift their own harmonics. Measured on made-up songs whose
 * every hit is known, against every note that was not a hit:
 *
 * - a snare lifts both 1.1-4 kHz and 4-8 kHz; the lesser of the two outscored
 *   a true snare in 1-7 of every 100 kicks, hats, bass notes, voices, strums,
 *   pads and piano notes, where the detector this replaces was fooled by 17-36;
 * - a kick lifts 70-234 Hz as a whole: its mean rise was beaten by 1 bass
 *   note in 100 and no strum or voice, where the least-lifted third of the
 *   range, what was used before, lost to 27 bass notes and missed one kick in
 *   ten outright (a bass note held under it kept its lowest third up). The
 *   range starts at the 70 Hz bin, where the 47 Hz this was once written from
 *   rounds up to: counted from 47, the made-up songs' kicks were caught 57%
 *   of the time against 61%, a bass note or an 808 sitting in that bin. Nor
 *   does the kick ask the bottom, 40-80 Hz, to rise as well, though that
 *   kept a man's sung note - from about 100 Hz up - off the lamp (0.40 kicks
 *   a second on eighteen separated voices, 0.18 asked): a bass note held
 *   under a kick keeps that bottom lit, and rock's kicks were caught 65% of
 *   the time against every one, 56% of the made-up songs' under a real
 *   singer against 61. Told by the note each bin belongs to, as Bass is
 *   (`bassNotes.ts`), a kick's first moment was lost too: its pitch sweeps
 *   down from 150 Hz or so;
 * - a hat puts most of its new energy above 8 kHz, where a snare's is mostly
 *   lower, and piano notes put almost none.
 *
 * Every bin counts only down to FLOOR_BELOW_DB under the frame's loudest bin:
 * judged against its own corner of the spectrum, a region with nothing in it
 * rose "broadly" whenever anything at all sounded there.
 */

/** Frames kept for RISE_LAG_MS: a hop is 10 ms, and these reach back 120. */
const FRAMES_KEPT = 12;
/** A bin counts only this far under the frame's loudest. */
const FLOOR_BELOW_DB = 50;
/** And never below this, whatever the loudest is. */
const FLOOR_DB = -90;

/** The regions, in Hz, and which window each is read from. */
/** From the 70 Hz bin: the kick's rise measured from 47 Hz lost kicks (see above). */
const LOW_REGION: readonly [number, number] = [60, 234];
const CRACK_REGION: readonly [number, number] = [1_100, 4_000];
const PRESENCE_REGION: readonly [number, number] = [4_000, 8_000];
const AIR_REGION: readonly [number, number] = [8_000, 16_000];

/**
 * One frame of the two analysers: decibels per bin, the long window for the
 * low end and the short one for the rest, and how far apart their bins are.
 */
export interface IRhythmSpectrum {
  low: Float32Array;
  lowBinHz: number;
  high: Float32Array;
  highBinHz: number;
}

interface IKeptFrame {
  atMs: number;
  low: Float32Array;
  high: Float32Array;
}

export interface ISpectrumDrumState {
  frames: IKeptFrame[];
}

export const createSpectrumDrumState = (): ISpectrumDrumState => ({
  frames: [],
});

/** What each drum's detector listens to, in hundredths of a decibel's rise. */
export interface ISpectrumDrums {
  kick: number;
  snare: number;
  hat: number;
}

const floorOf = (db: number) =>
  Number.isFinite(db) ? Math.max(-100, db) : -100;

const binRange = (
  region: readonly [number, number],
  binHz: number,
  count: number,
) => [
  Math.max(1, Math.ceil(region[0] / binHz)),
  Math.min(count - 1, Math.floor(region[1] / binHz)),
];

interface IRegionRise {
  /** The mean rise of the region's bins, in dB. */
  rise: number;
  /** The energy that is new, as a power against the loudest bin's. */
  added: number;
}

const riseIn = (
  now: Float32Array,
  before: Float32Array,
  [from, to]: number[],
  floor: number,
  loudestPower: number,
): IRegionRise => {
  let rise = 0;
  let added = 0;
  for (let bin = from; bin <= to; bin += 1) {
    const is = Math.max(floor, floorOf(now[bin]));
    const was = Math.max(floor, floorOf(before[bin]));
    rise += Math.max(0, is - was);
    added += Math.max(0, 10 ** (is / 10) - 10 ** (was / 10));
  }
  const count = Math.max(1, to - from + 1);
  return { rise: rise / count, added: added / loudestPower };
};

/**
 * This frame's drum features. The frame is kept (copied: the analysers reuse
 * their arrays) to measure the next frames' rises against.
 */
export const readSpectrumDrums = (
  state: ISpectrumDrumState,
  atMs: number,
  spectrum: IRhythmSpectrum,
): ISpectrumDrums => {
  const { frames } = state;
  let base: IKeptFrame | undefined;
  for (let at = frames.length - 1; at >= 0; at -= 1) {
    if (atMs - frames[at].atMs >= RISE_LAG_MS) {
      base = frames[at];
      break;
    }
  }
  base ??= frames[0];
  frames.push({
    atMs,
    low: Float32Array.from(spectrum.low),
    high: Float32Array.from(spectrum.high),
  });
  if (frames.length > FRAMES_KEPT) {
    frames.shift();
  }
  if (
    !base ||
    base.low.length !== spectrum.low.length ||
    base.high.length !== spectrum.high.length
  ) {
    return { kick: 0, snare: 0, hat: 0 };
  }
  const lowBins = binRange(LOW_REGION, spectrum.lowBinHz, spectrum.low.length);
  const crackBins = binRange(
    CRACK_REGION,
    spectrum.highBinHz,
    spectrum.high.length,
  );
  const presenceBins = binRange(
    PRESENCE_REGION,
    spectrum.highBinHz,
    spectrum.high.length,
  );
  const airBins = binRange(
    AIR_REGION,
    spectrum.highBinHz,
    spectrum.high.length,
  );
  let loudest = -100;
  for (let bin = lowBins[0]; bin <= lowBins[1]; bin += 1) {
    loudest = Math.max(
      loudest,
      floorOf(spectrum.low[bin]),
      floorOf(base.low[bin]),
    );
  }
  for (
    let bin = Math.ceil(LOW_REGION[1] / spectrum.highBinHz);
    bin <= airBins[1];
    bin += 1
  ) {
    loudest = Math.max(
      loudest,
      floorOf(spectrum.high[bin]),
      floorOf(base.high[bin]),
    );
  }
  const floor = Math.max(FLOOR_DB, loudest - FLOOR_BELOW_DB);
  const loudestPower = 10 ** (loudest / 10);
  const low = riseIn(spectrum.low, base.low, lowBins, floor, loudestPower);
  const crack = riseIn(
    spectrum.high,
    base.high,
    crackBins,
    floor,
    loudestPower,
  );
  const presence = riseIn(
    spectrum.high,
    base.high,
    presenceBins,
    floor,
    loudestPower,
  );
  const air = riseIn(spectrum.high, base.high, airBins, floor, loudestPower);
  const airShare =
    air.added / Math.max(1e-9, crack.added + presence.added + air.added);
  return {
    kick: low.rise / 100,
    snare: Math.min(crack.rise, presence.rise) / 100,
    hat: (airShare * air.rise) / 100,
  };
};
