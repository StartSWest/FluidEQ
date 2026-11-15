/*
Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later

@jest-environment node

The Lyrics tab's channels in main: a song is named by its library id and
never by a path, and lyrics imported through them land beside that song.
*/

const handlers = new Map<string, (...args: unknown[]) => unknown>();
const showOpenDialog = jest.fn();
jest.mock('electron', () => ({
  app: { getPath: () => 'C:\\Users\\listener\\Downloads' },
  ipcMain: {
    handle: (channel: string, fn: (...args: unknown[]) => unknown) =>
      handlers.set(channel, fn),
  },
  dialog: {
    showOpenDialog: (...args: unknown[]) => showOpenDialog(...args),
  },
}));
jest.mock('../../../main/mainText', () => ({
  __esModule: true,
  default: (key: string) => key,
}));

// eslint-disable-next-line import/first -- the mocks must be installed first
import fs from 'fs';
// eslint-disable-next-line import/first
import os from 'os';
// eslint-disable-next-line import/first
import path from 'path';
// eslint-disable-next-line import/first
import { registerLibraryLyricsIpc } from '../../../main/ipc/libraryLyricsIpc';
// eslint-disable-next-line import/first
import { mpegFrames } from '../../utils/lyricsFixtures';

describe('the Lyrics tab’s channels', () => {
  let dir = '';
  let song = '';

  beforeEach(() => {
    handlers.clear();
    showOpenDialog.mockReset();
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-lyrics-ipc-'));
    song = path.join(dir, 'Harbour.mp3');
    fs.writeFileSync(song, mpegFrames());
    registerLibraryLyricsIpc({
      userDataDir: path.join(dir, 'user-data'),
      getMainWindow: () => null,
      trackPath: (id) => (id === 'harbour' ? song : undefined),
    });
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  const call = (channel: string, ...args: unknown[]) => {
    const handler = handlers.get(channel);
    if (handler === undefined) {
      throw new Error(`no handler for ${channel}`);
    }
    return Promise.resolve(handler({}, ...args));
  };

  it('keeps imported lyrics beside the song the id names, and reads them back', async () => {
    await expect(
      call('library-lyrics-import', 'harbour', 'Salt on the rope', false),
    ).resolves.toEqual({
      state: 'saved',
      place: 'beside',
      fileName: 'Harbour.txt',
    });
    await expect(
      call('library-track-lyrics', 'harbour'),
    ).resolves.toMatchObject({
      lyrics: {
        kind: 'plain',
        text: 'Salt on the rope',
        fileName: 'Harbour.txt',
      },
    });
  });

  it('writes nothing for an id the library does not know, or a path in its place', async () => {
    await expect(
      call('library-lyrics-import', song, 'Salt on the rope', false),
    ).resolves.toBeUndefined();
    await expect(
      call('library-lyrics-import', 'nobody', 'Salt on the rope', false),
    ).resolves.toBeUndefined();
    await expect(
      call('library-lyrics-import', 'harbour', { text: 'not a string' }, false),
    ).resolves.toBeUndefined();
    expect(fs.readdirSync(dir)).toEqual(['Harbour.mp3']);
  });

  it('replaces only on a literal true', async () => {
    fs.writeFileSync(path.join(dir, 'Harbour.txt'), 'Old words');
    await expect(
      call('library-lyrics-import', 'harbour', 'New words', 'yes'),
    ).resolves.toMatchObject({ state: 'exists' });
    expect(fs.readFileSync(path.join(dir, 'Harbour.txt'), 'utf8')).toBe(
      'Old words',
    );
  });

  it('opens the dialog for lyrics files in Downloads, and hands back the text', async () => {
    const picked = path.join(dir, 'Harbour (LRCLIB).lrc');
    fs.writeFileSync(picked, '[00:01.00]Salt on the rope');
    showOpenDialog.mockResolvedValue({ canceled: false, filePaths: [picked] });
    await expect(call('library-lyrics-pick')).resolves.toEqual({
      state: 'picked',
      text: '[00:01.00]Salt on the rope',
    });
    expect(showOpenDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultPath: 'C:\\Users\\listener\\Downloads',
        filters: [{ name: 'files.type.lyrics', extensions: ['lrc', 'txt'] }],
      }),
    );
    showOpenDialog.mockResolvedValue({ canceled: true, filePaths: [] });
    await expect(call('library-lyrics-pick')).resolves.toEqual({
      state: 'canceled',
    });
  });
});
