/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import fftInPlace from './dsp/fft';
import type { IRhythmSpectrum } from './rhythmSpectrum';

/**
 * The sound, read every HOP_MS from its own samples, whatever the screen is
 * doing (`spectrumEnergy.ts`, `sceneRhythm.ts`).
 *
 * WHY NOT THE ANALYSER'S TRANSFORM, ONCE A FRAME. An `AnalyserNode` answers
 * with the spectrum of its last window, whenever it is asked, and a drawing
 * asks once a frame. At 33 frames a second its 21 ms window left 9 ms of
 * every frame unheard, and a hi-hat that fell in that gap was never seen:
 * measured on made-up songs whose every hit is known, hats were found half
 * as often at 33 frames a second as at 100. Every detector's timing moved
 * with the screen as well - a kick heard 26 ms late at 33 frames, 17 ms at
 * 100. So the samples themselves are read, every hop of them, and each hop
 * is transformed as the analyser would have transformed it: the same
 * Blackman window, the same scaling, the same decibels, so the drums'
 * features are measured on exactly what they were designed on.
 *
 * Two windows, as the drums and the tempo need them: the low end over about
 * 43 ms, where the bins have to be narrow enough to part a kick from a bass
 * note, and everything above over half that, short enough to keep a hat's
 * edge. Sized in time rather than samples - 2048 and 1024 at 44.1 and
 * 48 kHz, twice that at 88.2 and 96 - so a bin is 21 to 23 Hz wide at every
 * rate and the features mean the same on a 96 kHz DAC.
 *
 * Read in stereo: the mid, (left + right) / 2, is what an analyser hears and
 * what everything above is measured on; the side, (left - right) / 2, is
 * read in the long window too, up to 4 kHz, where a voice is. What is left
 * of the mid once the side is taken out is what stands in the middle of the
 * mix - a lead vocal, nearly always (`voiceReading.ts`).
 *
 * The hops are kept in a ring, and everything that listens takes the ones it
 * has not seen yet through a cursor of its own (`ISoundHops.take`), so all of them
 * are moved by the same moments of sound, and none by another's reading.
 */

/** How often the sound is read: a hundred times a second. */
export const HOP_MS = 10;
/** The long window, in seconds of sound: 2048 samples at 48 kHz. */
const LOW_WINDOW_S = 2_048 / 48_000;
/** How far up each window's bins are kept, in Hz, and the voice's. */
const LOW_TOP_HZ = 375;
const HIGH_TOP_HZ = 16_000;
const VOICE_TOP_HZ = 4_000;
/** The rhythm's bands: a third of an octave each from 40 Hz to 12 kHz. */
export const RHYTHM_BAND_COUNT = 24;
export const RHYTHM_BANDS_LOW_HZ = 40;
export const RHYTHM_BANDS_HIGH_HZ = 12_000;
/** The bands up to this one are read from the long window. */
const LOW_BANDS_END = 8;
/** Hops kept for listeners that read less often than others: 1.28 s. */
const RING_SIZE = 128;
/**
 * How far behind the newest sample a listener can fall between two reads
 * before time is lost: a quarter of a second, four frames at 16 a second.
 */
const SLACK_S = 0.25;
/**
 * Decibels at and below which nothing is heard: what a bin with nothing in
 * it is written as.
 */
export const NOTHING_DB = -100;

/** The long window's length in samples at `rate`: a power of two, for the transform. */
const lowSizeAt = (rate: number) =>
  2 ** Math.round(Math.log2(Math.max(256, rate * LOW_WINDOW_S)));

/**
 * The samples a reader has to hold for the hops: the long window and the
 * slack, as a power of two an `AnalyserNode` accepts as its size.
 */
export const soundHistorySamples = (rate: number) =>
  Math.min(32_768, 2 ** Math.ceil(Math.log2(lowSizeAt(rate) + rate * SLACK_S)));

/** Where band `band` of the rhythm's 24 starts, in Hz; `band + 1` is where it ends. */
export const rhythmBandEdgeHz = (band: number) =>
  RHYTHM_BANDS_LOW_HZ *
  (RHYTHM_BANDS_HIGH_HZ / RHYTHM_BANDS_LOW_HZ) ** (band / RHYTHM_BAND_COUNT);

/** The long window's mid and side, in dB, up to VOICE_TOP_HZ. */
export interface IVoiceSpectrum {
  mid: Float32Array;
  side: Float32Array;
  binHz: number;
}

