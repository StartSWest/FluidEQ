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
import type {
  ILibraryIndex,
  ILibraryScanProgress,
} from '../../common/library/types';

const EMPTY_INDEX: ILibraryIndex = { version: 1, roots: [], tracks: [] };

interface ILibraryContextValue {
  index: ILibraryIndex;
  /**
   * Set once, from the first `getLibraryIndex` reply.
   *
   * True means the on-disk index could not be read and main rebuilt it from
   * scratch — a library that silently emptied itself after a bad shutdown.
   * Worth surfacing even though it never changes again this session: a scan
   * afterwards repopulates `index`, but nothing else would ever explain why
   * the folders were still there and the songs were not.
   */
  wasReset: boolean;
  isScanning: boolean;
  progress: ILibraryScanProgress | undefined;
  addFolder: () => Promise<void>;
  addFolderPaths: (paths: string[]) => Promise<void>;
  rescan: () => Promise<void>;
  /** Re-reads every candidate regardless of whether it changed — see
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
 * One context, not two.
 *
 * `LiveAudioContext` splits frame data from control state because the frame
 * arrives ~22 times a second and re-rendered every consumer that only cared
 * about start/stop. Scan progress here arrives per file, at disk and parser
 * speed — nowhere near frame rate — so a single context is the simpler
 * correct answer until a measurement says otherwise.
 */
export const LibraryProvider = ({ children }: { children: ReactNode }) => {
  const [index, setIndex] = useState<ILibraryIndex>(EMPTY_INDEX);
  const [wasReset, setWasReset] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState<ILibraryScanProgress | undefined>(
    undefined,
  );

  useEffect(() => {
    let mounted = true;
    window.electron.ipcRenderer
      .getLibraryIndex()
      .then((result) => {
        if (mounted) {
          setIndex(result.index);
          setWasReset(result.wasReset);
        }
        return undefined;
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const unsubscribeProgress =
      window.electron.ipcRenderer.onLibraryScanProgress((next) => {
        setProgress(next);
        setIsScanning(!next.isDone);
      });
    const unsubscribeIndex = window.electron.ipcRenderer.onLibraryIndexChanged(
      (next) => setIndex(next),
    );
    return () => {
      unsubscribeProgress();
      unsubscribeIndex();
    };
  }, []);

  const addFolder = useCallback(async () => {
    const next = await window.electron.ipcRenderer.addLibraryRoot();
    setIndex(next);
  }, []);

  /** For a dropped folder; main decides what is really a directory. */
  const addFolderPaths = useCallback(async (paths: string[]) => {
    if (!paths.length) {
      return;
    }
    const next = await window.electron.ipcRenderer.addLibraryRootPaths(paths);
    setIndex(next);
  }, []);

  const rescan = useCallback(async () => {
    await window.electron.ipcRenderer.rescanLibrary();
  }, []);

  const forceRescan = useCallback(async () => {
    await window.electron.ipcRenderer.forceRescanLibrary();
  }, []);

  const cancelScan = useCallback(() => {
    window.electron.ipcRenderer.cancelLibraryScan();
  }, []);

  const removeRoot = useCallback(async (rootId: string) => {
    const next = await window.electron.ipcRenderer.removeLibraryRoot(rootId);
    setIndex(next);
  }, []);

  const value = useMemo<ILibraryContextValue>(
    () => ({
      index,
      wasReset,
      isScanning,
      progress,
      addFolder,
      addFolderPaths,
      rescan,
      forceRescan,
      cancelScan,
      removeRoot,
    }),
    [
      index,
      wasReset,
      isScanning,
      progress,
      addFolder,
      addFolderPaths,
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
