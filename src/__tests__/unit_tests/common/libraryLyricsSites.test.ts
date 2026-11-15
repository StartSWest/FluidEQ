/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import {
  LYRICS_SITES,
  lyricsSearchQuery,
  lyricsSearchUrl,
} from 'common/library/lyricsSites';
import {
  SUBTITLE_SITES,
  subtitleSearchQuery,
  subtitleSearchUrl,
} from 'common/library/subtitleSites';
import type { ILibraryTrack } from 'common/library/types';

/**
 * The Lyrics tab's links to lyrics sites: a search for the song's artist and
 * title, percent-encoded whole, and nothing else about the listener or
 * their library in the address.
 */

const site = (id: string) => {
  const found = LYRICS_SITES.find((candidate) => candidate.id === id);
  if (found === undefined) {
    throw new Error(`no site ${id}`);
  }
  return found;
};

const song: ILibraryTrack = {
  id: 'track-7f3a',
  rootId: 'root-1',
  path: 'C:\\Users\\listener\\Music\\Private Folder\\AC-DC - Back in Black.flac',
  kind: 'audio',
  isPlayable: true,
  title: 'Back in Black',
  artist: 'AC/DC',
  album: 'Secret Album Name',
  genre: 'Rock',
  sizeBytes: 1,
  mtimeMs: 1,
  addedAt: 1,
};

