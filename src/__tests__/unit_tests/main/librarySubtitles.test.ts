/*
Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later

@jest-environment node

A video's subtitles in main: found beside it under its own name, read in
the encoding they were saved in, and subtitles brought to it kept there
under a name no file has yet.
*/

import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  importPickedSubtitles,
  importVideoSubtitles,
  readTrackSubtitles,
} from '../../../main/library/librarySubtitles';

const SRT = [
  '1',
  '00:00:01,000 --> 00:00:02,000',
  'Lights off at the pier',
  '',
  '2',
  '00:00:03,500 --> 00:00:05,000',
  'Café closed early',
  '',
].join('\r\n');

const VTT = 'WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nLas luces del muelle\n';

describe("a video's subtitles", () => {
  let dir = '';
  let video = '';
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-subtitles-'));
    video = path.join(dir, 'Pier.mp4');
    fs.writeFileSync(video, Buffer.alloc(16));
  });
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  const put = (name: string, contents: string | Buffer) =>
    fs.writeFileSync(path.join(dir, name), contents);

  it('finds none, and says which names it looked for', async () => {
    put('Pier.lrc', '[00:01.00]Not a subtitle');
    await expect(readTrackSubtitles(video, undefined, ['en'])).resolves.toEqual(
      { files: [], looked: ['Pier.srt', 'Pier.vtt'] },
    );
  });

  it('reads the preferred language among the files beside the video', async () => {
    put('Pier.srt', SRT);
    put('Pier.es.vtt', VTT);
    put('Other.srt', SRT);
    const answer = await readTrackSubtitles(video, undefined, ['es']);
    expect(answer.files.map((file) => file.fileName)).toEqual([
      'Pier.srt',
      'Pier.es.vtt',
    ]);
    expect(answer.shown).toEqual({
      fileName: 'Pier.es.vtt',
      lines: [{ timeMs: 1000, text: 'Las luces del muelle' }],
    });
    // The control: with no preference, the file of the video's own name.
    expect(
      (await readTrackSubtitles(video, undefined, [])).shown?.fileName,
    ).toBe('Pier.srt');
  });

  it('reads the file the window picked, and only one found beside the video', async () => {
    put('Pier.srt', SRT);
    put('Pier.es.vtt', VTT);
    put('Elsewhere.srt', SRT);
    expect(
      (await readTrackSubtitles(video, 'Pier.srt', ['es'])).shown?.fileName,
    ).toBe('Pier.srt');
    // A name that is not one of the video's falls back to the pick.
    expect(
      (await readTrackSubtitles(video, 'Elsewhere.srt', ['es'])).shown
        ?.fileName,
    ).toBe('Pier.es.vtt');
    expect(
      (await readTrackSubtitles(video, '..\\Elsewhere.srt', [])).shown
        ?.fileName,
    ).toBe('Pier.srt');
  });

  it('reads a UTF-16 file with its mark, as subtitle tools save them', async () => {
    put(
      'Pier.srt',
      Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(SRT, 'utf16le')]),
    );
    const answer = await readTrackSubtitles(video, undefined, []);
    expect(answer.shown?.lines).toEqual([
      { timeMs: 1000, text: 'Lights off at the pier' },
      { timeMs: 3500, text: 'Café closed early' },
    ]);
  });

  it('keeps a dropped file beside the video, never over one already there', async () => {
    put('Pier.en.srt', 'kept by hand');
    await expect(
      importVideoSubtitles({
        videoPath: video,
        sourceName: 'The.Pier.2020.1080p.en.srt',
        text: SRT,
      }),
    ).resolves.toEqual({ state: 'saved', fileName: 'Pier.en.2.srt' });
    expect(fs.readFileSync(path.join(dir, 'Pier.en.srt'), 'utf8')).toBe(
      'kept by hand',
    );
    expect(fs.readFileSync(path.join(dir, 'Pier.en.2.srt'), 'utf8')).toBe(
      `${SRT.replace(/\r\n/g, '\n').trimEnd()}\n`,
    );
    // And the tab finds it at once.
    expect(
      (await readTrackSubtitles(video, 'Pier.en.2.srt', [])).shown?.lines,
    ).toHaveLength(2);
  });

  it('refuses a file that is not subtitles and writes nothing', async () => {
    await expect(
      importVideoSubtitles({
        videoPath: video,
        sourceName: 'notes.txt',
        text: 'shopping list',
      }),
    ).resolves.toEqual({ state: 'refused', reason: 'notSubtitles' });
    expect(fs.readdirSync(dir)).toEqual(['Pier.mp4']);
  });

  it('keeps a picked file under the video’s name, in its own format', async () => {
    const downloads = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-dl-'));
    try {
      const picked = path.join(downloads, 'pier-subs.vtt');
      fs.writeFileSync(picked, VTT);
      await expect(importPickedSubtitles(video, picked)).resolves.toEqual({
        state: 'saved',
        fileName: 'Pier.vtt',
      });
      expect(fs.readFileSync(path.join(dir, 'Pier.vtt'), 'utf8')).toBe(VTT);
    } finally {
      fs.rmSync(downloads, { recursive: true, force: true });
    }
  });
});
