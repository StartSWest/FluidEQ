/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import fs from 'fs';
import os from 'os';
import path from 'path';
import type { BrowserWindow } from 'electron';
import type {
  ILibraryIndex,
  ILibraryTrack,
} from '../../../common/library/types';
import type {
  IScanOptions,
  IScanResult,
} from '../../../main/library/libraryScanner';

const handlers = new Map<string, (...args: unknown[]) => unknown>();
jest.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, fn: (...args: unknown[]) => unknown) =>
      handlers.set(channel, fn),
    on: (channel: string, fn: (...args: unknown[]) => unknown) =>
      handlers.set(channel, fn),
  },
  dialog: { showOpenDialog: jest.fn() },
  shell: { showItemInFolder: jest.fn() },
}));

// The walk itself is `libraryScanner.test.ts`'s business; here it is scripted
// so each test decides exactly what a rescan found.
const scanLibraryRoot = jest.fn<Promise<IScanResult>, [IScanOptions]>();
jest.mock('../../../main/library/libraryScanner', () => ({
  scanLibraryRoot: (options: IScanOptions) => scanLibraryRoot(options),
}));

/* eslint-disable import/first -- the mocks above must be installed first */
import * as asyncWriter from '../../../main/asyncWriter';
import { registerLibraryIpc } from '../../../main/ipc/library';
import {
  readLibraryIndex,
  serializeLibraryIndex,
  writeLibraryIndexSoon,
} from '../../../main/library/libraryIndex';
/* eslint-enable import/first */

const tempDir = (prefix: string): string =>
  fs.mkdtempSync(path.join(os.tmpdir(), prefix));

interface ISent {
  channel: string;
  payload: unknown;
}

/**
 * A main window that stays hidden, so the launch rescan waits for a `show`
 * that never comes: every walk in this file is one a test started.
 */
const hiddenWindow = (sent: ISent[]): BrowserWindow =>
  ({
    isVisible: () => false,
    once: () => undefined,
    webContents: {
      send: (channel: string, payload: unknown) =>
        sent.push({ channel, payload }),
    },
  }) as unknown as BrowserWindow;

const invoke = (channel: string, ...args: unknown[]): Promise<unknown> => {
  const handler = handlers.get(channel);
  if (!handler) {
    throw new Error(`no handler for ${channel}`);
  }
  return Promise.resolve(handler({}, ...args));
};

/**
 * Lets a chain of promises that never touches the disk run to its end. A walk
 * here is scripted, so everything between its start and its merge is such a
 * chain; each test shows the same drain is long enough by what it sees after
 * a walk that did change something.
 */
const drain = async (): Promise<void> => {
  for (let turn = 0; turn < 50; turn += 1) {
    await Promise.resolve();
  }
};

const trackFor = (
  rootId: string,
  file: string,
  over: Partial<ILibraryTrack> = {},
): ILibraryTrack => {
  const stats = fs.statSync(file);
  return {
    id: `id-${path.basename(file)}`,
    rootId,
    path: file,
    kind: 'audio',
    isPlayable: true,
    title: path.basename(file),
    sizeBytes: stats.size,
    mtimeMs: stats.mtimeMs,
    addedAt: 1,
    ...over,
  };
};

const indexOf = (titles: readonly string[]): ILibraryIndex => ({
  version: 1,
  roots: [
    { id: 'r1', path: '/music', addedAt: 1, trackCount: 1, karaokeSkipped: 0 },
  ],
  tracks: titles.map((title) => ({
    id: `id-${title}`,
    rootId: 'r1',
    path: `/music/${title}.mp3`,
    kind: 'audio',
    isPlayable: true,
    title,
    sizeBytes: 1,
    mtimeMs: 1,
    addedAt: 1,
    normalization: { version: 2, truePeakDbtp: -1, integratedLufs: -9 },
  })),
});

const indexFileIn = (userDataDir: string) =>
  path.join(userDataDir, 'library-index.json');

