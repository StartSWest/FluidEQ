/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  HOP_MS,
  createSoundCursor,
  createSoundHops,
  soundHistorySamples,
  type ISoundHop,
} from './soundHops';
import { fixtureNoise, soundHopsFixtureSample } from './soundHopsFixture';
import { createEnergyState, hearSound } from './spectrumEnergy';

/**
 * The music as every drawing hears it — level, bands, pulse, accent, the
 * flywheel, the rhythm and the voice — read by `spectrumEnergy.ts` from a
 * made-up song with a shape (`sceneEnergyFixtureSample`), long enough for
 * the tempo to be found, a build heard and a drop to land, and written as the header
 * its C++ twin is held to (`native/scene-core/tests/scene_energy_fixture.h`,
 * `scene_energy_parity_test.cpp`). Every tenth hop is kept: the state
 * between them is the same state, and a header of every hop would be a
 * megabyte of the same numbers.
 */

export const SCENE_ENERGY_FIXTURE_RATE = 48_000;
export const SCENE_ENERGY_FIXTURE_SECONDS = 24;
const KEEP_EVERY = 10;

/**
 * Sample `n` of a song with a shape: a groove, a bar of break, six seconds of
 * noise rising over a held chord with no kick (a build), and the kick and the
 * bass back louder at 14 s (a drop), long enough after for the accent and
 * the bar to settle again. The noise is `fixtureNoise` differenced, sample
 * to sample: bright, so it climbs in the upper bands where a build is heard.
 */
export const sceneEnergyFixtureSample = (
  n: number,
  rate: number,
): [number, number] => {
  const t = n / rate;
  const [grooveLeft, grooveRight] = soundHopsFixtureSample(n, rate);
  if (t < 7.5) {
    return [grooveLeft, grooveRight];
  }
  if (t < 8) {
    return [0.3 * grooveLeft, 0.3 * grooveRight];
  }
  const chord =
    0.06 *
    (Math.sin(2 * Math.PI * 220 * t) + Math.sin(2 * Math.PI * 329.63 * t));
  if (t < 14) {
    const rise = 10 ** ((-36 + 6 * (t - 8)) / 20);
    const bright = rise * (fixtureNoise(n) - fixtureNoise(n - 1));
    // In the middle, where the bands are read: opposite on the two sides it
    // cancelled there, and the build was heard as silence.
    return [chord + bright, chord + 0.8 * bright];
  }
  // Off the half-second the song's blocks are counted on: a kick landing on
  // the boundary itself is 500 ms old when the block that hears the bass
  // come back is read, and a drop needs one within the last 500.
  // Kicks and no held bass note: a held note under them hides each kick's
  // rise, and the kick detector then hears none. Each has a softer second
  // kick 110 ms behind it, inside one kick's refractory time and outside a
  // shorter one; and at 18 s the whole grid jumps a third of a beat, so the
  // clock has to be steered back onto it.
  const jump = t >= 18 ? 0.17 : 0;
  const beat = (((t - 14.3 - jump) % 0.5) + 0.5) % 0.5;
  const kick =
    beat < 0.15 ? Math.sin(2 * Math.PI * 50 * t) * Math.exp(-beat * 20) : 0;
  const flam =
    beat >= 0.11 && beat < 0.21
      ? 0.6 * Math.sin(2 * Math.PI * 50 * t) * Math.exp(-(beat - 0.11) * 25)
      : 0;
  return [kick + flam + 1.2 * grooveLeft, kick + flam + 1.2 * grooveRight];
};

/** A double as C++ reads it back exactly: JavaScript's shortest round trip. */
const cDouble = (value: number) => {
  const text = String(value);
  return text.includes('.') || text.includes('e') ? text : `${text}.0`;
};

const readings = (): { firstAtMs: number; rows: string[] } => {
  const rate = SCENE_ENERGY_FIXTURE_RATE;
  const total = rate * SCENE_ENERGY_FIXTURE_SECONDS;
  const history = soundHistorySamples(rate);
  // The whole song once, with the silence an analyser holds before it.
  const songLeft = new Float32Array(history + total);
  const songRight = new Float32Array(history + total);
  for (let n = 0; n < total; n += 1) {
    const [l, r] = sceneEnergyFixtureSample(n, rate);
    songLeft[history + n] = l;
    songRight[history + n] = r;
  }
  const hops = createSoundHops(rate);
  const cursor = createSoundCursor();
  const energy = createEnergyState();
  const block = Math.round((rate * HOP_MS) / 1_000);
  const rows: string[] = [];
  const count = { firstAtMs: undefined as number | undefined, heard: 0 };
  const hear = (hop: ISoundHop) => {
    count.firstAtMs ??= hop.atMs;
    const reading = hearSound(energy, [hop], 0);
    count.heard += 1;
    if (count.heard % KEEP_EVERY !== 0) {
      return;
    }
    const { rhythm, voice } = reading;
    const values = [
      hop.atMs,
      reading.level,
      reading.bass,
      reading.mid,
      reading.treble,
      reading.beat,
      reading.accent,
      reading.accentSerial,
      reading.run,
      reading.runSpeed,
      rhythm.beatPhase,
      rhythm.barPhase,
      rhythm.tempo,
      rhythm.confidence,
      rhythm.kick,
      rhythm.snare,
      rhythm.hat,
      rhythm.intensity,
      rhythm.build,
      rhythm.drop,
      rhythm.dropSerial,
      rhythm.running ? 1 : 0,
      voice.open,
      voice.pitch,
      voice.sure,
    ];
    rows.push(`    {${values.map(cDouble).join(', ')}},`);
  };
  for (let end = block; end <= total; end += block) {
    hops.update(
      songLeft.subarray(end, end + history),
      songRight.subarray(end, end + history),
      ((end - 1) * 1_000) / rate,
    );
    hops.take(cursor).forEach(hear);
  }
  return { firstAtMs: count.firstAtMs ?? 0, rows };
};

/** The header, as `generate-sound-hops-fixture.ts` writes it. */
export const sceneEnergyFixture = (): string => {
  const { firstAtMs, rows } = readings();
  return [
    '// Written by .erb/scripts/generate-sound-hops-fixture.ts from',
    '// src/common/spectrumEnergy.ts. Do not edit; regenerate.',
    '#pragma once',
    '',
    'namespace feq::scene::fixture {',
    '',
    '// The song is read at this rate, for this long; the TypeScript hears its',
    '// first hop at kEnergyFirstAtMs.',
    `inline constexpr double kEnergyRate = ${SCENE_ENERGY_FIXTURE_RATE}.0;`,
    `inline constexpr double kEnergySeconds = ${SCENE_ENERGY_FIXTURE_SECONDS}.0;`,
    `inline constexpr double kEnergyFirstAtMs = ${cDouble(firstAtMs)};`,
    `inline constexpr int kEnergyKeepEvery = ${KEEP_EVERY};`,
    '',
    '// at_ms, level, bass, mid, treble, beat, accent, accent_serial, run,',
    '// run_speed, beat_phase, bar_phase, tempo, confidence, kick, snare, hat,',
    '// intensity, build, drop, drop_serial, running, voice open, pitch, sure.',
    'inline constexpr double kEnergy[][25] = {',
    ...rows,
    '};',
    '',
    '}  // namespace feq::scene::fixture',
    '',
  ].join('\n');
};
