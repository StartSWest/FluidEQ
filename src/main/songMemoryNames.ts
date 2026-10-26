/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { createHash } from 'crypto';
import type { ISongIdentity, TSongSource } from '../common/songIdentity';
import type {
  ISongMemoryEntryBase,
  ISongMemoryOutput,
  ISongMemorySettings,
} from '../common/songMemory';

/**
 * What the two song memories (`song-eq.json`, `song-sound.json`) may hold
 * about a song: a fingerprint to find it by, and its name only when it is a
 * file of the listener's own.
 *
 * They held every song's key, alias, title and artist as written, so a video
 * listened to in a browser stood in a file in the app's data folder as
 * `system:chrome.exe:<its title>:<its channel>` for as long as the memory
 * kept it (Ivan, 2026-10-26: "user maybe watching porn or whatever and closed
 * it and get busted"). A song is found by its key and its alias, and a SHA-1
 * of each finds it as well as the text did: the same text gives the same
 * fingerprint on every launch, so a Library file and the same song on Spotify
 * still meet through the alias, without the file saying what either was. The
 * engine's song levels are kept the same way (`songProgramme.ts`).
 *
 * A name stays for the Library and Karaoke, whose songs are files on this
 * machine already. Nothing reads a stored name back for a song of anybody
 * else's: the notice that says which song a memory went onto names the one
 * playing (`SongEqNotice`, `SongSoundNotice`).
 */

const OWN_SOURCES: ReadonlySet<string> = new Set<TSongSource>([
  'library',
  'karaoke',
]);

/** A key or an alias already filed by its fingerprint. Never written text:
 * a key always names its source before a colon and an alias joins its title
 * and artist with a bar, and a fingerprint has neither. */
const FINGERPRINT = /^[0-9a-f]{40}$/;

const fingerprint = (text: string): string =>
  FINGERPRINT.test(text)
    ? text
    : createHash('sha1').update(text, 'utf8').digest('hex');

/** The song as the memory files it: see the module comment. */
export const storedSongIdentity = (identity: ISongIdentity): ISongIdentity => {
  const isOwn = OWN_SOURCES.has(identity.source);
  return {
    key: fingerprint(identity.key),
    ...(identity.alias === undefined
      ? {}
      : { alias: fingerprint(identity.alias) }),
    title: isOwn ? identity.title : '',
    ...(isOwn && identity.artist !== undefined
      ? { artist: identity.artist }
      : {}),
    source: identity.source,
  };
};

/** An entry the conversion can carry over: an object whose alias, if it
 * has one, is text. Anything else came from a hand edit or half a write. */
const isConvertible = (entry: unknown): boolean => {
  if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
    return false;
  }
  const { alias } = entry as { alias?: unknown };
  return alias === undefined || typeof alias === 'string';
};

/**
 * A memory as builds before 2026-10-26 wrote it, filed again by fingerprints
 * and with the names of every song not the listener's own taken out.
 *
 * Every entry keeps what it holds — its settings or its sound, its plays and
 * when it was saved — under the fingerprint of the key it had, which is the
 * fingerprint a new save of the same song files it under: the key is the
 * player, the title and the artist (`buildSongIdentity`), and the same text
 * gives the same fingerprint. Only an entry that is not one at all is left
 * out, and counted in `dropped`.
 *
 * `rewrite` says the file has to be written again; a memory already filed
 * this way comes back as it went in. The source of a key written as text is
 * the word before its first colon, which is how `buildSongIdentity` spells
 * every one; a key already a fingerprint was filed by this module, with the
 * name already gone where it had to go.
 */
export const fingerprintSongMemory = <Entry extends ISongMemoryEntryBase>(
  settings: ISongMemorySettings<Entry>,
): {
  settings: ISongMemorySettings<Entry>;
  rewrite: boolean;
  dropped: number;
} => {
  let rewrite = false;
  let dropped = 0;
  const outputs: Record<string, ISongMemoryOutput<Entry>> = {};
  Object.entries(settings.outputs).forEach(([deviceId, output]) => {
    const entries: Record<string, Entry> = {};
    Object.entries(output.entries).forEach(([key, entry]) => {
      if (!isConvertible(entry)) {
        dropped += 1;
        return;
      }
      const isWritten = !FINGERPRINT.test(key);
      const isOwn = OWN_SOURCES.has(key.slice(0, key.indexOf(':')));
      const isNamed = isWritten && !isOwn;
      const alias =
        entry.alias === undefined ? undefined : fingerprint(entry.alias);
      rewrite ||= isWritten || alias !== entry.alias;
      entries[fingerprint(key)] = {
        ...entry,
        alias,
        ...(isNamed ? { title: '', artist: undefined } : {}),
      };
    });
    const aliases: Record<string, string> = {};
    Object.entries(output.aliases).forEach(([alias, key]) => {
      // A pointer that is not text points at nothing a lookup could find.
      if (typeof key !== 'string') {
        rewrite = true;
        return;
      }
      rewrite ||= !FINGERPRINT.test(alias) || !FINGERPRINT.test(key);
      aliases[fingerprint(alias)] = fingerprint(key);
    });
    outputs[deviceId] = { entries, aliases };
  });
  rewrite ||= dropped > 0;
  return {
    settings: rewrite ? { ...settings, outputs } : settings,
    rewrite,
    dropped,
  };
};
