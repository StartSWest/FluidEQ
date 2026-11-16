/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import {
  MAX_REMEMBERED_SUBTITLES,
  parseSubtitleMemory,
  serialiseSubtitleMemory,
  withoutSubtitleChoice,
  withSubtitleChoice,
} from 'common/library/subtitleMemory';

/**
 * The subtitle file each video was last watched with: kept by video,
 * most recent last, bounded, and read back entry by entry.
 */

describe('the remembered subtitle files', () => {
  it('read back what was kept, in the order it was kept', () => {
    const kept = withSubtitleChoice(
      withSubtitleChoice(new Map(), 'film-a', 'A.en.srt'),
      'film-b',
      'B.es.vtt',
    );
    const read = parseSubtitleMemory(serialiseSubtitleMemory(kept));
    expect([...read]).toEqual([
      ['film-a', 'A.en.srt'],
      ['film-b', 'B.es.vtt'],
    ]);
  });

  it('move a video chosen again to the most recent place', () => {
    let memory = withSubtitleChoice(new Map(), 'film-a', 'A.en.srt');
    memory = withSubtitleChoice(memory, 'film-b', 'B.srt');
    memory = withSubtitleChoice(memory, 'film-a', 'A.es.srt');
    expect([...memory]).toEqual([
      ['film-b', 'B.srt'],
      ['film-a', 'A.es.srt'],
    ]);
  });

  it('forget the longest-unwatched past the bound, and only those', () => {
    let memory = new Map<string, string>();
    for (let at = 0; at < MAX_REMEMBERED_SUBTITLES + 5; at += 1) {
      memory = withSubtitleChoice(memory, `film-${at}`, `F${at}.srt`);
    }
    expect(memory.size).toBe(MAX_REMEMBERED_SUBTITLES);
    expect(memory.has('film-0')).toBe(false);
    expect(memory.has('film-4')).toBe(false);
    // The control: the first one kept past the bound, and the newest.
    expect(memory.get('film-5')).toBe('F5.srt');
    expect(memory.get(`film-${MAX_REMEMBERED_SUBTITLES + 4}`)).toBe(
      `F${MAX_REMEMBERED_SUBTITLES + 4}.srt`,
    );
  });

  it('forget one video alone when its file is removed', () => {
    const memory = withSubtitleChoice(
      withSubtitleChoice(new Map(), 'film-a', 'A.srt'),
      'film-b',
      'B.srt',
    );
    expect([...withoutSubtitleChoice(memory, 'film-a')]).toEqual([
      ['film-b', 'B.srt'],
    ]);
    // Never changed in place: the memory handed in is the store's.
    expect(memory.size).toBe(2);
  });

  it('are nothing when nothing, or not a list, was kept', () => {
    expect(parseSubtitleMemory(null).size).toBe(0);
    expect(parseSubtitleMemory('not json').size).toBe(0);
    expect(parseSubtitleMemory('{"film-a":"A.srt"}').size).toBe(0);
  });

  it('drop an entry that is not one and keep the rest', () => {
    const read = parseSubtitleMemory(
      JSON.stringify([
        ['film-a', 'A.srt'],
        ['film-b'],
        [3, 'C.srt'],
        ['', 'D.srt'],
        ['film-e', 'x'.repeat(600)],
        ['film-f', 'F.srt'],
        ['film-a', 'A.es.srt'],
      ]),
    );
    expect([...read]).toEqual([
      ['film-f', 'F.srt'],
      ['film-a', 'A.es.srt'],
    ]);
  });

  it('are held to the bound when read, whatever an older build kept', () => {
    const oversized = Array.from(
      { length: MAX_REMEMBERED_SUBTITLES + 50 },
      (_, at) => [`film-${at}`, `F${at}.srt`],
    );
    const read = parseSubtitleMemory(JSON.stringify(oversized));
    expect(read.size).toBe(MAX_REMEMBERED_SUBTITLES);
    expect(read.has('film-49')).toBe(false);
    expect(read.has('film-50')).toBe(true);
  });
});
