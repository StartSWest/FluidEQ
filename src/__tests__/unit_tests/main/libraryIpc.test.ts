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

// The walk itself -- `readdir`, tags, artwork -- is `libraryScanner.test.ts`'s
// job. Mocked here so each test says exactly what a walk finds and when it
// returns, deterministically, instead of racing real disk I/O. Outside a real
// Electron main process the scan host has no worker to start, so every walk
// comes straight here (`scanHost.ts`).
const scanLibraryRoot = jest.fn<Promise<IScanResult>, [options: IScanOptions]>(
  () => Promise.resolve({ found: 0, karaokeSkipped: 0, wasCancelled: false }),
);
jest.mock('../../../main/library/libraryScanner', () => ({
  scanLibraryRoot: (options: IScanOptions) => scanLibraryRoot(options),
}));

/**
 * Every walk the channels start, as the runner itself hands it out.
 *
 * A walk runs behind the channel that started it -- a folder added answers
 * before its walk is done, which is the whole point of `addRootsAndScan` --
 * and the channel drops the promise the runner gives it. That promise is the
 * one signal that the walk, its sweep and its counts are all over, so the
 * real runner is wrapped to keep it; nothing about what it does changes.
 */
const walks: Promise<void>[] = [];
jest.mock('../../../main/library/libraryScanRunner', () => {
  const actual = jest.requireActual<
    typeof import('../../../main/library/libraryScanRunner')
  >('../../../main/library/libraryScanRunner');
  const kept = (walk: Promise<void>): Promise<void> => {
    walks.push(walk);
    return walk;
  };
  return {
    createLibraryScanRunner: (
      deps: ILibraryScanRunnerDeps,
    ): ILibraryScanRunner => {
      const runner = actual.createLibraryScanRunner(deps);
      return {
        ...runner,
        request: (rootIds) => kept(runner.request(rootIds)),
        rescanAll: (force) => kept(runner.rescanAll(force)),
      };
    },
  };
});

// eslint-disable-next-line import/first -- the mocks must be installed first
import fs from 'fs';
// eslint-disable-next-line import/first
import os from 'os';
// eslint-disable-next-line import/first
import path from 'path';
// eslint-disable-next-line import/first
import type { BrowserWindow } from 'electron';
// eslint-disable-next-line import/first
import type { ILibrarySummary } from '../../../common/library/query';
// eslint-disable-next-line import/first
import type {
  ILibraryScanProgress,
  ILibraryTrack,
} from '../../../common/library/types';
// eslint-disable-next-line import/first
import { registerLibraryIpc } from '../../../main/ipc/library';
// eslint-disable-next-line import/first
import { trackIdForPath } from '../../../main/library/libraryScanDiscovery';
// eslint-disable-next-line import/first
import type {
  IScanOptions,
  IScanResult,
} from '../../../main/library/libraryScanner';
// eslint-disable-next-line import/first
import type {
  ILibraryScanRunner,
  ILibraryScanRunnerDeps,
} from '../../../main/library/libraryScanRunner';

/** A fresh, real, writable directory; the store is made in one of these. */
const tempDir = (prefix: string): string =>
  fs.mkdtempSync(path.join(os.tmpdir(), prefix));

const handler = (channel: string): ((...args: unknown[]) => unknown) => {
  const registered = handlers.get(channel);
  if (registered === undefined) {
    throw new Error(`Nothing is registered on ${channel}`);
  }
  return registered;
};

const summaryNow = (): ILibrarySummary =>
  handler('library-summary-get')({}) as ILibrarySummary;

/** Every walk started so far has finished, sweep and counts included. */
const walksDone = async (): Promise<void> => {
  await Promise.all(walks.splice(0));
};

/** What main sends the window, by channel. */
interface IWindowMessages {
  'library-changed': ILibrarySummary;
  'library-scan-progress': ILibraryScanProgress;
}

/** A window that keeps everything main sends it. */
const recordingWindow = () => {
  const sent: { channel: string; payload: unknown }[] = [];
  const window = {
    webContents: {
      send: (channel: string, payload: unknown) => {
        sent.push({ channel, payload });
      },
    },
  } as unknown as BrowserWindow;
  const received = <C extends keyof IWindowMessages>(
    channel: C,
  ): IWindowMessages[C][] =>
    sent
      .filter((message) => message.channel === channel)
      .map((message) => message.payload as IWindowMessages[C]);
  return { window, received };
};

const rootAt = (summary: ILibrarySummary, dir: string) =>
  summary.roots.find((root) => root.path === dir);

const JOINED = 12345;

/** A song the mocked walk finds in the root it is walking. */
const songIn = (options: IScanOptions): ILibraryTrack => {
  const filePath = path.join(options.rootPath, 'a.mp3');
  return {
    id: trackIdForPath(filePath),
    rootId: options.rootId,
    path: filePath,
    kind: 'audio',
    isPlayable: true,
    title: 'A',
    sizeBytes: 1,
    mtimeMs: 1,
    addedAt: JOINED,
  };
};

