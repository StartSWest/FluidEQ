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

import fs from 'fs';
import path from 'path';
import {
  ILibraryIndex,
  ILibraryNormalizationAnalysis,
  ILibraryRoot,
  ILibraryTrack,
} from '../../common/library/types';
import { scheduleWriteOperation, writeFileNow } from '../asyncWriter';

const INDEX_FILENAME = 'library-index.json';

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isOptionalString = (value: unknown): boolean =>
  value === undefined || typeof value === 'string';

const isOptionalNumber = (value: unknown): boolean =>
  value === undefined || typeof value === 'number';

const isOptionalBoolean = (value: unknown): boolean =>
  value === undefined || typeof value === 'boolean';

const isProgrammeEdges = (value: unknown): boolean =>
  isObject(value) &&
  typeof value.leadInMs === 'number' &&
  Number.isFinite(value.leadInMs) &&
  value.leadInMs >= 0 &&
  typeof value.endMs === 'number' &&
  Number.isFinite(value.endMs) &&
  value.endMs >= value.leadInMs;

/** Also what `library-track-normalization-set` holds a window's measurement to. */
export const isNormalizationAnalysis = (
  value: unknown,
): value is ILibraryNormalizationAnalysis =>
  isObject(value) &&
  value.version === 2 &&
  (value.edges === undefined || isProgrammeEdges(value.edges)) &&
  typeof value.truePeakDbtp === 'number' &&
  Number.isFinite(value.truePeakDbtp) &&
  value.truePeakDbtp >= -120 &&
  value.truePeakDbtp <= 24 &&
  typeof value.integratedLufs === 'number' &&
  Number.isFinite(value.integratedLufs) &&
  value.integratedLufs >= -120 &&
  value.integratedLufs <= 24;

const isOptionalNormalizationAnalysis = (value: unknown): boolean =>
  value === undefined || isNormalizationAnalysis(value);

const isLibraryRoot = (value: unknown): value is ILibraryRoot =>
  isObject(value) &&
  typeof value.id === 'string' &&
  typeof value.path === 'string' &&
  typeof value.addedAt === 'number' &&
  isOptionalNumber(value.lastScanAt) &&
  isOptionalBoolean(value.isOffline) &&
  typeof value.trackCount === 'number' &&
  typeof value.karaokeSkipped === 'number';

const isLibraryTrack = (value: unknown): value is ILibraryTrack =>
  isObject(value) &&
  typeof value.id === 'string' &&
  typeof value.rootId === 'string' &&
  typeof value.path === 'string' &&
  (value.kind === 'audio' || value.kind === 'video') &&
  typeof value.isPlayable === 'boolean' &&
  typeof value.title === 'string' &&
  isOptionalString(value.artist) &&
  isOptionalString(value.albumArtist) &&
  isOptionalString(value.album) &&
  isOptionalNumber(value.trackNo) &&
  isOptionalNumber(value.discNo) &&
  isOptionalNumber(value.year) &&
  isOptionalString(value.genre) &&
  isOptionalNumber(value.durationMs) &&
  isOptionalNumber(value.bitrate) &&
  isOptionalNumber(value.sampleRate) &&
  isOptionalNumber(value.channels) &&
  isOptionalString(value.codec) &&
  isOptionalString(value.artId) &&
  isOptionalBoolean(value.artworkChecked) &&
  typeof value.sizeBytes === 'number' &&
  typeof value.mtimeMs === 'number' &&
  typeof value.addedAt === 'number' &&
  isOptionalBoolean(value.hasMetadataError) &&
  isOptionalNormalizationAnalysis(value.normalization);

export const emptyLibraryIndex = (): ILibraryIndex => ({
  version: 1,
  roots: [],
  tracks: [],
});

export const parseLibraryIndex = (raw: unknown): ILibraryIndex | undefined => {
  if (!isObject(raw) || raw.version !== 1) {
    return undefined;
  }
  if (!Array.isArray(raw.roots) || !Array.isArray(raw.tracks)) {
    return undefined;
  }
  const roots = raw.roots.filter(isLibraryRoot);
  const tracks = raw.tracks.filter(isLibraryTrack);
  // A dropped entry means the file holds something this version never wrote.
  // Trimming it silently would make a hand-edited or half-written index look
  // like a smaller-but-valid one instead of the corrupt file it is.
  if (
    roots.length !== raw.roots.length ||
    tracks.length !== raw.tracks.length
  ) {
    return undefined;
  }
  return { version: 1, roots, tracks };
};

export const libraryIndexPath = (userDataDir: string): string =>
  path.join(userDataDir, INDEX_FILENAME);

/** The index in `text`, or undefined when it is not one this version wrote. */
const parseLibraryIndexText = (text: string): ILibraryIndex | undefined => {
  try {
    return parseLibraryIndex(JSON.parse(text));
  } catch {
    return undefined;
  }
};

