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

/**
 * The subtitle file each video was last watched with (Ivan, 2026-11-15:
 * "videos need to save the last used subs"), by the video's library id,
 * most recently chosen last. Bounded: past `MAX_REMEMBERED_SUBTITLES` the
 * longest-unwatched are forgotten, so a library of thousands of clips never
 * grows the store without end. A file that has since gone simply is not
 * found beside the video, and the video opens the way any unremembered one
 * does (`pickSubtitle`).
 */

/** A few hundred films: a long season of watching, and a few KB stored. */
export const MAX_REMEMBERED_SUBTITLES = 300;

/** What a library id and a file name may be, as stored by this app. */
const MAX_TEXT = 512;

const isEntry = (value: unknown): value is [string, string] =>
  Array.isArray(value) &&
  value.length === 2 &&
  typeof value[0] === 'string' &&
  typeof value[1] === 'string' &&
  value[0] !== '' &&
  value[1] !== '' &&
  value[0].length <= MAX_TEXT &&
  value[1].length <= MAX_TEXT;

/** The memory within its bound, the longest-unwatched dropped first. */
const trimmed = (memory: Map<string, string>): Map<string, string> => {
  const overflow = memory.size - MAX_REMEMBERED_SUBTITLES;
  if (overflow <= 0) {
    return memory;
  }
  return new Map([...memory].slice(overflow));
};

/**
 * The stored choices, oldest first, each checked on its own: an entry that
 * is not one is dropped and the rest kept. Nothing stored, or text that is
 * not a list, is no memory at all. Kept to the bound on the way in too, so
 * a store an older build wrote larger cannot outgrow it.
 */
export const parseSubtitleMemory = (
  raw: string | null,
): Map<string, string> => {
  let stored: unknown;
  try {
    stored = raw === null ? [] : (JSON.parse(raw) as unknown);
  } catch {
    // Not JSON: a hand edit, or another build's format.
    stored = [];
  }
  const entries = Array.isArray(stored) ? stored.filter(isEntry) : [];
  const memory = new Map<string, string>();
  entries.forEach(([videoId, fileName]) => {
    // A video named twice keeps its later choice, in the later place.
    memory.delete(videoId);
    memory.set(videoId, fileName);
  });
  return trimmed(memory);
};

/** The memory with this video's choice in it, as the most recent. */
export const withSubtitleChoice = (
  memory: ReadonlyMap<string, string>,
  videoId: string,
  fileName: string,
): Map<string, string> => {
  const next = new Map(memory);
  next.delete(videoId);
  next.set(videoId, fileName);
  return trimmed(next);
};

/** The memory without this video's choice: its file was removed. */
export const withoutSubtitleChoice = (
  memory: ReadonlyMap<string, string>,
  videoId: string,
): Map<string, string> => {
  const next = new Map(memory);
  next.delete(videoId);
  return next;
};

/** As stored: a list of pairs, oldest first. */
export const serialiseSubtitleMemory = (
  memory: ReadonlyMap<string, string>,
): string => JSON.stringify([...memory]);
