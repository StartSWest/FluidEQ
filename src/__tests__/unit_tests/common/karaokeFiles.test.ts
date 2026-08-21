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
  KARAOKE_FILE_PICKER_ACCEPT,
  isKaraokeAudioFile,
  isKaraokeImageFile,
  isKaraokeLyricFile,
  isKaraokeVideoFile,
  karaokeFileBaseName,
  parseKaraokeText,
  readKaraokeTextFile,
  selectKaraokePlaylist,
  selectKaraokeFiles,
  selectKaraokeStageMedia,
  setKaraokeRelativePath,
} from '../../../common/karaoke/files';
import { decodeKaraokeText } from '../../../common/karaoke/textEncoding';

const file = (name: string, type = '') => new File(['fixture'], name, { type });

/** A file at a known folder, which is what a folder import produces. */
const inFolder = (folder: string, name: string): File =>
  setKaraokeRelativePath(file(name), `${folder}/${name}`);

/** Real bytes, never an already-decoded string: encoding is the thing tested. */
const byteFile = (name: string, ...parts: Buffer[]): File =>
  new File([Buffer.concat(parts)], name);

const latin = (text: string): Buffer => Buffer.from(text, 'latin1');
const raw = (...values: number[]): Buffer => Buffer.from(values);

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
    // The licence is not a lyric sheet. A karaoke folder routinely ships one,
    // and counted as an unpaired lyric it became "a song whose audio is
    // missing" in the import notice — a warning about nothing, on every
    // download that documents itself. It is set aside with the artwork.
    expect(license.name).toBe('License.txt');
    expect(selection.unpairedLyrics).toEqual([]);
    expect(selection.ignored.map((entry) => entry.name).sort()).toEqual([
      'License.txt',
      'cover.jpg',
    ]);
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

