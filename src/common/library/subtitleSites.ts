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
 * Where a viewer can look a video's subtitles up for themselves, the
 * Subtitles tab's twin of `lyricsSites.ts` (Ivan, 2026-11-15: "change the
 * sites to ones that search subs for movies and videos"). LINKS ONLY, as
 * there: the site opens in the viewer's own browser, and what they download
 * is brought in by them (`subtitleImport.ts`). Only the video's tidied
 * title goes into the address.
 *
 * Each address was checked against the live site on 2026-11-15 with a
 * search for "the matrix" answering with its results:
 * - OpenSubtitles: its own path form, `/en/search2/sublanguageid-all/
 *   moviename-<query>`. The query-string form (`?MovieName=`) loses its
 *   query behind the site's bot check, which redirects to the path alone.
 * - SubDL: `/search/<query>`.
 * - Addic7ed: `search.php?search=<query>&Submit=Search`, its form's GET.
 * A `/` inside a query is read by the path forms as a new segment
 * (OpenSubtitles searched "Face" for "Face/Off"), so every site gets it as
 * a space, which each one's search treats the same as the slash.
 *
 * Podnapisi was considered and left out: its domain did not resolve on
 * the day these were checked, and a link that goes nowhere reads as a
 * broken app.
 */

export type TSubtitleSiteId = 'opensubtitles' | 'subdl' | 'addic7ed';

export interface ISubtitleSite {
  id: TSubtitleSiteId;
  /** The site's own name, never translated. */
  name: string;
  /** What the site is strongest at, said under its name. */
  covers: 'moviesAndTv' | 'tv';
  searchUrl: (query: string) => string;
}

const encoded = (query: string): string =>
  encodeURIComponent(query.replace(/\//g, ' ').replace(/\s+/g, ' ').trim());

export const SUBTITLE_SITES: readonly ISubtitleSite[] = [
  {
    id: 'opensubtitles',
    name: 'OpenSubtitles',
    covers: 'moviesAndTv',
    searchUrl: (query) =>
      `https://www.opensubtitles.org/en/search2/sublanguageid-all/moviename-${encoded(
        query,
      )}`,
  },
  {
    id: 'subdl',
    name: 'SubDL',
    covers: 'moviesAndTv',
    searchUrl: (query) => `https://subdl.com/search/${encoded(query)}`,
  },
  {
    id: 'addic7ed',
    name: 'Addic7ed',
    covers: 'tv',
    searchUrl: (query) =>
      `https://www.addic7ed.com/search.php?search=${encoded(
        query,
      )}&Submit=Search`,
  },
];

/**
 * Where a release name stops being the title: a year, a season and episode
 * (kept — "Show S01E02" is what an episode is searched by), or the first of
 * the tags a release group writes after the title. Only tags no title is
 * made of: "Web", "DVD" or "Extended" can be words of one ("Charlotte's
 * Web"), and cutting there loses the film.
 */
const RELEASE_TAG =
  /^(?:\d{3,4}p|bluray|blu-ray|bdrip|brrip|webrip|web-dl|webdl|hdtv|dvdrip|hdrip|remux|x264|x265|h264|h265|hevc|xvid|hdr10|ddp5|dts-hd)$/i;

const YEAR = /^\(?(?:19|20)\d{2}\)?$/;

const EPISODE = /^s\d{1,2}e\d{1,3}$/i;

/**
 * The video's title as somebody would type it into a subtitle site: a
 * release name's dots and underscores as spaces, and nothing from its year
 * or its first release tag on. Nothing when no title is left.
 */
export const subtitleSearchQuery = (video: {
  title: string;
}): string | undefined => {
  const words = video.title
    .replace(/[._]+/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .split(/\s+/)
    .filter((word) => word !== '');
  const kept: string[] = [];
  words.every((word, at) => {
    if (EPISODE.test(word)) {
      kept.push(word.toUpperCase());
      return false;
    }
    // A year that IS the title ("1917", "2012") is kept when nothing came
    // before it.
    if ((at > 0 && YEAR.test(word)) || RELEASE_TAG.test(word)) {
      return false;
    }
    kept.push(word);
    return true;
  });
  const query = kept.join(' ').trim();
  return query === '' ? undefined : query;
};

/** The site's search for this video, or nothing for a video with no title. */
export const subtitleSearchUrl = (
  site: ISubtitleSite,
  video: { title: string },
): string | undefined => {
  const query = subtitleSearchQuery(video);
  return query === undefined ? undefined : site.searchUrl(query);
};
