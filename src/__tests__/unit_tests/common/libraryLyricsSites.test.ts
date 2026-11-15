/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import {
  LYRICS_SITES,
  lyricsSearchQuery,
  lyricsSearchUrl,
} from 'common/library/lyricsSites';
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