describe('Karaoke lyric file decoding', () => {
  it('reads a CP1252 file as its author wrote it rather than as UTF-8', async () => {
    const codepage = byteFile(
      'song.lrc',
      latin('[00:01.00]Canci'),
      raw(0xf3),
      latin('n'),
    );
    const unicode = byteFile(
      'song.lrc',
      Buffer.from('[00:01.00]Canción', 'utf8'),
    );

    expect(await readKaraokeTextFile(codepage)).toBe('[00:01.00]Canción');
    // Positive control: the same words as real UTF-8 bytes have to land in the
    // same place, or "decoded correctly" only means "decoded somehow".
    expect(await readKaraokeTextFile(unicode)).toBe('[00:01.00]Canción');
  });

  it('decodes UTF-16 carrying either byte-order mark', async () => {
    const header = '#BPM:200\n#TITLE:Song';
    const littleEndian = byteFile(
      'song.txt',
      raw(0xff, 0xfe),
      Buffer.from(header, 'utf16le'),
    );
    const bigEndian = byteFile(
      'song.txt',
      raw(0xfe, 0xff),
      Buffer.from(header, 'utf16le').swap16(),
    );

    expect(await readKaraokeTextFile(littleEndian)).toBe(header);
    expect(await readKaraokeTextFile(bigEndian)).toBe(header);
  });

  it('decodes UTF-16 that carries no byte-order mark at all', async () => {
    const header = '#BPM:200\n#TITLE:Song';
    const bomless = byteFile('song.txt', Buffer.from(header, 'utf16le'));
    const singleByte = byteFile('song.txt', latin(header));

    // Every other byte is NUL, which is valid UTF-8, so this file used to
    // reach the parser as "#\0B\0P\0M\0" and be reported as declaring no BPM.
    expect(await readKaraokeTextFile(bomless)).toBe(header);
    // Positive control: a sniff that answered UTF-16 for everything would pass
    // the line above on its own.
    expect(await readKaraokeTextFile(singleByte)).toBe(header);
  });

  it('strips a UTF-8 byte-order mark off the first tag', async () => {
    const withMark = byteFile(
      'song.txt',
      raw(0xef, 0xbb, 0xbf),
      Buffer.from('#BPM:200', 'utf8'),
    );

    expect(await readKaraokeTextFile(withMark)).toBe('#BPM:200');
  });

  it('honours the UltraStar #ENCODING header over the codepage fallback', async () => {
    // 0xE6 is ć in CP1250 and æ in CP1252 — one byte that tells the two
    // codepages apart, and not valid UTF-8 in either.
    const declaring = (encoding: string) =>
      byteFile('song.txt', latin(`#ENCODING:${encoding}\n#TITLE:`), raw(0xe6));

    expect(await readKaraokeTextFile(declaring('CP1250'))).toBe(
      '#ENCODING:CP1250\n#TITLE:ć',
    );
    expect(await readKaraokeTextFile(declaring('CP1252'))).toBe(
      '#ENCODING:CP1252\n#TITLE:æ',
    );
    // Positive control: with no header the same byte takes the CP1252 default
    // UltraStar itself falls back to.
    expect(
      await readKaraokeTextFile(
        byteFile('song.txt', latin('#TITLE:'), raw(0xe6)),
      ),
    ).toBe('#TITLE:æ');
  });

  it('believes a declared encoding even when the bytes would pass as UTF-8', async () => {
    const accented = Buffer.from('ó', 'utf8');
    const asUtf8 = byteFile(
      'song.txt',
      latin('#ENCODING:UTF8\n#TITLE:'),
      accented,
    );
    const asCodepage = byteFile(
      'song.txt',
      latin('#ENCODING:CP1252\n#TITLE:'),
      accented,
    );

    expect(await readKaraokeTextFile(asUtf8)).toBe('#ENCODING:UTF8\n#TITLE:ó');
    // C3 B3 reads as Ã³ in CP1252; a header that changed nothing here would
    // not be a header being honoured.
    expect(await readKaraokeTextFile(asCodepage)).toBe(
      '#ENCODING:CP1252\n#TITLE:Ã³',
    );
  });

  it('decodes the same bytes the same way on all three read paths', async () => {
    const bytes = Buffer.concat([
      latin('[00:01.00]Canci'),
      raw(0xf3),
      latin('n'),
    ]);
    const modern = new File([bytes], 'song.lrc');
    const legacy = new File([bytes], 'song.lrc');
    // Environments whose File predates arrayBuffer fall back to FileReader.
    Object.defineProperty(legacy, 'arrayBuffer', { value: undefined });

    const expected = await readKaraokeTextFile(modern);
    expect(expected).toBe('[00:01.00]Canción');
    expect(await readKaraokeTextFile(legacy)).toBe(expected);
    // The main process restores a session by handing these bytes straight to
    // the decoder; a restored file has to read as the opened one did.
    expect(decodeKaraokeText(new Uint8Array(bytes))).toBe(expected);
  });
});

