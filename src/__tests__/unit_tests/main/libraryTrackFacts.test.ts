/*
Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later

@jest-environment node

Main-process file I/O; the parser reads the file through Node, not jsdom.
*/

import fs from 'fs';
import os from 'os';
import path from 'path';
import { readTrackFacts } from '../../../main/library/libraryTrackFacts';

/** A real WAV: 16-bit stereo PCM at 48 kHz, a tenth of a second of silence. */
const wav = (): Buffer => {
  const rate = 48_000;
  const channels = 2;
  const bits = 16;
  const frames = rate / 10;
  const data = frames * channels * (bits / 8);
  const buffer = Buffer.alloc(44 + data);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + data, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(rate, 24);
  buffer.writeUInt32LE(rate * channels * (bits / 8), 28);
  buffer.writeUInt16LE(channels * (bits / 8), 32);
  buffer.writeUInt16LE(bits, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(data, 40);
  return buffer;
};

describe("a song's facts, read from its file", () => {
  let dir = '';
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-facts-'));
  });
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('says the depth, rate, channels and size the file has', async () => {
    const file = path.join(dir, 'song.wav');
    const bytes = wav();
    fs.writeFileSync(file, bytes);
    const facts = await readTrackFacts(file);
    expect(facts).toMatchObject({
      bitsPerSample: 16,
      sampleRate: 48_000,
      channels: 2,
      sizeBytes: bytes.length,
    });
    expect(facts.readFailed).toBeUndefined();
  });

  it('says it could not read a file that is not there', async () => {
    const error = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    expect(await readTrackFacts(path.join(dir, 'gone.flac'))).toEqual({
      readFailed: true,
    });
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});
