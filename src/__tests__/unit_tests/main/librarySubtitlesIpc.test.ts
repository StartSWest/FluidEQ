/*
Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later

@jest-environment node

The Subtitles tab's channels in main: a video is named by its library id
and never by a path, a song's id finds no subtitles, and a dropped file is
kept beside the video the id names.
*/

const handlers = new Map<string, (...args: unknown[]) => unknown>();
const showOpenDialog = jest.fn();
jest.mock('electron', () => ({
  app: { getPath: () => 'C:\\Users\\viewer\\Downloads' },
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
import { registerLibrarySubtitlesIpc } from '../../../main/ipc/librarySubtitlesIpc';

const SRT = '1\n00:00:01,000 --> 00:00:02,000\nTide coming in\n';

describe('the Subtitles tab’s channels', () => {
  let dir = '';
  let video = '';
  let song = '';

  beforeEach(() => {
    handlers.clear();
    showOpenDialog.mockReset();
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-subtitles-ipc-'));
    video = path.join(dir, 'Tide.mp4');
    song = path.join(dir, 'Tide.mp3');
    fs.writeFileSync(video, Buffer.alloc(8));
    fs.writeFileSync(song, Buffer.alloc(8));
    fs.writeFileSync(path.join(dir, 'Tide.srt'), SRT);
    const paths: Record<string, string> = { video, song };
    registerLibrarySubtitlesIpc({
      getMainWindow: () => null,
      trackPath: (id) => paths[id],
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

  it('reads a video’s subtitles by id, and none for a song beside it', async () => {
    await expect(
      call('library-track-subtitles', 'video', undefined, ['en']),
    ).resolves.toMatchObject({
      files: [{ fileName: 'Tide.srt' }],
      shown: { fileName: 'Tide.srt' },
    });
    // The song shares the name and the folder: the control that the
    // refusal is the kind of track, not a missing file.
    await expect(
      call('library-track-subtitles', 'song', undefined, ['en']),
    ).resolves.toBe(undefined);
    await expect(
      call('library-track-subtitles', 'nobody', undefined, []),
    ).resolves.toBe(undefined);
  });

  it('ignores a preference list that is not one', async () => {
    await expect(
      call('library-track-subtitles', 'video', 42, 'en'),
    ).resolves.toMatchObject({ shown: { fileName: 'Tide.srt' } });
  });

  it('keeps a dropped file beside the video, and nothing for a song', async () => {
    await expect(
      call('library-subtitles-import', 'video', 'tide.es.srt', SRT),
    ).resolves.toEqual({ state: 'saved', fileName: 'Tide.es.srt' });
    expect(fs.existsSync(path.join(dir, 'Tide.es.srt'))).toBe(true);
    await expect(
      call('library-subtitles-import', 'song', 'tide.fr.srt', SRT),
    ).resolves.toEqual({ state: 'failed' });
    expect(fs.existsSync(path.join(dir, 'Tide.fr.srt'))).toBe(false);
  });

  it('opens the dialog for .srt and .vtt only, and a cancel keeps nothing', async () => {
    showOpenDialog.mockResolvedValue({ canceled: true, filePaths: [] });
    await expect(call('library-subtitles-pick', 'video')).resolves.toEqual({
      state: 'canceled',
    });
    expect(showOpenDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        filters: [{ name: 'files.type.subtitles', extensions: ['srt', 'vtt'] }],
      }),
    );
  });
});
