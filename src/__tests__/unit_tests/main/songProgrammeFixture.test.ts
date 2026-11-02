/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { readFileSync } from 'fs';
import path from 'path';
import { songProgrammeFixture } from '../../../main/songProgrammeFixture';

/**
 * The tray names the song for the FluidEQ Engine while Electron is gone, and
 * main again when it is back (`song_programme.cpp`), held by
 * `song_programme_test.cpp` to `song_programme_fixture.h`. A change to how
 * `songProgramme.ts` names or writes a song, not regenerated there, would
 * have the two name one song twice — so this holds the header to it.
 */
it('is how main names and writes a song now', () => {
  const header = readFileSync(
    path.resolve(
      process.cwd(),
      'native/tray-host/tests/song_programme_fixture.h',
    ),
    'utf8',
  );
  expect(header).toBe(songProgrammeFixture());
});
