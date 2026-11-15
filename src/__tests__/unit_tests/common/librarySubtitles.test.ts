/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import {
  checkSubtitleImport,
  sourceSubtitleLanguage,
  subtitleDestinationName,
} from 'common/library/subtitleImport';
import {
  lookedSubtitleNames,
  MAX_SUBTITLE_LINES,
  pickSubtitle,
  subtitleFilesOf,
  subtitleLanguage,
  subtitleLines,
  subtitleQualifiers,
} from 'common/library/subtitles';

/**
 * A video's subtitles: which files beside it are its own, which language
 * each names, which one opens first, and the SubRip and WebVTT cues read as
 * the timed lines the Lyrics tab already follows.
 */

const SRT = [
  '1',
  '00:00:01,000 --> 00:00:03,500',
  'Where were you last night?',
  '',
  '2',
  '00:00:04,250 --> 00:00:06,000',
  '<i>Out.</i>',
  'Walking.',
  '',
  '3',
  '01:02:03,040 --> 01:02:05,000',
  '{\\an8}The harbour, mostly.',
  '',
].join('\r\n');

const VTT = [
  'WEBVTT',
  '',
  'NOTE written for these tests',
  '',
  '00:01.000 --> 00:03.500 line:90%',
  'Where were you last night?',
  '',
  '00:00:04.250 --> 00:00:06.000',
  'Out. Walking.',
  '',
].join('\n');

describe('the subtitle files beside a video', () => {
  const siblings = [
    'Harbour Night.mp4',
    'Harbour Night.srt',
    'harbour night.EN.forced.srt',
    'Harbour Night.es.vtt',
    'Harbour Night.pt-br.srt',
    'Harbour Night.lrc',
    'Harbour Night 2.srt',
    'Harbour Nightfall.srt',
    'Other.srt',
    'Harbour Night..srt',
  ];

  it('are the .srt and .vtt of its own name, with or without a tag, any case', () => {
    // Its own name first, then by name without case, in any locale.
    expect(subtitleFilesOf('Harbour Night.mp4', siblings)).toEqual([
      { fileName: 'Harbour Night.srt' },
      { fileName: 'harbour night.EN.forced.srt', tag: 'EN.forced' },
      { fileName: 'Harbour Night.es.vtt', tag: 'es' },
      { fileName: 'Harbour Night.pt-br.srt', tag: 'pt-br' },
    ]);
  });

  it('never take another video’s, a lyrics file or the video itself', () => {
    const names = subtitleFilesOf('Harbour Night.mp4', siblings).map(
      (file) => file.fileName,
    );
    [
      'Harbour Night 2.srt',
      'Harbour Nightfall.srt',
      'Other.srt',
      'Harbour Night.lrc',
      'Harbour Night.mp4',
      'Harbour Night..srt',
    ].forEach((name) => expect(names).not.toContain(name));
  });

  it('say which names were looked for', () => {
    expect(lookedSubtitleNames('Harbour Night.mkv')).toEqual([
      'Harbour Night.srt',
      'Harbour Night.vtt',
    ]);
  });
});

describe('the language a subtitle file names', () => {
  it('reads two- and three-letter codes and regions, canonical', () => {
    expect(subtitleLanguage('en')).toBe('en');
    expect(subtitleLanguage('eng')).toBe('en');
    expect(subtitleLanguage('pt-br')).toBe('pt-BR');
    expect(subtitleLanguage('EN.forced')).toBe('en');
  });

  it('reads no language from a qualifier, a word or a number', () => {
    expect(subtitleLanguage('forced')).toBe(undefined);
    // Southern Kurdish by code, the hard-of-hearing track by convention.
    expect(subtitleLanguage('sdh')).toBe(undefined);
    expect(subtitleLanguage('English')).toBe(undefined);
    expect(subtitleLanguage('2')).toBe(undefined);
    expect(subtitleLanguage(undefined)).toBe(undefined);
  });

  it('keeps what follows the language as the kind of track', () => {
    expect(subtitleQualifiers('en.forced')).toEqual(['forced']);
    expect(subtitleQualifiers('en')).toEqual([]);
    expect(subtitleQualifiers('sdh')).toEqual(['sdh']);
  });
});

