/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { ISongIdentity } from './songIdentity';

/**
 * Something remembered about a song: the store both song memories keep — the
 * Smart EQ correction (`songEq.ts`, one store per output) and the sound a song
 * plays with (`songSound.ts`, one store for every output). One set of rules
 * for finding, filing, evicting and forgetting a song, because the alias
 * bookkeeping is where the bugs in either live, and a second copy of it would
 * be a second place to get them.
 *
 * The rules are written for one store (`ISongMemoryOutput`); the per-output
 * functions below apply them to an output's.
 *
 * Pure: every function takes the whole store and returns a new one.
 */
export interface ISongMemoryEntryBase {
  title: string;
  artist?: string;
  alias?: string;
  /** Times this song was filed at its end. */
  plays: number;
  /** Epoch ms of the last save. Also the eviction order. */
  updatedAt: number;
}

export interface ISongMemoryOutput<Entry> {
  entries: Record<string, Entry>;
  /** alias → entry key. One key per alias; the most recent save wins. */
  aliases: Record<string, string>;
}

export interface ISongMemorySettings<Entry> {
  version: 1;
  outputs: Record<string, ISongMemoryOutput<Entry>>;
}

export const emptySongMemory = <Entry>(): ISongMemorySettings<Entry> => ({
  version: 1,
  outputs: {},
});

export const emptySongMemoryOutput = <Entry>(): ISongMemoryOutput<Entry> => ({
  entries: {},
  aliases: {},
});

/**
 * Which key this store actually holds this song under, if any.
 *
 * The one resolution rule, so lookup and forget cannot disagree about it.
 * They did: a curve learned from a library file was matched from Spotify
 * through the alias index, and Forget then deleted `system:...` — a key that
 * was never there. Nothing threw, the reply was a success, the notice
 * cleared, and the entry stayed on disk to come back on the next play.
 *
 * Exact first and always: your own file beats an alias that has drifted to a
 * rip of the same song.
 */
const resolveKey = <Entry>(
  output: ISongMemoryOutput<Entry> | undefined,
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

/** What one store holds for the song, if anything. */
export const lookupInSongMemory = <Entry>(
  output: ISongMemoryOutput<Entry> | undefined,
  identity: ISongIdentity,
): Entry | undefined => {
  const key = resolveKey(output, identity);
  return output && key !== undefined ? output.entries[key] : undefined;
};

export const lookupSongMemory = <Entry>(
  settings: ISongMemorySettings<Entry>,
  deviceId: string,
  identity: ISongIdentity,
): Entry | undefined =>
  lookupInSongMemory(settings.outputs[deviceId], identity);

/**
 * What this output holds for the song, or else what any other output does —
 * the newest of them.
 *
 * For what is about the record and not the output it plays on: Smart
 * correction measures the source, before any output's effects, so a song
 * measured on the headphones is measured for the speakers too (Auto EQ,
 * 2026-11-20: a song's sound follows it to every output).
 */
export const lookupSongMemoryAnywhere = <Entry extends ISongMemoryEntryBase>(
  settings: ISongMemorySettings<Entry>,
  deviceId: string,
  identity: ISongIdentity,
): Entry | undefined => {
  const own = lookupSongMemory(settings, deviceId, identity);
  if (own) {
    return own;
  }
  let newest: Entry | undefined;
  Object.entries(settings.outputs).forEach(([id, output]) => {
    const entry =
      id === deviceId ? undefined : lookupInSongMemory(output, identity);
    if (entry && (!newest || entry.updatedAt > newest.updatedAt)) {
      newest = entry;
    }
  });
  return newest;
};

/** Drop the lowest `updatedAt` entries until the store is inside the cap,
 * taking each one's alias with it. */
const evict = <Entry extends ISongMemoryEntryBase>(
  output: ISongMemoryOutput<Entry>,
  maxEntries: number,
): ISongMemoryOutput<Entry> => {
  const keys = Object.keys(output.entries);
  if (keys.length <= maxEntries) {
    return output;
  }
  const doomed = new Set(
    keys
      .sort((a, b) => output.entries[a].updatedAt - output.entries[b].updatedAt)
      .slice(0, keys.length - maxEntries),
  );
  const entries: Record<string, Entry> = {};
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

/**
 * File `make`'s entry under the identity's own key, with its alias pointing
 * there, and evict down to `maxEntries`. `make` is handed what was filed under
 * that key before, for whatever it carries on (the play count).
 */
export const putInSongMemory = <Entry extends ISongMemoryEntryBase>(
  output: ISongMemoryOutput<Entry> | undefined,
  identity: ISongIdentity,
  make: (existing: Entry | undefined) => Entry,
  maxEntries: number,
): ISongMemoryOutput<Entry> => {
  const current = output ?? emptySongMemoryOutput<Entry>();
  return evict(
    {
      entries: {
        ...current.entries,
        [identity.key]: make(current.entries[identity.key]),
      },
      aliases: identity.alias
        ? { ...current.aliases, [identity.alias]: identity.key }
        : { ...current.aliases },
    },
    maxEntries,
  );
};

export const putSongMemory = <Entry extends ISongMemoryEntryBase>(
  settings: ISongMemorySettings<Entry>,
  deviceId: string,
  identity: ISongIdentity,
  make: (existing: Entry | undefined) => Entry,
  maxEntries: number,
): ISongMemorySettings<Entry> => ({
  ...settings,
  outputs: {
    ...settings.outputs,
    [deviceId]: putInSongMemory(
      settings.outputs[deviceId],
      identity,
      make,
      maxEntries,
    ),
  },
});

/**
 * Forget one song in one store.
 *
 * Takes the identity rather than a key, because the key the caller is holding
 * is the key of whatever is *playing* and the entry may well be filed under
 * another one — that is what the alias index is for. Resolved through
 * `resolveKey`, so this deletes exactly the entry a lookup would have handed
 * back. The same store comes back when there was nothing to forget.
 */
export const forgetInSongMemory = <Entry>(
  output: ISongMemoryOutput<Entry> | undefined,
  identity: ISongIdentity,
): ISongMemoryOutput<Entry> | undefined => {
  const key = resolveKey(output, identity);
  if (!output || key === undefined) {
    return output;
  }
  return forgetKeyInSongMemory(output, key);
};

/** Forget the entry filed under `key`, and every alias still pointing at it. */
export const forgetKeyInSongMemory = <Entry>(
  output: ISongMemoryOutput<Entry>,
  key: string,
): ISongMemoryOutput<Entry> => {
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
  return { entries, aliases };
};

export const forgetSongMemory = <Entry>(
  settings: ISongMemorySettings<Entry>,
  deviceId: string,
  identity: ISongIdentity,
): ISongMemorySettings<Entry> => {
  const output = settings.outputs[deviceId];
  const next = forgetInSongMemory(output, identity);
  if (!next || next === output) {
    return settings;
  }
  return { ...settings, outputs: { ...settings.outputs, [deviceId]: next } };
};
