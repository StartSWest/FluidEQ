/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  LIGHTING_GRID_HEIGHT,
  LIGHTING_GRID_WIDTH,
} from 'common/lighting/lightingModel';
import {
  DEFAULT_LIGHTING_PROFILE,
  type ILightingProfile,
} from 'common/lighting/lightingProfiles';
import { fillSwatchGrid } from 'common/lighting/swatchGrid';
import { clockDaylight, followDaylight } from 'common/sceneDaylight';
import { fixtureNoise } from 'common/soundHopsFixture';
import { SILENT_RHYTHM } from 'common/sceneRhythm';
import { SPECTRUM_TEXELS } from 'common/sceneUniformContract';
import { createLightingAtmosphere } from './lightingAtmosphere';
import type { IHeardFrame } from './lightingListener';

/**
 * What `native/scene-core/tests/lamp_atmosphere_parity_test.cpp` holds the
 * lamps' C++ host to, written by `generate-sound-hops-fixture.ts` into
 * `lamp_fixture.h`: the inputs and what this window's own code answers to
 * them, for the atmosphere (`lightingAtmosphere.ts`) under three idle
 * profiles, the clock's time of day, the eased time of day
 * (`followDaylight`), and the swatch grid a scene that cannot be drawn
 * lights the desk with.
 *
 * Every input is a function of its index — `fixtureNoise` for what varies —
 * so the two languages read the same numbers. The runs are chosen to reach
 * every branch: music and silence in runs long enough to settle, a gap the
 * ease factor clamps, a frame of no time, one long enough to wrap the
 * scene's hour, and a step back in time the follower holds at zero.
 */

const ATMOSPHERE_FRAMES = 240;
/** Each case's profile: hold, and the idle speed (`ILightingProfile`). */
const ATMOSPHERE_PROFILES: ILightingProfile[] = [
  { ...DEFAULT_LIGHTING_PROFILE, idle: 'flow', idleSpeed: 0.35 },
  { ...DEFAULT_LIGHTING_PROFILE, idle: 'flow', idleSpeed: 1 },
  { ...DEFAULT_LIGHTING_PROFILE, idle: 'hold', idleSpeed: 0.5 },
];

/** A double as C++ reads it back exactly: JavaScript's shortest round trip. */
const cDouble = (value: number) => {
  const text = String(value);
  return text.includes('.') || text.includes('e') ? text : `${text}.0`;
};

const unit = (n: number) => (fixtureNoise(n) + 1) / 2;

/** The frame heard at `index`: music in runs of forty, silence between. */
const heardAt = (index: number) => {
  let deltaMs = 33.333 + fixtureNoise(index * 3 + 11) * 2;
  if (index === 30) {
    // Twenty thousand seconds of music: past the scene's hour, whatever the
    // idle speed.
    deltaMs = 20_000_000;
  } else if (index % 97 === 50) {
    // A stall longer than any half-life the atmosphere eases by.
    deltaMs = 5000;
  } else if (index % 61 === 7) {
    deltaMs = 0;
  }
  return {
    deltaMs,
    silent: Math.floor(index / 40) % 2 === 1,
    level: unit(index * 7 + 1),
    beat: unit(index * 7 + 2),
    bands: [unit(index * 7 + 3), unit(index * 7 + 4), unit(index * 7 + 5)] as [
      number,
      number,
      number,
    ],
  };
};

/** The whole frame the listener hands on; only the moving parts vary. */
const sceneFrameOf = (
  heard: ReturnType<typeof heardAt>,
): IHeardFrame['frame'] => ({
  timeSeconds: 0,
  deltaMs: heard.deltaMs,
  level: heard.level,
  beat: heard.beat,
  bands: heard.bands,
  musicAccent: [0, 0],
  musicRun: [0, 0],
  rhythm: SILENT_RHYTHM,
  accent: [0, 0, 0],
  fade: 1,
  spectrum: new Uint8Array(SPECTRUM_TEXELS),
  waveform: new Uint8Array(1),
});

const atmosphereRows = (profile: ILightingProfile) => {
  const atmosphere = createLightingAtmosphere();
  const rows: string[] = [];
  for (let index = 0; index < ATMOSPHERE_FRAMES; index += 1) {
    const heard = heardAt(index);
    const frame = atmosphere(
      { frame: sceneFrameOf(heard), silent: heard.silent },
      profile,
    );
    rows.push(
      [
        frame.timeSeconds,
        frame.activity ?? 0,
        frame.level,
        frame.beat,
        frame.bands[0],
        frame.bands[1],
        frame.bands[2],
      ]
        .map(cDouble)
        .join(', '),
    );
  }
  return rows;
};

const heardRows = () =>
  Array.from({ length: ATMOSPHERE_FRAMES }, (_, index) => {
    const heard = heardAt(index);
    return [
      heard.deltaMs,
      heard.silent ? 1 : 0,
      heard.level,
      heard.beat,
      ...heard.bands,
    ]
      .map(cDouble)
      .join(', ');
  });

const clockRows = () =>
  Array.from({ length: 24 }, (_, hours) => hours).flatMap((hours) =>
    [0, 7, 29, 30, 45, 59].flatMap((minutes) =>
      [0, 31].map((seconds) => {
        // January: no clock change moves a local reading on the first.
        const date = new Date(2026, 0, 1, hours, minutes, seconds);
        return `${hours}, ${minutes}, ${seconds}, ${cDouble(clockDaylight(date))}`;
      }),
    ),
  );