beforeEach(() => {
  scanLibraryRoot.mockReset();
});

afterEach(async () => {
  await asyncWriter.flushPendingWrites();
  jest.restoreAllMocks();
});

describe('a rescan of a library that has not changed', () => {
  it('writes nothing and sends nothing, where a rescan that found a change does both', async () => {
    const userDataDir = tempDir('fluideq-quiet-data-');
    const music = tempDir('fluideq-quiet-music-');
    const file = path.join(music, 'a.mp3');
    fs.writeFileSync(file, 'x');
    const sent: ISent[] = [];
    const window = hiddenWindow(sent);
    registerLibraryIpc({ userDataDir, getMainWindow: () => window });
    const indexChanges = () =>
      sent.filter((entry) => entry.channel === 'library-index-changed').length;

    // The first walk finds the one file.
    scanLibraryRoot.mockImplementation(async (options) => ({
      tracks: [trackFor(options.rootId, file)],
      karaokeSkipped: 0,
      wasCancelled: false,
    }));
    await invoke('library-root-add-paths', [music]);
    await drain();
    await asyncWriter.flushPendingWrites();
    const changesAfterFirstWalk = indexChanges();
    expect(changesAfterFirstWalk).toBe(1);
    const writes = jest.spyOn(asyncWriter, 'writeFileNow');

    // Found as it was: the walk hands back the very tracks it was given,
    // which is what an unchanged file comes back as.
    scanLibraryRoot.mockImplementation(async (options) => ({
      tracks: [...options.known],
      karaokeSkipped: 0,
      wasCancelled: false,
    }));
    await invoke('library-scan-start');
    await drain();
    await asyncWriter.flushPendingWrites();
    expect(scanLibraryRoot).toHaveBeenCalledTimes(2);
    expect(indexChanges()).toBe(changesAfterFirstWalk);
    expect(writes).not.toHaveBeenCalled();

    // The control, with the same drain: a walk that read the file again.
    scanLibraryRoot.mockImplementation(async (options) => ({
      tracks: [trackFor(options.rootId, file, { title: 'Retagged' })],
      karaokeSkipped: 0,
      wasCancelled: false,
    }));
    await invoke('library-scan-start');
    await drain();
    await asyncWriter.flushPendingWrites();
    expect(indexChanges()).toBe(changesAfterFirstWalk + 1);
    expect(writes).toHaveBeenCalledTimes(1);
    const saved = JSON.parse(
      fs.readFileSync(indexFileIn(userDataDir), 'utf8'),
    ) as ILibraryIndex;
    expect(saved.tracks.map((track) => track.title)).toEqual(['Retagged']);
  });
});

describe('storing a newly measured song', () => {
  it('answers without writing the index on the spot, and every measurement reaches the disk', async () => {
    const userDataDir = tempDir('fluideq-measure-data-');
    const music = tempDir('fluideq-measure-music-');
    const files = ['a', 'b', 'c', 'd', 'e'].map((name) => {
      const file = path.join(music, `${name}.mp3`);
      fs.writeFileSync(file, name);
      return file;
    });
    const sent: ISent[] = [];
    const window = hiddenWindow(sent);
    registerLibraryIpc({ userDataDir, getMainWindow: () => window });
    scanLibraryRoot.mockImplementation(async (options) => ({
      tracks: files.map((file) => trackFor(options.rootId, file)),
      karaokeSkipped: 0,
      wasCancelled: false,
    }));
    await invoke('library-root-add-paths', [music]);
    await drain();
    await asyncWriter.flushPendingWrites();

    const syncWrites = jest.spyOn(fs, 'writeFileSync');
    const syncRenames = jest.spyOn(fs, 'renameSync');
    const answers = await Promise.all(
      files.map((file, place) => {
        const stats = fs.statSync(file);
        return invoke(
          'library-track-normalization-set',
          `id-${path.basename(file)}`,
          { version: 2, truePeakDbtp: -1, integratedLufs: -10 - place },
          { sizeBytes: stats.size, mtimeMs: stats.mtimeMs },
        );
      }),
    );
    expect(answers).toEqual(files.map(() => true));
    // Nothing written while main was answering: that was the freeze.
    expect(syncWrites).not.toHaveBeenCalled();
    expect(syncRenames).not.toHaveBeenCalled();

    await asyncWriter.flushPendingWrites();
    const saved = JSON.parse(
      fs.readFileSync(indexFileIn(userDataDir), 'utf8'),
    ) as ILibraryIndex;
    expect(
      saved.tracks.map((track) => track.normalization?.integratedLufs),
    ).toEqual([-10, -11, -12, -13, -14]);
  });
});

