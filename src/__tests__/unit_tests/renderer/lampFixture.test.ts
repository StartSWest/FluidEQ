/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { readFileSync } from 'fs';
import path from 'path';
import { lampFixture } from 'renderer/lighting/lampFixture';

/**
 * The lamps drawn without Electron rest, follow the time of day and fall
 * back to the scene's colours through C++ twins of `lightingAtmosphere.ts`,
 * `followDaylight`, `clockDaylight` and `swatchGrid.ts`, held by
 * `lamp_atmosphere_parity_test.cpp` to `lamp_fixture.h`. A change to any of
 * those, not regenerated there, is a C++ test held to a desk the window no
 * longer lights — so this holds the header to the modules byte for byte.
 */
it('is what the window lights the desk with now', () => {
  const header = readFileSync(
    path.resolve(process.cwd(), 'native/scene-core/tests/lamp_fixture.h'),
    'utf8',
  );
  expect(header).toBe(lampFixture());
});

const rowsOf = (text: string, name: string) => {
  const start = text.indexOf(`${name}[][`);
  const body = text.slice(start, text.indexOf('};', start));
  return [...body.matchAll(/^ {4}\{([^}]*)\}/gm)].map((match) =>
    match[1].split(', ').map(Number),
  );
};

/**
 * The inputs have to drive every branch, or the C++ is held to a branch
 * neither side took: the desk settling into silence and back into music,
 * the scene's hour wrapping, a held profile standing still, and a swatch
 * lit and glowing.
 */
it('drives every branch the lamps can take', () => {
  const text = lampFixture();
  const flowing = rowsOf(text, 'kAtmosphere0');
  const activities = flowing.map((row) => row[1]);
  expect(Math.min(...activities.slice(60))).toBeLessThan(0.05);
  expect(Math.max(...activities)).toBeGreaterThan(0.95);
  // The frames heard add up to far more than the scene's hour, and its clock
  // never reads past it: the hour wrapped.
  const heardMs = rowsOf(text, 'kAtmosphereHeard').reduce(
    (sum, row) => sum + row[0],
    0,
  );
  expect(heardMs / 1000).toBeGreaterThan(3600);
  expect(Math.max(...flowing.map((row) => row[0]))).toBeLessThan(3600);

  const held = rowsOf(text, 'kAtmosphere2');
  // In long silence a held scene stands still: its clock stops moving.
  const silentRun = held.slice(70, 80).map((row) => row[0]);
  expect(Math.max(...silentRun) - Math.min(...silentRun)).toBeLessThan(0.05);

  const clock = rowsOf(text, 'kClockDaylight').map((row) => row[3]);
  expect(clock).toContain(0);
  expect(clock).toContain(100);
  expect(clock.some((value) => value > 0 && value < 100)).toBe(true);

  const grid = /kSwatch0Grid\[\] = \{([^}]*)\}/.exec(text)?.[1] ?? '';
  const values = new Set(grid.split(', ').map(Number));
  // Lit at full colour and glowing at a fifth of it.
  expect(values.has(255)).toBe(true);
  expect(values.has(Math.round(255 * 0.22))).toBe(true);
});
