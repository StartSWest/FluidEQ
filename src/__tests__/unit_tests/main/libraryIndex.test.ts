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
import {
  emptyLibraryIndex,
  loadLibraryIndex,
  parseLibraryIndex,
} from '../../../main/library/libraryIndex';

const tempDir = (): string =>
  fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-library-'));

// The JSON file the library lived in before the store: read once, to move it
// in (`libraryStoreOpen.ts`), and never written again.
describe('the old library index on disk', () => {
  it('reads what an earlier build wrote', () => {
    const dir = tempDir();
    const index = emptyLibraryIndex();
    index.roots.push({
      id: 'r1',
      path: 'C:\\Music',
      addedAt: 1,
      trackCount: 1,
      karaokeSkipped: 0,
    });
    index.tracks.push({
      id: 't1',
      rootId: 'r1',
      path: 'C:\\Music\\a.mp3',
      kind: 'audio',
      isPlayable: true,
      title: 'A',
      sizeBytes: 10,
      mtimeMs: 20,
      addedAt: 30,
    });
    fs.writeFileSync(
      path.join(dir, 'library-index.json'),
      JSON.stringify(index, null, 2),
    );
    expect(loadLibraryIndex(dir)).toEqual({ index, wasReset: false });
  });

  it('starts empty when nothing has been saved', () => {
    // The positive control for the recovery test below: "empty" must mean
    // "nothing yet", not "something went wrong and I hid it".
    expect(loadLibraryIndex(tempDir())).toEqual({
      index: emptyLibraryIndex(),
      wasReset: false,
    });
  });

  it('rebuilds from scratch and says so when the file is corrupt', () => {
    const dir = tempDir();
    fs.writeFileSync(path.join(dir, 'library-index.json'), '{ not json');
    const loaded = loadLibraryIndex(dir);
    expect(loaded.index).toEqual(emptyLibraryIndex());
    expect(loaded.wasReset).toBe(true);
    // Kept, not deleted — a corrupt index is still the only record of which
    // folders somebody added.
    expect(fs.existsSync(path.join(dir, 'library-index.json.bak'))).toBe(true);
  });

  it('refuses a payload that is the wrong shape', () => {
    expect(parseLibraryIndex(undefined)).toBeUndefined();
    expect(
      parseLibraryIndex({ version: 99, roots: [], tracks: [] }),
    ).toBeUndefined();
    expect(parseLibraryIndex({ version: 1, roots: [], tracks: [] })).toEqual({
      version: 1,
      roots: [],
      tracks: [],
    });
  });
});
