/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Library's side of main, for renderer tests: a real store in a folder
 * of its own, answering the window's questions exactly as main does.
 *
 * Not a hand-written fake of the answers. Every list the Library draws is a
 * query the store runs — grouping, search, order, where folder headings
 * stand, which letter starts where — and a fake that answered those from an
 * array would be a second implementation to keep in step with the first,
 * passing whenever the two agreed with each other and not with the app.
 * Here the window asks and main's own code answers, through the same guard
 * `ipc/library.ts` puts on the channel.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import type {
  ILibraryAnswers,
  ILibrarySummary,
  TLibraryRequest,
} from '../../common/library/query';
import type {
  ILibraryRoot,
  ILibraryScanProgress,
  ILibraryTrack,
} from '../../common/library/types';
import { createLibraryQueries } from '../../main/library/libraryQuery';
import parseLibraryRequest from '../../main/library/libraryRequestGuard';
import type { ILibraryStore } from '../../main/library/libraryStore';
import { openLibraryStore } from '../../main/library/libraryStoreOpen';

type TIpcRenderer = Window['electron']['ipcRenderer'];

/** The channels the Library reads the store through. */
export type TLibraryStoreChannels = Pick<
  TIpcRenderer,
  | 'getLibrarySummary'
  | 'queryLibrary'
  | 'onLibraryChanged'
  | 'onLibraryScanProgress'
>;

export interface ILibraryStoreBridge {
  /** The store itself, for a test to change the library under the window. */
  readonly store: ILibraryStore;
  /** What `library-summary-get` answers right now. */
  readonly summary: () => ILibrarySummary;
  readonly channels: TLibraryStoreChannels;
  /** Tells the window the library changed, as main does after every write.
   * Wrap it in `act`: it sets state in whatever is listening. */
  readonly announce: () => void;
  /** A scan's progress, as main sends it. Wrap it in `act` too. */
  readonly sendProgress: (progress: ILibraryScanProgress) => void;
  /** Closes the store and removes its folder. Unmount first. */
  readonly close: () => void;
}

/** A root, with the counts a fresh one starts at. */
export const libraryRoot = (id: string, rootPath: string): ILibraryRoot => ({
  id,
  path: rootPath,
  addedAt: 1,
  trackCount: 0,
  karaokeSkipped: 0,
});

/**
 * A song with only what a test names about it. Its id is its title unless
 * one is given, so a test can say which song it means by what is on screen.
 */
export const libraryTrack = (
  over: Partial<ILibraryTrack> & { title: string },
): ILibraryTrack => ({
  id: over.title,
  rootId: 'r1',
  path: `C:\\Music\\${over.title}.mp3`,
  kind: 'audio',
  isPlayable: true,
  sizeBytes: 1,
  mtimeMs: 1,
  addedAt: 1,
  ...over,
});

/**
 * A store holding `roots` and `tracks`, and the channels that read it. The
 * roots default to one, `r1` at `C:\Music`, which is where `libraryTrack`
 * puts a song.
 */
export const openLibraryStoreBridge = ({
  roots = [libraryRoot('r1', 'C:\\Music')],
  tracks = [],
}: {
  roots?: readonly ILibraryRoot[];
  tracks?: readonly ILibraryTrack[];
} = {}): ILibraryStoreBridge => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-library-view-'));
  const { store, wasReset } = openLibraryStore(dir);
  store.addRoots(roots);
  store.upsertTracks(tracks, 0);
  const queries = createLibraryQueries(store);
  const changeListeners = new Set<(summary: ILibrarySummary) => void>();
  const progressListeners = new Set<(progress: ILibraryScanProgress) => void>();
  let isClosed = false;

  const summary = (): ILibrarySummary => ({
    version: store.version(),
    roots: store.roots(),
    trackCount: store.trackCount(),
    videoCount: store.videoCount(),
    wasReset,
  });

  const queryLibrary = <R extends TLibraryRequest>(
    request: R,
  ): Promise<ILibraryAnswers[R['type']]> =>
    // A promise around the whole answer, so a question main would refuse —
    // or one asked after the store closed — rejects the way `invoke` does
    // instead of throwing inside the component that asked.
    new Promise((resolve) => {
      if (isClosed) {
        throw new Error('The library store is closed');
      }
      const parsed = parseLibraryRequest(request);
      if (parsed === undefined) {
        throw new Error('Not a library question');
      }
      // `answer` is typed over every question at once; the one asked is the
      // one `R` names, which is what `ipcRenderer.queryLibrary` promises.
      resolve(queries.answer(parsed) as ILibraryAnswers[R['type']]);
    });

  const channels: TLibraryStoreChannels = {
    getLibrarySummary: () => Promise.resolve(summary()),
    queryLibrary,
    onLibraryChanged: (listener) => {
      changeListeners.add(listener);
      return () => {
        changeListeners.delete(listener);
      };
    },
    onLibraryScanProgress: (listener) => {
      progressListeners.add(listener);
      return () => {
        progressListeners.delete(listener);
      };
    },
  };

  return {
    store,
    summary,
    channels,
    announce: () => {
      const next = summary();
      changeListeners.forEach((listener) => listener(next));
    },
    sendProgress: (progress) => {
      progressListeners.forEach((listener) => listener(progress));
    },
    close: () => {
      isClosed = true;
      store.close();
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
};

/**
 * Puts these channels where the window looks for them. The rest of the
 * bridge is left out on purpose: a component reaching for a channel the test
 * did not expect fails loudly instead of being answered by a stub.
 */
export const installIpcRenderer = (channels: Partial<TIpcRenderer>): void => {
  window.electron = {
    ipcRenderer: channels,
  } as unknown as Window['electron'];
};
