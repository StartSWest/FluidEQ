/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The room's shipped heads, from the MIT KEMAR measurements.
 *
 *   pnpm build:room-heads --kemar <folder holding elev0/>
 *
 * Reads the compact set (`elev0/H0e<azimuth>a.wav`: stereo 16-bit 44.1 kHz,
 * 128 taps, left ear then right, azimuth clockwise from straight ahead every
 * 5°), takes the 24 directions every 15°, and writes three heads under
 * `assets/room/heads/`: `medium.txt` is the head as measured; `small.txt`
 * and `large.txt` are the same responses played 6% shorter and 6% longer.
 * A head scaled in size scales every cue in time by the same factor — the
 * cross-head delay and the pinna's notches together (Middlebrooks 1999) —
 * so one measured head stands in for three sizes until a listener's own
 * measurement replaces it. Each head is written at 44.1, 48 and 96 kHz; the
 * engine picks the block for its stream and doubles 96 for 192.
 *
 * Every response is diffuse-field equalised (see below) and resampled
 * offline with a windowed sinc; the set is normalised so the loudest sample
 * across every direction and ear is -6 dBFS, which leaves the room's reflections and a full ring of speakers
 * headroom before the rack's safety limiter has to act.
 *
 * The data is copyright 1994 MIT Media Laboratory, free with no restrictions
 * provided the authors are cited (`assets/room/heads/LICENSES.md`).
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'fs';
import path from 'path';

const DIRECTIONS = 24;
const SOURCE_RATE = 44_100;
const RATES = [44_100, 48_000, 96_000];
const SIZES: { name: string; timeScale: number }[] = [
  { name: 'small', timeScale: 0.94 },
  { name: 'medium', timeScale: 1 },
  { name: 'large', timeScale: 1.06 },
];
const OUT_DIR = path.join(__dirname, '..', '..', 'assets', 'room', 'heads');
const PEAK = 0.5;
/**
 * A head is a filter, and a filter resampled as if it were a sound changes
 * its gain: `resample` keeps the height of the waveform, so a block with
 * twice the taps sums to twice as much. Every block is therefore levelled by
 * the inverse of its resampling ratio — the rate's AND the head size's, since
 * a head played 6% longer is 6% more taps too. The heads shipped without
 * this: the room measured 6 dB louder on a 96 kHz output than on a 48 kHz
 * one (12 dB at 192 kHz with the engine's doubling, which now halves), and
 * the large head played 1 dB louder than the small one inside Fit, where the
 * louder of two sounds is the one that gets picked.
 *
 * Anchored on the medium head at 48 kHz, whose block comes out as the same
 * numbers as before: that is where everyone had been listening, so the fix
 * changes nothing there.
 */
const ANCHOR_RATIO = 48_000 / SOURCE_RATE;

const fail = (message: string): never => {
  console.error(`build-room-heads: ${message}`);
  process.exit(1);
};

const kemarDir = (): string => {
  const at = process.argv.indexOf('--kemar');
  if (at < 0 || !process.argv[at + 1]) {
    return fail('pass --kemar <folder holding elev0/>');
  }
  const dir = process.argv[at + 1];
  if (!existsSync(path.join(dir, 'elev0'))) {
    return fail(`${dir} has no elev0/ folder`);
  }
  return dir;
};

