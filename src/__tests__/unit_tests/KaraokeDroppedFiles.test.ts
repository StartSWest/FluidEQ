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

import { karaokeFileRelativePath } from '../../common/karaoke/files';
import collectKaraokeDropFiles from '../../renderer/karaoke/droppedFiles';

const fileEntry = (path: string, file: File): FileSystemFileEntry =>
  ({
    isFile: true,
    isDirectory: false,
    fullPath: path,
    name: file.name,
    file: (success: (next: File) => void) => success(file),
  }) as unknown as FileSystemFileEntry;

describe('Karaoke folder drops', () => {
  it('reads every Chromium directory batch and preserves relative paths', async () => {
    const first = fileEntry(
      '/Album/Song.txt',
      new File(['lyrics'], 'Song.txt'),
    );
    const second = fileEntry(
      '/Album/Song.mp3',
      new File(['audio'], 'Song.mp3'),
    );
    const batches: FileSystemEntry[][] = [[first], [second], []];
    const directory = {
      isFile: false,
      isDirectory: true,
      fullPath: '/Album',
      name: 'Album',
      createReader: () => ({
        readEntries: (success: (entries: FileSystemEntry[]) => void) =>
          success(batches.shift() ?? []),
      }),
    } as unknown as FileSystemDirectoryEntry;
    const dataTransfer = {
      items: [
        {
          kind: 'file',
          webkitGetAsEntry: () => directory,
        },
      ],
      files: [],
    } as unknown as DataTransfer;

    const files = await collectKaraokeDropFiles(dataTransfer);

    expect(files.map((file) => file.name)).toEqual(['Song.mp3', 'Song.txt']);
    expect(files.map(karaokeFileRelativePath)).toEqual([
      'Album/Song.mp3',
      'Album/Song.txt',
    ]);
  });

  it('falls back to an ordinary flat file drop', async () => {
    const song = new File(['audio'], 'song.wav');
    const dataTransfer = {
      items: [],
      files: [song],
    } as unknown as DataTransfer;

    await expect(collectKaraokeDropFiles(dataTransfer)).resolves.toEqual([
      song,
    ]);
  });
});
