/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The room under a voice, before the cleaner and after it: the Noise
 * cancelling picture's two floor lines and its "Room taken", and the same
 * number on the live strip and the rail, read once per frame where the
 * mic's readings arrive (`useMicLevels`).
 *
 * Read from the two spectra the picture draws (the cleaner tap and the
 * denoise tap, windowed and smoothed alike in the engine), sliced exactly as
 * the picture slices them (`createEqSpectrum`'s short window: 768 points, a
 * twelfth of an octave), as the mean level of the slices across the voice's
 * band, 150 Hz to 6 kHz — so a floor line lies where the room's own spectrum
 * lies on the plot. The room
 * is what is there in the quietest fifth of the last four seconds, judged by
 * the level before the cleaner: between words, where nothing but the room
 * reaches the mic. The cleaner's level is taken at those same moments, so
 * what was taken is one room measured twice, never the quietest gap after
 * cleaning against an ordinary one before it. The voice is the loudest tenth
 * after the cleaner, for "Voice over the room".
 */

import { ANALYSIS_BINS, IHostAnalysis } from '../../common/dsp/analysisWire';
import { EQ_SPECTRUM_POINTS } from '../dsp/dspEqSpectrum';
import {
  createGraphSliceReader,
  IGraphSliceReader,
} from '../graph/graphSlices';

const BAND_LOW_HZ = 150;
const BAND_HIGH_HZ = 6000;
const MEMORY_MS = 4000;
/** Less than this much heard and the floors are a guess, so none is said. */
const ENOUGH_MS = 1500;
const ROOM_SHARE = 0.2;
const VOICE_SHARE = 0.9;

export interface IRoomFloor {
  /** The room's level before the cleaner, dB on the plot's own scale. */
  beforeDb: number;
  /** The same moments after it. */
  afterDb: number;
  /** The voice's level after it, the loudest tenth. */
  voiceDb: number;
}

export interface IRoomFloorReader {
  add: (
    at: number,
    axis: readonly number[],
    before: Float64Array,
    after: Float64Array,
  ) => void;
  read: () => IRoomFloor | undefined;
  reset: () => void;
}

/** The mean power of the slices across the band, as dB. */
const bandLevel = (axis: readonly number[], levels: Float64Array): number => {
  let power = 0;
  let count = 0;
  for (let index = 0; index < axis.length; index += 1) {
    if (axis[index] >= BAND_LOW_HZ && axis[index] <= BAND_HIGH_HZ) {
      const level = levels[index];
      power += Number.isFinite(level) ? 10 ** (level / 10) : 0;
      count += 1;
    }
  }
  return count > 0 && power > 0 ? 10 * Math.log10(power / count) : -Infinity;
};

const powerMean = (levels: readonly number[]): number => {
  const power =
    levels.reduce((sum, level) => sum + 10 ** (level / 10), 0) / levels.length;
  return 10 * Math.log10(power);
};

export const createRoomFloor = (): IRoomFloorReader => {
  const heard: { at: number; before: number; after: number }[] = [];
  return {
    add: (at, axis, before, after) => {
      const levelBefore = bandLevel(axis, before);
      const levelAfter = bandLevel(axis, after);
      if (Number.isFinite(levelBefore) && Number.isFinite(levelAfter)) {
        heard.push({ at, before: levelBefore, after: levelAfter });
      }
      while (heard.length > 0 && at - heard[0].at > MEMORY_MS) {
        heard.shift();
      }
    },
    read: () => {
      if (
        heard.length < 2 ||
        heard[heard.length - 1].at - heard[0].at < ENOUGH_MS
      ) {
        return undefined;
      }
      const byBefore = [...heard].sort((a, b) => a.before - b.before);
      const room = byBefore.slice(
        0,
        Math.max(1, Math.round(byBefore.length * ROOM_SHARE)),
      );
      const after = heard.map((moment) => moment.after).sort((a, b) => a - b);
      return {
        beforeDb: powerMean(room.map((moment) => moment.before)),
        afterDb: powerMean(room.map((moment) => moment.after)),
        voiceDb:
          after[
            Math.min(after.length - 1, Math.floor(after.length * VOICE_SHARE))
          ],
      };
    },
    reset: () => {
      heard.length = 0;
    },
  };
};

/**
 * The room reading from the engine's frames, one call per frame. Each tap
 * publishes a window when its own is full, so the two can land in different
 * frames; the last of each is kept, and a moment is counted only once both
 * have been refreshed since the last one counted. A tap that stops (the
 * rack switched off, the Voice stage off, an engine before 1.32) therefore
 * stops the counting instead of pairing a stale "before" with a live
 * "after".
 */
export const createRoomReading = () => {
  const floor = createRoomFloor();
  let slices: IGraphSliceReader | undefined;
  let before: Float64Array | undefined;
  let after: Float64Array | undefined;
  let freshBefore = false;
  let freshAfter = false;
  return (
    frame: IHostAnalysis,
    sampleRate: number,
    at: number,
  ): IRoomFloor | undefined => {
    const { cleanerIn, denoise } = frame.spectra;
    if (cleanerIn || denoise) {
      if (!slices || slices.sampleRate !== sampleRate) {
        slices = createGraphSliceReader(
          sampleRate,
          ANALYSIS_BINS * 2,
          EQ_SPECTRUM_POINTS,
        );
      }
      // Copied: the reader hands back one array it writes again each read.
      if (cleanerIn) {
        before = Float64Array.from(slices.read(cleanerIn));
        freshBefore = true;
      }
      if (denoise) {
        after = Float64Array.from(slices.read(denoise));
        freshAfter = true;
      }
      if (before && after && freshBefore && freshAfter) {
        floor.add(at, slices.axis, before, after);
        freshBefore = false;
        freshAfter = false;
      }
    }
    return floor.read();
  };
};
