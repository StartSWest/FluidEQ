/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import fs from 'fs';
import os from 'os';
import path from 'path';
import { getDefaultSongEqSettings } from 'common/songEq';
import { loadSongEqSettings, saveSongEqSettings } from 'main/songEqStore';

const tempDir = () =>
  fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-song-eq-'));

describe('songEqStore', () => {
  it('returns an empty store where there is no file', () => {
    expect(loadSongEqSettings(tempDir())).toEqual(getDefaultSongEqSettings());
  });

  it('reads back exactly what it wrote', () => {
    // Positive control for the test above: proves the empty result is a
    // missing file rather than a reader that always returns empty.
    const dir = tempDir();
    const settings = {
      ...getDefaultSongEqSettings(),
      outputs: {
        'device-a': {
          entries: {
            'library:x': {
              settings: { filters: {} },
              title: 'Song',
              plays: 2,
              updatedAt: 5,
            },
          },
          aliases: { 'song|artist': 'library:x' },
        },
      },
    };
    saveSongEqSettings(dir, settings);
    expect(loadSongEqSettings(dir)).toEqual(settings);
  });

  it('returns an empty store rather than throwing on a corrupt file', () => {
    // A half-written file after a power cut must not stop the app starting.
    const dir = tempDir();
    fs.writeFileSync(path.join(dir, 'song-eq.json'), '{ not json', 'utf8');
    expect(loadSongEqSettings(dir)).toEqual(getDefaultSongEqSettings());
  });

  it('refuses a file from a future version', () => {
    const dir = tempDir();
    fs.writeFileSync(
      path.join(dir, 'song-eq.json'),
      JSON.stringify({ version: 99, outputs: {} }),
      'utf8',
    );
    expect(loadSongEqSettings(dir)).toEqual(getDefaultSongEqSettings());
  });

  it('fills in a missing entries or aliases half instead of handing a shape that throws downstream', () => {
    // Valid JSON, valid version, but an output missing both halves — the
    // shape that used to reach common/songEq.ts's `output.entries[...]` and
    // throw a TypeError inside an ipcMain handler that had already committed
    // to replying, hanging the renderer's promise forever. The positive
    // control is the "reads back exactly what it wrote" test above: it
    // proves a well-formed output's entries and aliases survive untouched, so
    // this test cannot be satisfied by a loader that empties every output.
    const dir = tempDir();
    fs.writeFileSync(
      path.join(dir, 'song-eq.json'),
      JSON.stringify({ version: 1, outputs: { 'device-a': {} } }),
      'utf8',
    );
    expect(loadSongEqSettings(dir)).toEqual({
      version: 1,
      outputs: { 'device-a': { entries: {}, aliases: {} } },
    });
  });
});
