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

import {
  isLibraryPlayable,
  isUltraStarText,
  karaokeLyricCandidates,
  libraryFileKind,
  libraryTitleFromFileName,
} from '../../../common/library/files';

describe('classifying a file the scanner has found', () => {
  it('sorts audio from video and knows what Chromium can decode', () => {
    expect(libraryFileKind('song.flac')).toBe('audio');
    expect(libraryFileKind('clip.MP4')).toBe('video');
    expect(libraryFileKind('notes.txt')).toBeUndefined();
    expect(libraryFileKind('no-extension')).toBeUndefined();
  });

  it('lists formats it cannot play rather than hiding them', () => {
    // A recognised-but-unplayable file has to reach the UI, or the library
    // silently loses half of somebody's collection and never says why.
    expect(libraryFileKind('movie.mkv')).toBe('video');
    expect(isLibraryPlayable('movie.mkv')).toBe(false);
    expect(isLibraryPlayable('track.wma')).toBe(false);
    expect(isLibraryPlayable('track.mp3')).toBe(true);
    expect(isLibraryPlayable('clip.webm')).toBe(true);
  });

  it('makes a readable title out of a filename', () => {
    expect(
      libraryTitleFromFileName('04 - Regi_Should Have Been There.mp3'),
    ).toBe('Regi Should Have Been There');
    expect(libraryTitleFromFileName('01.Song.mp3')).toBe('Song');
  });
});

describe('keeping karaoke songs out of the library', () => {
  it('pairs a song with its lyric file by base name', () => {
    const found = karaokeLyricCandidates('Song.mp3', [
      'Song.mp3',
      'Song.lrc',
      'Other.lrc',
    ]);
    expect(found.certain).toEqual(['Song.lrc']);
    expect(found.needsContentCheck).toEqual([]);
  });

  it('defers a .txt sibling to a content check', () => {
    // A .txt beside an MP3 is as often a tracklist as an UltraStar chart, so
    // the extension alone must not exclude the song.
    const found = karaokeLyricCandidates('Song.mp3', ['Song.mp3', 'Song.txt']);
    expect(found.certain).toEqual([]);
    expect(found.needsContentCheck).toEqual(['Song.txt']);
  });

  it('finds no pairing for an ordinary album folder', () => {
    // The positive control. Without it, a function that returns nothing for
    // every input passes the two tests above and destroys the library.
    const found = karaokeLyricCandidates('Song.mp3', [
      'Song.mp3',
      'cover.jpg',
      'Another Song.mp3',
    ]);
    expect(found.certain).toEqual([]);
    expect(found.needsContentCheck).toEqual([]);
  });

  it('recognises an UltraStar chart by its contents', () => {
    expect(isUltraStarText('#TITLE:Song\n#BPM:200\n: 0 4 0 Hel~\n')).toBe(true);
    expect(isUltraStarText('1. Intro\n2. Verse\n')).toBe(false);
  });
});
