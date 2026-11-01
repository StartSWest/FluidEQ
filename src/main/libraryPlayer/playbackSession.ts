/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Library's session, kept in the core across restarts: the queue as it
 * was, how far into the song, and whether to keep playing once the list
 * runs out. `library-playback.json` beside the app's other settings.
 *
 * The window kept the same thing in its own storage until the player moved;
 * the first window after the move hands its copy over once
 * (`adoptLegacy`), and it counts only while the core has none of its own —
 * a song pressed in the meantime is what the listener wants now.
 */
import path from 'path';
import { createKeptFile, type IKeptFile } from '../../core/files/keptFile';
import type { ICoreLog } from '../../core/coreLog';
import {
  type IPlaybackMemory,
  type IRestoredSession,
  parseContinuationSwitch,
  parsePlaybackMemory,
  playbackMemoryOf,
  restoreSession,
} from '../../common/library/playbackMemory';
import type { ILibraryQueue } from '../../common/library/queue';
import type { ILibraryTrack } from '../../common/library/types';

export const PLAYBACK_SESSION_FILE = 'library-playback.json';

interface IStoredSession {
  memory?: IPlaybackMemory;
  /** Absent until the switch was moved or handed over: the default, on. */
  isContinuationOn?: boolean;
}

const parseStoredSession = (raw: unknown): IStoredSession => {
  if (typeof raw !== 'object' || raw === null) {
    return {};
  }
  const { memory, isContinuationOn } = raw as Record<string, unknown>;
  const parsed = parsePlaybackMemory(memory);
  return {
    ...(parsed ? { memory: parsed } : {}),
    ...(isContinuationOn === undefined
      ? {}
      : { isContinuationOn: parseContinuationSwitch(isContinuationOn) }),
  };
};

export interface IPlaybackSession {
  isContinuationOn: () => boolean;
  /** The stored queue, rebuilt from the songs the library still has. */
  restore: (
    tracks: (ids: readonly string[]) => ILibraryTrack[],
  ) => IRestoredSession | undefined;
  keep: (
    queue: ILibraryQueue | undefined,
    positionMs: number,
    isContinuationOn: boolean,
  ) => void;
  /**
   * The window's old copy, taken only where the core has nothing of its
   * own. True when anything was taken.
   */
  adoptLegacy: (raw: unknown) => boolean;
}

export const createPlaybackSession = (
  userDataDir: string,
  log: ICoreLog,
): IPlaybackSession => {
  const file: IKeptFile<IStoredSession> = createKeptFile({
    filePath: path.join(userDataDir, PLAYBACK_SESSION_FILE),
    parse: parseStoredSession,
    empty: {},
    log,
  });

  return {
    isContinuationOn: () => file.read().isContinuationOn ?? true,

    restore: (tracks) => {
      const { memory } = file.read();
      if (!memory) {
        return undefined;
      }
      const found = tracks([...new Set(memory.trackIds)]);
      return restoreSession(
        memory,
        new Map(found.map((track) => [track.id, track.durationMs])),
      );
    },

    keep: (queue, positionMs, isContinuationOn) => {
      const memory = playbackMemoryOf(queue, positionMs);
      const stored = file.read();
      file.keep({
        ...(memory ? { memory } : {}),
        ...(isContinuationOn && stored.isContinuationOn === undefined
          ? {}
          : { isContinuationOn }),
      });
    },

    adoptLegacy: (raw) => {
      if (typeof raw !== 'object' || raw === null) {
        return false;
      }
      const { memory, keepPlaying } = raw as Record<string, unknown>;
      const stored = file.read();
      const legacyMemory = stored.memory
        ? undefined
        : parsePlaybackMemory(memory);
      const legacySwitch =
        stored.isContinuationOn === undefined && typeof keepPlaying === 'string'
          ? parseContinuationSwitch(keepPlaying)
          : undefined;
      if (legacyMemory === undefined && legacySwitch === undefined) {
        return false;
      }
      file.keep({
        ...stored,
        ...(legacyMemory ? { memory: legacyMemory } : {}),
        ...(legacySwitch === undefined
          ? {}
          : { isContinuationOn: legacySwitch }),
      });
      return true;
    },
  };
};
