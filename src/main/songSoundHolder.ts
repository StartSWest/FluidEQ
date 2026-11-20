/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ISongSoundSettings } from '../common/songSoundMemory';
import {
  keepSongSoundSettings,
  loadSongSoundSettings,
  readSongSoundSettings,
  saveSongSoundSettings,
} from './songSoundStore';

/**
 * Auto EQ's song and album sounds, held in memory between writes, for the
 * channels that read and change them (`ipc/songSound.ts` for the song that
 * plays, `ipc/songSoundLibrary.ts` for the Library and Manage). Nothing else
 * writes the file, and a song ending is not a moment for a disk read.
 *
 * Every change is written and then told to the window (`notify`), so the
 * Library's labels, Manage and the song that plays — looked up again — all
 * follow it, wherever it was made.
 */
export interface ISongSoundHolder {
  read: () => ISongSoundSettings;
  /** Hold, write and tell; the same settings back is no change at all. */
  write: (next: ISongSoundSettings) => void;
  /** Settles once the read just after launch has been taken in. */
  launchRead: Promise<void>;
}

export const createSongSoundHolder = (
  userDataDir: string,
  notify: () => void,
): ISongSoundHolder => {
  let cached: ISongSoundSettings | undefined;
  const read = (): ISongSoundSettings => {
    if (!cached) {
      cached = loadSongSoundSettings(userDataDir);
    }
    return cached;
  };
  // Read once just after launch, off the main thread, rather than at the
  // first song: a file written before 2026-10-26 names the songs in it, and
  // one written before Auto EQ is moved to its store, and reading it is what
  // writes it again (`songSoundStore.ts`). A lookup that lands first has read
  // the file itself and written it then, and may have saved a song since, so
  // this then leaves both alone.
  const launchRead = readSongSoundSettings(userDataDir).then((loaded) => {
    if (cached === undefined) {
      cached = keepSongSoundSettings(userDataDir, loaded);
    }
    return undefined;
  });
  const write = (next: ISongSoundSettings): void => {
    if (next === read()) {
      return;
    }
    cached = next;
    saveSongSoundSettings(userDataDir, next);
    notify();
  };
  return { read, write, launchRead };
};
