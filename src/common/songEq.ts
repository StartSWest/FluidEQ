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

/**
 * What the app remembers about a song, per output.
 *
 * Pure on purpose: every function here takes the whole settings object and
 * returns a new one. The eviction and the alias bookkeeping are where the bugs
 * in this feature will be, and they should be reachable from a unit test with
 * no filesystem in the way — `main/songEqStore.ts` is the half that touches
 * disk and it holds no rules.
 */
export interface ISongEqEntry {
  /** The saved layer. Never carries `apoOverride` — see `stripSongEqLayer`. */
  settings: ISmartEqSettings;
  title: string;
  artist?: string;
  alias?: string;
  /** Completed recordings of this song. Provenance, and all of it. */
  plays: number;
  /** Epoch ms of the last save. Also the eviction order. */
  updatedAt: number;
}

export interface ISongEqOutput {
  entries: Record<string, ISongEqEntry>;
  /** alias → entry key. One key per alias; the most recent save wins. */
  aliases: Record<string, string>;
}

export interface ISongEqSettings {
  version: 1;
  outputs: Record<string, ISongEqOutput>;
}

/**
 * The ceiling, per output, and the reason there is one.
 *
 * The file is rewritten on every song that reaches two minutes, so without a
 * cap a year of listening is a file that grows forever and is read at every
 * launch. At roughly a kilobyte an entry this is a couple of megabytes.
 */
export const SONG_EQ_MAX_ENTRIES = 2000;

export const getDefaultSongEqSettings = (): ISongEqSettings => ({
  version: 1,
  outputs: {},
});

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

const outputOf = (settings: ISongEqSettings, deviceId: string): ISongEqOutput =>
  settings.outputs[deviceId] ?? { entries: {}, aliases: {} };

/**
 * Which key this output actually holds this song under, if any.
 *
 * The one resolution rule, so lookup and forget cannot disagree about it.
 * They did: a curve learned from a library file was matched from Spotify
 * through the alias index, and Forget then deleted `system:...` — a key that
 * was never there. Nothing threw, the reply was a success, the notice
 * cleared, and the entry stayed on disk to come back on the next play. With
 * the recording tick off, which §9 explicitly supports, that song could never
 * be forgotten at all.
 *
 * Exact first and always: your own file beats an alias that has drifted to a
 * rip of the same song.
 */
const resolveSongEqKey = (
  output: ISongEqOutput | undefined,
  identity: ISongIdentity,
): string | undefined => {
  if (!output) {
    return undefined;
  }
  if (output.entries[identity.key]) {
    return identity.key;
  }
  if (!identity.alias) {
    return undefined;
  }
  const aliased = output.aliases[identity.alias];
  return aliased !== undefined && output.entries[aliased] ? aliased : undefined;
};

export const lookupSongEq = (
  settings: ISongEqSettings,
  deviceId: string,
  identity: ISongIdentity,
): ISongEqEntry | undefined => {
  const output = settings.outputs[deviceId];
  const key = resolveSongEqKey(output, identity);
  return output && key !== undefined ? output.entries[key] : undefined;
};

/** Drop the lowest `updatedAt` entries until the output is inside the cap,
 * taking each one's alias with it. */
const evict = (output: ISongEqOutput): ISongEqOutput => {
  const keys = Object.keys(output.entries);
  if (keys.length <= SONG_EQ_MAX_ENTRIES) {
    return output;
  }
  const doomed = new Set(
    keys
      .sort((a, b) => output.entries[a].updatedAt - output.entries[b].updatedAt)
      .slice(0, keys.length - SONG_EQ_MAX_ENTRIES),
  );
  const entries: Record<string, ISongEqEntry> = {};
  keys.forEach((key) => {
    if (!doomed.has(key)) {
      entries[key] = output.entries[key];
    }
  });
  const aliases: Record<string, string> = {};
  Object.entries(output.aliases).forEach(([alias, key]) => {
    if (!doomed.has(key)) {
      aliases[alias] = key;
    }
  });
  return { entries, aliases };
};

const put = (
  settings: ISongEqSettings,
  deviceId: string,
  identity: ISongIdentity,
  layer: ISmartEqSettings,
  now: number,
  playsDelta: number,
): ISongEqSettings => {
  const output = outputOf(settings, deviceId);
  const existing = output.entries[identity.key];
  const entry: ISongEqEntry = {
    settings: stripSongEqLayer(layer),
    title: identity.title,
    artist: identity.artist,
    alias: identity.alias,
    plays: (existing?.plays ?? 0) + playsDelta,
    updatedAt: now,
  };
  const next: ISongEqOutput = {
    entries: { ...output.entries, [identity.key]: entry },
    aliases: identity.alias
      ? { ...output.aliases, [identity.alias]: identity.key }
      : { ...output.aliases },
  };
  return {
    ...settings,
    outputs: { ...settings.outputs, [deviceId]: evict(next) },
  };
};

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
 * Forget one song on one output.
 *
 * Takes the identity rather than a key, because the key the caller is holding
 * is the key of whatever is *playing* and the entry may well be filed under
 * another one — that is what the alias index is for. Resolved through
 * `resolveSongEqKey`, so this deletes exactly the entry `lookupSongEq` would
 * have handed back.
 */
export const forgetSongEq = (
  settings: ISongEqSettings,
  deviceId: string,
  identity: ISongIdentity,
): ISongEqSettings => {
  const output = settings.outputs[deviceId];
  const key = resolveSongEqKey(output, identity);
  if (!output || key === undefined) {
    return settings;
  }
  const entries = { ...output.entries };
  delete entries[key];
  const aliases: Record<string, string> = {};
  Object.entries(output.aliases).forEach(([alias, target]) => {
    // Only where it still points here. The alias moves to whichever key saved
    // last, and taking it from the live entry would be forgetting two songs.
    if (target !== key) {
      aliases[alias] = target;
    }
  });
  return {
    ...settings,
    outputs: { ...settings.outputs, [deviceId]: { entries, aliases } },
  };
};