export interface ISoundHop {
  /** Counts up by one a hop, within its ring. */
  seq: number;
  /** When the hop's last sample was played, on the audio clock, in ms. */
  atMs: number;
  /** How much time the hop stands for: HOP_MS, more after time was lost. */
  stepMs: number;
  /** The rhythm's 24 bands in absolute level, 0..1 over 100 dB. */
  bands: Float32Array;
  /** The two windows' bins in dB, for the drums (`rhythmSpectrum.ts`). */
  spectrum: IRhythmSpectrum;
  /** The mid and the side where a voice is (`voiceReading.ts`). */
  voice: IVoiceSpectrum;
}

/** Where one listener is in a ring: the last hop it took, and time it missed. */
export interface ISoundCursor {
  /** The ring it last read (`ISoundHops.id`), -1 before the first. */
  ring: number;
  seq: number;
  /**
   * Time it missed before the first of the hops it took last: a listener
   * that fell a whole ring behind loses what the ring no longer holds.
   */
  lostMs: number;
}

export const createSoundCursor = (): ISoundCursor => ({
  ring: -1,
  seq: -1,
  lostMs: 0,
});

export interface ISoundHops {
  /** Unique among the rings made in this page, so a cursor knows a new one. */
  readonly id: number;
  /**
   * Reads the samples that arrived since the last call: `left` and `right`
   * are each channel's latest soundHistorySamples, oldest first, the last one
   * played at `atMs` on the audio clock - the same array twice for a single
   * channel. Samples that arrived further back than the slack are lost, and
   * the next hop stands for their time as well as its own.
   */
  update(left: Float32Array, right: Float32Array, atMs: number): void;
  /**
   * The hops `cursor` has not taken, oldest first, and the cursor moved past
   * them. A cursor from another ring starts with this ring's newest hop.
   * The hops are the ring's own, overwritten as it goes round: read them
   * now, never keep them.
   */
  take(cursor: ISoundCursor): readonly ISoundHop[];
}

/** The analyser's own Blackman window (alpha 0.16) for `size` samples. */
const blackman = (size: number) => {
  const window = new Float64Array(size);
  for (let n = 0; n < size; n += 1) {
    window[n] =
      0.42 -
      0.5 * Math.cos((2 * Math.PI * n) / size) +
      0.08 * Math.cos((4 * Math.PI * n) / size);
  }
  return window;
};

interface ITransform {
  size: number;
  window: Float64Array;
  real: Float64Array;
  imaginary: Float64Array;
}

const transformOf = (size: number): ITransform => ({
  size,
  window: blackman(size),
  real: new Float64Array(size),
  imaginary: new Float64Array(size),
});

/**
 * The window ending at `end` of the mid - or, with `side`, of the side -
 * transformed, and bins 0 to `out.length - 1` written to `out` in dB as the
 * analyser writes them: the magnitude over the window's length.
 */
const transformInto = (
  transform: ITransform,
  left: Float32Array,
  right: Float32Array,
  end: number,
  out: Float32Array,
  side = false,
) => {
  const { size, window, real, imaginary } = transform;
  const from = end - size + 1;
  const sign = side ? -1 : 1;
  for (let n = 0; n < size; n += 1) {
    real[n] = 0.5 * (left[from + n] + sign * right[from + n]) * window[n];
    imaginary[n] = 0;
  }
  fftInPlace(real, imaginary, false);
  for (let bin = 0; bin < out.length; bin += 1) {
    const magnitude = Math.hypot(real[bin], imaginary[bin]) / size;
    out[bin] =
      magnitude > 0
        ? Math.max(NOTHING_DB, 20 * Math.log10(magnitude))
        : NOTHING_DB;
  }
};

/**
 * The bands from `from` to `to` from one window's dB bins, each the mean
 * power of its bins - a band too narrow for a bin of its own taking the
 * nearest - mapped 0..1 over 100 dB.
 */
const bandsInto = (
  out: Float32Array,
  bins: Float32Array,
  binHz: number,
  from: number,
  to: number,
) => {
  for (let band = from; band <= to; band += 1) {
    const low = rhythmBandEdgeHz(band);
    const high = rhythmBandEdgeHz(band + 1);
    let power = 0;
    let count = 0;
    for (
      let bin = Math.max(1, Math.ceil(low / binHz));
      bin * binHz < high && bin < bins.length;
      bin += 1
    ) {
      power += 10 ** (bins[bin] / 10);
      count += 1;
    }
    if (count === 0) {
      const nearest = Math.min(
        bins.length - 1,
        Math.max(1, Math.round(Math.sqrt(low * high) / binHz)),
      );
      power = 10 ** (bins[nearest] / 10);
      count = 1;
    }
    const db = 10 * Math.log10(power / count);
    out[band] = Math.max(0, Math.min(1, (db - NOTHING_DB) / -NOTHING_DB));
  }
};

