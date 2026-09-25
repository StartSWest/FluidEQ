/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import fs from 'fs';
import type { ILibraryTrack } from '../../../common/library/types';
import type {
  IScanOptions,
  IScanResult,
} from '../../../main/library/libraryScanner';
import type {
  IScanWorkerRequest,
  IScanWorkerResponse,
} from '../../../main/library/scanWorkerProtocol';

type TChildEvent = 'message' | 'exit';
type TChildListener = (message?: unknown) => void;

const childListeners = new Map<TChildEvent, TChildListener>();
const child = {
  on: jest.fn((event: TChildEvent, listener: TChildListener) => {
    childListeners.set(event, listener);
  }),
  postMessage: jest.fn<void, [IScanWorkerRequest]>(),
  kill: jest.fn(),
};
const fork = jest.fn(() => child);
const scanInProcess = jest.fn<Promise<IScanResult>, [IScanOptions]>(
  async () => ({ tracks: [], karaokeSkipped: 0, wasCancelled: false }),
);

jest.mock('electron', () => ({
  app: { isPackaged: true },
  utilityProcess: { fork },
}));
jest.mock('../../../main/library/libraryArtwork', () => ({
  storeArtwork: () => Promise.resolve(undefined),
}));
jest.mock('../../../main/library/libraryScanner', () => ({
  scanLibraryRoot: (options: IScanOptions) => scanInProcess(options),
}));

const track = (
  name: string,
  over: Partial<ILibraryTrack> = {},
): ILibraryTrack => ({
  id: `id-${name}`,
  rootId: 'music-root',
  path: `C:\\Music\\${name}.flac`,
  kind: 'audio',
  isPlayable: true,
  title: name,
  artist: 'Somebody',
  album: 'Something',
  artId: `art-${name}`,
  artworkChecked: true,
  sizeBytes: 100,
  mtimeMs: 200,
  addedAt: 300,
  normalization: { version: 2, truePeakDbtp: -1, integratedLufs: -9 },
  ...over,
});

/** Starts a scan; by the time this settles the worker has been sent it. */
const startScan = async (
  overrides: Partial<IScanOptions> = {},
): Promise<{ result: Promise<IScanResult> }> => {
  jest.spyOn(fs, 'existsSync').mockReturnValue(true);
  const { default: scanLibraryRootOffThread } =
    await import('../../../main/library/scanHost');
  return {
    result: scanLibraryRootOffThread({
      rootId: 'music-root',
      rootPath: 'C:\\Music',
      userDataDir: 'C:\\FluidEQ',
      known: [],
      onProgress: () => undefined,
      isCancelled: () => false,
      ...overrides,
    }),
  };
};

const answer = (message: IScanWorkerResponse) =>
  childListeners.get('message')?.(message);

describe('what the library scan host sends its worker, and takes back', () => {
  afterEach(() => {
    childListeners.clear();
    child.on.mockClear();
    child.postMessage.mockClear();
    child.kill.mockClear();
    fork.mockClear();
    scanInProcess.mockClear();
    jest.restoreAllMocks();
    // A worker that failed makes the module scan in-process from then on.
    jest.resetModules();
  });

  it('sends only what a walk reads of each known track, and puts its own tracks back where the worker names them', async () => {
    const kept = track('Kept');
    const alsoKept = track('Also kept');
    const scanning = await startScan({ known: [kept, alsoKept] });
    const [request] = child.postMessage.mock.calls[0];
    expect(request).toEqual({
      type: 'scan',
      rootId: 'music-root',
      rootPath: 'C:\\Music',
      userDataDir: 'C:\\FluidEQ',
      known: [kept, alsoKept].map((known) => ({
        path: known.path,
        sizeBytes: known.sizeBytes,
        mtimeMs: known.mtimeMs,
        artId: known.artId,
        artworkChecked: known.artworkChecked,
        addedAt: known.addedAt,
      })),
    });

    const read = track('New', { normalization: undefined });
    answer({
      type: 'done',
      tracks: [read],
      knownAt: [1, -1, 0],
      karaokeSkipped: 2,
      wasCancelled: false,
    });
    const result = await scanning.result;
    // The very objects main holds, so it can see nothing about them changed.
    expect(result.tracks[0]).toBe(alsoKept);
    expect(result.tracks[1]).toEqual(read);
    expect(result.tracks[2]).toBe(kept);
    expect(result.karaokeSkipped).toBe(2);
    expect(scanInProcess).not.toHaveBeenCalled();
  });

  it('scans in-process instead when the worker names a track it was never sent', async () => {
    const scanning = await startScan({ known: [track('Only')] });
    answer({
      type: 'done',
      tracks: [],
      knownAt: [0, 4],
      karaokeSkipped: 0,
      wasCancelled: false,
    });
    await scanning.result;
    expect(scanInProcess).toHaveBeenCalledTimes(1);
  });

  it('tells the worker to stop the moment the scan is cancelled, without waiting for it to speak', async () => {
    const abort = new AbortController();
    const scanning = await startScan({
      isCancelled: () => abort.signal.aborted,
      signal: abort.signal,
    });
    expect(child.postMessage).toHaveBeenCalledTimes(1);
    abort.abort();
    expect(child.postMessage).toHaveBeenLastCalledWith({ type: 'cancel' });

    answer({
      type: 'done',
      tracks: [],
      karaokeSkipped: 0,
      wasCancelled: true,
    });
    await expect(scanning.result).resolves.toMatchObject({
      wasCancelled: true,
    });
  });
});