/** Target, frame time, and where the follower draws it. */
const followerRows = () => {
  const steps: [number, number][] = [];
  for (let at = 0; at < 5; at += 1) {
    steps.push([0, 33]);
  }
  // Long enough to come within a hundredth of the target, where the follower
  // lands on it rather than easing on for ever.
  for (let at = 0; at < 130; at += 1) {
    steps.push([100, 33 + (at % 3)]);
  }
  // Within a hundredth of where it is: there.
  steps.push([100.005, 33]);
  for (let at = 0; at < 10; at += 1) {
    // A frame whose time went backwards moves nothing.
    steps.push([50, at === 4 ? -5 : 16]);
  }
  steps.push([50, 0]);
  for (let at = 0; at < 30; at += 1) {
    steps.push([unit(at) * 100, 250]);
  }
  let target = 0;
  const follower = followDaylight(() => target);
  return steps.map(([next, deltaMs]) => {
    target = next;
    return [next, deltaMs, follower.next(deltaMs)].map(cDouble).join(', ');
  });
};

interface ISwatchCase {
  colours: [number, number, number][];
  spectrum: (texel: number) => number;
  width: number;
  height: number;
}

const SWATCH_CASES: ISwatchCase[] = [
  {
    colours: [
      [255, 0, 0],
      [0, 255, 0],
      [0, 0, 255],
    ],
    spectrum: (texel) => Math.floor((texel / (SPECTRUM_TEXELS - 1)) * 255),
    width: LIGHTING_GRID_WIDTH,
    height: LIGHTING_GRID_HEIGHT,
  },
  {
    colours: [[12, 200, 99]],
    spectrum: (texel) => Math.floor(unit(texel + 900) * 256) % 256,
    width: LIGHTING_GRID_WIDTH,
    height: LIGHTING_GRID_HEIGHT,
  },
  {
    colours: [
      [255, 255, 255],
      [1, 2, 3],
      [128, 64, 32],
      [0, 229, 207],
      [77, 0, 177],
    ],
    spectrum: (texel) => (texel % 3 === 0 ? 0 : 255),
    width: LIGHTING_GRID_WIDTH,
    height: LIGHTING_GRID_HEIGHT,
  },
  {
    colours: [
      [10, 20, 30],
      [200, 100, 50],
    ],
    spectrum: (texel) => texel % 256,
    width: 1,
    height: 5,
  },
];

const swatchCase = (entry: ISwatchCase, index: number) => {
  const spectrum = Uint8Array.from({ length: SPECTRUM_TEXELS }, (_, texel) =>
    entry.spectrum(texel),
  );
  const grid = fillSwatchGrid(
    entry.colours,
    spectrum,
    entry.width,
    entry.height,
    new Uint8Array(entry.width * entry.height * 3),
  );
  const colours = entry.colours
    .map((colour) => `{${colour.join(', ')}}`)
    .join(', ');
  return [
    `inline constexpr int kSwatch${index}Width = ${entry.width};`,
    `inline constexpr int kSwatch${index}Height = ${entry.height};`,
    `inline constexpr std::array<std::uint8_t, 3> kSwatch${index}Colours[] = {${colours}};`,
    `inline constexpr std::uint8_t kSwatch${index}Spectrum[] = {${[...spectrum].join(', ')}};`,
    `inline constexpr std::uint8_t kSwatch${index}Grid[] = {${[...grid].join(', ')}};`,
  ].join('\n');
};

const table = (name: string, columns: number, rows: string[]) =>
  [
    `inline constexpr double ${name}[][${columns}] = {`,
    ...rows.map((row) => `    {${row}},`),
    '};',
  ].join('\n');

export const lampFixture = (): string =>
  [
    '// Written by .erb/scripts/generate-sound-hops-fixture.ts from',
    '// src/renderer/lighting/lampFixture.ts. Do not edit; regenerate.',
    '#pragma once',
    '',
    '#include <array>',
    '#include <cstdint>',
    '',
    'namespace feq::scene::fixture {',
    '',
    '// delta ms, silent, level, beat, bass, mid, treble.',
    table('kAtmosphereHeard', 7, heardRows()),
    '',
    '// Each profile: hold, idle speed.',
    `inline constexpr double kAtmosphereProfiles[][2] = {${ATMOSPHERE_PROFILES.map(
      (profile) =>
        `{${profile.idle === 'hold' ? '1.0' : '0.0'}, ${cDouble(profile.idleSpeed)}}`,
    ).join(', ')}};`,
    '',
    '// Per profile: time s, activity, level, beat, bass, mid, treble.',
    ...ATMOSPHERE_PROFILES.map((profile, index) =>
      table(`kAtmosphere${index}`, 7, atmosphereRows(profile)),
    ),
    '',
    '// hours, minutes, seconds, the time of day.',
    table('kClockDaylight', 4, clockRows()),
    '',
    '// target, delta ms, the time of day drawn.',
    table('kFollower', 3, followerRows()),
    '',
    ...SWATCH_CASES.map(swatchCase),
    '',
    '}  // namespace feq::scene::fixture',
    '',
  ].join('\n');
