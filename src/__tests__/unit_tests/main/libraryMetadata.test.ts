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

Jest reads pragmas only from the file's first block comment, so it lives here
rather than in a comment of its own further down.

@jest-environment node

This file tests main-process file I/O, not anything DOM-shaped; jsdom, this
suite's default test environment, has no reason to run it.
*/

import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  findFolderArt,
  readLibraryTags,
} from '../../../main/library/libraryMetadata';

/** A real ID3v2.3 tag with three text frames, and no audio behind it. */
const taggedMp3 = (fields: Record<string, string>): Buffer => {
  const frames = Object.entries(fields).map(([id, value]) => {
    const body = Buffer.concat([
      Buffer.from([0]),
      Buffer.from(value, 'latin1'),
    ]);
    const size = Buffer.alloc(4);
    size.writeUInt32BE(body.length);
    return Buffer.concat([Buffer.from(id), size, Buffer.from([0, 0]), body]);
  });
  const payload = Buffer.concat(frames);
  // ID3v2 sizes are syncsafe: seven bits per byte. Small payloads fit the
  // last byte, which is why this test keeps its strings short.
  const header = Buffer.from([
    0x49,
    0x44,
    0x33,
    3,
    0,
    0,
    0,
    0,
    0,
    payload.length,
  ]);
  return Buffer.concat([header, payload]);
};

