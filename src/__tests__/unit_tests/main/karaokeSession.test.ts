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
import log from 'electron-log';
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
    await saveKaraokeSession(directory, {
      version: 1,
      files: [
        { localPath: audioPath, relativePath: 'Album/Song.mp3' },
        { localPath: lyricsPath, relativePath: 'Album/Song.lrc' },
      ],
      playlistOrder: ['album/song.mp3'],
      selectedPlaylistId: 'album/song.mp3',
      playheadMs: 12_345,
    });

    const restored = await restoreKaraokeSession(directory);
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

  it('drops missing files and clears the saved session', async () => {
    await saveKaraokeSession(directory, {
      version: 1,
      files: [{ localPath: audioPath, relativePath: 'Song.mp3' }],
      playlistOrder: ['song.mp3'],
      playheadMs: 0,
    });
    fs.rmSync(audioPath);
    await expect(restoreKaraokeSession(directory)).resolves.toBeUndefined();

    await clearKaraokeSession(directory);
    expect(fs.existsSync(path.join(directory, 'karaoke-session.json'))).toBe(
      false,
    );
  });
});

/**
 * A save off main's own thread, and only when there is something new to keep.
 *
 * Every save used to stat each playlist file with `statSync` and write with
 * `writeFileSync`, on the thread every window message waits on, whether or not
 * the snapshot had changed since the last one.
 */
describe('saving the Karaoke session', () => {
  let directory: string;
  let audioPath: string;
  let sessionFile: string;

  const snapshot = (playheadMs: number) => ({
    version: 1 as const,
    files: [{ localPath: audioPath, relativePath: 'Song.mp3' }],
    playlistOrder: ['song.mp3'],
    playheadMs,
  });

  /** How many times the session file itself has been replaced. */
  const writesOfSession = (rename: jest.SpyInstance) =>
    rename.mock.calls.filter(([, to]) => to === sessionFile).length;

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-karaoke-'));
    audioPath = path.join(directory, 'Song.mp3');
    sessionFile = path.join(directory, 'karaoke-session.json');
    fs.writeFileSync(audioPath, Buffer.from([1, 2, 3, 4]));
  });

  afterEach(() => {
    jest.restoreAllMocks();
    fs.rmSync(directory, { recursive: true, force: true });
  });

  it('asks the disk nothing on main’s own thread', async () => {
    const statSync = jest.spyOn(fs, 'statSync');
    const writeFileSync = jest.spyOn(fs, 'writeFileSync');

    await saveKaraokeSession(directory, snapshot(1_000));

    expect(statSync).not.toHaveBeenCalled();
    expect(writeFileSync).not.toHaveBeenCalled();
    // The positive control: the session did reach the disk.
    expect(JSON.parse(fs.readFileSync(sessionFile, 'utf8'))).toMatchObject({
      files: [{ localPath: audioPath, relativePath: 'Song.mp3' }],
      playheadMs: 1_000,
    });
  });

  it('writes a snapshot identical to the last one written once', async () => {
    const rename = jest.spyOn(fs.promises, 'rename');
    const stat = jest.spyOn(fs.promises, 'stat');

    await saveKaraokeSession(directory, snapshot(1_000));
    expect(writesOfSession(rename)).toBe(1);
    const statsForFirst = stat.mock.calls.length;

    await saveKaraokeSession(directory, snapshot(1_000));
    expect(writesOfSession(rename)).toBe(1);
    // Nor were the playlist's files asked about again.
    expect(stat.mock.calls.length).toBe(statsForFirst);

    // The control: a snapshot that moved is written.
    await saveKaraokeSession(directory, snapshot(2_000));
    expect(writesOfSession(rename)).toBe(2);
    expect(JSON.parse(fs.readFileSync(sessionFile, 'utf8')).playheadMs).toBe(
      2_000,
    );
  });

  /**
   * A save that fails is said to the window, which forgets what it last sent
   * and sends the same snapshot again — and main does not count it as written
   * either. It used to be swallowed here: the window took it as saved and
   * never sent that snapshot again.
   */
  it('reports a save that failed, and writes the same snapshot when asked again', async () => {
    jest.spyOn(log, 'warn').mockImplementation(() => undefined);
    jest.spyOn(log, 'error').mockImplementation(() => undefined);
    const full = Object.assign(new Error('no space left on device'), {
      code: 'ENOSPC',
    });
    jest.spyOn(fs.promises, 'rename').mockRejectedValueOnce(full);

    await expect(saveKaraokeSession(directory, snapshot(5_000))).rejects.toBe(
      full,
    );
    expect(fs.existsSync(sessionFile)).toBe(false);

    await saveKaraokeSession(directory, snapshot(5_000));
    expect(JSON.parse(fs.readFileSync(sessionFile, 'utf8')).playheadMs).toBe(
      5_000,
    );
  });

  it('restores what a save still on its way was asked to keep', async () => {
    const saving = saveKaraokeSession(directory, snapshot(3_000));

    const restored = await restoreKaraokeSession(directory);

    expect(restored?.playheadMs).toBe(3_000);
    await saving;
  });

  it('keeps a clear sent after a save cleared, and saves again after it', async () => {
    await saveKaraokeSession(directory, snapshot(1_000));

    const saving = saveKaraokeSession(directory, snapshot(4_000));
    const clearing = clearKaraokeSession(directory);
    await Promise.all([saving, clearing]);

    expect(fs.existsSync(sessionFile)).toBe(false);
    await expect(restoreKaraokeSession(directory)).resolves.toBeUndefined();

    // The same snapshot as before the clear is not "already written": the
    // file it was written to is gone.
    await saveKaraokeSession(directory, snapshot(1_000));
    expect(fs.existsSync(sessionFile)).toBe(true);
  });
});