beforeEach(() => {
  scanLibraryRoot.mockReset();
  scanLibraryRoot.mockImplementation(() =>
    Promise.resolve({ found: 0, karaokeSkipped: 0, wasCancelled: false }),
  );
});

// A walk a test started and did not wait for would run on into the next one.
afterEach(walksDone);

describe('the library channels', () => {
  it('registers every channel the renderer will call', () => {
    registerLibraryIpc({
      userDataDir: tempDir('fluideq-lib-data-'),
      getMainWindow: () => null,
    });
    [
      'library-summary-get',
      'library-query',
      'library-root-add',
      'library-root-add-paths',
      'library-queue-files',
      'library-root-remove',
      'library-scan-start',
      'library-scan-force',
      'library-scan-cancel',
      'library-reveal',
      'library-track-bytes',
      'library-track-signature',
      'library-track-normalization-set',
    ].forEach((channel) => expect(handlers.has(channel)).toBe(true));
  });

  it('refuses a dropped path that is not a directory', () => {
    // The one channel that takes a folder inwards. It may add a root and
    // nothing else, so a file — or a path that does not exist — is refused
    // rather than added and scanned.
    registerLibraryIpc({
      userDataDir: tempDir('fluideq-lib-data-'),
      getMainWindow: () => null,
    });
    const file = path.join(tempDir('fluideq-lib-file-'), 'song.mp3');
    fs.writeFileSync(file, 'x');
    const summary = handler('library-root-add-paths')({}, [
      file,
      path.join(os.tmpdir(), 'fluideq-no-such-folder'),
    ]);
    expect(summary).toMatchObject({ roots: [] });
    expect(scanLibraryRoot).not.toHaveBeenCalled();
  });

  it('accepts a real directory, right beside the refusal above', async () => {
    // The positive control the refusal test needs: proof the same handler,
    // given a real folder instead of a bad path, actually adds it. Without
    // this, "refuses a bad path" would pass identically whether the handler
    // correctly refuses only bad paths, or wrongly refuses every path.
    const goodDir = tempDir('fluideq-lib-good-');
    registerLibraryIpc({
      userDataDir: tempDir('fluideq-lib-data-'),
      getMainWindow: () => null,
    });
    const summary = handler('library-root-add-paths')({}, [
      goodDir,
    ]) as ILibrarySummary;
    expect(summary.roots).toHaveLength(1);
    expect(summary.roots[0].path).toBe(goodDir);
    await walksDone();
    expect(scanLibraryRoot).toHaveBeenCalledTimes(1);
    expect(scanLibraryRoot.mock.calls[0][0].rootPath).toBe(goodDir);
  });
});

describe('a root added while another is already scanning', () => {
  it('is queued and still ends up with its tracks, not left empty', async () => {
    // Reproduces the bug directly: root A's walk is still in flight when root
    // B is dropped. If B's request were silently no-op'd by the busy guard,
    // as it was before this fix, B would settle at zero tracks with nothing
    // left in the session to rescan it.
    const dirA = tempDir('fluideq-lib-a-');
    const dirB = tempDir('fluideq-lib-b-');
    registerLibraryIpc({
      userDataDir: tempDir('fluideq-lib-data-'),
      getMainWindow: () => null,
    });

    scanLibraryRoot.mockImplementation(async (options) => {
      if (options.rootPath === dirA) {
        // Dropped from inside A's still-pending walk, before it returns --
        // "drop a folder while a scan is running" exactly.
        await handler('library-root-add-paths')({}, [dirB]);
      }
      options.onTracks?.([songIn(options)], true);
      return { found: 1, karaokeSkipped: 0, wasCancelled: false };
    });

    // Returns as soon as A is added. Its walk begins a moment later -- the
    // scanner is loaded on first use (`scanHost.ts`) -- and B is added from
    // inside it, not from this line.
    const afterAddingA = handler('library-root-add-paths')({}, [dirA]);
    expect(afterAddingA).toMatchObject({ roots: [{ path: dirA }] });

    await walksDone();
    const final = summaryNow();
    expect(final.roots.map((root) => root.path)).toEqual([dirA, dirB]);
    expect(rootAt(final, dirA)?.trackCount).toBe(1);
    expect(rootAt(final, dirB)?.trackCount).toBe(1);
    expect(final.trackCount).toBe(2);
    // One walk at a time: B's waited for A's to finish.
    expect(
      scanLibraryRoot.mock.calls.map(([options]) => options.rootPath),
    ).toEqual([dirA, dirB]);
  });
});

