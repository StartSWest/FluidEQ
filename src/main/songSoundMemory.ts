/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ISongIdentity } from '../common/songIdentity';
import {
  ISongSound,
  ISongSoundEntry,
  ISongSoundSettings,
  forgetSongSound,
  lookupSongSound,
  saveSongSound,
} from '../common/songSound';
import { storedSongIdentity } from './songMemoryNames';
import {
  keepSongSoundSettings,
  loadSongSoundSettings,
  readSongSoundSettings,
  saveSongSoundSettings,
} from './songSoundStore';

/**
 * What each song was played with, as the song memory reads and files it
 * (`songMemory.ts`): the file read once and held, every change written
 * through. Songs are filed by fingerprint, never by another program's names
 * (`songMemoryNames.ts`).
 */
export interface ISongSoundMemory {
  /**
   * The read just after launch, off the main thread, taken in only if
   * nothing has read the file since: by then a lookup may have read it and
   * filed a song over it.
   */
  launchRead: Promise<void>;
  lookup(
    deviceId: string,
    identity: ISongIdentity,
  ): ISongSoundEntry | undefined;
  save(deviceId: string, identity: ISongIdentity, sound: ISongSound): void;
  forget(deviceId: string, identity: ISongIdentity): void;
}

export const createSongSoundMemory = (
  userDataDir: string,
): ISongSoundMemory => {
  let cached: ISongSoundSettings | undefined;
  const settings = (): ISongSoundSettings => {
    if (!cached) {
      cached = loadSongSoundSettings(userDataDir);
    }
    return cached;
  };
  const keep = (next: ISongSoundSettings) => {
    cached = next;
    saveSongSoundSettings(userDataDir, next);
  };
  return {
    launchRead: readSongSoundSettings(userDataDir).then((loaded) => {
      if (cached === undefined) {
        cached = keepSongSoundSettings(userDataDir, loaded);
      }
      return undefined;
    }),
    lookup: (deviceId, identity) =>
      lookupSongSound(settings(), deviceId, storedSongIdentity(identity)),
    save: (deviceId, identity, sound) =>
      keep(
        saveSongSound(
          settings(),
          deviceId,
          storedSongIdentity(identity),
          sound,
          Date.now(),
        ),
      ),
    forget: (deviceId, identity) =>
      keep(forgetSongSound(settings(), deviceId, storedSongIdentity(identity))),
  };
};
