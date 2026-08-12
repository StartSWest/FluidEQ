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

import { setKaraokeRelativePath } from '../../common/karaoke/files';

const readFileEntry = (entry: FileSystemFileEntry): Promise<File> =>
  new Promise((resolve, reject) => {
    entry.file(
      (file) =>
        resolve(
          setKaraokeRelativePath(file, entry.fullPath.replace(/^\/+/, '')),
        ),
      reject,
    );
  });

const readDirectory = async (
  entry: FileSystemDirectoryEntry,
): Promise<FileSystemEntry[]> => {
  const reader = entry.createReader();
  const entries: FileSystemEntry[] = [];
  // Chromium returns directory entries in batches and an empty batch at EOF.
  // Reading only once silently truncates larger karaoke folders.
  let batch: FileSystemEntry[];
  do {
    batch = await new Promise<FileSystemEntry[]>((resolve, reject) => {
      reader.readEntries(resolve, reject);
    });
    entries.push(...batch);
  } while (batch.length > 0);
  return entries;
};

const walkEntry = async (entry: FileSystemEntry): Promise<File[]> => {
  if (entry.isFile) {
    return [await readFileEntry(entry as FileSystemFileEntry)];
  }
  if (!entry.isDirectory) {
    return [];
  }
  const children = await readDirectory(entry as FileSystemDirectoryEntry);
  const nested = await Promise.all(children.map(walkEntry));
  return nested.flat();
};

/** Collect ordinary files and recursively traverse Chromium folder drops. */
const collectKaraokeDropFiles = async (
  dataTransfer: DataTransfer,
): Promise<File[]> => {
  const entries = Array.from(dataTransfer.items || [])
    .filter((item) => item.kind === 'file')
    .map((item) => item.webkitGetAsEntry())
    .filter((entry): entry is FileSystemEntry => Boolean(entry));
  if (!entries.length) {
    return Array.from(dataTransfer.files || []);
  }
  const files = (await Promise.all(entries.map(walkEntry))).flat();
  return files.sort((left, right) => left.name.localeCompare(right.name));
};

export default collectKaraokeDropFiles;