describe('Karaoke pairing for names with no ASCII letters', () => {
  it('keeps a usable base name for Japanese, Korean and Cyrillic titles', () => {
    expect(karaokeFileBaseName('夜に駆ける.mp3')).not.toBe('');
    expect(karaokeFileBaseName('강남스타일.lrc')).not.toBe('');
    expect(karaokeFileBaseName('Кино - Группа крови.mp3')).toBe(
      'кино группа крови',
    );
    expect(karaokeFileBaseName('夜に駆ける.mp3')).not.toBe(
      karaokeFileBaseName('怪物.mp3'),
    );
    // Positive control: the Latin normalisation these names used to erase.
    expect(karaokeFileBaseName('Café del Mar.mp3')).toBe('cafe del mar');
  });

  it('pairs every song in a folder of Japanese titles', () => {
    const selection = selectKaraokePlaylist([
      inFolder('JP', '夜に駆ける.mp3'),
      inFolder('JP', '夜に駆ける.lrc'),
      inFolder('JP', '怪物.mp3'),
      inFolder('JP', '怪物.lrc'),
    ]);

    expect(selection.items).toHaveLength(2);
    selection.items.forEach((item) => {
      expect(item.lyrics?.name).toBe(item.audio.name.replace('.mp3', '.lrc'));
    });
    expect(selection.ambiguousLyrics).toEqual([]);
  });

  it('still calls a genuine two-lyric collision ambiguous', () => {
    const selection = selectKaraokePlaylist([
      inFolder('JP', '怪物.mp3'),
      inFolder('JP', '怪物.lrc'),
      inFolder('JP', '怪物.txt'),
    ]);

    expect(selection.items[0].lyrics).toBeUndefined();
    expect(selection.ambiguousLyrics).toHaveLength(2);
  });

  it('never pairs two names that normalise to nothing', () => {
    const unrelated = selectKaraokePlaylist([
      inFolder('Odd', '!!!.mp3'),
      inFolder('Odd', '???.lrc'),
    ]);
    expect(unrelated.items[0].lyrics).toBeUndefined();

    // Positive control: identical punctuation names are still one song.
    const matching = selectKaraokePlaylist([
      inFolder('Odd', '!!!.mp3'),
      inFolder('Odd', '!!!.lrc'),
    ]);
    expect(matching.items[0].lyrics?.name).toBe('!!!.lrc');
  });
});

describe('Karaoke stage media selection', () => {
  const pack = (folder: string, names: readonly string[]): File[] =>
    names.map((name) => inFolder(folder, name));

  it('reads the [CO] and [BG] tags a real UltraStar pack ships', () => {
    const files = pack('Pack', [
      'Artist - Song.mp3',
      'Artist - Song [CO].jpg',
      'Artist - Song [BG].jpg',
    ]);
    const media = selectKaraokeStageMedia(files[0], files);

    expect(media.cover?.name).toBe('Artist - Song [CO].jpg');
    expect(media.background?.name).toBe('Artist - Song [BG].jpg');
  });

  it('picks the video by its [VD#0] tag without disturbing the pictures', () => {
    const files = pack('Pack', [
      'Artist - Song.mp3',
      'Artist - Song [CO].jpg',
      'Artist - Song [VD#0].mp4',
    ]);
    const media = selectKaraokeStageMedia(files[0], files);

    expect(media.video?.name).toBe('Artist - Song [VD#0].mp4');
    expect(media.cover?.name).toBe('Artist - Song [CO].jpg');
    expect(media.background).toBeUndefined();
  });

  it('lets a declared header beat every convention', () => {
    const files = pack('Pack', [
      'Song.mp3',
      'cover.jpg',
      'back.jpg',
      'clip.mp4',
    ]);
    const media = selectKaraokeStageMedia(files[0], files, {
      coverFileName: 'back.jpg',
      backgroundFileName: 'cover.jpg',
      videoFileName: 'clip.mp4',
    });

    expect(media.cover?.name).toBe('back.jpg');
    expect(media.background?.name).toBe('cover.jpg');
    expect(media.video?.name).toBe('clip.mp4');
  });

  it('ranks the conventional names in a folder holding three pictures', () => {
    const files = pack('Pack', [
      'Song.mp3',
      'cover.jpg',
      'back.jpg',
      'extra.jpg',
    ]);
    const media = selectKaraokeStageMedia(files[0], files);

    expect(media.cover?.name).toBe('cover.jpg');
    expect(media.background?.name).toBe('back.jpg');
  });

  it('gives one picture the cover role and no scenery', () => {
    const files = pack('Pack', ['Song.mp3', 'art.jpg']);
    const media = selectKaraokeStageMedia(files[0], files);

    expect(media.cover?.name).toBe('art.jpg');
    expect(media.background).toBeUndefined();
  });

  it('refuses to hand one picture to both roles', () => {
    const files = pack('Pack', ['Song.mp3', 'art.jpg']);
    const both = selectKaraokeStageMedia(files[0], files, {
      coverFileName: 'art.jpg',
      backgroundFileName: 'art.jpg',
    });

    expect(both.cover?.name).toBe('art.jpg');
    expect(both.background).toBeUndefined();

    const backgroundOnly = selectKaraokeStageMedia(files[0], files, {
      backgroundFileName: 'art.jpg',
    });

    expect(backgroundOnly.background?.name).toBe('art.jpg');
    expect(backgroundOnly.cover).toBeUndefined();
  });

  it('shows no cover rather than the next song cover with no folder', () => {
    const songA = file('SongA.mp3');
    const loose = [songA, file('SongB.mp3'), file('SongB - cover.jpg')];

    expect(selectKaraokeStageMedia(songA, loose).cover).toBeUndefined();

    // Positive control: a drop holding one song has nothing to steal from, and
    // its cover still has to arrive — otherwise this passes by finding nothing.
    const single = [songA, file('cover.jpg')];
    expect(selectKaraokeStageMedia(songA, single).cover?.name).toBe(
      'cover.jpg',
    );
  });

  it('does not lend one song artwork to another inside a shared folder', () => {
    const files = pack('Album', ['A.mp3', 'A.jpg', 'B.mp3', 'B.jpg']);
    const media = selectKaraokeStageMedia(files[0], files);

    expect(media.cover?.name).toBe('A.jpg');
    expect(media.background).toBeUndefined();
  });
});