describe('the index writer', () => {
  it('collapses requests made together into one write of the index as it is when the write starts', async () => {
    const userDataDir = tempDir('fluideq-writer-');
    let index = indexOf(['a']);
    const current = jest.fn(() => index);
    const requests = [1, 2, 3, 4, 5, 6, 7, 8].map(() =>
      writeLibraryIndexSoon(userDataDir, current),
    );
    index = indexOf(['a', 'b']);
    await Promise.all(requests);
    expect(current).toHaveBeenCalledTimes(1);
    expect(
      JSON.parse(fs.readFileSync(indexFileIn(userDataDir), 'utf8')),
    ).toEqual(index);
  });

  it('writes once more, with the newest index, for any number of requests made while a write is under way', async () => {
    const userDataDir = tempDir('fluideq-writer-');
    const { writeFileNow } = asyncWriter;
    let started: () => void = () => undefined;
    const firstStarted = new Promise<void>((resolve) => {
      started = resolve;
    });
    let release: () => void = () => undefined;
    const firstHeld = new Promise<void>((resolve) => {
      release = resolve;
    });
    const writes = jest
      .spyOn(asyncWriter, 'writeFileNow')
      .mockImplementationOnce(async (file, text) => {
        started();
        await firstHeld;
        return writeFileNow(file, text);
      });

    let index = indexOf(['a']);
    const current = jest.fn(() => index);
    const first = writeLibraryIndexSoon(userDataDir, current);
    await firstStarted;
    index = indexOf(['a', 'b']);
    const behind = [1, 2, 3].map(() =>
      writeLibraryIndexSoon(userDataDir, current),
    );
    index = indexOf(['a', 'b', 'c']);
    release();
    await Promise.all([first, ...behind]);

    expect(current).toHaveBeenCalledTimes(2);
    expect(writes).toHaveBeenCalledTimes(2);
    expect(
      JSON.parse(fs.readFileSync(indexFileIn(userDataDir), 'utf8')),
    ).toEqual(index);
  });

  it('writes what JSON.stringify gives for the index, a replaced track as it is now', () => {
    const index = indexOf(['a', 'b']);
    expect(serializeLibraryIndex(index)).toBe(JSON.stringify(index));
    const retitled: ILibraryIndex = {
      ...index,
      tracks: [index.tracks[0], { ...index.tracks[1], title: 'B, retitled' }],
    };
    expect(serializeLibraryIndex(retitled)).toBe(JSON.stringify(retitled));
  });

  it('reads back what it wrote, and an index written indented by an earlier version', async () => {
    const written = tempDir('fluideq-writer-');
    const index = indexOf(['a', 'b']);
    await writeLibraryIndexSoon(written, () => index);
    await expect(readLibraryIndex(written)).resolves.toEqual({
      index,
      wasReset: false,
    });

    const earlier = tempDir('fluideq-writer-');
    fs.writeFileSync(indexFileIn(earlier), JSON.stringify(index, null, 2));
    await expect(readLibraryIndex(earlier)).resolves.toEqual({
      index,
      wasReset: false,
    });
  });
});
