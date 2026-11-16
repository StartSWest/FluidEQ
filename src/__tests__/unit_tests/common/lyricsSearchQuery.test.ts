/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What a lyrics site is asked for: the song's first artist and its own
 * title, cleaned of what a library adds to tags. Musixmatch answered
 * "Something went wrong" to the raw tags of one of Ivan's songs
 * (2026-11-15), "Nino Bravo,DjMrTrim. America, America----dueto con El
 * Consorcio". Each case stands beside a plain song that must pass through
 * unchanged, so a cleaner that ate everything would fail too.
 */

import {
  LYRICS_SITES,
  lyricsSearchQuery,
  lyricsSearchUrl,
} from '../../../common/library/lyricsSites';

describe('lyricsSearchQuery', () => {
  it('passes a plain song through as "Artist Title"', () => {
    expect(
      lyricsSearchQuery({
        artist: 'Roberto Jordan',
        title: 'Amor de estudiante',
      }),
    ).toBe('Roberto Jordan Amor de estudiante');
  });

  it('keeps the first artist and cuts the dashes and what follows them', () => {
    expect(
      lyricsSearchQuery({
        artist: 'Nino Bravo,DjMrTrim.',
        title: 'America, America----dueto con El Consorcio',
      }),
    ).toBe('Nino Bravo America America');
  });

  it('drops a featured credit and a bracketed note', () => {
    expect(
      lyricsSearchQuery({
        artist: 'Queen feat. David Bowie',
        title: 'Under Pressure (Remastered 2011)',
      }),
    ).toBe('Queen Under Pressure');
    expect(
      lyricsSearchQuery({
        artist: 'Daft Punk ft. Pharrell',
        title: 'Get Lucky [Radio Edit]',
      }),
    ).toBe('Daft Punk Get Lucky');
  });

  it('keeps a name an ampersand or a bare slash belongs to', () => {
    expect(
      lyricsSearchQuery({ artist: 'Simon & Garfunkel', title: 'The Boxer' }),
    ).toBe('Simon & Garfunkel The Boxer');
    expect(lyricsSearchQuery({ artist: 'AC/DC', title: 'Back In Black' })).toBe(
      'AC/DC Back In Black',
    );
    // A spaced slash separates two artists.
    expect(lyricsSearchQuery({ artist: 'A / B', title: 'X' })).toBe('A X');
    // "feat" inside a word is not a credit.
    expect(lyricsSearchQuery({ artist: 'Feather', title: 'Song' })).toBe(
      'Feather Song',
    );
  });

  it('keeps a title that would clean down to nothing', () => {
    expect(lyricsSearchQuery({ title: '(Intro)' })).toBe('(Intro)');
  });

  it('asks nothing for a song with no title', () => {
    expect(lyricsSearchQuery({ artist: 'Somebody', title: '  ' })).toBe(
      undefined,
    );
  });

  it('sends Musixmatch the cleaned query with its spaces as plus signs', () => {
    const musixmatch = LYRICS_SITES.find((site) => site.id === 'musixmatch');
    if (musixmatch === undefined) {
      throw new Error('Musixmatch is not a lyrics site');
    }
    expect(
      lyricsSearchUrl(musixmatch, {
        artist: 'Nino Bravo,DjMrTrim.',
        title: 'America, America----dueto con El Consorcio',
      }),
    ).toBe(
      'https://www.musixmatch.com/search?query=Nino+Bravo+America+America',
    );
  });
});
