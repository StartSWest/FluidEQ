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
 * Initials for the tile drawn in place of a missing cover.
 *
 * Two characters where there are two words, two of one word, and a question
 * mark when there is nothing at all — a blank square in a grid reads as a
 * failed load rather than as an album with no art.
 */
export const libraryTileInitials = (label: string): string => {
  const words = label.trim().split(/\s+/).filter(Boolean);
  if (!words.length) {
    return '?';
  }
  if (words.length === 1) {
    return words[0].slice(0, 2).toLocaleUpperCase();
  }
  return `${words[0][0]}${words[1][0]}`.toLocaleUpperCase();
};

/**
 * A hue derived from the label, so it is the same on every launch.
 *
 * FNV-1a over the code points. Any stable hash would do; what matters is that
 * nothing here is random — a library that recolours itself between starts
 * looks broken in a way that is hard to describe and impossible to miss.
 */
export const libraryTileHue = (label: string): number => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < label.length; index += 1) {
    // eslint-disable-next-line no-bitwise -- FNV-1a hash requires bitwise XOR
    hash ^= label.charCodeAt(index);
    // eslint-disable-next-line no-bitwise -- FNV-1a hash requires bitwise operations
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash % 360;
};
