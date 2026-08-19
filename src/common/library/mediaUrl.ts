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
 * directly. `registerLibraryMediaScheme` and `handleLibraryMedia`, which
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
 * Ids only, and never a path.
 *
 * The host carries the kind and the single path segment carries the id, which
 * has to survive a strict character test. A URL is the one input to this
 * process that arrives from a document, so it gets the narrowest possible
 * grammar rather than a sanitiser.
 */
export const parseLibraryMediaUrl = (
  url: string,
): { kind: 'track' | 'art'; id: string } | undefined => {
  const match = /^fluideq-media:\/\/(track|art)\/([0-9a-f]{6,64})$/.exec(url);
  if (!match) {
    return undefined;
  }
  return { kind: match[1] === 'art' ? 'art' : 'track', id: match[2] };
};
