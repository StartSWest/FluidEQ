/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { ILibraryTrack } from '../../../common/library/types';
import { IScanOptions } from '../../../main/library/libraryScanner';
import {
  IScanWorkerRequest,
  IScanWorkerResponse,
} from '../../../main/library/scanWorkerProtocol';

const scanLibraryRoot = jest.fn<Promise<unknown>, [IScanOptions]>();

jest.mock('../../../main/library/libraryScanner', () => ({
  scanLibraryRoot: (options: IScanOptions) => scanLibraryRoot(options),
}));

/** The store as the worker reads it: one path at a time, and closed after. */
const readerClose = jest.fn();
const trackByPath = jest.fn<ILibraryTrack | undefined, [string]>(
  () => undefined,
);
jest.mock('../../../main/library/libraryStoreOpen', () => ({
  openLibraryReader: () => ({
    trackByPath: (filePath: string) => trackByPath(filePath),
    close: () => readerClose(),
  }),
}));

interface IFakeParentPort {
  postMessage: jest.Mock<void, [unknown]>;
  on: jest.Mock<
    void,
    ['message', (event: { data: IScanWorkerRequest }) => void]
  >;
}

const utilityProcess = process as unknown as {
  parentPort?: IFakeParentPort;
};

const flushMessages = (): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, 0);
  });

describe('the packaged library scan worker', () => {
  afterEach(() => {
    delete utilityProcess.parentPort;
    scanLibraryRoot.mockReset();
    jest.resetModules();
  });

  it('round-trips raw cover bytes through the Electron host before returning the track', async () => {
    let receive: ((event: { data: IScanWorkerRequest }) => void) | undefined;
    const port: IFakeParentPort = {
      postMessage: jest.fn(),
      on: jest.fn((_event, listener) => {
        receive = listener;
      }),
    };
    utilityProcess.parentPort = port;
    const bytes = new Uint8Array([9, 8, 7]);
    scanLibraryRoot.mockImplementation(async (options) => {
      const [artId, duplicateArtId] = await Promise.all([
        options.storeArtwork?.(bytes),
        options.storeArtwork?.(new Uint8Array(bytes)),
      ]);
      expect(duplicateArtId).toBe(artId);
      const track: ILibraryTrack = {
        id: 'track1',
        rootId: options.rootId,
        path: 'C:\\Music\\Covered.mp3',
        kind: 'audio',
        isPlayable: true,
        title: 'Covered',
        artId,
        artworkChecked: true,
        sizeBytes: 3,
        mtimeMs: 4,
        addedAt: 5,
      };
      // What the store already holds is asked of it, path by path.
      options.lookupKnown('C:\\Music\\Covered.mp3');
      options.onTracks?.([track], true);
      return {
        found: 1,
        karaokeSkipped: 0,
        wasCancelled: false,
      };
    });

    jest.isolateModules(() => {
      jest.requireActual('../../../main/library/scanWorker');
    });
    receive?.({
      data: {
        type: 'scan',
        rootId: 'music-root',
        rootPath: 'C:\\Music',
        userDataDir: 'C:\\FluidEQ',
        force: false,
      },
    });
    await flushMessages();

    const storeRequest = port.postMessage.mock.calls
      .map(([message]) => message as IScanWorkerResponse)
      .find((message) => message.type === 'store-artwork');
    expect(storeRequest).toEqual({
      type: 'store-artwork',
      requestId: 1,
      bytes,
    });
    expect(
      port.postMessage.mock.calls.filter(
        ([message]) =>
          (message as IScanWorkerResponse).type === 'store-artwork',
      ),
    ).toHaveLength(1);

    receive?.({
      data: { type: 'artwork-stored', requestId: 1, artId: 'abc123' },
    });
    await flushMessages();

    expect(port.postMessage).toHaveBeenCalledWith({
      type: 'tracks',
      tracks: [expect.objectContaining({ artId: 'abc123' })],
      confirmed: true,
    });
    expect(port.postMessage).toHaveBeenCalledWith({
      type: 'done',
      found: 1,
      karaokeSkipped: 0,
      wasCancelled: false,
    });
    expect(trackByPath).toHaveBeenCalledWith('C:\\Music\\Covered.mp3');
    expect(readerClose).toHaveBeenCalled();
  });
});
