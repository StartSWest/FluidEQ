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
 * `/search` with `q`, and Musixmatch's search is `/search?query=` - the
 * address its own search box leaves, given by Ivan on 2026-11-15 after the
 * `/search/<query>` path lyrics tools build answered "Forbidden".
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
    // `?query=`, its spaces as `+`: the path form `/search/<query>` answers
    // "Forbidden" (Ivan, 2026-11-15, with the address of a search he made
    // there: musixmatch.com/search?query=roberto+Jordan).
    searchUrl: (query) =>
      `https://www.musixmatch.com/search?query=${encodeURIComponent(
        query,
      ).replace(/%20/g, '+')}`,
  },
];

/** What a search needs to know about a song, and nothing more. */
export interface ILyricsSearchSong {
  title: string;
  artist?: string;
  albumArtist?: string;
}

/** Stray spacing folded to one space and trimmed. */
const tidy = (text: string | undefined): string =>
  (text ?? '').replace(/\s+/g, ' ').trim();

/**
 * The first artist a tag names: "Nino Bravo,DjMrTrim." is Nino Bravo, as are
 * "Nino Bravo; X", "Nino Bravo feat. X" and "Nino Bravo / X". The others are
 * what a search site does not know the song by. An ampersand or a slash with
 * no space round it is part of a name: Simon & Garfunkel, AC/DC.
 */
const ARTIST_SEPARATOR =
  /\s*(?:[,;]|\s\/\s|\bfeat\.?(?=\s)|\bft\.?(?=\s)|\bfeaturing\b)\s*/i;

const firstArtist = (artist: string): string =>
  tidy(artist.split(ARTIST_SEPARATOR)[0])
    // The full stop and dashes a tagger leaves at the end of a name.
    .replace(/[\s._-]+$/, '');

/**
 * The song's own title, without what a library's files add to it: a run of
 * dashes or underscores and whatever follows ("America, America----dueto con
 * El Consorcio"), a bracketed note ("(Remastered 2011)", "[Live]"), a "feat."
 * credit; and the commas and other marks a search box treats as syntax
 * turned to spaces. Nothing left of it, the title as it was.
 */
const searchTitle = (title: string): string => {
  const cleaned = tidy(
    title
      .replace(/\s*(?:-{2,}|_{2,}).*$/, '')
      .replace(/\s*[([{][^)\]}]*[)\]}]/g, ' ')
      .replace(/\s+(?:feat\.?|ft\.?|featuring)\s.*$/i, '')
      .replace(/[,;:!?"“”«»|]+/g, ' '),
  );
  return cleaned === '' ? tidy(title) : cleaned;
};

/**
 * "Artist Title", the way a listener would type it: the song's first artist
 * (or its album's, where the song names none) and its own title, cleaned of
 * what a library adds to tags (Ivan, 2026-11-15: Musixmatch answered
 * "Something went wrong" to "Nino Bravo,DjMrTrim. America, America----dueto
 * con El Consorcio"). Nothing when the title is empty — a search for an
 * artist alone finds everything they ever wrote.
 */
export const lyricsSearchQuery = (
  song: ILyricsSearchSong,
): string | undefined => {
  const title = searchTitle(tidy(song.title));
  if (title === '') {
    return undefined;
  }
  const artist =
    firstArtist(tidy(song.artist)) || firstArtist(tidy(song.albumArtist));
  return artist === '' ? title : `${artist} ${title}`;
};

export const lyricsSearchUrl = (
  site: ILyricsSite,
  song: ILyricsSearchSong,
): string | undefined => {
  const query = lyricsSearchQuery(song);
  return query === undefined ? undefined : site.searchUrl(query);
};