describe('forcing a rescan (follow-up 7)', () => {
  it('asks the walk to re-read every file even though nothing changed, still telling it what each one is', async () => {
    // An unchanged file is trusted forever -- its cached `artId` included,
    // which `storeArtwork` answers on a bare `existsSync`. If
    // `userData/library-art` is ever cleared from outside the app, an
    // ordinary rescan cannot notice or repair it; a forced one is the only
    // path that makes the walk read every file again. It used to be done by
    // handing the walk no known tracks at all, which also lost every song's
    // day of joining: the walk is still told what the store has.
    const dir = tempDir('fluideq-lib-force-');
    registerLibraryIpc({
      userDataDir: tempDir('fluideq-lib-data-'),
      getMainWindow: () => null,
    });

    const asked: { force: boolean; known: ILibraryTrack | undefined }[] = [];
    scanLibraryRoot.mockImplementation(async (options) => {
      const song = songIn(options);
      asked.push({
        force: options.force,
        known: options.lookupKnown(song.path),
      });
      options.onTracks?.([song], true);
      return { found: 1, karaokeSkipped: 0, wasCancelled: false };
    });

    handler('library-root-add-paths')({}, [dir]);
    await walksDone();
    // The positive control: an ordinary rescan is not a forced one.
    await handler('library-scan-start')({});
    await walksDone();
    await handler('library-scan-force')({});
    await walksDone();

    expect(asked.map((entry) => entry.force)).toEqual([false, false, true]);
    expect(asked[0].known).toBeUndefined();
    expect(asked[2].known).toMatchObject({
      path: path.join(dir, 'a.mp3'),
      addedAt: JOINED,
    });
  });
});

describe('publishing tracks mid-scan', () => {
  it('writes a batch into the store and tells the window before the walk finishes', async () => {
    // The mocked walk publishes and then looks, all before it returns -- so
    // what it sees is the batch alone, not the runner's end-of-walk write.
    const win = recordingWindow();
    const dir = tempDir('fluideq-lib-mid-');
    registerLibraryIpc({
      userDataDir: tempDir('fluideq-lib-data-'),
      getMainWindow: () => win.window,
    });

    let changesSentMidWalk = 0;
    let answeredMidWalk: unknown;
    scanLibraryRoot.mockImplementation(async (options) => {
      const song = songIn(options);
      options.onTracks?.([song], true);
      changesSentMidWalk = win.received('library-changed').length;
      answeredMidWalk = await handler('library-query')(
        {},
        { type: 'tracks', ids: [song.id] },
      );
      return { found: 1, karaokeSkipped: 0, wasCancelled: false };
    });

    handler('library-root-add-paths')({}, [dir]);
    await walksDone();

    expect(changesSentMidWalk).toBe(1);
    // The summary, never the songs: the window asks for what it shows.
    expect(win.received('library-changed')[0]).toMatchObject({
      trackCount: 1,
    });
    expect(answeredMidWalk).toEqual([
      expect.objectContaining({ id: trackIdForPath(path.join(dir, 'a.mp3')) }),
    ]);
  });

  it('does not duplicate an existing track when a rescan republishes it mid-scan (invariant: upsert by id, not a concat)', async () => {
    const dir = tempDir('fluideq-lib-dup-');
    registerLibraryIpc({
      userDataDir: tempDir('fluideq-lib-data-'),
      getMainWindow: () => null,
    });

    const midWalkCounts: number[] = [];
    scanLibraryRoot.mockImplementation(async (options) => {
      options.onTracks?.([songIn(options)], true);
      // Read right after the batch and before the walk returns: the store as
      // the batch alone left it, with the first walk's copy still in it.
      midWalkCounts.push(summaryNow().trackCount);
      return { found: 1, karaokeSkipped: 0, wasCancelled: false };
    });

    handler('library-root-add-paths')({}, [dir]);
    await walksDone();
    await handler('library-scan-start')({});
    await walksDone();

    expect(midWalkCounts).toEqual([1, 1]);
    expect(summaryNow().trackCount).toBe(1);
  });
});

describe('a root scan that throws partway through (blocker 3)', () => {
  it('still emits a terminal progress event, instead of leaving the renderer scanning forever', async () => {
    // Reproduces the wedge directly: whatever broke the walk -- originally
    // the unguarded `fs.promises.stat` in libraryScanParse.ts, but this must
    // hold for *any* future throw in the chain -- is caught and logged.
    // `LibraryContext.tsx`'s `isScanning` is derived solely from the last
    // `progress.isDone` it received; with no event at all for this root, it
    // would stay "scanning" for the rest of the session: the strip pinned,
    // Rescan disabled, Stop inert.
    const win = recordingWindow();
    const dir = tempDir('fluideq-lib-throws-');
    registerLibraryIpc({
      userDataDir: tempDir('fluideq-lib-data-'),
      getMainWindow: () => win.window,
    });
    scanLibraryRoot.mockImplementation(() =>
      Promise.reject(new Error('ENOENT: vanished mid-scan')),
    );
    // The failure must be said, not swallowed; kept off the run's output only
    // so it is not mistaken for a failure of the test itself.
    const logged = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    try {
      const summary = handler('library-root-add-paths')({}, [
        dir,
      ]) as ILibrarySummary;
      await walksDone();

      const progress = win.received('library-scan-progress');
      expect(progress.length).toBeGreaterThan(0);
      expect(progress[progress.length - 1]).toMatchObject({
        rootId: summary.roots[0].id,
        isDone: true,
      });
      expect(logged).toHaveBeenCalledWith(
        `Could not scan library root ${dir}`,
        expect.objectContaining({ message: 'ENOENT: vanished mid-scan' }),
      );
    } finally {
      logged.mockRestore();
    }
  });
});
