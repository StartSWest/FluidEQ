/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { readFileSync } from 'fs';
import path from 'path';
import { lampFrameFixture } from 'renderer/lighting/lampFrameFixture';

/**
 * The lamps drawn without Electron are handed frames by `LampListener`,
 * held by `lamp_frame_parity_test.cpp` to the frames this window's own
 * frame maker (`lampFrames.ts`) makes from the same song
 * (`lamp_frame_fixture.h`). A change to how the window makes them, not
 * regenerated there, is a C++ test held to frames the window no longer
 * makes — so the header is held to the module byte for byte.
 */

let text = '';
beforeAll(() => {
  text = lampFrameFixture();
}, 60_000);

it('is what the window makes its lamps’ frames with now', () => {
  const header = readFileSync(
    path.resolve(process.cwd(), 'native/scene-core/tests/lamp_frame_fixture.h'),
    'utf8',
  );
  expect(header).toBe(text);
});

/**
 * The song has to reach every branch of the frame or the C++ is held to a
 * branch neither side took: music and true silence, the pause holding what
 * the frame last showed, and a level that moves.
 */
it('is made from a song that reaches every branch of a frame', () => {
  const start = text.indexOf('kLampFrames[][9]');
  const rows = [
    ...text
      .slice(start, text.indexOf('};', start))
      .matchAll(/^ {4}\{([^}]*)\}/gm),
  ].map((match) => match[1].split(', ').map(Number));
  const silent = rows.filter((row) => row[8] === 1);
  const heard = rows.filter((row) => row[8] === 0);
  expect(silent.length).toBeGreaterThan(20);
  expect(heard.length).toBeGreaterThan(200);
  // The pause, blocks 700 to 850: the level held, frame after frame.
  const paused = rows.slice(212, 252).map((row) => row[3]);
  expect(new Set(paused).size).toBe(1);
  // Elsewhere it moves.
  expect(new Set(heard.map((row) => row[3])).size).toBeGreaterThan(100);
});