let ringsMade = 0;

export const createSoundHops = (rate: number): ISoundHops => {
  ringsMade += 1;
  const id = ringsMade;
  const hopSamples = (rate * HOP_MS) / 1_000;
  const lowSize = lowSizeAt(rate);
  const low = transformOf(lowSize);
  const high = transformOf(lowSize / 2);
  const lowBinHz = rate / lowSize;
  const highBinHz = rate / (lowSize / 2);
  const lowCount = Math.floor(LOW_TOP_HZ / lowBinHz) + 1;
  const highCount = Math.min(
    lowSize / 4,
    Math.floor(Math.min(HIGH_TOP_HZ, rate / 2) / highBinHz) + 1,
  );
  const voiceCount = Math.min(
    lowSize / 2,
    Math.floor(Math.min(VOICE_TOP_HZ, rate / 2) / lowBinHz) + 1,
  );
  // The long window's bins up to the top of the last band it serves, and of
  // the voice's.
  const lowBandBins = new Float32Array(
    Math.max(
      lowCount,
      voiceCount,
      Math.ceil(rhythmBandEdgeHz(LOW_BANDS_END + 1) / lowBinHz) + 1,
    ),
  );
  const ring: ISoundHop[] = Array.from({ length: RING_SIZE }, () => ({
    seq: -1,
    atMs: 0,
    stepMs: HOP_MS,
    bands: new Float32Array(RHYTHM_BAND_COUNT),
    spectrum: {
      low: new Float32Array(lowCount),
      lowBinHz,
      high: new Float32Array(highCount),
      highBinHz,
    },
    voice: {
      mid: new Float32Array(voiceCount),
      side: new Float32Array(voiceCount),
      binHz: lowBinHz,
    },
  }));
  let lastSeq = -1;
  let lastAtMs: number | undefined;
  // Samples arrived and not yet read into a hop, and time lost with them.
  let pending = 0;
  let lostMs = 0;
  const taken: ISoundHop[] = [];

  return {
    id,
    update: (left, right, atMs) => {
      if (lastAtMs === undefined || atMs < lastAtMs) {
        // The first read, or a clock that went back (a new context): no
        // samples are known to be new yet.
        lastAtMs = atMs;
        pending = 0;
        return;
      }
      pending += ((atMs - lastAtMs) * rate) / 1_000;
      lastAtMs = atMs;
      const most = left.length - lowSize;
      if (pending > most) {
        lostMs += ((pending - most) * 1_000) / rate;
        pending = most;
      }
      while (pending >= hopSamples) {
        const end = Math.round(left.length - 1 - (pending - hopSamples));
        pending -= hopSamples;
        lastSeq += 1;
        const hop = ring[lastSeq % RING_SIZE];
        hop.seq = lastSeq;
        hop.atMs = atMs - ((left.length - 1 - end) * 1_000) / rate;
        hop.stepMs = HOP_MS + lostMs;
        lostMs = 0;
        transformInto(low, left, right, end, lowBandBins);
        hop.spectrum.low.set(lowBandBins.subarray(0, lowCount));
        hop.voice.mid.set(lowBandBins.subarray(0, voiceCount));
        bandsInto(hop.bands, lowBandBins, lowBinHz, 0, LOW_BANDS_END);
        transformInto(low, left, right, end, hop.voice.side, true);
        transformInto(high, left, right, end, hop.spectrum.high);
        bandsInto(
          hop.bands,
          hop.spectrum.high,
          highBinHz,
          LOW_BANDS_END + 1,
          RHYTHM_BAND_COUNT - 1,
        );
      }
    },
    take: (cursor) => {
      taken.length = 0;
      cursor.lostMs = 0;
      if (cursor.ring !== id) {
        cursor.ring = id;
        cursor.seq = Math.max(-1, lastSeq - 1);
      }
      const oldest = Math.max(0, lastSeq - RING_SIZE + 1);
      if (cursor.seq + 1 < oldest) {
        cursor.lostMs = (oldest - cursor.seq - 1) * HOP_MS;
        cursor.seq = oldest - 1;
      }
      for (let at = cursor.seq + 1; at <= lastSeq; at += 1) {
        taken.push(ring[at % RING_SIZE]);
      }
      cursor.seq = Math.max(cursor.seq, lastSeq);
      return taken;
    },
  };
};