const backupUnreadableIndex = (target: string): void => {
  try {
    // Overwrites any previous .bak: only the most recent corruption is worth
    // keeping, and it is kept rather than deleted because a corrupt index is
    // still the only record of which folders the user added.
    fs.renameSync(target, `${target}.bak`);
  } catch (error) {
    // The index is being reset either way; losing the rename must still show
    // up in a bug report rather than vanish into an empty catch. Console is
    // this project's one sanctioned sink for a failure with no user to show
    // it to.
    // eslint-disable-next-line no-console
    console.error(
      `Could not preserve the unreadable library index at ${target}`,
      error,
    );
  }
};

export interface ILoadedLibraryIndex {
  index: ILibraryIndex;
  /** The file was there and could not be read; it is kept as `.bak`. */
  wasReset: boolean;
}

/** What a read of a file that exists comes to. */
const settleRead = (
  target: string,
  parsed: ILibraryIndex | undefined,
): ILoadedLibraryIndex => {
  if (parsed) {
    return { index: parsed, wasReset: false };
  }
  backupUnreadableIndex(target);
  return { index: emptyLibraryIndex(), wasReset: true };
};

const isMissingFile = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  (error as { code: unknown }).code === 'ENOENT';

/**
 * The index on disk, read without holding main while the disk answers.
 *
 * The index is one file of every track the library knows — 10-40 MB for
 * fourteen thousand, by how it was written — and it used to be read and
 * parsed synchronously at registration, which `main.ts` does at module scope:
 * in front of the first window, on every launch. `ipc/library.ts` now reads
 * it through here when something first needs it.
 */
export const readLibraryIndex = async (
  userDataDir: string,
): Promise<ILoadedLibraryIndex> => {
  const target = libraryIndexPath(userDataDir);
  try {
    return settleRead(
      target,
      parseLibraryIndexText(await fs.promises.readFile(target, 'utf8')),
    );
  } catch (error) {
    if (isMissingFile(error)) {
      return { index: emptyLibraryIndex(), wasReset: false };
    }
    // Any other failure to read is a file that is there and cannot be used,
    // the same as text that does not parse.
    return settleRead(target, undefined);
  }
};

/**
 * Each track's text in the file, kept for as long as the track object lives.
 *
 * A track is never changed in place — every edit in `ipc/library.ts` and
 * every scan builds a new object (`libraryIndexTracks.ts`) — so its text is
 * fixed the moment it exists, and a write only has to stringify the tracks
 * that are new since the last one. Joining the rest costs 10-15 ms for
 * fourteen thousand tracks, against 40-140 ms to stringify the whole index
 * (measured on a synthetic index; the high end is tracks carrying noise
 * profiles) — which is what every newly measured song used to cost main.
 */
const trackText = new WeakMap<ILibraryTrack, string>();

/** The same text `JSON.stringify` gives for the whole index. */
export const serializeLibraryIndex = (index: ILibraryIndex): string => {
  const { tracks, ...rest } = index;
  const body = tracks
    .map((track) => {
      const known = trackText.get(track);
      if (known !== undefined) {
        return known;
      }
      const text = JSON.stringify(track);
      trackText.set(track, text);
      return text;
    })
    .join(',');
  // `rest` always holds `version`, so its text ends in a `}` closing at least
  // one member; the tracks go in as the last.
  return `${JSON.stringify(rest).slice(0, -1)},"tracks":[${body}]}`;
};

/**
 * Asks for the index to be on disk soon, without holding main while it goes.
 *
 * Every change used to end in a `writeFileSync` of the whole index,
 * indented: 13-40 MB for fourteen thousand tracks, stringified and written on
 * main — 70-350 ms on a synthetic index that size, each time a newly played
 * song's loudness was kept. Now a change is a request. One write runs at a
 * time; the requests that arrive while it does collapse into one more, which
 * reads `current()` when it starts, so it writes the index as it is by then
 * and never a snapshot older than the last change. `asyncWriter` writes beside
 * the file and renames over it, and the quit waits for it
 * (`flushPendingWrites`). Compact rather than indented: the one reader is
 * `JSON.parse`, and the indentation was a third to half of the file.
 *
 * `writeFileNow`, not `scheduleWrite`: the operation already coalesces, and
 * `scheduleWrite` keeps each path's last text in memory to skip identical
 * writes — the whole index again, for a check `ipc/library.ts` makes before it
 * asks (a rescan that changed nothing asks for no write at all).
 */
export const writeLibraryIndexSoon = (
  userDataDir: string,
  current: () => ILibraryIndex,
): Promise<void> => {
  const target = libraryIndexPath(userDataDir);
  return scheduleWriteOperation(target, async () => {
    await fs.promises.mkdir(userDataDir, { recursive: true });
    await writeFileNow(target, serializeLibraryIndex(current()));
  });
};

export const trackPathById = (
  index: ILibraryIndex,
  id: string,
): string | undefined =>
  // Not a lookup object: an id from a URL could read 'constructor' or
  // 'toString' and come back with an inherited function instead of undefined.
  // Array#find has no prototype chain for that id to fall into.
  index.tracks.find((track) => track.id === id)?.path;
