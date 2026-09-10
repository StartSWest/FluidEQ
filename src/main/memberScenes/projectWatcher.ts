import { createHash } from 'crypto';
import fs from 'fs';
import { readProject, type TProjectBuild } from './project';

/**
 * A linked project folder, rebuilt on every save.
 *
 * Editors do not save once. They write a temporary file, rename it over the
 * old one, touch a swap file, and some write twice — so one press of Ctrl+S
 * arrives as a burst of events. The burst is coalesced without a clock: while
 * a build is running, further events only mark it dirty, and a dirty build is
 * followed by exactly one more. However long the burst, the last build always
 * reads the files as they ended up.
 *
 * A build identical to the last one sent is not sent again. The events that
 * produced it — a swap file, a save with no change — are real, but handing the
 * renderer the same scene would recompile a shader for nothing.
 */

export interface IProjectWatcher {
  /** Resolves when no build is running. */
  settled(): Promise<void>;
  close(): void;
}

interface IFolderWatcher {
  on(event: 'change', listener: (type: string, file: unknown) => void): unknown;
  on(event: 'error', listener: (error: Error) => void): unknown;
  close(): void;
}

export interface IProjectWatcherDeps {
  watch?: (folder: string) => IFolderWatcher;
  read?: (folder: string) => Promise<TProjectBuild>;
}

const watchFolder = (folder: string): IFolderWatcher =>
  // `persistent: false`: a watched folder must never be what keeps the app
  // from quitting.
  fs.watch(folder, { persistent: false });

/** What makes two builds the same, without hashing the picture's bytes again. */
const fingerprint = (build: TProjectBuild): string => {
  if (!build.ok) {
    return `problems:${JSON.stringify(build.problems)}`;
  }
  const { artwork, ...rest } = build.pack;
  const described = JSON.stringify({
    ...rest,
    artwork: artwork ? (build.artworkHash ?? artwork.data.length) : undefined,
  });
  return `pack:${createHash('sha256').update(described).digest('hex')}`;
};

const FOLDER_GONE: TProjectBuild = {
  ok: false,
  problems: [{ code: 'missing-file', file: 'pack.json' }],
};

export const watchProject = (
  folder: string,
  onBuild: (build: TProjectBuild) => void,
  { watch = watchFolder, read = readProject }: IProjectWatcherDeps = {},
): IProjectWatcher => {
  let closed = false;
  let running = false;
  let dirty = false;
  let lastSent: string | undefined;
  let current: Promise<void> = Promise.resolve();

  const send = (build: TProjectBuild) => {
    const print = fingerprint(build);
    if (print === lastSent) {
      return;
    }
    lastSent = print;
    onBuild(build);
  };

  const cycle = async (): Promise<void> => {
    dirty = false;
    const build = await read(folder);
    if (closed) {
      return;
    }
    send(build);
    if (dirty) {
      await cycle();
    }
  };

  let watcher: IFolderWatcher | undefined;

  const request = () => {
    if (closed) {
      return;
    }
    if (running) {
      dirty = true;
      return;
    }
    running = true;
    current = cycle()
      .catch(() => {
        // `readProject` never throws; an injected reader that does is treated
        // as the folder being unreadable, which the next save retries.
        send(FOLDER_GONE);
      })
      .finally(() => {
        running = false;
        if (dirty) {
          request();
        }
      });
  };

  const close = () => {
    closed = true;
    watcher?.close();
  };

  try {
    watcher = watch(folder);
    watcher.on('change', () => request());
    watcher.on('error', () => {
      // The folder was deleted, renamed or unplugged. Say so once, and stop:
      // a watcher on a path that no longer exists never recovers by itself.
      send(FOLDER_GONE);
      close();
    });
  } catch {
    send(FOLDER_GONE);
    closed = true;
    return { settled: () => current, close };
  }

  request();
  return { settled: () => current, close };
};
