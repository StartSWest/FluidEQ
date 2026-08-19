const handlers = new Map<string, (...args: unknown[]) => unknown>();
// Typed to take (...unknown[]) rather than the brief's zero-arg form: TS
// infers a jest.fn's call signature from its implementation's own parameter
// list, and a zero-arg implementation makes the mock's signature a strict
// empty tuple -- which the factory below cannot spread `args` into (TS2556)
// under this project's TypeScript version. Runtime behaviour is identical.
const showOpenDialog = jest.fn((..._args: unknown[]) =>
  Promise.resolve({ canceled: false, filePaths: ['C:\\Music'] }),
);
jest.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, fn: (...args: unknown[]) => unknown) =>
      handlers.set(channel, fn),
    on: (channel: string, fn: (...args: unknown[]) => unknown) =>
      handlers.set(channel, fn),
  },
  dialog: { showOpenDialog: (...args: unknown[]) => showOpenDialog(...args) },
  shell: { showItemInFolder: jest.fn() },
}));

// The scanner does real filesystem work `readdir`/tag-reading this suite has
// no reason to exercise (that's `libraryScanner.test.ts`'s job); mocked here
// so the mid-scan-add test below can control exactly when each root's walk
// resolves, deterministically, instead of racing real disk I/O.
const scanLibraryRoot = jest.fn<Promise<IScanResult>, [options: IScanOptions]>(
  () => Promise.resolve({ tracks: [], karaokeSkipped: 0, wasCancelled: false }),
);
jest.mock('../../../main/library/libraryScanner', () => ({
  scanLibraryRoot: (options: IScanOptions) => scanLibraryRoot(options),
}));

// eslint-disable-next-line import/first -- the mocks must be installed first
import fs from 'fs';
// eslint-disable-next-line import/first
import os from 'os';
// eslint-disable-next-line import/first
import path from 'path';
// eslint-disable-next-line import/first
import type { BrowserWindow } from 'electron';
// eslint-disable-next-line import/first
import { registerLibraryIpc } from '../../../main/ipc/library';
// eslint-disable-next-line import/first
import type {
  IScanOptions,
  IScanResult,
} from '../../../main/library/libraryScanner';

/** A fresh, real, writable directory `saveLibraryIndex` can write into. */
const tempDir = (prefix: string): string =>
  fs.mkdtempSync(path.join(os.tmpdir(), prefix));

/**
 * A stand-in for the one method these handlers actually call on the window --
 * cast rather than shaped to the full `BrowserWindow` interface, which this
 * suite has no reason to implement.
 */
const silentWindow = (): BrowserWindow =>
  ({
    isVisible: () => true,
    once: () => undefined,
    webContents: { send: () => undefined },
  }) as unknown as BrowserWindow;

/**
 * Polls `predicate` until it is true.
 *
 * `library-root-add-paths` returns as soon as a root is added, before its
 * scan finishes -- that is the whole point of the fire-and-forget design (see
 * `addRootsAndScan`'s own comment) -- so a caller cannot `await` its way to
 * "the scan is done." This polls the one thing that is actually true only
 * once every queued root has been drained and merged in.
 */
const waitFor = async (
  predicate: () => boolean,
  timeoutMs = 2000,
): Promise<void> => {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error('Timed out waiting for the scan to settle');
    }
    // eslint-disable-next-line no-await-in-loop -- polling by design in a test helper.
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 5);
    });
  }
};

beforeEach(() => {
  scanLibraryRoot.mockReset();
  scanLibraryRoot.mockImplementation(() =>
    Promise.resolve({ tracks: [], karaokeSkipped: 0, wasCancelled: false }),
  );
});

