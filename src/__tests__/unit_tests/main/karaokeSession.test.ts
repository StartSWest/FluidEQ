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
  clearKaraokeSession,
  readRestoredKaraokeFile,
  restoreKaraokeSession,
  saveKaraokeSession,
} from '../../../main/karaokeSession';

describe('persisted Karaoke session', () => {
  let directory: string;
  let musicDirectory: string;
  let audioPath: string;
  let lyricsPath: string;

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-karaoke-'));
    musicDirectory = path.join(directory, 'Album');
    fs.mkdirSync(musicDirectory);
    audioPath = path.join(musicDirectory, 'Song.mp3');
    lyricsPath = path.join(musicDirectory, 'Song.lrc');
    fs.writeFileSync(audioPath, Buffer.from([1, 2, 3, 4]));
    fs.writeFileSync(lyricsPath, '[00:01.00]Remember me');
  });

  afterEach(() => {
    fs.rmSync(directory, { recursive: true, force: true });
  });

  it('restores the folder, active song, playhead and lazy audio token', async () => {
    saveKaraokeSession(directory, {
      version: 1,
      files: [
        { localPath: audioPath, relativePath: 'Album/Song.mp3' },
        { localPath: lyricsPath, relativePath: 'Album/Song.lrc' },
      ],
      playlistOrder: ['album/song.mp3'],
      selectedPlaylistId: 'album/song.mp3',
      playheadMs: 12_345,
    });

    const restored = restoreKaraokeSession(directory);
    expect(restored).toMatchObject({
      playlistOrder: ['album/song.mp3'],
      selectedPlaylistId: 'album/song.mp3',
      playheadMs: 12_345,
    });
    expect(restored?.files).toEqual([
      expect.objectContaining({
        name: 'Song.mp3',
        relativePath: 'Album/Song.mp3',
        role: 'audio',
      }),
      expect.objectContaining({
        name: 'Song.lrc',
        relativePath: 'Album/Song.lrc',
        role: 'lyrics',
        text: '[00:01.00]Remember me',
      }),
    ]);

    const audio = restored?.files.find((file) => file.role === 'audio');
    expect(audio).toBeDefined();
    expect(audio).not.toHaveProperty('text');
    expect((await readRestoredKaraokeFile(audio?.token ?? ''))?.data).toEqual(
      new Uint8Array([1, 2, 3, 4]),
    );
  });

  it('drops missing files and clears the saved session', () => {
    saveKaraokeSession(directory, {
      version: 1,
      files: [{ localPath: audioPath, relativePath: 'Song.mp3' }],
      playlistOrder: ['song.mp3'],
      playheadMs: 0,
    });
    fs.rmSync(audioPath);
    expect(restoreKaraokeSession(directory)).toBeUndefined();

    clearKaraokeSession(directory);
    expect(fs.existsSync(path.join(directory, 'karaoke-session.json'))).toBe(
      false,
    );
  });
});
