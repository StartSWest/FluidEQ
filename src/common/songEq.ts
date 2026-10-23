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

import { ISmartEqSettings } from './constants';
import { ISongIdentity } from './songIdentity';
import {
  ISongMemoryEntryBase,
  ISongMemoryOutput,
  ISongMemorySettings,
  emptySongMemory,
  forgetSongMemory,
  lookupSongMemory,
  putSongMemory,
} from './songMemory';

/**
 * What the app remembers about a song's Smart EQ correction, per output.
 *
 * Pure on purpose: every function here takes the whole settings object and
 * returns a new one. The eviction and the alias bookkeeping are where the bugs
 * in this feature will be, and they live in `songMemory.ts`, reachable from a
 * unit test with no filesystem in the way — `main/songEqStore.ts` is the half
 * that touches disk and it holds no rules.
 */
export interface ISongEqEntry extends ISongMemoryEntryBase {
  /** The saved layer. Never carries `apoOverride` — see `stripSongEqLayer`. */
  settings: ISmartEqSettings;
}

export type ISongEqOutput = ISongMemoryOutput<ISongEqEntry>;

export type ISongEqSettings = ISongMemorySettings<ISongEqEntry>;

/**
 * The ceiling, per output, and the reason there is one.
 *
 * The file is rewritten on every song that reaches two minutes, so without a
 * cap a year of listening is a file that grows forever and is read at every
 * launch. At roughly a kilobyte an entry this is a couple of megabytes.
 */
export const SONG_EQ_MAX_ENTRIES = 2000;

export const getDefaultSongEqSettings = (): ISongEqSettings =>
  emptySongMemory<ISongEqEntry>();

/**
 * The layer as it may be stored.
 *
 * `apoOverride` is the exact contents of a config file the user hand-edited
 * through Equalizer APO. It belongs to that moment on that output; replaying it
 * onto another song would write somebody's manual edit into a track that never
 * had one.
 */
export const stripSongEqLayer = (layer: ISmartEqSettings): ISmartEqSettings => {
  const { apoOverride, ...rest } = layer;
  return rest;
};

export const lookupSongEq = (
  settings: ISongEqSettings,
  deviceId: string,
  identity: ISongIdentity,
): ISongEqEntry | undefined => lookupSongMemory(settings, deviceId, identity);

const put = (
  settings: ISongEqSettings,
  deviceId: string,
  identity: ISongIdentity,
  layer: ISmartEqSettings,
  now: number,
  playsDelta: number,
): ISongEqSettings =>
  putSongMemory(
    settings,
    deviceId,
    identity,
    (existing) => ({
      settings: stripSongEqLayer(layer),
      title: identity.title,
      artist: identity.artist,
      alias: identity.alias,
      plays: (existing?.plays ?? 0) + playsDelta,
      updatedAt: now,
    }),
    SONG_EQ_MAX_ENTRIES,
  );

/**
 * Write what has been learned so far without counting it as a play.
 *
 * Sent the moment two minutes have been listened to, so the song survives the
 * app being killed, the machine sleeping or the window closing mid-track. The
 * commit that follows at the end of the song is what counts the play.
 */
export const checkpointSongEq = (
  settings: ISongEqSettings,
  deviceId: string,
  identity: ISongIdentity,
  layer: ISmartEqSettings,
  now: number,
): ISongEqSettings => put(settings, deviceId, identity, layer, now, 0);

/** Write the finished curve and count the play. */
export const commitSongEq = (
  settings: ISongEqSettings,
  deviceId: string,
  identity: ISongIdentity,
  layer: ISmartEqSettings,
  now: number,
): ISongEqSettings => put(settings, deviceId, identity, layer, now, 1);

/**
 * Forget one song on one output — exactly the entry `lookupSongEq` would have
 * handed back, alias and all (`songMemory.ts`).
 */
export const forgetSongEq = (
  settings: ISongEqSettings,
  deviceId: string,
  identity: ISongIdentity,
): ISongEqSettings => forgetSongMemory(settings, deviceId, identity);
