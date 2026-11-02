/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { readFileSync } from 'fs';
import path from 'path';
import { songTellerFixture } from '../../../main/songTellerFixture';

jest.mock('electron-log', () => ({ error: jest.fn(), warn: jest.fn() }));

/**
 * The tray tells the FluidEQ Engine the song while Electron is gone
 * (`song_teller.cpp`), held by `song_teller_test.cpp` to what main's own
 * `createSongProgramme` wrote for the same script. A change to how main
 * tells it, not regenerated there, would leave the two telling the engine
 * different things — so this holds the header to main's code.
 */
it('is what main tells the engine now', async () => {
  const header = readFileSync(
    path.resolve(process.cwd(), 'native/tray-host/tests/song_teller_fixture.h'),
    'utf8',
  );
  expect(header).toBe(await songTellerFixture());
});
