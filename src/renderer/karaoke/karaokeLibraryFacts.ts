/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { type ILibraryTrack } from '../../common/library/types';
import { karaokeFileRelativePath } from '../../common/karaoke/files';

/**
 * What the Library knows about a song the Karaoke list holds: its tagged
 * title and artist, its length and its cover in the Library's art cache.
 *
 * A song sent from the Library arrives as a bare copy of its bytes, named by
 * its file, so the list drew "AV · Aquí Voy · MP3" for a song the Library
 * shows as Jesse & Joy with its album's cover (Ivan, 2026-11-16: "karaoke is
 * not done"). The send hands these facts over with the copy, and they are
 * kept by the song's name and time, which is what a session restored after
 * a restart still has: the restored file is rebuilt with no bytes and no
 * path, only its name, its relative path and its modification time.
 */
export interface IKaraokeLibraryFacts {
  title: string;
  artist?: string;
  album?: string;
  durationMs?: number;
  artId?: string;
}

const FACTS = Symbol('karaokeLibraryFacts');
const STORAGE_KEY = 'fluideq.karaoke.libraryFacts';
/** Songs remembered; the oldest go first past this. */
const KEPT = 400;

type TFactsFile = File & { [FACTS]?: IKaraokeLibraryFacts };

const keyOf = (file: File) =>
  `${karaokeFileRelativePath(file).toLowerCase()}|${file.lastModified}`;

const isFacts = (value: unknown): value is IKaraokeLibraryFacts => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const facts = value as Record<string, unknown>;
  const text = (name: string) =>
    facts[name] === undefined || typeof facts[name] === 'string';
  return (
    typeof facts.title === 'string' &&
    text('artist') &&
    text('album') &&
    text('artId') &&
    (facts.durationMs === undefined || typeof facts.durationMs === 'number')
  );
};

const readStored = (): [string, IKaraokeLibraryFacts][] => {
  try {
    const parsed: unknown = JSON.parse(
      window.localStorage.getItem(STORAGE_KEY) ?? '[]',
    );
    return Array.isArray(parsed)
      ? parsed.filter(
          (entry): entry is [string, IKaraokeLibraryFacts] =>
            Array.isArray(entry) &&
            typeof entry[0] === 'string' &&
            isFacts(entry[1]),
        )
      : [];
  } catch {
    return [];
  }
};

let stored: Map<string, IKaraokeLibraryFacts> | undefined;
const storedFacts = () => {
  stored ??= new Map(readStored());
  return stored;
};

/** The Library's facts for this copy, kept for the next launch as well. */
export const setKaraokeLibraryFacts = (
  file: File,
  track: ILibraryTrack,
): void => {
  const facts: IKaraokeLibraryFacts = {
    title: track.title,
    artist: track.artist ?? track.albumArtist,
    album: track.album,
    durationMs: track.durationMs,
    artId: track.artId,
  };
  (file as TFactsFile)[FACTS] = facts;
  const all = storedFacts();
  const key = keyOf(file);
  all.delete(key);
  all.set(key, facts);
  while (all.size > KEPT) {
    const oldest = all.keys().next();
    if (oldest.done) {
      break;
    }
    all.delete(oldest.value);
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...all]));
  } catch {
    // Without storage the facts still hold for this launch.
  }
};

export const karaokeLibraryFactsOf = (
  file: File,
): IKaraokeLibraryFacts | undefined =>
  (file as TFactsFile)[FACTS] ?? storedFacts().get(keyOf(file));

const fileNameOfPath = (path: string) =>
  path.slice(Math.max(path.lastIndexOf('\\'), path.lastIndexOf('/')) + 1);

// Within this much of the copy's time is the same file: the send rounds the
// Library's time to the millisecond, and a file system can keep it coarser.
const SAME_TIME_MS = 2000;

const missing = new WeakSet<File>();
const pendingLookups = new Map<File, Promise<IKaraokeLibraryFacts | null>>();
let lookups: Promise<unknown> = Promise.resolve();

const askLibrary = async (
  file: File,
  title: string,
): Promise<IKaraokeLibraryFacts | null> => {
  const page = await window.electron.ipcRenderer.queryLibrary({
    type: 'page',
    query: {
      shelf: 'tracks',
      scope: { kind: 'audio' },
      search: title,
      direction: 'asc',
    },
    offset: 0,
    limit: 25,
  });
  const name = file.name.toLowerCase();
  const sameName = page.items.flatMap((item) =>
    item.kind === 'track' &&
    fileNameOfPath(item.track.path).toLowerCase() === name
      ? [item.track]
      : [],
  );
  const match =
    sameName.find(
      (track) => Math.abs(track.mtimeMs - file.lastModified) <= SAME_TIME_MS,
    ) ?? (sameName.length === 1 ? sameName[0] : undefined);
  if (!match) {
    return null;
  }
  setKaraokeLibraryFacts(file, match);
  return karaokeLibraryFactsOf(file) ?? null;
};

/**
 * The Library's facts for a song that came without them: one sent before
 * the send carried them, or a file opened from disk that the Library also
 * holds. Found by the file's name and time among the Library's songs that
 * match its title, one song at a time, and a song the Library does not
 * have is asked about once a launch.
 */
export const lookUpKaraokeLibraryFacts = (
  file: File,
  title: string,
): Promise<IKaraokeLibraryFacts | null> => {
  const known = karaokeLibraryFactsOf(file);
  if (known) {
    return Promise.resolve(known);
  }
  if (missing.has(file) || !window.electron?.ipcRenderer.queryLibrary) {
    return Promise.resolve(null);
  }
  const waiting = pendingLookups.get(file);
  if (waiting) {
    return waiting;
  }
  const asked = lookups
    .then(() => askLibrary(file, title))
    // A Library that cannot answer (not scanned yet, or its store failing)
    // is a song it does not have, for this launch: the row still reads its
    // own length and shows its file's name.
    .catch((error: unknown) => {
      // eslint-disable-next-line no-console -- context-rich error before it becomes "not in the Library"
      console.error(`Could not look ${file.name} up in the Library`, error);
      return null;
    })
    .then((facts) => {
      pendingLookups.delete(file);
      if (!facts) {
        missing.add(file);
      }
      return facts;
    });
  lookups = asked;
  pendingLookups.set(file, asked);
  return asked;
};
