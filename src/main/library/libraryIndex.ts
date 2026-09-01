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

const isNormalizationAnalysis = (
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

const readLibraryIndexFile = (target: string): ILibraryIndex | undefined => {
  try {
    return parseLibraryIndex(JSON.parse(fs.readFileSync(target, 'utf8')));
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

export const loadLibraryIndex = (
  userDataDir: string,
): { index: ILibraryIndex; wasReset: boolean } => {
  const target = libraryIndexPath(userDataDir);
  if (!fs.existsSync(target)) {
    return { index: emptyLibraryIndex(), wasReset: false };
  }
  const parsed = readLibraryIndexFile(target);
  if (parsed) {
    return { index: parsed, wasReset: false };
  }
  backupUnreadableIndex(target);
  return { index: emptyLibraryIndex(), wasReset: true };
};

export const saveLibraryIndex = (
  userDataDir: string,
  index: ILibraryIndex,
): void => {
  fs.mkdirSync(userDataDir, { recursive: true });
  const target = libraryIndexPath(userDataDir);
  const temporary = `${target}.tmp`;
  // A write that dies partway through leaves the .tmp file damaged, not the
  // index a scan is about to be checked against; the rename that follows is
  // atomic on both NTFS and the POSIX filesystems this app ships on.
  fs.writeFileSync(temporary, JSON.stringify(index, null, 2), 'utf8');
  fs.renameSync(temporary, target);
};

export const trackPathById = (
  index: ILibraryIndex,
  id: string,
): string | undefined =>
  // Not a lookup object: an id from a URL could read 'constructor' or
  // 'toString' and come back with an inherited function instead of undefined.
  // Array#find has no prototype chain for that id to fall into.
  index.tracks.find((track) => track.id === id)?.path;