describe('reading tags off a file', () => {
  it('returns the title, artist and album it was given', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-tags-'));
    const file = path.join(dir, 'song.mp3');
    fs.writeFileSync(
      file,
      taggedMp3({ TIT2: 'Blue', TPE1: 'Miles', TALB: 'Kind' }),
    );
    await expect(readLibraryTags(file)).resolves.toMatchObject({
      title: 'Blue',
      artist: 'Miles',
      album: 'Kind',
    });
  });

  it('answers with empty facts and readFailed rather than throwing', async () => {
    // music-metadata is lenient about content it cannot recognise at all --
    // arbitrary bytes in a .mp3 just come back with no tags, no throw. What
    // it does reject is content that contradicts the extension's promise:
    // an Ogg stream (magic "OggS") saved with a .flac name is asked for by
    // the FLAC demuxer specifically and its preamble check fails outright.
    // That contradiction is what a genuinely corrupt file looks like, and
    // one must not end a scan of four thousand -- but the scanner still
    // needs to know a real failure happened here, so it can set
    // hasMetadataError on the track instead of just showing a filename with
    // no explanation.
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-tags-'));
    const file = path.join(dir, 'broken.flac');
    fs.writeFileSync(file, Buffer.from('OggSnot really a flac file at all'));
    await expect(readLibraryTags(file)).resolves.toEqual({ readFailed: true });
  });

  it('strips an embedded NUL from a tag string', async () => {
    // ID3v2.4 legitimately delimits multi-valued text frames with the NUL
    // codepoint. Measured against this project's real ID3v2.3 fixture, TIT2
    // passes one straight through undecoded rather than splitting on it.
    // albumKey() in common/library/grouping.ts joins album and artist with
    // that exact character to build its map key, and does not sanitise its
    // inputs -- a raw NUL surviving into a track record would let two
    // differently-named album-plus-artist pairs collide on the same key.
    const nulChar = String.fromCharCode(0);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-tags-'));
    const file = path.join(dir, 'embedded-nul.mp3');
    fs.writeFileSync(file, taggedMp3({ TIT2: `Blue${nulChar}Note` }));
    const facts = await readLibraryTags(file);
    expect(facts.title).toBe('BlueNote');
    expect(facts.title).not.toContain(nulChar);
  });

  it('never emits a non-finite number for a malformed header', async () => {
    // A WAV "fmt " chunk with a block-align of zero drives format.duration
    // to Infinity: music-metadata guards the zero-sample-rate case but not
    // this one, so numberOfSamples becomes chunkSize divided by zero.
    // JSON.stringify turns a non-finite number into null, and
    // parseLibraryIndex() in Task 6 rejects null for every optional numeric
    // field it knows about -- one non-finite value anywhere in durationMs,
    // bitrate, sampleRate, channels, year or a track number declares the
    // whole library index corrupt and resets it to empty on the next launch.
    const fmtFields = Buffer.alloc(16);
    fmtFields.writeUInt16LE(1, 0); // wFormatTag = PCM
    fmtFields.writeUInt16LE(1, 2); // nChannels
    fmtFields.writeUInt32LE(1000, 4); // nSamplesPerSec
    fmtFields.writeUInt32LE(0, 8); // nAvgBytesPerSec
    fmtFields.writeUInt16LE(0, 12); // nBlockAlign -- the malformed field
    fmtFields.writeUInt16LE(8, 14); // wBitsPerSample
    const riffChunk = (id: string, size: number): Buffer => {
      const sizeField = Buffer.alloc(4);
      sizeField.writeUInt32LE(size);
      return Buffer.concat([Buffer.from(id), sizeField]);
    };
    const fmtChunk = Buffer.concat([riffChunk('fmt ', 16), fmtFields]);
    const dataChunk = Buffer.concat([riffChunk('data', 1), Buffer.from([0])]);
    const body = Buffer.concat([Buffer.from('WAVE'), fmtChunk, dataChunk]);
    const wav = Buffer.concat([riffChunk('RIFF', body.length), body]);

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-tags-'));
    const file = path.join(dir, 'zero-block-align.wav');
    fs.writeFileSync(file, wav);
    const facts = await readLibraryTags(file);
    expect(facts.durationMs).toBeUndefined();
    const numericValues = Object.values(facts).filter(
      (value): value is number => typeof value === 'number',
    );
    numericValues.forEach((value) => expect(Number.isFinite(value)).toBe(true));
    // Positive control for the broken.mp3 case above: a header this odd
    // still parses without throwing, so it must not be marked as a metadata
    // error just for having little left to report.
    expect(facts.readFailed).toBeUndefined();
  });

  /**
   * A chart-rip MP3 whose APE trailer holds one real tag and then junk.
   *
   * `music-metadata` walks to the END of a file for APEv2 and ID3v1 once it
   * has read the front. On real rips that trailer is encoder leftovers, and
   * enough of it parses as an APE tag to reach `APEv2Parser.parseTags` —
   * which subtracts an item size read straight out of the file from its
   * remaining byte count. A bogus size takes that hugely negative in one step
   * and hands it to `FileHandle.read` as a length: `ERR_OUT_OF_RANGE`, thrown
   * past every caller and killing the whole read.
   *
   * `patches/music-metadata@11.14.0.patch` adds the bounds check the loop
   * already implies. The junk item ends the tag; everything before it is
   * kept. So the fixture deliberately carries BOTH: a valid `Album` item,
   * then the ~1.1GB item size from the original report.
   *
   * The valid item is what makes this a test of the fix rather than of the
   * workaround it replaced. Catching the throw and re-reading with
   * `skipPostHeaders` also stops the crash — and loses `Chart Rip` with it,
   * along with every tag of every file whose tags live only in the trailer.
   */
  const apeItem = (key: string, value: string): Buffer => {
    const body = Buffer.from(value, 'utf8');
    const header = Buffer.alloc(8);
    header.writeUInt32LE(body.length, 0);
    header.writeUInt32LE(0, 4); // flags: UTF-8 text
    return Buffer.concat([header, Buffer.from(`${key}\0`, 'ascii'), body]);
  };

  const apeTrailerMp3 = (): Buffer => {
    // No TALB at the front on purpose, so an album can only have come from
    // the APE item below.
    const front = taggedMp3({ TIT2: 'Someone', TPE1: 'Lewis' });
    const good = apeItem('Album', 'Chart Rip');
    const junk = Buffer.alloc(8);
    junk.writeUInt32LE(1162229480, 0); // the item size, as reported
    junk.writeUInt32LE(0, 4);
    const items = Buffer.concat([good, junk, Buffer.from('X\0', 'ascii')]);
    const footer = Buffer.alloc(32);
    footer.write('APETAGEX', 0, 'ascii');
    footer.writeUInt32LE(2000, 8); // version
    footer.writeUInt32LE(items.length + 32, 12); // seeks back to the first item
    footer.writeUInt32LE(2, 16); // fields
    footer.writeUInt32LE(0, 20); // flags: a footer, not a header
    return Buffer.concat([front, items, footer]);
  };

  it('does not throw on the trailer that used to kill the parser', async () => {
    // The regression test for the patch, asserted against `parseFile` itself
    // rather than through this module -- if the guard is ever dropped, this
    // says so in one line instead of failing somewhere downstream.
    const { parseFile } = await import('music-metadata');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-tags-'));
    const file = path.join(dir, 'trailer.mp3');
    fs.writeFileSync(file, apeTrailerMp3());
    await expect(parseFile(file)).resolves.toBeDefined();
  });

  it('keeps the front tags and the valid trailing one, in one read', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-tags-'));
    const file = path.join(dir, 'trailer.mp3');
    fs.writeFileSync(file, apeTrailerMp3());

    // Silent, and asserted rather than assumed: this is an ordinary file that
    // reads correctly, so there is nothing for a scan of four thousand to say
    // about it.
    const logged = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const facts = await readLibraryTags(file);
      expect(facts.title).toBe('Someone');
      expect(facts.artist).toBe('Lewis');
      // The item BEFORE the junk one. A workaround that skipped the trailer
      // wholesale would leave this undefined, which is the difference between
      // stopping the crash and fixing it.
      expect(facts.album).toBe('Chart Rip');
      expect(facts.readFailed).toBeUndefined();
      expect(logged).not.toHaveBeenCalled();
    } finally {
      logged.mockRestore();
    }
  });

  /**
   * An `.m4a` whose track carries no sample-size table.
   *
   * `MP4Parser.parseTrackBox` builds its track object with `media` and
   * `fragments` and nothing else, then `parse()` reads five tables off it as
   * arrays without checking: `soundSampleDescription.length` for every track,
   * and `sampleSizeTable.length` for an audio track with no fragments. An
   * `stbl` is not required to carry an `stsz`, so a legal file reached
   * `Cannot read properties of undefined (reading 'length')` and threw out of
   * `parseFile` — losing the tags, the duration and the embedded cover of a
   * file whose metadata had already been read correctly. Three files in a
   * real library did exactly this, which is how it was found.
   *
   * `patches/music-metadata@11.14.0.patch` initialises those tables to empty
   * arrays, because an absent box means a table with no entries — which is
   * what every reader of them already tests for.
   *
   * `withSampleSizeTable` is the positive control, and it is the whole point
   * of building the fixture this way. Without it, a fixture malformed in some
   * unrelated way would fail to parse for its own reasons and this test would
   * pass for none. The `stsz` variant is the same bytes plus that one box, it
   * has always parsed, and it must still report the same facts — plus the
   * bitrate that only a sample-size table can produce.
   */
  const TIMESCALE = 44100;
  const SAMPLE_COUNT = 88200; // two seconds, in timescale units
  const CHANNELS = 2;

  const mp4Box = (name: string, ...payload: Buffer[]): Buffer => {
    const body = Buffer.concat(payload);
    const header = Buffer.alloc(8);
    header.writeUInt32BE(body.length + 8, 0);
    header.write(name, 4, 'latin1');
    return Buffer.concat([header, body]);
  };

  const soundSampleDescription = (): Buffer => {
    // Read in two halves: an 8-byte version block, then the version-0 fields.
    const description = Buffer.alloc(20);
    description.writeInt16BE(0, 0); // version 0
    description.writeInt16BE(0, 2); // revision
    description.writeInt32BE(0, 4); // vendor
    description.writeInt16BE(CHANNELS, 8);
    description.writeInt16BE(16, 10); // bits per sample
    description.writeInt16BE(0, 12); // compression id
    description.writeInt16BE(0, 14); // packet size
    description.writeUInt16BE(TIMESCALE, 16); // 16.16 fixed point, whole part
    description.writeUInt16BE(0, 18); // ...and its fraction
    // The entry's own header: size, format, six reserved bytes, then the
    // data-reference index at a fixed offset of ten.
    const entry = Buffer.alloc(16);
    entry.writeUInt32BE(16 + description.length, 0);
    entry.write('mp4a', 4, 'latin1');
    entry.writeUInt16BE(1, 14);
    const stsdHeader = Buffer.alloc(8);
    stsdHeader.writeUInt32BE(1, 4); // one entry
    return Buffer.concat([stsdHeader, entry, description]);
  };

  const mp4WithoutStsz = (withSampleSizeTable: boolean): Buffer => {
    const ftyp = Buffer.alloc(16);
    ftyp.write('M4A ', 0, 'latin1');
    ftyp.write('M4A ', 8, 'latin1');
    ftyp.write('mp42', 12, 'latin1');

    const tkhd = Buffer.alloc(84);
    tkhd.writeUInt32BE(1, 12); // track id
    tkhd.writeUInt32BE(SAMPLE_COUNT, 20);

    const mdhd = Buffer.alloc(24);
    mdhd.writeUInt32BE(TIMESCALE, 12);
    mdhd.writeUInt32BE(SAMPLE_COUNT, 16);

    const hdlr = Buffer.alloc(32);
    hdlr.write('mhlr', 4, 'latin1');
    hdlr.write('soun', 8, 'latin1'); // what makes this an audio track

    // Two samples of a thousand bytes each, so the control does not merely
    // add an empty table: it is the only variant that can reach `sizeInBytes`
    // and therefore the only one that reports a bitrate.
    const stsz = Buffer.alloc(20);
    stsz.writeInt32BE(0, 4); // a per-sample table follows, not one fixed size
    stsz.writeInt32BE(2, 8);
    stsz.writeInt32BE(1000, 12);
    stsz.writeInt32BE(1000, 16);

    const stbl = mp4Box(
      'stbl',
      mp4Box('stsd', soundSampleDescription()),
      ...(withSampleSizeTable ? [mp4Box('stsz', stsz)] : []),
    );
    const trak = mp4Box(
      'trak',
      mp4Box('tkhd', tkhd),
      mp4Box(
        'mdia',
        mp4Box('mdhd', mdhd),
        mp4Box('hdlr', hdlr),
        mp4Box('minf', stbl),
      ),
    );
    return Buffer.concat([mp4Box('ftyp', ftyp), mp4Box('moov', trak)]);
  };

  const writeMp4 = (withSampleSizeTable: boolean): string => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-tags-'));
    const file = path.join(dir, 'no-sample-table.m4a');
    fs.writeFileSync(file, mp4WithoutStsz(withSampleSizeTable));
    return file;
  };

  it('does not throw on the track box that used to kill the MP4 parser', async () => {
    // Asserted against `parseFile` itself rather than through this module, so
    // that dropping the guard says so in one line rather than failing
    // somewhere downstream -- the same shape as the APEv2 case above.
    const { parseFile } = await import('music-metadata');
    await expect(parseFile(writeMp4(false))).resolves.toBeDefined();
  });

  it('reads the same facts with and without a sample-size table', async () => {
    const withTable = await readLibraryTags(writeMp4(true));
    const withoutTable = await readLibraryTags(writeMp4(false));

    // The control. If the fixture were malformed for some reason of its own,
    // this variant would fail too and neither assertion would mean anything.
    expect(withTable.readFailed).toBeUndefined();
    expect(withTable.durationMs).toBe(2000);
    expect(withTable.sampleRate).toBe(TIMESCALE);
    expect(withTable.channels).toBe(CHANNELS);
    // 8 * 2000 bytes over two seconds. Only a sample-size table can produce
    // this, which is what makes the two variants genuinely different files.
    expect(withTable.bitrate).toBe(8000);

    // The regression. Everything the file itself declares still arrives; only
    // the bitrate, which is computed from the missing table, is absent.
    expect(withoutTable.readFailed).toBeUndefined();
    expect(withoutTable.durationMs).toBe(2000);
    expect(withoutTable.sampleRate).toBe(TIMESCALE);
    expect(withoutTable.channels).toBe(CHANNELS);
    expect(withoutTable.bitrate).toBeUndefined();
  });
});

describe('finding a cover beside the music', () => {
  it('prefers the conventional names, in order', () => {
    expect(findFolderArt(['back.jpg', 'folder.jpg', 'cover.jpg'])).toBe(
      'cover.jpg',
    );
    expect(findFolderArt(['scan.png', 'front.png'])).toBe('front.png');
  });

  it('ignores case, as Windows does', () => {
    expect(findFolderArt(['Cover.JPG'])).toBe('Cover.JPG');
  });

  it('finds nothing in a folder that has nothing', () => {
    // Positive control: the two tests above pass equally well for a function
    // that returns the first entry it sees.
    expect(findFolderArt(['song.mp3', 'notes.txt'])).toBeUndefined();
    expect(findFolderArt([])).toBeUndefined();
  });
});