/** A 16-bit PCM stereo wav's two channels, as floats in -1..1. */
const readStereoWav = (file: string): { left: number[]; right: number[] } => {
  const bytes = readFileSync(file);
  if (bytes.toString('ascii', 0, 4) !== 'RIFF') {
    return fail(`${file} is not a RIFF file`);
  }
  let at = 12;
  let channels = 0;
  let bits = 0;
  let data: Buffer | undefined;
  while (at + 8 <= bytes.length) {
    const id = bytes.toString('ascii', at, at + 4);
    const size = bytes.readUInt32LE(at + 4);
    const body = bytes.subarray(at + 8, at + 8 + size);
    if (id === 'fmt ') {
      channels = body.readUInt16LE(2);
      bits = body.readUInt16LE(14);
    } else if (id === 'data') {
      data = body;
    }
    at += 8 + size + (size % 2);
  }
  if (channels !== 2 || bits !== 16 || data === undefined) {
    return fail(`${file}: expected stereo 16-bit PCM`);
  }
  const frames = data.length / 4;
  const left: number[] = [];
  const right: number[] = [];
  for (let frame = 0; frame < frames; frame += 1) {
    left.push(data.readInt16LE(frame * 4) / 32_768);
    right.push(data.readInt16LE(frame * 4 + 2) / 32_768);
  }
  return { left, right };
};

/**
 * Windowed-sinc resampling to `ratio` output samples per input sample. The
 * cutoff follows the lower of the two rates, so a shortening (ratio below
 * one) removes what would alias rather than folding it back.
 */
const resample = (input: number[], ratio: number): number[] => {
  const half = 32;
  const cutoff = Math.min(1, ratio);
  const length = Math.ceil(input.length * ratio);
  const output: number[] = [];
  for (let n = 0; n < length; n += 1) {
    const centre = n / ratio;
    const from = Math.max(0, Math.floor(centre) - half);
    const to = Math.min(input.length - 1, Math.floor(centre) + half);
    let sum = 0;
    for (let k = from; k <= to; k += 1) {
      const x = centre - k;
      const sinc =
        x === 0 ? 1 : Math.sin(Math.PI * cutoff * x) / (Math.PI * cutoff * x);
      const window = 0.5 + 0.5 * Math.cos((Math.PI * x) / (half + 1));
      sum += input[k] * sinc * cutoff * window;
    }
    output.push(sum);
  }
  return output;
};

const tapsFor = (rate: number): number => (rate >= 96_000 ? 512 : 256);

/** In-place radix-2 complex FFT; `inverse` scales by 1/N. */
const fft = (re: number[], im: number[], inverse = false): void => {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i += 1) {
    let bit = n >> 1;
    while (j & bit) {
      j ^= bit;
      bit >>= 1;
    }
    j |= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let size = 2; size <= n; size <<= 1) {
    const step = ((inverse ? 2 : -2) * Math.PI) / size;
    for (let start = 0; start < n; start += size) {
      for (let k = 0; k < size / 2; k += 1) {
        const wr = Math.cos(step * k);
        const wi = Math.sin(step * k);
        const a = start + k;
        const b = a + size / 2;
        const tr = re[b] * wr - im[b] * wi;
        const ti = re[b] * wi + im[b] * wr;
        re[b] = re[a] - tr;
        im[b] = im[a] - ti;
        re[a] += tr;
        im[a] += ti;
      }
    }
  }
  if (inverse) {
    for (let i = 0; i < n; i += 1) {
      re[i] /= n;
      im[i] /= n;
    }
  }
};

/**
 * The diffuse-field equalisation: what a head measured at the ear canal
 * has in common with every direction, taken back out.
 *
 * KEMAR's compact responses are the raw measurement at the blocked ear
 * canal, so the ear's own resonance sits in every one of them: averaged over
 * the ring and both ears the set measured +7 dB at 2 kHz, +9 dB at 2.5 kHz,
 * +5 dB at 3-4 kHz, and -7 dB at 100 Hz where the measurement speaker ran
 * out. Headphones deliver to that same ear canal, whose resonance is then
 * counted twice — which is what "the room sounds mid-like" was, Ivan's
 * words on first listening. The correction is the inverse of the average
 * magnitude over all directions and ears, smoothed over a third of an
 * octave so no single notch is inverted into a peak, held flat below 80 Hz
 * and above 16 kHz where the measurement says nothing, limited to ±12 dB,
 * and applied as a minimum-phase filter so no cue in time moves. What each
 * direction has that the others do not — the cues — is untouched.
 */
