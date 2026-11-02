/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { readFileSync } from 'fs';
import path from 'path';
import { sceneEnergyFixture } from 'common/sceneEnergyFixture';

/**
 * The lamps and the desktop drawn without Electron hear the music — level,
 * bands, pulse, accent, flywheel, tempo, beat and bar, drums, the song's
 * shape and the voice — through a C++ twin of `spectrumEnergy.ts` and
 * everything under it, held by `scene_energy_parity_test.cpp` to
 * `scene_energy_fixture.h`. A change to how the TypeScript hears, not
 * regenerated there, is a C++ test held to a hearing the window no longer
 * has — so this holds the header to the module byte for byte.
 */
it('is what spectrumEnergy.ts hears now', () => {
  const header = readFileSync(
    path.resolve(
      process.cwd(),
      'native/scene-core/tests/scene_energy_fixture.h',
    ),
    'utf8',
  );
  expect(header).toBe(sceneEnergyFixture());
}, 60_000);

/**
 * The song the header was read from has to make every part of the hearing
 * move, or the C++ is held to a branch neither side ever took: a fixture
 * whose hats were an 18 kHz tone and whose build cancelled in the middle
 * held the drop, the build and the hats to zero on both sides, and passed.
 */
it('is read from a song that moves every part of the hearing', () => {
  const rows = [...sceneEnergyFixture().matchAll(/^ {4}\{([^}]*)\}/gm)].map(
    (match) => match[1].split(', ').map(Number),
  );
  const highest = (field: number) => Math.max(...rows.map((row) => row[field]));
  // accent, accent serial, kick, snare, hat, build, drop, drop serial,
  // voice open, voice sure: each heard at least once.
  [6, 7, 14, 15, 16, 18, 19, 20, 22, 24].forEach((field) => {
    expect(highest(field)).toBeGreaterThan(0.1);
  });
  // The tempo found, and the beat held with confidence.
  expect(highest(12)).toBeGreaterThan(110);
  expect(highest(13)).toBeGreaterThan(0.9);
}, 60_000);
