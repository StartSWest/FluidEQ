/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import fs from 'fs';
import { IScanOptions } from '../../../main/library/libraryScanner';
import { IScanWorkerResponse } from '../../../main/library/scanWorkerProtocol';

type TChildEvent = 'message' | 'exit';
type TChildListener = (message?: unknown) => void;

const childListeners = new Map<TChildEvent, TChildListener>();
const child = {
  on: jest.fn((event: TChildEvent, listener: TChildListener) => {
    childListeners.set(event, listener);
  }),
  postMessage: jest.fn(),
  kill: jest.fn(),
};
const fork = jest.fn(() => child);
const cacheArtwork = jest.fn<Promise<string | undefined>, [string, Uint8Array]>(
  () => Promise.resolve('abc123'),
);

jest.mock('electron', () => ({
  app: { isPackaged: true },
  utilityProcess: { fork },
}));
jest.mock('../../../main/library/libraryArtwork', () => ({
  storeArtwork: (userDataDir: string, bytes: Uint8Array) =>
    cacheArtwork(userDataDir, bytes),
}));
jest.mock('../../../main/library/libraryScanner', () => {
  const actual = jest.requireActual(
    '../../../main/library/libraryScanner',
  ) as object;
  return { ...actual, scanLibraryRoot: jest.fn() };
});

const flushMessages = (): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, 0);
  });

describe('the library scan host', () => {
  afterEach(() => {
    childListeners.clear();
    child.on.mockClear();
    child.postMessage.mockClear();
    child.kill.mockClear();
    fork.mockClear();
    cacheArtwork.mockClear();
    jest.restoreAllMocks();
  });

  it('caches worker cover bytes with Electron and returns the id before accepting done', async () => {
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    const { default: scanLibraryRootOffThread } =
      await import('../../../main/library/scanHost');
    const onTracks = jest.fn();
    const onUnchanged = jest.fn();
    const options: IScanOptions = {
      rootId: 'music-root',
      rootPath: 'C:\\Music',
      userDataDir: 'C:\\FluidEQ',
      lookupKnown: () => undefined,
      force: true,
      onProgress: () => undefined,
      onTracks,
      onUnchanged,
      isCancelled: () => false,
    };

    const resultPromise = scanLibraryRootOffThread(options);
    // The walk is told to re-read everything and nothing else about the
    // library: the worker asks the store itself, one path at a time.
    expect(child.postMessage).toHaveBeenCalledWith({
      type: 'scan',
      rootId: 'music-root',
      rootPath: 'C:\\Music',
      userDataDir: 'C:\\FluidEQ',
      force: true,
    });
    const bytes = new Uint8Array([4, 5, 6]);
    childListeners.get('message')?.({
      type: 'store-artwork',
      requestId: 7,
      bytes,
    } satisfies IScanWorkerResponse);
    await flushMessages();

    expect(cacheArtwork).toHaveBeenCalledWith('C:\\FluidEQ', bytes);
    expect(child.postMessage).toHaveBeenCalledWith({
      type: 'artwork-stored',
      requestId: 7,
      artId: 'abc123',
    });

    // A batch keeps whether it was read or only listed, and the files found
    // unchanged arrive as ids.
    childListeners.get('message')?.({
      type: 'tracks',
      tracks: [],
      confirmed: true,
    } satisfies IScanWorkerResponse);
    childListeners.get('message')?.({
      type: 'unchanged',
      ids: ['a', 'b'],
    } satisfies IScanWorkerResponse);
    expect(onTracks).toHaveBeenCalledWith([], true);
    expect(onUnchanged).toHaveBeenCalledWith(['a', 'b']);

    childListeners.get('message')?.({
      type: 'done',
      found: 2,
      karaokeSkipped: 0,
      wasCancelled: false,
    } satisfies IScanWorkerResponse);
    await expect(resultPromise).resolves.toEqual({
      found: 2,
      karaokeSkipped: 0,
      wasCancelled: false,
    });
    expect(child.kill).toHaveBeenCalled();
  });
});