const CORRECT_FROM_HZ = 80;
const CORRECT_TO_HZ = 16_000;
const CORRECT_LIMIT_DB = 12;

/** Power at `n` linear bins up to the Nyquist of `rate`, averaged over `set`. */
const averagePower = (
  set: number[][],
  rate: number,
  bins: number,
): number[] => {
  const size = bins * 2;
  const power = new Array<number>(bins).fill(0);
  set.forEach((taps) => {
    const re = fit(taps, size);
    const im = new Array<number>(size).fill(0);
    fft(re, im);
    for (let k = 0; k < bins; k += 1) {
      power[k] += (re[k] * re[k] + im[k] * im[k]) / set.length;
    }
  });
  return power;
};

/** The correction in dB against frequency, from the measured set. */
const diffuseFieldCorrection = (
  set: number[][],
  rate: number,
): ((hz: number) => number) => {
  const bins = 512;
  const power = averagePower(set, rate, bins);
  const hzOf = (bin: number) => (bin * rate) / (bins * 2);
  const levelDb = (bin: number) => 10 * Math.log10(Math.max(power[bin], 1e-20));
  // Third-octave smoothing in the log domain: the bins within ±1/6 octave.
  const smoothedDb = (hz: number): number => {
    const low = hz / 2 ** (1 / 6);
    const high = hz * 2 ** (1 / 6);
    let sum = 0;
    let count = 0;
    for (let bin = 1; bin < bins; bin += 1) {
      const at = hzOf(bin);
      if (at >= low && at <= high) {
        sum += levelDb(bin);
        count += 1;
      }
    }
    return count > 0 ? sum / count : levelDb(Math.round(hz / hzOf(1)));
  };
  const reference = smoothedDb(1000);
  return (hz: number) => {
    const clamped = Math.min(CORRECT_TO_HZ, Math.max(CORRECT_FROM_HZ, hz));
    const correction = reference - smoothedDb(clamped);
    return Math.max(-CORRECT_LIMIT_DB, Math.min(CORRECT_LIMIT_DB, correction));
  };
};

/**
 * A minimum-phase filter of `size` taps with the magnitude `gainDb(hz)`
 * at `rate`, by the real cepstrum: fold the cepstrum of the log magnitude
 * onto its causal half and exponentiate.
 */
const minimumPhaseFilter = (
  gainDb: (hz: number) => number,
  rate: number,
  size: number,
): number[] => {
  const n = size * 4;
  const logMag = new Array<number>(n).fill(0);
  const zeros = new Array<number>(n).fill(0);
  for (let k = 0; k <= n / 2; k += 1) {
    const value = (gainDb((k * rate) / n) * Math.LN10) / 20;
    logMag[k] = value;
    if (k > 0 && k < n / 2) {
      logMag[n - k] = value;
    }
  }
  const cepRe = [...logMag];
  const cepIm = [...zeros];
  fft(cepRe, cepIm, true);
  for (let i = 1; i < n / 2; i += 1) {
    cepRe[i] *= 2;
  }
  for (let i = n / 2 + 1; i < n; i += 1) {
    cepRe[i] = 0;
  }
  const specRe = [...cepRe];
  const specIm = new Array<number>(n).fill(0);
  fft(specRe, specIm);
  for (let k = 0; k < n; k += 1) {
    const magnitude = Math.exp(specRe[k]);
    specRe[k] = magnitude * Math.cos(specIm[k]);
    specIm[k] = magnitude * Math.sin(specIm[k]);
  }
  fft(specRe, specIm, true);
  return specRe.slice(0, size).map((sample, at) => {
    // A raised-cosine tail over the last quarter, so the cut is silent.
    const fade = size - at;
    const quarter = size / 4;
    return fade < quarter
      ? sample * 0.5 * (1 - Math.cos((Math.PI * fade) / quarter))
      : sample;
  });
};

