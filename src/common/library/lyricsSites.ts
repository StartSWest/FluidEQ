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
 * Where a listener can look a song's lyrics up for themselves: a search on
 * three sites that publish lyrics legitimately, opened in their own browser.
 *
 * LINKS ONLY. FluidEQ is sold and lyrics are copyrighted, so the app never
 * fetches a lyrics page or calls a lyrics API: the listener opens the site,
 * and imports what they downloaded or copied (`lyricsImport.ts`).
 *
 * Only the song's artist and title go into the address — nothing else about
 * the listener or their library — and both are percent-encoded whole, a `/`
 * included, so an "AC/DC" stays one search and never becomes a path.
 *
 * The address shapes were checked against each site on 2026-11-15: LRCLIB's
 * own router serves `/search/:keyword`, Genius's search form is a GET to
 * `/search` with `q`, and Musixmatch's search lives at `/search/<query>`
 * (it refuses scripted requests, so that one is the shape lyrics tools such
 * as spotDL build, not a page fetched here).
 */

export type TLyricsSiteId = 'lrclib' | 'genius' | 'musixmatch';

export interface ILyricsSite {
  id: TLyricsSiteId;
  /** The site's own name, never translated. */
  name: string;
  /** Free to download timed `.lrc` files, rather than words to copy. */
  isFreeSynced: boolean;
  searchUrl: (query: string) => string;
}

export const LYRICS_SITES: readonly ILyricsSite[] = [
  {
    id: 'lrclib',
    name: 'LRCLIB',
    isFreeSynced: true,
    searchUrl: (query) =>
      `https://lrclib.net/search/${encodeURIComponent(query)}`,
  },
  {
    id: 'genius',
    name: 'Genius',
    isFreeSynced: false,
    searchUrl: (query) =>
      `https://genius.com/search?q=${encodeURIComponent(query)}`,
  },
  {
    id: 'musixmatch',
    name: 'Musixmatch',
    isFreeSynced: false,
    searchUrl: (query) =>
      `https://www.musixmatch.com/search/${encodeURIComponent(query)}`,
  },
];

/** What a search needs to know about a song, and nothing more. */
export interface ILyricsSearchSong {
  title: string;
  artist?: string;
  albumArtist?: string;
}

/**
 * "Artist Title", the way a listener would type it: the song's artist (or
 * its album's, where the song names none) and its title, each tidied of
 * stray spacing. Nothing when the title is empty — a search for an artist
 * alone finds everything they ever wrote.
 */
export const lyricsSearchQuery = (
  song: ILyricsSearchSong,
): string | undefined => {
  const tidy = (text: string | undefined) =>
    (text ?? '').replace(/\s+/g, ' ').trim();
  const title = tidy(song.title);
  if (title === '') {
    return undefined;
  }
  const artist = tidy(song.artist) || tidy(song.albumArtist);
  return artist === '' ? title : `${artist} ${title}`;
};

/** The site's search for this song, or nothing for a song with no title. */
export const lyricsSearchUrl = (
  site: ILyricsSite,
  song: ILyricsSearchSong,
): string | undefined => {
  const query = lyricsSearchQuery(song);
  return query === undefined ? undefined : site.searchUrl(query);
};