describe('the subtitle file shown first', () => {
  const files = [
    { fileName: 'F.en.forced.srt', tag: 'en.forced' },
    { fileName: 'F.en.srt', tag: 'en' },
    { fileName: 'F.pt-BR.srt', tag: 'pt-BR' },
    { fileName: 'F.srt' },
  ];

  it('is the preferred language, a full track before a forced one', () => {
    expect(pickSubtitle(files, ['en'])?.fileName).toBe('F.en.srt');
    expect(pickSubtitle(files, ['eng'])?.fileName).toBe('F.en.srt');
  });

  it('takes a regional track for its base language, in preference order', () => {
    expect(pickSubtitle(files, ['pt'])?.fileName).toBe('F.pt-BR.srt');
    expect(pickSubtitle(files, ['fr', 'pt', 'en'])?.fileName).toBe(
      'F.pt-BR.srt',
    );
  });

  it('falls back to the video’s own name, then the first file', () => {
    expect(pickSubtitle(files, ['ja'])?.fileName).toBe('F.srt');
    expect(
      pickSubtitle(
        [
          { fileName: 'F.de.srt', tag: 'de' },
          { fileName: 'F.it.srt', tag: 'it' },
        ],
        ['ja'],
      )?.fileName,
    ).toBe('F.de.srt');
    expect(pickSubtitle([], ['en'])).toBe(undefined);
  });
});

describe('subtitle cues as timed lines', () => {
  it('reads SubRip, its styling and placement codes gone, rows joined', () => {
    expect(subtitleLines(SRT, 'F.srt')).toEqual([
      { timeMs: 1000, text: 'Where were you last night?' },
      { timeMs: 4250, text: 'Out. Walking.' },
      { timeMs: 3_723_040, text: 'The harbour, mostly.' },
    ]);
  });

  it('reads WebVTT by its extension, the NOTE block and cue settings ignored', () => {
    expect(subtitleLines(VTT, 'F.vtt')).toEqual([
      { timeMs: 1000, text: 'Where were you last night?' },
      { timeMs: 4250, text: 'Out. Walking.' },
    ]);
  });

  it('keeps a film’s every cue past a song’s line cap', () => {
    const cues = Array.from({ length: 2500 }, (_, at) => {
      const second = at + 1;
      const clock = (value: number) =>
        `${String(Math.floor(value / 3600)).padStart(2, '0')}:${String(
          Math.floor(value / 60) % 60,
        ).padStart(2, '0')}:${String(value % 60).padStart(2, '0')},000`;
      return `${second}\n${clock(second)} --> ${clock(second)}\nLine ${second}\n`;
    }).join('\n');
    const lines = subtitleLines(cues, 'F.srt');
    expect(lines).toHaveLength(2500);
    expect(lines[2499]).toEqual({ timeMs: 2_500_000, text: 'Line 2500' });
    expect(MAX_SUBTITLE_LINES).toBeGreaterThan(2500);
  });
});

describe('subtitles brought to a video', () => {
  it('are kept as they came, in their own format, line ends made plain', () => {
    expect(checkSubtitleImport(SRT, 'download.srt')).toEqual({
      ok: true,
      text: `${SRT.replace(/\r\n/g, '\n').trimEnd()}\n`,
      extension: 'srt',
    });
    // A text with no extension to go by is known by its signature.
    expect(checkSubtitleImport(VTT, 'pasted.txt')).toMatchObject({
      ok: true,
      extension: 'vtt',
    });
  });

  it('are refused when they are not subtitles, empty or binary', () => {
    expect(checkSubtitleImport('just some words', 'notes.txt')).toEqual({
      ok: false,
      reason: 'notSubtitles',
    });
    expect(checkSubtitleImport('1\nno timing here\n', 'F.srt')).toEqual({
      ok: false,
      reason: 'empty',
    });
    expect(checkSubtitleImport('\u0000\u0001\u0002', 'F.srt')).toEqual({
      ok: false,
      reason: 'notText',
    });
  });

  it('carry the language their own name ends on, and nothing else from it', () => {
    expect(sourceSubtitleLanguage('The.Film.2019.1080p.en.srt')).toBe('en');
    expect(sourceSubtitleLanguage('The.Film.2019.1080p.srt')).toBe(undefined);
    expect(sourceSubtitleLanguage('en.srt')).toBe(undefined);
  });

  it('take the video’s name, and the next free one rather than replace a file', () => {
    const taken = new Set(['harbour.en.srt', 'harbour.en.2.srt']);
    const isTaken = (name: string) => taken.has(name.toLowerCase());
    expect(
      subtitleDestinationName('Harbour.mp4', 'dl.en.srt', 'srt', isTaken),
    ).toBe('Harbour.en.3.srt');
    expect(
      subtitleDestinationName('Harbour.mp4', 'dl.srt', 'vtt', isTaken),
    ).toBe('Harbour.vtt');
    // The control: nothing taken, the plain name.
    expect(
      subtitleDestinationName('Harbour.mp4', 'dl.es.srt', 'srt', () => false),
    ).toBe('Harbour.es.srt');
  });
});
