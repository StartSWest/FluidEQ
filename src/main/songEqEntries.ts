/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ISmartEqSettings } from '../common/constants';
import {
  type ISongEqEntry,
  type ISongEqSettings,
  checkpointSongEq,
  commitSongEq,
  forgetSongEq,
  lookupSongEq,
} from '../common/songEq';
import type { ISongIdentity } from '../common/songIdentity';
import { sanitizeSmartEqSettings } from '../common/smartEq';
import { storedSongIdentity } from './songMemoryNames';
import {
  keepSongEqSettings,
  loadSongEqSettings,
  readSongEqSettings,
  saveSongEqSettings,
} from './songEqStore';

/**
 * Each output's Smart EQ layer per song, as the core keeps it
 * (`songEqMemory.ts`): the file on disk behind four calls, with the song as
 * the file may name it (`storedSongIdentity`). What a lookup returns and what
 * a write changes are `common/songEq.ts`'s rules.
 */
export interface ISongEqEntries {
  /**
   * The read just after launch, off the main thread, taken in only if
   * nothing has read the file since.
   */
  launchRead: Promise<void>;
  lookup(deviceId: string, identity: ISongIdentity): ISongEqEntry | undefined;
  checkpoint(
    deviceId: string,
    identity: ISongIdentity,
    layer: ISmartEqSettings,
  ): void;
  commit(
    deviceId: string,
    identity: ISongIdentity,
    layer: ISmartEqSettings,
  ): void;
  forget(deviceId: string, identity: ISongIdentity): void;
}

export const createSongEqEntries = (userDataDir: string): ISongEqEntries => {
  let cached: ISongEqSettings | undefined;
  const settings = (): ISongEqSettings => {
    if (!cached) {
      cached = loadSongEqSettings(userDataDir);
    }
    return cached;
  };
  const keep = (next: ISongEqSettings) => {
    cached = next;
    saveSongEqSettings(userDataDir, next);
  };
  return {
    launchRead: readSongEqSettings(userDataDir).then((loaded) => {
      if (cached === undefined) {
        cached = keepSongEqSettings(userDataDir, loaded);
      }
      return undefined;
    }),
    lookup: (deviceId, identity) => {
      const entry = lookupSongEq(
        settings(),
        deviceId,
        storedSongIdentity(identity),
      );
      // As the layer will be written, so that once it is the memory knows
      // the layer as its own: the window's era filed layers the update path
      // then rounded to a tenth of a decibel, and one that came back rounded
      // would read as somebody else's edit.
      const layer = entry && sanitizeSmartEqSettings(entry.settings);
      return entry && layer ? { ...entry, settings: layer } : undefined;
    },
    checkpoint: (deviceId, identity, layer) =>
      keep(
        checkpointSongEq(
          settings(),
          deviceId,
          storedSongIdentity(identity),
          layer,
          Date.now(),
        ),
      ),
    commit: (deviceId, identity, layer) =>
      keep(
        commitSongEq(
          settings(),
          deviceId,
          storedSongIdentity(identity),
          layer,
          Date.now(),
        ),
      ),
    forget: (deviceId, identity) =>
      keep(forgetSongEq(settings(), deviceId, storedSongIdentity(identity))),
  };
};
