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
 * Every response is resampled offline with a windowed sinc; the set is
 * normalised so the loudest sample across every direction and ear is -6
 * dBFS, which leaves the room's reflections and a full ring of speakers
 * headroom before the rack's safety limiter has to act.
 *
 * The data is copyright 1994 MIT Media Laboratory, free with no restrictions
 * provided the authors are cited (`assets/room/heads/LICENSES.md`).
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
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
  mkdirSync(OUT_DIR, { recursive: true });
  SIZES.forEach(({ name, timeScale }) => {
    // One gain for the whole head, across sizes and rates alike, so the
    // three heads sit at the same level and switching between them is a
    // change of head and not of volume.
    const blocks = RATES.map((rate) => {
      const ratio = (rate / SOURCE_RATE) * timeScale;
      const taps = tapsFor(rate);
      return {
        rate,
        taps,
        directions: measured.map(({ left, right }) => ({
          left: fit(resample(left, ratio), taps),
          right: fit(resample(right, ratio), taps),
        })),
      };
    });
    let peak = 0;
    blocks.forEach((block) =>
      block.directions.forEach(({ left, right }) =>
        [...left, ...right].forEach((sample) => {
          peak = Math.max(peak, Math.abs(sample));
        }),
      ),
    );
    const gain = peak > 0 ? PEAK / peak : 1;
    const lines = [`# FluidEQ room head v1 ${name}`];
    blocks.forEach((block) => {
      lines.push(
        `rate ${block.rate} directions ${DIRECTIONS} taps ${block.taps}`,
      );
      block.directions.forEach(({ left, right }) => {
        lines.push(
          [...left, ...right]
            .map((sample) => (sample * gain).toPrecision(6))
            .join(' '),
        );
      });
    });
    const out = path.join(OUT_DIR, `${name}.txt`);
    writeFileSync(out, `${lines.join('\n')}\n`);
    console.log(
      `${out}: ${DIRECTIONS} directions, peak ${peak.toFixed(3)} → ${PEAK}`,
    );
  });
};

main();
