/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  encodeAccent,
  encodeDaylight,
  encodePause,
  encodePreview,
  encodeProfile,
  encodeShow,
  SCENE_HOST_KIND,
  SCENE_HOST_MAGIC,
  type ISceneHostScene,
} from './sceneHostWire';

/**
 * The lamp host's messages as both ends must read and write them, written by
 * `generate-sound-hops-fixture.ts` into `native/scene-host/tests/
 * lamp_wire_fixture.h`: what main sends, encoded by `sceneHostWire.ts`, for
 * `lamp_messages_test.cpp` to read back; and what the host sends, laid out
 * here by hand from `scene_wire.h`'s comment, for the host's writers to
 * equal byte for byte and `sceneHostWire.test.ts` to read. A layout the two
 * sides disagree about does not fail loudly — it lights the desk with a
 * level read as a beat.
 */

export const FIXTURE_SCENE: ISceneHostScene = {
  guarded: true,
  response: { sensitivity: 1.5, threshold: 0.125, attack: 40, release: 320 },
  params: [
    { id: 'glow', value: 0.25, min: 0, max: 1 },
    { id: 'daylight', value: 0, min: 0, max: 100 },
  ],
  vertexSource: '#version 300 es\nvoid main() {}\n',
  fragmentSource: '#version 300 es\nprecision highp float;\n// é\n',
  view: [-0.5, 0, 2, 1],
  spectrumRect: [0.25, 0.75, 0, 0.5],
  artwork: { width: 4, height: 2, webp: Uint8Array.from([1, 2, 3, 4, 5]) },
};
export const FIXTURE_SWATCH: [number, number, number][] = [
  [255, 0, 16],
  [0, 229, 207],
];

export const FIXTURE_GRID = {
  level: 0.5,
  beat: 0.25,
  bass: 0.125,
  mid: 0.75,
  treble: 1,
  deltaMs: 33.375,
  timeSeconds: 1234.5,
  activity: 0.875,
  drawn: true,
};

/** The grid's colours: each cell its own index, so a shifted row shows. */
export const fixtureGridRgb = (): Uint8Array =>
  Uint8Array.from({ length: 48 * 27 * 3 }, (_, at) => at % 251);

/** The picture's: 2 by 1, red then blue. */
export const FIXTURE_PICTURE = Uint8Array.from([255, 0, 0, 0, 0, 255]);

export const FIXTURE_FAILED = { id: 7, reason: 2, words: 'ERROR: 0:3: é' };

/** A message as `scene_wire.h` lays one out, from its payload. */
const message = (kind: number, payload: Uint8Array): Uint8Array => {
  const out = new Uint8Array(12 + payload.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, SCENE_HOST_MAGIC, true);
  view.setUint32(4, kind, true);
  view.setUint32(8, payload.length, true);
  out.set(payload, 12);
  return out;
};

export const referenceGrid = (): Uint8Array => {
  const rgb = fixtureGridRgb();
  const payload = new Uint8Array(8 + 8 * 8 + 4 + rgb.length);
  const view = new DataView(payload.buffer);
  view.setUint32(0, 48, true);
  view.setUint32(4, 27, true);
  [
    FIXTURE_GRID.level,
    FIXTURE_GRID.beat,
    FIXTURE_GRID.bass,
    FIXTURE_GRID.mid,
    FIXTURE_GRID.treble,
    FIXTURE_GRID.deltaMs,
    FIXTURE_GRID.timeSeconds,
    FIXTURE_GRID.activity,
  ].forEach((value, at) => view.setFloat64(8 + at * 8, value, true));
  view.setUint32(72, FIXTURE_GRID.drawn ? 1 : 0, true);
  payload.set(rgb, 76);
  return message(SCENE_HOST_KIND.grid, payload);
};

export const referencePicture = (): Uint8Array => {
  const payload = new Uint8Array(8 + FIXTURE_PICTURE.length);
  const view = new DataView(payload.buffer);
  view.setUint32(0, 2, true);
  view.setUint32(4, 1, true);
  payload.set(FIXTURE_PICTURE, 8);
  return message(SCENE_HOST_KIND.picture, payload);
};

export const referenceLoaded = (): Uint8Array => {
  const payload = new Uint8Array(4);
  new DataView(payload.buffer).setUint32(0, 42, true);
  return message(SCENE_HOST_KIND.loaded, payload);
};

export const referenceFailed = (): Uint8Array => {
  const words = new TextEncoder().encode(FIXTURE_FAILED.words);
  const payload = new Uint8Array(12 + words.length);
  const view = new DataView(payload.buffer);
  view.setUint32(0, FIXTURE_FAILED.id, true);
  view.setUint32(4, FIXTURE_FAILED.reason, true);
  view.setUint32(8, words.length, true);
  payload.set(words, 12);
  return message(SCENE_HOST_KIND.failed, payload);
};

const bytes = (name: string, value: Uint8Array) =>
  `inline constexpr std::uint8_t ${name}[] = {${[...value].join(', ')}};`;

/**
 * A C string of `value`'s UTF-8 bytes: printable ASCII as itself, the rest
 * as three-digit octal, which no following digit can extend and no compiler
 * reads in another code page.
 */
const cText = (value: string) =>
  `"${[...new TextEncoder().encode(value)]
    .map((byte) =>
      byte >= 0x20 && byte < 0x7f && byte !== 0x22 && byte !== 0x5c
        ? String.fromCharCode(byte)
        : `\\${byte.toString(8).padStart(3, '0')}`,
    )
    .join('')}"`;

export const lampWireFixture = (): string =>
  [
    '// Written by .erb/scripts/generate-sound-hops-fixture.ts from',
    '// src/main/lighting/lampWireFixture.ts. Do not edit; regenerate.',
    '#pragma once',
    '',
    '#include <cstdint>',
    '',
    'namespace feq::scene::fixture {',
    '',
    '// Main to host, as sceneHostWire.ts encodes them.',
    bytes('kShowScene', encodeShow(9, FIXTURE_SWATCH, FIXTURE_SCENE)),
    bytes('kShowSwatch', encodeShow(10, FIXTURE_SWATCH)),
    bytes('kDaylightClock', encodeDaylight({ clock: true })),
    bytes('kDaylightFixed', encodeDaylight({ clock: false, value: 62.5 })),
    bytes('kPauseOn', encodePause(true)),
    bytes('kProfileHold', encodeProfile(true, 0.5)),
    bytes('kAccent', encodeAccent([0.25, 0.5, 1])),
    bytes('kPreviewOn', encodePreview(true)),
    `inline constexpr const char* kShowVertex = ${cText(FIXTURE_SCENE.vertexSource)};`,
    `inline constexpr const char* kShowFragment = ${cText(FIXTURE_SCENE.fragmentSource)};`,
    '',
    '// Host to main, laid out from scene_wire.h.',
    bytes('kGrid', referenceGrid()),
    bytes('kPicture', referencePicture()),
    bytes('kLoaded', referenceLoaded()),
    bytes('kFailed', referenceFailed()),
    `inline constexpr const char* kFailedWords = ${cText(FIXTURE_FAILED.words)};`,
    '',
    '}  // namespace feq::scene::fixture',
    '',
  ].join('\n');
