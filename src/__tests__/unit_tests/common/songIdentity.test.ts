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

  it('cuts tracking off a media url but keeps the path', () => {
    const identity = buildSongIdentity(
      'media',
      'https://www.youtube.com/watch?v=abc&t=42s&si=track',
      'Song',
    );
    expect(identity?.key).toBe('media:https://www.youtube.com/watch');
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