describe('the library channels', () => {
  it('registers every channel the renderer will call', () => {
    registerLibraryIpc({ userDataDir: 'C:\\Data', getMainWindow: () => null });
    [
      'library-index-get',
      'library-root-add',
      'library-root-add-paths',
      'library-root-remove',
      'library-scan-start',
      'library-scan-cancel',
      'library-reveal',
    ].forEach((channel) => expect(handlers.has(channel)).toBe(true));
  });

  it('refuses a dropped path that is not a directory', async () => {
    // The one channel that takes a path inwards. It may add a root and
    // nothing else, so a file — or a path that does not exist — is refused
    // rather than added and scanned.
    registerLibraryIpc({ userDataDir: 'C:\\Data', getMainWindow: () => null });
    const handler = handlers.get('library-root-add-paths');
    const index = await handler?.({}, ['C:\\Windows\\notepad.exe']);
    expect(index).toMatchObject({ roots: [] });
  });

  it('accepts a real directory, right beside the refusal above', async () => {
    // The positive control the refusal test needs: proof the same handler,
    // given a real folder instead of a bad path, actually adds it. Without
    // this, "refuses a bad path" would pass identically whether the handler
    // correctly refuses only bad paths, or wrongly refuses every path.
    const userDataDir = tempDir('fluideq-lib-data-');
    const goodDir = tempDir('fluideq-lib-good-');
    registerLibraryIpc({ userDataDir, getMainWindow: () => null });
    const handler = handlers.get('library-root-add-paths');
    const index = (await handler?.({}, [goodDir])) as {
      roots: Array<{ path: string }>;
    };
    expect(index.roots).toHaveLength(1);
    expect(index.roots[0].path).toBe(goodDir);
  });
});

describe('a root added while another is already scanning', () => {
  it('is queued and still ends up with its tracks, not left empty', async () => {
    // Reproduces the bug directly: root A's walk is still in flight (held
    // open by an unresolved mock) when root B is dropped. If B's request were
    // silently no-op'd by the busy guard, as it was before this fix, B would
    // settle at zero tracks with nothing left in the session to rescan it.
    const userDataDir = tempDir('fluideq-lib-data-');
    const dirA = tempDir('fluideq-lib-a-');
    const dirB = tempDir('fluideq-lib-b-');

    let dropSecondRootWhileFirstIsScanning:
      (() => Promise<unknown>) | undefined;

    scanLibraryRoot.mockImplementation(
      async (options: IScanOptions): Promise<IScanResult> => {
        if (options.rootPath === dirA && dropSecondRootWhileFirstIsScanning) {
          // Runs synchronously inside A's still-pending scan call, before
          // this mock returns -- i.e. while `isScanning` is still true --
          // reproducing "drop a folder while a scan is running" exactly.
          const drop = dropSecondRootWhileFirstIsScanning;
          dropSecondRootWhileFirstIsScanning = undefined;
          await drop();
        }
        const isA = options.rootPath === dirA;
        return {
          tracks: [
            {
              id: isA ? 'track-a' : 'track-b',
              rootId: options.rootId,
              path: path.join(options.rootPath, isA ? 'a.mp3' : 'b.mp3'),
              kind: 'audio' as const,
              isPlayable: true,
              title: isA ? 'A' : 'B',
              sizeBytes: 1,
              mtimeMs: 1,
              addedAt: 1,
            },
          ],
          karaokeSkipped: 0,
          wasCancelled: false,
        };
      },
    );

    registerLibraryIpc({ userDataDir, getMainWindow: silentWindow });
    const addPaths = handlers.get('library-root-add-paths');
    const indexGet = handlers.get('library-index-get');

    const readIndex = () =>
      indexGet?.({}) as {
        index: { roots: Array<{ path: string; trackCount: number }> };
      };

    dropSecondRootWhileFirstIsScanning = () =>
      Promise.resolve(addPaths?.({}, [dirB]));

    // Returns as soon as A is added and its scan is started -- B gets queued
    // moments later, from inside A's still-pending mocked scan call, not from
    // this line.
    const afterAddingA = await addPaths?.({}, [dirA]);
    expect(afterAddingA).toMatchObject({
      roots: [{ path: dirA }, { path: dirB }],
    });

    // Both scans, A's and B's queued one, are driven by the same
    // `performScan` call and need no real I/O or timers to complete -- this
    // just gives their microtask chain room to run rather than asserting
    // against a fixed tick count.
    await waitFor(() => {
      const root = readIndex().index.roots.find((entry) => entry.path === dirB);
      return root !== undefined && root.trackCount > 0;
    });

    const final = readIndex();
    const rootB = final.index.roots.find((root) => root.path === dirB);
    expect(rootB?.trackCount).toBe(1);
    const rootA = final.index.roots.find((root) => root.path === dirA);
    expect(rootA?.trackCount).toBe(1);
  });
});
