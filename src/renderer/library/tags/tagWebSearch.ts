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
 * An album looked up on the web BY THE LISTENER, in their own browser, on a
 * press: FluidEQ fetches nothing, asks no service anything and stores
 * nothing from the web. The listener picks a picture and pastes or drops it
 * on the cover, or reads what an album page says and types it. Ivan,
 * 2026-11-16: "I wanna make sure nobody can ever sue me ... not automatic,
 * they need to push a button". A cover service or a tag service queried by
 * the app itself is a contract and a picture's rights the app would be
 * answering for; a search opened in the browser is the listener's own.
 */

const queryOf = (parts: readonly (string | undefined)[]): string =>
  parts
    .map((part) => (part ?? '').trim())
    .filter((part) => part !== '')
    .join(' ');

/** An image search for the album's cover. */
export const coverSearchUrl = (artist?: string, album?: string): string =>
  `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(
    queryOf([artist, album, 'cover']),
  )}`;

/** The album among MusicBrainz's releases: title, year, every song. */
export const albumSearchUrl = (artist?: string, album?: string): string =>
  `https://musicbrainz.org/search?type=release&method=indexed&query=${encodeURIComponent(
    queryOf([album, artist]),
  )}`;

/**
 * Hands the address to the main window's link rule, which opens http(s) in
 * the browser and nothing else (`safeExternal.ts`).
 */
export const openInBrowser = (url: string): void => {
  window.open(url, '_blank', 'noopener,noreferrer');
};
