/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { ILibrarySummary } from '../../common/library/query';
import type { ILibraryScanProgress } from '../../common/library/types';

const EMPTY_SUMMARY: ILibrarySummary = {
  version: -1,
  roots: [],
  trackCount: 0,
  videoCount: 0,
  wasReset: false,
};

interface ILibraryContextValue {
  /**
   * What the window holds of the library at all times: its folders, how many
   * songs it has, and the version everything else is read at. The songs
   * themselves are never here — every list asks for the page it draws
   * (`useLibraryList`), every lookup for the songs it names
   * (`useLibraryTracks`), and both ask again when `version` moves.
   */
  summary: ILibrarySummary;
  /**
   * Whether the first summary has come back.
   *
   * The difference between "no songs" and "not asked yet" for anything
   * drawing an empty state: a library that starts empty and fills a moment
   * later showed the "add a folder" panel to everybody with a library, every
   * time they opened the tab.
   */
  isIndexLoaded: boolean;
  isScanning: boolean;
  progress: ILibraryScanProgress | undefined;
  addFolder: () => Promise<void>;
  addFolderPaths: (paths: string[]) => Promise<void>;
  /**
   * Music files dropped straight onto a queue: they join the library and
   * their ids come back, in the order they were dropped, so the caller can
   * queue them in the same gesture. A file already known keeps its id.
   */
  queueFiles: (paths: string[]) => Promise<string[]>;
  rescan: () => Promise<void>;
  /** Re-reads every file whatever its size and time say — see
   * `forceRescanLibrary`'s own comment for why an ordinary rescan cannot
   * substitute for this. */
  forceRescan: () => Promise<void>;
  cancelScan: () => void;
  removeRoot: (rootId: string) => Promise<void>;
}

const LibraryContext = createContext<ILibraryContextValue | undefined>(
  undefined,
);

/**
 * The newer of two summaries. The window hears about a change twice — the
 * reply to its own request and the broadcast every change sends — and in no
 * guaranteed order, so the one read at the later version wins.
 */
const newer = (
  current: ILibrarySummary,
  next: ILibrarySummary,
): ILibrarySummary => (next.version >= current.version ? next : current);

/**
 * One context, not two.
 *
 * `LiveAudioContext` splits frame data from control state because the frame
 * arrives ~22 times a second and re-rendered every consumer that only cared
 * about start/stop. Scan progress here arrives per file, coalesced to a
 * frame, and the summary a few times a second at most — nowhere near frame
 * rate — so a single context is the simpler correct answer until a
 * measurement says otherwise.
 */
export const LibraryProvider = ({ children }: { children: ReactNode }) => {
  const [summary, setSummary] = useState<ILibrarySummary>(EMPTY_SUMMARY);
  const [isIndexLoaded, setIsIndexLoaded] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState<ILibraryScanProgress | undefined>(
    undefined,
  );

  const takeSummary = useCallback((next: ILibrarySummary) => {
    setSummary((current) => newer(current, next));
  }, []);

  useEffect(() => {
    let mounted = true;
    window.electron.ipcRenderer
      .getLibrarySummary()
      .then((result) => {
        if (mounted) {
          takeSummary(result);
          setIsIndexLoaded(true);
        }
        return undefined;
      })
      // Loaded on a failure too. The reply is how the interface learns there
      // is nothing to show; a rejection that left this false would leave the
      // tab spinning at a library that is never coming.
      .catch(() => {
        if (mounted) {
          setIsIndexLoaded(true);
        }
      });
    const unsubscribe = window.electron.ipcRenderer.onLibraryChanged((next) => {
      if (mounted) {
        takeSummary(next);
      }
    });
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [takeSummary]);

  useEffect(() => {
    // Progress arrives once per file — fifty a second on a warm cache — and
    // every one of them re-renders this provider and everything under it,
    // rows included. A strip that says "6,712 of 14,077" does not need fifty
    // updates a second to be read, so they are coalesced onto animation
    // frames: the newest is kept, the rest are dropped, and the browser
    // decides the rate.
    //
    // The terminal event is exempt. It is the one the renderer derives "still
    // scanning" from, and dropping it — or delivering it after a frame that
    // never comes because the tab is hidden — would pin the strip on forever.
    let queued: ILibraryScanProgress | undefined;
    let frame = 0;
    let isRunning = false;
    const flush = () => {
      frame = 0;
      if (queued) {
        setProgress(queued);
        setIsScanning(!queued.isDone);
        queued = undefined;
      }
    };
    const deliverNow = (next: ILibraryScanProgress) => {
      if (frame) {
        cancelAnimationFrame(frame);
        frame = 0;
      }
      queued = undefined;
      setProgress(next);
      setIsScanning(!next.isDone);
    };
    const unsubscribeProgress =
      window.electron.ipcRenderer.onLibraryScanProgress((next) => {
        // The first event of a scan and the last one both go straight
        // through. The first is what puts the pane on screen at all — a long
        // action has to show progress from its first second, not from its
        // first animation frame — and the last is what the renderer derives
        // "still scanning" from, so deferring it risks pinning the pane on.
        if (next.isDone || !isRunning) {
          isRunning = !next.isDone;
          deliverNow(next);
          return;
        }
        queued = next;
        if (!frame) {
          frame = requestAnimationFrame(flush);
        }
      });
    return () => {
      if (frame) {
        cancelAnimationFrame(frame);
      }
      unsubscribeProgress();
    };
  }, []);

  const addFolder = useCallback(async () => {
    takeSummary(await window.electron.ipcRenderer.addLibraryRoot());
  }, [takeSummary]);

  /** For a dropped folder; main decides what is really a directory. */
  const addFolderPaths = useCallback(
    async (paths: string[]) => {
      if (paths.length > 0) {
        takeSummary(
          await window.electron.ipcRenderer.addLibraryRootPaths(paths),
        );
      }
    },
    [takeSummary],
  );

  /** For music dropped on a queue; see the note on the context's own type. */
  const queueFiles = useCallback(
    (paths: string[]) =>
      paths.length > 0
        ? window.electron.ipcRenderer.queueLibraryFiles(paths)
        : Promise.resolve([]),
    [],
  );

  const rescan = useCallback(async () => {
    await window.electron.ipcRenderer.rescanLibrary();
  }, []);

  const forceRescan = useCallback(async () => {
    await window.electron.ipcRenderer.forceRescanLibrary();
  }, []);

  const cancelScan = useCallback(() => {
    window.electron.ipcRenderer.cancelLibraryScan();
  }, []);

  const removeRoot = useCallback(
    async (rootId: string) => {
      takeSummary(await window.electron.ipcRenderer.removeLibraryRoot(rootId));
    },
    [takeSummary],
  );

  const value = useMemo<ILibraryContextValue>(
    () => ({
      summary,
      isIndexLoaded,
      isScanning,
      progress,
      addFolder,
      addFolderPaths,
      queueFiles,
      rescan,
      forceRescan,
      cancelScan,
      removeRoot,
    }),
    [
      summary,
      isIndexLoaded,
      isScanning,
      progress,
      addFolder,
      addFolderPaths,
      queueFiles,
      rescan,
      forceRescan,
      cancelScan,
      removeRoot,
    ],
  );

  return (
    <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>
  );
};

export const useLibrary = (): ILibraryContextValue => {
  const context = useContext(LibraryContext);
  if (!context) {
    throw new Error('useLibrary must be used inside LibraryProvider');
  }
  return context;
};
