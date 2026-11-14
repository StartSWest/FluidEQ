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
 * The `fluideq-media://` URL grammar itself — pure string functions with no
 * Electron and no Node dependency, so both processes can import them
 * directly. `registerPrivilegedSchemes` and `handleLibraryMedia`, which
 * genuinely need `electron`, stay in `src/main/library/libraryProtocol.ts`;
 * this module exists because `LibraryCoverArt.tsx` (renderer) needs
 * `libraryMediaUrl` and importing it from that main-process file dragged
 * `electron`, `crypto`, `fs` and `path` into the renderer's production
 * webpack bundle, which cannot resolve any of them.
 */

export const LIBRARY_MEDIA_SCHEME = 'fluideq-media';

export const libraryMediaUrl = (kind: 'track' | 'art', id: string): string =>
  `${LIBRARY_MEDIA_SCHEME}://${kind}/${id}`;

/**
 * A cover's smaller pictures, each made by main from the cached 320-pixel
 * cover the first time it is asked for (`ensureSizedArtwork`):
 *
 * - `small`, for the rows that draw a cover at 30 to 36 CSS pixels (the
 *   list, Up Next, the player's bar). Measured over 14,000 songs, a row
 *   decoded the 320 cover to show 32 pixels — 61 times the pixels on screen.
 * - `medium`, for a grid tile (160 CSS pixels at most) on a display that
 *   does not need 320: the browser picks it from the tile's `srcset`.
 */
export type TCoverSize = 'small' | 'medium';

export const librarySizedArtUrl = (id: string, size: TCoverSize): string =>
  `${LIBRARY_MEDIA_SCHEME}://art/${id}?size=${size}`;

/**
 * Ids only, and never a path.
 *
 * The host carries the kind and the single path segment carries the id, which
 * has to survive a strict character test. A URL is the one input to this
 * process that arrives from a document, so it gets the narrowest possible
 * grammar rather than a sanitiser: a cover may name one of its sizes and
 * nothing else may carry a query at all.
 */
export const parseLibraryMediaUrl = (
  url: string,
):
  | { kind: 'track'; id: string }
  | { kind: 'art'; id: string; size?: TCoverSize }
  | undefined => {
  const match =
    /^fluideq-media:\/\/(track|art)\/([0-9a-f]{6,64})(?:\?size=(small|medium))?$/.exec(
      url,
    );
  if (!match) {
    return undefined;
  }
  const [, kind, id, size] = match;
  if (kind === 'art') {
    return size === 'small' || size === 'medium'
      ? { kind: 'art', id, size }
      : { kind: 'art', id };
  }
  return size === undefined ? { kind: 'track', id } : undefined;
};
