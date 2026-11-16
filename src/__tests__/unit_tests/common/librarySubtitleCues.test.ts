/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import {
  cuesAt,
  longestCueMs,
  MAX_SUBTITLE_CUES,
  parseSubtitleCues,
} from 'common/library/subtitleCues';

/**
 * A subtitle file's cues as captions over a film: each with its start and
 * its end, its rows kept, every tag gone; and which are on screen at a
 * moment, overlapping speakers included.
 */

const SRT = [
  '1',
  '00:00:01,000 --> 00:00:03,500',
  '- Where were you last night?',
  '- <i>Out.</i> Walking.',
  '',
  '2',
  '00:00:04,250 --> 00:00:06,000',
  '{\\an8}<font color="#ffff00">The harbour</font>, mostly.',
  '',
  '3',
  '01:02:03,040 --> 01:02:05,000',
  'Tom &amp; Jerry',
  '',
].join('\r\n');

const VTT = [
  'WEBVTT',
  '',
  'NOTE written for these tests',
  '',
  'STYLE',
  '::cue { color: lime }',
  '',
  '00:01.000 --> 00:03.500 line:90% align:start',
  '<v Ana>Where were you</v>',
  '',
  'intro',
  '00:00:04.250 --> 00:00:06.000',
  '<00:00:04.250><c.big>Out.</c> <00:00:05.000>Walking.',
  '',
].join('\n');

describe('subtitle cues', () => {
  it('reads SubRip with its ends and rows, every tag and code gone', () => {
    expect(parseSubtitleCues(SRT)).toEqual([
      {
        startMs: 1000,
        endMs: 3500,
        text: '- Where were you last night?\n- Out. Walking.',
      },
      { startMs: 4250, endMs: 6000, text: 'The harbour, mostly.' },
      { startMs: 3_723_040, endMs: 3_725_000, text: 'Tom & Jerry' },
    ]);
  });

  it('reads WebVTT: NOTE and STYLE passed over, settings, voices, classes and stamps gone', () => {
    expect(parseSubtitleCues(VTT)).toEqual([
      { startMs: 1000, endMs: 3500, text: 'Where were you' },
      { startMs: 4250, endMs: 6000, text: 'Out. Walking.' },
    ]);
  });

  it('drops a cue that lasts no time or holds no words, and keeps the next', () => {
    const text = [
      '1',
      '00:00:05,000 --> 00:00:05,000',
      'Never seen',
      '',
      '2',
      '00:00:06,000 --> 00:00:07,000',
      '<i></i>',
      '',
      '3',
      '00:00:08,000 --> 00:00:09,000',
      'Seen',
    ].join('\n');
    expect(parseSubtitleCues(text)).toEqual([
      { startMs: 8000, endMs: 9000, text: 'Seen' },
    ]);
  });

  it('puts cues in start order, the file’s order kept among equal starts', () => {
    const text = [
      '00:00:09,000 --> 00:00:10,000\nThird',
      '00:00:02,000 --> 00:00:04,000\nFirst',
      '00:00:02,000 --> 00:00:03,000\nSecond',
    ].join('\n\n');
    expect(parseSubtitleCues(text).map((cue) => cue.text)).toEqual([
      'First',
      'Second',
      'Third',
    ]);
  });

  it('keeps a film’s every cue past a song’s line cap', () => {
    const clock = (value: number) =>
      `${String(Math.floor(value / 3600)).padStart(2, '0')}:${String(
        Math.floor(value / 60) % 60,
      ).padStart(2, '0')}:${String(value % 60).padStart(2, '0')},000`;
    const text = Array.from({ length: 2500 }, (_, at) => {
      const second = at + 1;
      return `${second}\n${clock(second)} --> ${clock(second + 1)}\nLine ${second}\n`;
    }).join('\n');
    const cues = parseSubtitleCues(text);
    expect(cues).toHaveLength(2500);
    expect(cues[2499]).toEqual({
      startMs: 2_500_000,
      endMs: 2_501_000,
      text: 'Line 2500',
    });
    expect(MAX_SUBTITLE_CUES).toBeGreaterThan(2500);
  });
});

describe('the cues on screen at a moment', () => {
  const cues = [
    { startMs: 1000, endMs: 3000, text: 'one' },
    // A long cue that the next two start inside.
    { startMs: 4000, endMs: 20_000, text: 'sign' },
    { startMs: 5000, endMs: 6000, text: 'two' },
    { startMs: 7000, endMs: 8000, text: 'three' },
  ];

  it('is the cue whose time it is, and nothing between cues', () => {
    expect(cuesAt(cues, 1000).map((cue) => cue.text)).toEqual(['one']);
    expect(cuesAt(cues, 2999).map((cue) => cue.text)).toEqual(['one']);
    // The end is exclusive: at 3000 the line has gone.
    expect(cuesAt(cues, 3000)).toEqual([]);
    expect(cuesAt(cues, 3500)).toEqual([]);
    expect(cuesAt(cues, 0)).toEqual([]);
  });

  it('shows overlapping cues together, in start order', () => {
    expect(cuesAt(cues, 5500).map((cue) => cue.text)).toEqual(['sign', 'two']);
    // A cue that started long before is still found, by the longest cue.
    expect(cuesAt(cues, 7500).map((cue) => cue.text)).toEqual([
      'sign',
      'three',
    ]);
    expect(cuesAt(cues, 19_999).map((cue) => cue.text)).toEqual(['sign']);
    expect(cuesAt(cues, 20_000)).toEqual([]);
  });

  it('agrees with a walk over every cue at every moment (the control)', () => {
    const longest = longestCueMs(cues);
    expect(longest).toBe(16_000);
    for (let at = 0; at <= 21_000; at += 250) {
      expect(cuesAt(cues, at, longest)).toEqual(
        cues.filter((cue) => cue.startMs <= at && at < cue.endMs),
      );
    }
  });

  it('finds nothing in no cues', () => {
    expect(cuesAt([], 1000)).toEqual([]);
    expect(longestCueMs([])).toBe(0);
  });
});