describe('Karaoke file picker accept list', () => {
  const recognised = (candidate: File): boolean =>
    isKaraokeAudioFile(candidate) ||
    isKaraokeLyricFile(candidate) ||
    isKaraokeImageFile(candidate) ||
    isKaraokeVideoFile(candidate);

  it('offers nothing the import will refuse, and offers artwork', () => {
    const accepted = KARAOKE_FILE_PICKER_ACCEPT.split(',');

    expect(accepted).toContain('.jpg');
    expect(accepted).toContain('.mp4');
    expect(accepted).toContain('.opus');
    expect(accepted).toContain('.aac');
    // The wildcard offered .wma, which the import then refused with "none of
    // those files is supported".
    expect(accepted).not.toContain('audio/*');
    expect(accepted).not.toContain('.wma');

    accepted.forEach((extension) => {
      expect(recognised(file(`song${extension}`))).toBe(true);
    });

    // Positive control: a format this build cannot decode fails all four.
    expect(recognised(file('song.wma'))).toBe(false);
  });

  // Detection and parsing read the same pattern now. When they did not, the
  // day the parser learned `[hh:mm:ss.xx]` this file stopped being recognised
  // as LRC, fell through to the UltraStar adapter, and told the user it
  // declared no BPM — a specific, confident, wrong sentence.
  it('detects every timestamp shape the LRC parser accepts', () => {
    const hourForm = parseKaraokeText(
      'lyrics.txt',
      '[ti:Long]\n[01:02:03.45]hour form\n[01:02:05.00]second line\n',
    );
    expect(hourForm.sourceFormat).toBe('lrc');
    expect(hourForm.lines[0].startMs).toBe(3_723_450);
    // The control: the shape that always worked still resolves to LRC.
    expect(
      parseKaraokeText('lyrics.txt', '[ti:Short]\n[00:12.00]plain\n')
        .sourceFormat,
    ).toBe('lrc');
  });

  it('folds ASCII accents without rewriting other alphabets', () => {
    expect(karaokeFileBaseName('Café del Mar.mp3')).toBe('cafe del mar');
    // `й` and `ё` carry the same combining marks as `é`. Folding them paired
    // two different songs, and stripping the Japanese voiced-sound mark left
    // `ダンス` normalising with a space through the middle of it.
    expect(karaokeFileBaseName('Виктор Цой.mp3')).not.toBe(
      karaokeFileBaseName('Виктор Цои.mp3'),
    );
    expect(karaokeFileBaseName('ёлка.mp3')).not.toBe(
      karaokeFileBaseName('елка.mp3'),
    );
    expect(karaokeFileBaseName('ダンス.mp3')).toBe('ダンス');
  });
});