/** `taps` convolved with `filter`, kept to `length` samples. */
const convolve = (
  taps: number[],
  filter: number[],
  length: number,
): number[] => {
  const out = new Array<number>(length).fill(0);
  for (let i = 0; i < taps.length; i += 1) {
    if (taps[i] === 0) {
      continue;
    }
    const to = Math.min(filter.length, length - i);
    for (let j = 0; j < to; j += 1) {
      out[i + j] += taps[i] * filter[j];
    }
  }
  return out;
};

const fit = (samples: number[], taps: number): number[] => {
  const out = samples.slice(0, taps);
  while (out.length < taps) {
    out.push(0);
  }
  return out;
};

const main = () => {
  const dir = kemarDir();
  const measured: { left: number[]; right: number[] }[] = [];
  for (let direction = 0; direction < DIRECTIONS; direction += 1) {
    // The compact set measures the right half of the circle (0° to 180°)
    // and states the left half as its mirror: a source at 345° is the
    // source at 15° with the ears swapped.
    const angle = direction * 15;
    const mirrored = angle > 180;
    const azimuth = String(mirrored ? 360 - angle : angle).padStart(3, '0');
    const file = path.join(dir, 'elev0', `H0e${azimuth}a.wav`);
    if (!existsSync(file)) {
      return fail(`${file} is missing`);
    }
    const { left, right } = readStereoWav(file);
    measured.push(mirrored ? { left: right, right: left } : { left, right });
  }
  // The correction is measured once, on the head as measured; a scaled head
  // is the same ear played faster or slower, so its resonance scales with
  // it and the correction is scaled the same way below.
  const correction = diffuseFieldCorrection(
    measured.flatMap(({ left, right }) => [left, right]),
    SOURCE_RATE,
  );
  mkdirSync(OUT_DIR, { recursive: true });
  const heads = SIZES.map(({ name, timeScale }) => ({
    name,
    blocks: RATES.map((rate) => {
      const ratio = (rate / SOURCE_RATE) * timeScale;
      const taps = tapsFor(rate);
      // Half the block for the correction: the response itself never
      // reaches the other half (147 taps at most before 96 kHz doubles it).
      const filter = minimumPhaseFilter(
        (hz) => correction(hz * timeScale),
        rate,
        taps / 2,
      );
      return {
        rate,
        taps,
        level: ANCHOR_RATIO / ratio,
        directions: measured.map(({ left, right }) => ({
          left: convolve(resample(left, ratio), filter, taps),
          right: convolve(resample(right, ratio), filter, taps),
        })),
      };
    }),
  }));
  // One gain for all three heads, taken where it always was: the medium
  // head's loudest sample before any block is levelled. With the anchor that
  // keeps the medium head's 48 kHz block the numbers it shipped as.
  const medium = heads.find((head) => head.name === 'medium');
  let peak = 0;
  medium?.blocks.forEach((block) =>
    block.directions.forEach(({ left, right }) =>
      [...left, ...right].forEach((sample) => {
        peak = Math.max(peak, Math.abs(sample));
      }),
    ),
  );
  const gain = peak > 0 ? PEAK / peak : 1;
  heads.forEach(({ name, blocks }) => {
    const lines = [`# FluidEQ room head v1 ${name}`];
    blocks.forEach((block) => {
      lines.push(
        `rate ${block.rate} directions ${DIRECTIONS} taps ${block.taps}`,
      );
      block.directions.forEach(({ left, right }) => {
        lines.push(
          [...left, ...right]
            .map((sample) => (sample * gain * block.level).toPrecision(6))
            .join(' '),
        );
      });
    });
    // Beside the file and renamed over it: main reads these while it runs,
    // and a head read half-written is a head of zeros.
    const out = path.join(OUT_DIR, `${name}.txt`);
    const partial = `${out}.partial`;
    writeFileSync(partial, `${lines.join('\n')}\n`);
    renameSync(partial, out);
    console.log(
      `${out}: ${DIRECTIONS} directions, peak ${peak.toFixed(3)} → ${PEAK}`,
    );
  });
};

main();
