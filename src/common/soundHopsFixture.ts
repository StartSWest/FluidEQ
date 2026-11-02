/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  HOP_MS,
  RHYTHM_BAND_COUNT,
  createSoundCursor,
  createSoundHops,
  soundHistorySamples,
} from './soundHops';

/**
 * The hops `soundHops.ts` reads from a made-up song, written as the header
 * its C++ twin is held to (`native/scene-core/tests/sound_hops_fixture.h`,
 * `sound_hops_parity_test.cpp`). The song is built from numbers alone — a
 * kick, a hat, a held chord and a voice that wavers, panned apart — and the
 * C++ test builds the same samples by the same formula, so the header holds
 * the TypeScript's reading and nothing else.
 *
 * The hat's noise is an integer hash of the sample's index (`fixtureNoise`),
 * never a random number and never the sign of a sine: a sine near zero
 * rounds differently in two maths libraries, and the sign of it would flip a
 * whole hat.
 *
 * The TypeScript is fed the way the window's analysers feed it: each channel's
 * latest soundHistorySamples every 10 ms of audio, at the last sample's time.
 */

export const SOUND_HOPS_FIXTURE_RATES = [44_100, 48_000] as const;
export const SOUND_HOPS_FIXTURE_SECONDS = 1.5;

/* eslint-disable no-bitwise -- the hash is the point: exact in both languages */
/**
 * White noise, -1 to 1, from sample `n` alone: a 32-bit integer hash of the
 * index, the same bits in JavaScript and in C++. A golden-ratio multiply's
 * top bit, used first, was no noise at all — a square wave whose sound sat
 * at 18 kHz, above every band the drums and a build are heard in.
 */
export const fixtureNoise = (n: number): number => {
  let x = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  x = (x ^ (x >>> 16)) >>> 0;
  return (x / 4_294_967_296) * 2 - 1;
};
/* eslint-enable no-bitwise */

/** Sample `n` of the made-up song at `rate`, left and right. */
export const soundHopsFixtureSample = (
  n: number,
  rate: number,
): [number, number] => {
  const t = n / rate;
  const beat = t % 0.5;
  const kick =
    beat < 0.12 ? Math.sin(2 * Math.PI * 55 * t) * Math.exp(-beat * 30) : 0;
  const hatAt = (t + 0.25) % 0.5;
  const hat = hatAt < 0.03 ? 0.2 * fixtureNoise(n) * Math.exp(-hatAt * 120) : 0;
  const chord =
    0.08 *
    (Math.sin(2 * Math.PI * 220 * t) +
      Math.sin(2 * Math.PI * 277.18 * t) +
      Math.sin(2 * Math.PI * 329.63 * t));
  const voice =
    0.15 * Math.sin(2 * Math.PI * 330 * t + 6 * Math.sin(2 * Math.PI * 5 * t));
  return [
    0.6 * kick + hat + chord + voice,
    0.6 * kick - 0.5 * hat + 0.7 * chord + voice,
  ];
};

/** A float as C++ reads it back exactly: shortest round trip, `F` suffix. */
const cFloat = (value: number) => {
  const text = String(Math.fround(value));
  return `${text.includes('.') || text.includes('e') ? text : `${text}.0`}F`;
};

const hopRows = (rate: number): string[] => {
  const total = Math.round(rate * SOUND_HOPS_FIXTURE_SECONDS);
  const history = soundHistorySamples(rate);
  // The whole song once, with the silence an analyser holds before it; each
  // read is the history that ends where the song has got to.
  const songLeft = new Float32Array(history + total);
  const songRight = new Float32Array(history + total);
  for (let n = 0; n < total; n += 1) {
    const [l, r] = soundHopsFixtureSample(n, rate);
    songLeft[history + n] = l;
    songRight[history + n] = r;
  }
  const hops = createSoundHops(rate);
  const cursor = createSoundCursor();
  const block = Math.round((rate * HOP_MS) / 1_000);
  const rows: string[] = [];
  for (let end = block; end <= total; end += block) {
    hops.update(
      songLeft.subarray(end, end + history),
      songRight.subarray(end, end + history),
      ((end - 1) * 1_000) / rate,
    );
    hops.take(cursor).forEach((hop) => {
      // Every bin of the drums' two windows and the voice's mid and side,
      // summed: one wrong bin anywhere moves its sum.
      const sums = [
        hop.spectrum.low,
        hop.spectrum.high,
        hop.voice.mid,
        hop.voice.side,
      ].map((bins) => bins.reduce((total, db) => total + db, 0).toFixed(6));
      rows.push(
        `    {${hop.atMs.toFixed(6)}, {${Array.from(hop.bands, cFloat).join(', ')}}, {${sums.join(', ')}}},`,
      );
    });
  }
  return rows;
};

/** The header, as `generate-sound-hops-fixture.ts` writes it. */
export const soundHopsFixture = (): string =>
  [
    '// Written by .erb/scripts/generate-sound-hops-fixture.ts from',
    '// src/common/soundHops.ts. Do not edit; regenerate.',
    '#pragma once',
    '',
    'namespace feq::scene::fixture {',
    '',
    'struct HopRow {',
    '  double at_ms;',
    `  float bands[${RHYTHM_BAND_COUNT}];`,
    '  // The dB of every bin summed: low, high, voice mid, voice side.',
    '  double sums[4];',
    '};',
    '',
    `inline constexpr double kSeconds = ${SOUND_HOPS_FIXTURE_SECONDS};`,
    '',
    ...SOUND_HOPS_FIXTURE_RATES.flatMap((rate) => [
      `inline constexpr HopRow kHops${rate}[] = {`,
      ...hopRows(rate),
      '};',
      '',
    ]),
    '}  // namespace feq::scene::fixture',
    '',
  ].join('\n');
