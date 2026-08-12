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
  karaokeFileBaseName,
  parseKaraokeText,
  selectKaraokePlaylist,
  selectKaraokeFiles,
  setKaraokeRelativePath,
} from '../../../common/karaoke/files';

const file = (name: string, type = '') => new File(['fixture'], name, { type });

describe('Karaoke local file selection', () => {
  it('normalizes accents and separators for same-song pairing', () => {
    expect(karaokeFileBaseName('Canción_de-Prueba.LRC')).toBe(
      'cancion de prueba',
    );
  });

  it('accepts an explicit audio-only or audio-plus-lyrics selection', () => {
    expect(selectKaraokeFiles([file('song.mp3')])).toMatchObject({
      kind: 'ready',
      audio: { name: 'song.mp3' },
    });
    expect(
      selectKaraokeFiles([file('track.flac'), file('words.lrc')]),
    ).toMatchObject({
      kind: 'ready',
      audio: { name: 'track.flac' },
      lyrics: { name: 'words.lrc' },
    });
  });

  it('finds one normalized basename pair in a larger drop', () => {
    expect(
      selectKaraokeFiles([
        file('other.wav'),
        file('My Song.ogg'),
        file('my-song.elrc'),
      ]),
    ).toMatchObject({
      kind: 'ready',
      audio: { name: 'My Song.ogg' },
      lyrics: { name: 'my-song.elrc' },
    });
  });

  it('does not guess when selection is missing audio or is ambiguous', () => {
    expect(selectKaraokeFiles([file('lyrics.lrc')]).kind).toBe('missing-audio');
    expect(
      selectKaraokeFiles([file('one.mp3'), file('two.wav'), file('words.lrc')])
        .kind,
    ).toBe('ambiguous');
    expect(selectKaraokeFiles([file('archive.zip')]).kind).toBe('unsupported');
  });

  it('builds every same-name audio and lyric pair in a folder', () => {
    const firstAudio = setKaraokeRelativePath(
      file('Artist - First.mp3'),
      'Album/Artist - First.mp3',
    );
    const firstLyrics = setKaraokeRelativePath(
      file('Artist - First.txt'),
      'Album/Artist - First.txt',
    );
    const secondAudio = setKaraokeRelativePath(
      file('Artist - Second.ogg'),
      'Album/Artist - Second.ogg',
    );
    const license = setKaraokeRelativePath(
      file('License.txt'),
      'Album/License.txt',
    );

    const selection = selectKaraokePlaylist([
      license,
      secondAudio,
      firstLyrics,
      firstAudio,
      file('cover.jpg'),
    ]);

    expect(selection.items).toHaveLength(2);
    expect(selection.items[0]).toMatchObject({
      audio: { name: 'Artist - First.mp3' },
      lyrics: { name: 'Artist - First.txt' },
    });
    expect(selection.items[1]).toMatchObject({
      audio: { name: 'Artist - Second.ogg' },
      lyrics: undefined,
    });
    expect(selection.unpairedLyrics).toEqual([license]);
    expect(selection.ignored[0].name).toBe('cover.jpg');
  });

  it('does not cross-pair identical names from different subfolders', () => {
    const files = [
      setKaraokeRelativePath(file('Song.mp3'), 'Disc 1/Song.mp3'),
      setKaraokeRelativePath(file('Song.txt'), 'Disc 1/Song.txt'),
      setKaraokeRelativePath(file('Song.mp3'), 'Disc 2/Song.mp3'),
      setKaraokeRelativePath(file('Song.txt'), 'Disc 2/Song.txt'),
    ];
    const selection = selectKaraokePlaylist(files);

    expect(selection.items.map((item) => item.relativePath)).toEqual([
      'Disc 1/Song.mp3',
      'Disc 2/Song.mp3',
    ]);
    expect(selection.items.map((item) => item.lyrics?.name)).toEqual([
      'Song.txt',
      'Song.txt',
    ]);
  });

  it('accepts a new provider through the normalized text adapter contract', () => {
    const parsed = parseKaraokeText('track.xml', '<singstar />', [
      {
        id: 'singstar-xml',
        extensions: ['xml'],
        canParse: (contents) => contents.includes('<singstar'),
        parse: () => ({
          timingPrecision: 'syllable',
          lines: [],
          pitch: {
            kind: 'notes',
            source: 'singstar-xml',
            coordinateSystem: 'midi-semitones',
            octavePolicy: 'absolute',
            notes: [],
          },
          gapMs: 0,
          sourceFormat: 'singstar-xml',
        }),
      },
    ]);

    expect(parsed.sourceFormat).toBe('singstar-xml');
    expect(parsed.pitch).toMatchObject({
      kind: 'notes',
      coordinateSystem: 'midi-semitones',
    });
  });
});