describe('lyrics site searches', () => {
  it('offers LRCLIB, Genius and Musixmatch, LRCLIB as the free timed one', () => {
    expect(LYRICS_SITES.map((candidate) => candidate.id)).toEqual([
      'lrclib',
      'genius',
      'musixmatch',
    ]);
    expect(
      LYRICS_SITES.filter((candidate) => candidate.isFreeSynced).map(
        (candidate) => candidate.id,
      ),
    ).toEqual(['lrclib']);
  });

  it('builds each site’s own search address from artist and title', () => {
    expect(lyricsSearchUrl(site('lrclib'), song)).toBe(
      'https://lrclib.net/search/AC%2FDC%20Back%20in%20Black',
    );
    expect(lyricsSearchUrl(site('genius'), song)).toBe(
      'https://genius.com/search?q=AC%2FDC%20Back%20in%20Black',
    );
    expect(lyricsSearchUrl(site('musixmatch'), song)).toBe(
      'https://www.musixmatch.com/search?query=AC%2FDC+Back+in+Black',
    );
  });

  it('puts nothing but the artist and title in the address', () => {
    LYRICS_SITES.forEach((candidate) => {
      const url = lyricsSearchUrl(candidate, song) ?? '';
      // A query value's spaces travel as `+`.
      const decoded = decodeURIComponent(url.replace(/\+/g, ' '));
      ['listener', 'Private Folder', 'Secret Album Name', 'Rock', 'track-7f3a']
        .concat(['root-1', '.flac'])
        .forEach((private_) => expect(decoded).not.toContain(private_));
      expect(decoded).toContain('AC/DC Back in Black');
    });
  });

  it('encodes every character that would change the address’s meaning', () => {
    const tricky = {
      title: 'Why? #1 & 50% off/on',
      artist: 'Ünder ⁄ Ñame',
    };
    LYRICS_SITES.forEach((candidate) => {
      const url = new URL(lyricsSearchUrl(candidate, tricky) ?? '');
      // One path segment, or one query value: never a new path, fragment or
      // parameter of the user's making.
      expect(url.hash).toBe('');
      expect(url.host).toMatch(
        /^(lrclib\.net|genius\.com|www\.musixmatch\.com)$/,
      );
      let query: string | null;
      if (candidate.id === 'genius') {
        query = url.searchParams.get('q');
      } else if (candidate.id === 'musixmatch') {
        query = url.searchParams.get('query');
      } else {
        query = decodeURIComponent(url.pathname.replace(/^\/search\//, ''));
      }
      expect(query).toBe('Ünder ⁄ Ñame Why? #1 & 50% off/on');
      // Genius and Musixmatch: `/search` and their one parameter. LRCLIB:
      // `/search/` and one segment, with no parameters at all.
      const shape = {
        genius: [2, ['q']],
        musixmatch: [2, ['query']],
        lrclib: [3, []],
      }[candidate.id];
      expect([
        url.pathname.split('/').length,
        [...url.searchParams.keys()],
      ]).toEqual(shape);
    });
  });

  it('falls back to the album artist, then the title alone, tidying spaces', () => {
    expect(
      lyricsSearchQuery({
        title: '  Night   Bus ',
        albumArtist: ' The Late  Trains',
      }),
    ).toBe('The Late Trains Night Bus');
    expect(lyricsSearchQuery({ title: 'Night Bus', artist: '   ' })).toBe(
      'Night Bus',
    );
  });

  it('offers no search for a song with no title', () => {
    expect(lyricsSearchQuery({ title: '  ', artist: 'Someone' })).toBe(
      undefined,
    );
    expect(lyricsSearchUrl(site('genius'), { title: '' })).toBe(undefined);
  });
});

/**
 * A video's Subtitles tab searches subtitle sites instead, with the video's
 * title tidied out of a release name; a song's tab keeps the lyric sites
 * above, untouched.
 */
describe('subtitle site searches', () => {
  const subSite = (id: string) => {
    const found = SUBTITLE_SITES.find((candidate) => candidate.id === id);
    if (found === undefined) {
      throw new Error(`no subtitle site ${id}`);
    }
    return found;
  };

  it('offers OpenSubtitles, SubDL and Addic7ed, and none of the lyric sites', () => {
    expect(SUBTITLE_SITES.map((candidate) => candidate.name)).toEqual([
      'OpenSubtitles',
      'SubDL',
      'Addic7ed',
    ]);
    const lyricHosts = LYRICS_SITES.map(
      (candidate) => new URL(candidate.searchUrl('x')).host,
    );
    SUBTITLE_SITES.forEach((candidate) => {
      expect(lyricHosts).not.toContain(new URL(candidate.searchUrl('x')).host);
    });
  });

  it('builds each search in the shape its site answers, checked live on 2026-11-15', () => {
    expect(subSite('opensubtitles').searchUrl('The Matrix')).toBe(
      'https://www.opensubtitles.org/en/search2/sublanguageid-all/moviename-The%20Matrix',
    );
    expect(subSite('subdl').searchUrl('The Matrix')).toBe(
      'https://subdl.com/search/The%20Matrix',
    );
    expect(subSite('addic7ed').searchUrl('The Office')).toBe(
      'https://www.addic7ed.com/search.php?search=The%20Office&Submit=Search',
    );
  });

  it('gives a slash as a space, so a path search stays one search', () => {
    SUBTITLE_SITES.forEach((candidate) => {
      const url = candidate.searchUrl('Face/Off');
      expect(url).not.toContain('Face/Off');
      expect(url).not.toContain('%2F');
      expect(url).toContain('Face%20Off');
    });
    // The control: an accent is encoded, not dropped.
    expect(subSite('subdl').searchUrl('Amélie')).toBe(
      'https://subdl.com/search/Am%C3%A9lie',
    );
  });

  it('searches a release name by its title, an episode by its code', () => {
    expect(
      subtitleSearchQuery({ title: 'The.Matrix.1999.1080p.BluRay.x264' }),
    ).toBe('The Matrix');
    expect(subtitleSearchQuery({ title: 'Some_Show.S02E05.720p.WEB-DL' })).toBe(
      'Some Show S02E05',
    );
    // A title that is a year keeps it; a title with "Web" in it is not cut.
    expect(subtitleSearchQuery({ title: '1917 (2019)' })).toBe('1917');
    expect(subtitleSearchQuery({ title: "Charlotte's Web" })).toBe(
      "Charlotte's Web",
    );
    // The control: a plain title passes through as it is.
    expect(subtitleSearchQuery({ title: 'Amélie' })).toBe('Amélie');
  });

  it('offers no search for a video with no title left', () => {
    expect(subtitleSearchQuery({ title: '1080p.x265' })).toBe(undefined);
    expect(subtitleSearchUrl(subSite('subdl'), { title: ' ' })).toBe(undefined);
    expect(subtitleSearchUrl(subSite('subdl'), { title: 'Heat' })).toBe(
      'https://subdl.com/search/Heat',
    );
  });
});
