/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ILibraryTrack } from '../../../common/library/types';
import type {
  IKnownTrack,
  IScanOptions,
  IScanResult,
} from '../../../main/library/libraryScanner';
import type {
  IScanWorkerRequest,
  IScanWorkerResponse,
} from '../../../main/library/scanWorkerProtocol';

const scanLibraryRoot = jest.fn<
  Promise<IScanResult<IKnownTrack>>,
  [IScanOptions<IKnownTrack>]
>();

jest.mock('../../../main/library/libraryScanner', () => ({
  scanLibraryRoot: (options: IScanOptions<IKnownTrack>) =>
    scanLibraryRoot(options),
}));

interface IFakeParentPort {
  postMessage: jest.Mock<void, [IScanWorkerResponse]>;
  on: jest.Mock<
    void,
    ['message', (event: { data: IScanWorkerRequest }) => void]
  >;
}

const utilityProcess = process as unknown as {
  parentPort?: IFakeParentPort;
};

const known = (name: string): IKnownTrack => ({
  path: `C:\\Music\\${name}.flac`,
  sizeBytes: 1,
  mtimeMs: 2,
  artId: `art-${name}`,
  artworkChecked: true,
  addedAt: 3,
});

const read: ILibraryTrack = {
  id: 'new',
  rootId: 'music-root',
  path: 'C:\\Music\\New.flac',
  kind: 'audio',
  isPlayable: true,
  title: 'New',
  sizeBytes: 4,
  mtimeMs: 5,
  addedAt: 6,
};

/** Runs one scan request through the worker and hands back its last word. */
const scanInWorker = async (
  request: Extract<IScanWorkerRequest, { type: 'scan' }>,
): Promise<IScanWorkerResponse[]> => {
  let receive: ((event: { data: IScanWorkerRequest }) => void) | undefined;
  let finished: () => void = () => undefined;
  const done = new Promise<void>((resolve) => {
    finished = resolve;
  });
  const port: IFakeParentPort = {
    postMessage: jest.fn((message: IScanWorkerResponse) => {
      if (message.type === 'done' || message.type === 'failed') {
        finished();
      }
    }),
    on: jest.fn((_event, listener) => {
      receive = listener;
    }),
  };
  utilityProcess.parentPort = port;
  jest.isolateModules(() => {
    jest.requireActual('../../../main/library/scanWorker');
  });
  receive?.({ data: request });
  await done;
  return port.postMessage.mock.calls.map(([message]) => message);
};

describe('what the library scan worker answers', () => {
  afterEach(() => {
    delete utilityProcess.parentPort;
    scanLibraryRoot.mockReset();
  });

  it('names a known track carried forward by its place in the request, and sends only what it read', async () => {
    const first = known('First');
    const second = known('Second');
    // The walk hands known tracks back as the objects it was given.
    scanLibraryRoot.mockImplementation(async (options) => ({
      tracks: [options.known[1], read, options.known[0]],
      karaokeSkipped: 0,
      wasCancelled: false,
    }));
    const messages = await scanInWorker({
      type: 'scan',
      rootId: 'music-root',
      rootPath: 'C:\\Music',
      userDataDir: 'C:\\FluidEQ',
      known: [first, second],
    });
    expect(messages[messages.length - 1]).toEqual({
      type: 'done',
      tracks: [read],
      knownAt: [1, -1, 0],
      karaokeSkipped: 0,
      wasCancelled: false,
    });
  });

  it('carries a share of the walk’s per-file reports, and always its last', async () => {
    scanLibraryRoot.mockImplementation(async (options) => {
      for (let parsed = 1; parsed <= 1000; parsed += 1) {
        options.onProgress({
          rootId: 'music-root',
          seen: 1000,
          parsed,
          karaokeSkipped: 0,
          current: `${parsed}.flac`,
          isDone: false,
        });
      }
      options.onProgress({
        rootId: 'music-root',
        seen: 1000,
        parsed: 1000,
        karaokeSkipped: 0,
        isDone: true,
      });
      return { tracks: [], karaokeSkipped: 0, wasCancelled: false };
    });
    const messages = await scanInWorker({
      type: 'scan',
      rootId: 'music-root',
      rootPath: 'C:\\Music',
      userDataDir: 'C:\\FluidEQ',
      known: [],
    });
    const progress = messages.flatMap((message) =>
      message.type === 'progress' ? [message.progress] : [],
    );
    expect(progress.length).toBeGreaterThan(0);
    expect(progress.length).toBeLessThan(1001 / 5);
    expect(progress[progress.length - 1].isDone).toBe(true);
    // The last word before `done` is the report that takes the strip off.
    expect(messages[messages.length - 2]).toMatchObject({
      type: 'progress',
      progress: { isDone: true },
    });
  });
});
