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

import { buildSongIdentity, normalizeSongAlias } from 'common/songIdentity';

describe('normalizeSongAlias', () => {
  it('collapses platform noise onto the same alias', () => {
    // Every one of these is the same recording wearing a different hat on a
    // different service, and they must land on one key or a curve learned in
    // the browser is invisible to the library.
    const expected = normalizeSongAlias('Black Dog', 'Led Zeppelin');
    expect(expected).toBeDefined();
    [
      'Black Dog (Official Video)',
      'Black Dog [4K]',
      'Black Dog (Official Audio)',
      'Black Dog (Lyrics)',
      '  Black   Dog  ',
      'Black Dog (feat. Nobody)',
    ].forEach((title) => {
      expect(normalizeSongAlias(title, 'Led Zeppelin')).toBe(expected);
    });
  });

  it('keeps different recordings apart', () => {
    // THE POSITIVE CONTROL FOR THE TEST ABOVE. A normaliser that returned a
    // constant would pass the collapse test perfectly, so this is what proves
    // it is doing work rather than flattening everything.
    const original = normalizeSongAlias('Black Dog', 'Led Zeppelin');
    [
      'Black Dog (Remastered 2011)',
      'Black Dog (Live at Wembley)',
      'Black Dog (Acoustic)',
      'Black Dog (Radio Edit)',
    ].forEach((title) => {
      expect(normalizeSongAlias(title, 'Led Zeppelin')).not.toBe(original);
    });
    expect(normalizeSongAlias('Black Dog', 'Someone Else')).not.toBe(original);
  });

  it('refuses an alias for what is only a page title', () => {
    // No artist, and nothing about the title that reads as a track. Giving
    // this an alias would let two unrelated browser tabs share a curve.
    expect(normalizeSongAlias('How CPUs Work - An Explainer')).toBeUndefined();
    expect(normalizeSongAlias('')).toBeUndefined();
  });

  it('still aliases a bare title that carried platform noise', () => {
    // Positive control for the refusal above: no artist, but the noise proves
    // it came off a media page describing a track.
    expect(normalizeSongAlias('Black Dog (Official Video)')).toBeDefined();
  });

  it('reads a typographic apostrophe as the same character as a straight one', () => {
    // Titles scraped from media pages use U+2019 where a tag file uses '.
    // Without this the same song aliases two ways depending on where it was
    // playing, which is the one thing this module exists to prevent.
    expect(normalizeSongAlias(`Don’t Stop Believin’`, 'Journey')).toBe(
      normalizeSongAlias("Don't Stop Believin'", 'Journey'),
    );
  });
});

describe('buildSongIdentity', () => {
  it('keys each source in its own namespace', () => {
    expect(buildSongIdentity('library', 'abc123', 'Song')?.key).toBe(
      'library:abc123',
    );
    expect(buildSongIdentity('karaoke', 'proj-7', 'Song')?.key).toBe(
      'karaoke:proj-7',
    );
  });

  it('cuts tracking off a media url but keeps what names the video', () => {
    const identity = buildSongIdentity(
      'media',
      'https://www.youtube.com/watch?v=abc&t=42s&si=track',
      'Song',
    );
    expect(identity?.key).toBe('media:https://www.youtube.com/watch?v=abc');
  });

  it('gives two different videos on the same site different keys', () => {
    // THE POSITIVE CONTROL FOR THE CUT ABOVE. A denylist that dropped `v` as
    // well as the tracking parameters would merge every video on the site
    // onto the one key `media:https://www.youtube.com/watch` — the exact bug
    // this fix exists to remove.
    const first = buildSongIdentity(
      'media',
      'https://www.youtube.com/watch?v=abc',
      'Song A',
    );
    const second = buildSongIdentity(
      'media',
      'https://www.youtube.com/watch?v=xyz',
      'Song B',
    );
    expect(first?.key).not.toBe(second?.key);
  });

  it('keys a video the same however its parameters are ordered', () => {
    // The denylist's survivors are sorted for exactly this: two loads of one
    // video that differ only in parameter order must not mint two keys.
    const reordered = buildSongIdentity(
      'media',
      'https://www.youtube.com/watch?si=track&v=abc&t=42s',
      'Song',
    );
    expect(reordered?.key).toBe('media:https://www.youtube.com/watch?v=abc');
  });

  it('gives two tracks of one album page two keys, though the url never moves', () => {
    // Bandcamp, Suno, YouTube Music radio, the Spotify web player: the queue
    // advances and the URL does not. Keyed on the URL alone the recorder saw
    // no identity change at all — one session for the whole album, its
    // listened time accumulating across every track, filed under the first
    // one's title, and that curve then applied to all of them.
    //
    // Fails if `mediaKey` stops folding the published title in.
    const album = 'https://artist.bandcamp.com/album/one';
    const first = buildSongIdentity(
      'media',
      album,
      'Opener',
      'Artist',
      'Opener',
    );
    const second = buildSongIdentity(
      'media',
      album,
      'Closer',
      'Artist',
      'Closer',
    );
    expect(first?.key).toBe(
      'media:https://artist.bandcamp.com/album/one#opener',
    );
    expect(first?.key).not.toBe(second?.key);
  });

  it('keeps one key for one track however its published title is spelled', () => {
    // The positive control for the split above: the fold is COLLAPSED, so a
    // republished title with different punctuation or spacing is still the
    // same track and not a second entry to learn from scratch.
    const album = 'https://artist.bandcamp.com/album/one';
    expect(
      buildSongIdentity('media', album, 'Rock N Roll', 'Artist', 'Rock N Roll')
        ?.key,
    ).toBe(
      buildSongIdentity(
        'media',
        album,
        'Rock-n-Roll',
        'Artist',
        '  Rock-n-Roll  ',
      )?.key,
    );
  });

  it('keys a media page on its url alone when the page publishes no track', () => {
    // Most of the web has no `mediaSession.metadata`, and the title the bar
    // falls back to is the document's — the site, not the song. Folding that
    // in would put "youtube" in the key of every page that never published
    // anything.
    expect(
      buildSongIdentity(
        'media',
        'https://www.youtube.com/watch?v=abc',
        'YouTube',
      )?.key,
    ).toBe('media:https://www.youtube.com/watch?v=abc');
  });

  it('puts title and artist in a system key, because the app alone is not a song', () => {
    const identity = buildSongIdentity(
      'system',
      'Spotify.exe',
      'Black Dog',
      'Led Zeppelin',
    );
    expect(identity?.key).toBe('system:Spotify.exe:black dog:led zeppelin');
  });

  it('never gives karaoke an alias', () => {
    // Its mix has the vocals pulled out. A curve learned there is not a curve
    // for the record, and an alias would quietly apply one to the other.
    const identity = buildSongIdentity(
      'karaoke',
      'proj-7',
      'Black Dog',
      'Led Zeppelin',
    );
    expect(identity?.alias).toBeUndefined();
  });

  it('gives the other three an alias when there is one to give', () => {
    // Positive control: proves the karaoke case above is a rule and not the
    // whole function returning undefined.
    (['library', 'media', 'system'] as const).forEach((source) => {
      expect(
        buildSongIdentity(source, 'x', 'Black Dog', 'Led Zeppelin')?.alias,
      ).toBeDefined();
    });
  });

  it('is nothing at all without a title', () => {
    expect(buildSongIdentity('library', 'abc123', '')).toBeUndefined();
    expect(buildSongIdentity('library', 'abc123', '   ')).toBeUndefined();
  });
});
