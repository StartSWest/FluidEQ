/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import fs from 'fs';
import path from 'path';

/**
 * The shipped heads are diffuse-field equalised: averaged over every
 * direction and both ears, a head's response is flat.
 *
 * KEMAR's raw measurement carries the dummy head's ear-canal resonance —
 * +9 dB at 2.5 kHz on that average, -7 dB at 100 Hz — and headphones deliver
 * to the listener's own ear canal, so the room sounded "mid-like" with the
 * resonance counted twice. `build-room-heads.ts` takes the average out; this
 * holds that it stays out, on each of the three heads, at third-octave
 * points between 125 Hz and 12.5 kHz.
 */

const HEADS_DIR = path.join(__dirname, '../../../../assets/room/heads');
const RATE = 44_100;
const THIRD_OCTAVES = [
  125, 160, 200, 250, 315, 400, 500, 630, 800, 1000, 1250, 1600, 2000, 2500,
  3150, 4000, 5000, 6300, 8000, 10000, 12500,
];
const TOLERANCE_DB = 2.5;

/** The 44.1 kHz block: 24 lines of left-then-right taps. */
const earsOf = (file: string): { taps: number; ears: number[][] } => {
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  const at = lines.findIndex((line) => line.startsWith(`rate ${RATE} `));
  const header = /^rate \d+ directions (\d+) taps (\d+)$/.exec(lines[at]);
  if (!header) {
    throw new Error(`${file}: no ${RATE} Hz block`);
  }
  const directions = Number(header[1]);
  const taps = Number(header[2]);
  const rows = lines
    .slice(at + 1, at + 1 + directions)
    .map((line) => line.trim().split(' ').map(Number));
  return {
    taps,
    ears: rows.flatMap((row) => [row.slice(0, taps), row.slice(taps)]),
  };
};

const magnitude = (taps: number[], hz: number): number => {
  let re = 0;
  let im = 0;
  taps.forEach((sample, n) => {
    const w = (2 * Math.PI * hz * n) / RATE;
    re += sample * Math.cos(w);
    im -= sample * Math.sin(w);
  });
  return Math.hypot(re, im);
};

/**
 * Average power over `ears` across the third-octave band around `hz`, in
 * dB: seven points from a sixth of an octave below to a sixth above. The
 * correction is smoothed the same way, so a single narrow notch that no
 * equalisation should invert into a peak does not count as a slope.
 */
const averageDb = (ears: number[][], hz: number): number => {
  const points = [-3, -2, -1, 0, 1, 2, 3].map((step) => hz * 2 ** (step / 18));
  const power = ears.reduce(
    (sum, taps) =>
      sum + points.reduce((band, at) => band + magnitude(taps, at) ** 2, 0),
    0,
  );
  return 10 * Math.log10(power / (ears.length * points.length));
};

describe.each(['small', 'medium', 'large'])('the %s head', (name) => {
  const file = path.join(HEADS_DIR, `${name}.txt`);

  it('is flat on average over every direction and both ears', () => {
    const { ears } = earsOf(file);
    expect(ears).toHaveLength(48);
    const reference = averageDb(ears, 1000);
    const worst = THIRD_OCTAVES.map((hz) => ({
      hz,
      dB: averageDb(ears, hz) - reference,
    })).reduce((a, b) => (Math.abs(a.dB) >= Math.abs(b.dB) ? a : b));
    expect(Math.abs(worst.dB)).toBeLessThanOrEqual(TOLERANCE_DB);
  });

  it('keeps the front pair its own: louder than the average where the pinna focuses', () => {
    // Positive control for the correction: only what every direction shares
    // is taken out, so a source at ±30° still carries its own colour.
    const { ears } = earsOf(file);
    const front = [ears[4], ears[5], ears[44], ears[45]];
    const lift = averageDb(front, 4000) - averageDb(ears, 4000);
    expect(lift).toBeGreaterThan(1);
  });
});
