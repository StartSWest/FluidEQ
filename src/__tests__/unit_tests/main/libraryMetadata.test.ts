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
