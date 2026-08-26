/* FluidEQ Karaoke Maker export regressions. GPL-3.0-or-later. */

import {
  exportKaraokeMaker,
  exportKaraokeMakerLrc,
  exportKaraokeMakerUltraStar,
  karaokeMakerExportFileName,
} from '../../../common/karaoke/makerExport';
import {
  addKaraokeTranslation,
  IKaraokeMakerNote,
  IKaraokeMakerProject,
  karaokeMakerProjectToSong,
  validateKaraokeMakerProject,
} from '../../../common/karaoke/makerProject';
import { IKaraokeAsset, IKaraokeSong } from '../../../common/karaoke/types';
import { parseUltraStar } from '../../../common/karaoke/ultrastar';
import { parseLrc } from '../../../common/karaoke/lrc';

/**
 * Two lines, four words, and the three shapes every fix here turns on:
 * a rest between "One" and "two", "Three" ending exactly where "four" starts,
 * and 3043/3086 ms — 43 ms apart, which the old 125 ms beat merged.
 */
const project = (): IKaraokeMakerProject => ({
  version: 2,
  id: 'project-1',
  title: 'Song',
  artist: 'Artist',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  audio: {
    name: 'Artist - Song.mp3',
    relativePath: 'Artist - Song.mp3',
    size: 1,
    lastModified: 1,
    durationMs: 10_000,
  },
  lyrics: {
    language: 'en',
    source: 'manual',
    lines: [
      {
        id: 'line-1',
        tokens: [
          {
            id: 'word-1',
            text: 'One',
            startsWord: true,
            startMs: 1_000,
            endMs: 1_200,
            source: 'manual',
          },
          {
            id: 'word-2',
            text: 'two',
            startsWord: true,
            startMs: 2_000,
            endMs: 2_400,
            source: 'manual',
          },
        ],
      },
      {
        id: 'line-2',
        tokens: [
          {
            id: 'word-3',
            text: 'Three',
            startsWord: true,
            startMs: 3_043,
            endMs: 3_086,
            source: 'manual',
          },
          {
            id: 'word-4',
            text: 'four',
            startsWord: true,
            startMs: 3_086,
            endMs: 3_300,
            source: 'manual',
          },
        ],
      },
    ],
  },
  melody: {
    source: 'manual',
    octavePolicy: 'absolute',
    notes: [
      {
        id: 'note-1',
        tokenId: 'word-1',
        startMs: 1_000,
        endMs: 1_200,
        targetMidi: 60,
        kind: 'normal',
        source: 'manual',
      },
      {
        id: 'note-2',
        tokenId: 'word-2',
        startMs: 2_000,
        endMs: 2_400,
        targetMidi: 62,
        kind: 'normal',
        source: 'manual',
      },
      {
        id: 'note-3',
        tokenId: 'word-3',
        startMs: 3_043,
        endMs: 3_086,
        targetMidi: 64,
        kind: 'normal',
        source: 'manual',
      },
      {
        id: 'note-4',
        tokenId: 'word-4',
        startMs: 3_086,
        endMs: 3_300,
        targetMidi: 65,
        kind: 'normal',
        source: 'manual',
      },
    ],
  },
  meta: { gapMs: 0, rightsConfirmed: true },
  analysis: { vocalFocus: false },
  provenance: [],
});

const rowsOf = (contents: string): string[] => contents.trimEnd().split('\n');

const noteRowsOf = (contents: string): string[] =>
  rowsOf(contents).filter((row) => /^[:*F] /.test(row));

const breakRowsOf = (contents: string): string[] =>
  rowsOf(contents).filter((row) => row.startsWith('-'));

const parsedNotes = (contents: string) => {
  const parsed = parseUltraStar(contents);
  return parsed.pitch.kind === 'notes' ? parsed.pitch.notes : [];
};

describe('UltraStar export', () => {
  it('gives every line break the start beat the format requires', () => {
    const contents = exportKaraokeMakerUltraStar(project());
    const breaks = breakRowsOf(contents);

    // The positive control: there IS a break, so "no bare -" below cannot pass
    // by breaking nothing at all.
    expect(breaks).toHaveLength(1);
    expect(breaks).toEqual(['- 609']);
    expect(breaks.some((row) => /^-\s*$/.test(row))).toBe(false);
    // 3043 ms is beat 609, and the break carries the beat of the note opening
    // the new line.
    expect(noteRowsOf(contents)[2]).toBe(': 609 8 4  Three');
    expect(parseUltraStar(contents).lines).toHaveLength(2);
  });

  it('writes syllables on a 5 ms grid instead of a 125 ms one', () => {
    const contents = exportKaraokeMakerUltraStar(project());

    expect(contents).toContain('#BPM:3000');
    const notes = parsedNotes(contents);
    expect(notes.map((note) => note.startMs)).toEqual([
      1_000, 2_000, 3_045, 3_085,
    ]);
    expect(notes.map((note) => note.endMs)).toEqual([
      1_200, 2_400, 3_085, 3_300,
    ]);
    // What the old 125 ms beat did to these two syllables: 3043 became beat 24
    // — 3000 ms, 43 ms early — and 3086 became beat 25, 3125 ms, 39 ms late,
    // while any two syllables inside one cell landed on the same beat.
    const legacyBeat = (timeMs: number) =>
      Math.round((timeMs * 120 * 4) / 60_000);
    expect(legacyBeat(3_043) * 125).toBe(3_000);
    expect(legacyBeat(3_086) * 125).toBe(3_125);
    expect(legacyBeat(3_000)).toBe(legacyBeat(3_043));
    // And what the new one does: distinct beats, within 2.5 ms of the truth.
    expect(Math.abs((notes[2].startMs ?? 0) - 3_043)).toBeLessThanOrEqual(2.5);
    expect(notes[2].startMs).not.toBe(notes[3].startMs);
  });

  it('re-exports an imported file to the identical beats', () => {
    const original = project();
    const first = exportKaraokeMakerUltraStar(original);
    const imported = parsedNotes(first);
    const roundTripped: IKaraokeMakerProject = {
      ...original,
      melody: {
        ...original.melody,
        notes: imported.map((note, index): IKaraokeMakerNote => ({
          id: `round-${index}`,
          tokenId: original.melody.notes[index].tokenId,
          startMs: note.startMs ?? 0,
          endMs: note.endMs ?? 0,
          targetMidi: note.targetMidi ?? 60,
          kind: 'normal',
          source: 'imported',
        })),
      },
    };

    expect(imported).toHaveLength(4);
    expect(noteRowsOf(exportKaraokeMakerUltraStar(roundTripped))).toEqual(
      noteRowsOf(first),
    );
  });

  it('moves #GAP back rather than collapsing an early note onto beat 0', () => {
    const early = project();
    early.meta.gapMs = 5_000;
    const contents = exportKaraokeMakerUltraStar(early);

    expect(contents).toContain('#GAP:1000');
    expect(noteRowsOf(contents)[0]).toBe(': 0 40 0  One');
    // Clamping used to write `: 0 1 …` for all four notes, moving the first
    // from 1000 ms to 5000 ms and the rest on top of it.
    expect(parsedNotes(contents).map((note) => note.startMs)).toEqual([
      1_000, 2_000, 3_045, 3_085,
    ]);

    // Positive control: a gap no note precedes is written unchanged.
    const later = project();
    later.meta.gapMs = 500;
    const kept = exportKaraokeMakerUltraStar(later);
    expect(kept).toContain('#GAP:500');
    expect(parsedNotes(kept).map((note) => note.startMs)).toEqual([
      1_000, 2_000, 3_045, 3_085,
    ]);
  });

  it('breaks lines by lyric order when notes lost their token binding', () => {
    const unbound = project();
    unbound.melody.notes.forEach((note) => {
      Object.assign(note, { tokenId: undefined });
    });
    const contents = exportKaraokeMakerUltraStar(unbound);

    expect(breakRowsOf(contents)).toEqual(['- 609']);
    expect(parseUltraStar(contents).lines).toHaveLength(2);
    // Positive control: the bound project puts real words on the same rows.
    expect(noteRowsOf(contents)[0]).toBe(': 200 40 0 ~');
    expect(noteRowsOf(exportKaraokeMakerUltraStar(project()))[0]).toBe(
      ': 200 40 0  One',
    );

    // Half a binding still writes the half it has.
    const half = project();
    Object.assign(half.melody.notes[0], { tokenId: undefined });
    Object.assign(half.melody.notes[1], { tokenId: undefined });
    const halfRows = noteRowsOf(exportKaraokeMakerUltraStar(half));
    expect(halfRows[0]).toBe(': 200 40 0 ~');
    expect(halfRows[3]).toBe(': 617 43 5  four');
  });

  it('reports a dangling binding, but not a note that never had one', () => {
    // A note pointing at a word that is no longer there is a real defect.
    const dangling = project();
    Object.assign(dangling.melody.notes[0], { tokenId: 'deleted-word' });
    expect(
      validateKaraokeMakerProject(dangling).filter(
        (issue) => issue.code === 'orphan-note',
      ),
    ).toEqual([
      {
        severity: 'warning',
        code: 'orphan-note',
        targetId: 'note-1',
        message: expect.any(String),
      },
    ]);

    // A note with no binding at all is an ordinary state — melody detected
    // before the words were timed — and counting it made the Maker's "checks"
    // total climb to one per note during normal work. What it really costs is
    // words missing from the file, which the writer reports itself.
    const unbound = project();
    unbound.melody.notes.forEach((note) => {
      Object.assign(note, { tokenId: undefined });
    });
    expect(
      validateKaraokeMakerProject(unbound).filter(
        (issue) => issue.code === 'orphan-note',
      ),
    ).toEqual([]);
    expect(exportKaraokeMaker(unbound, 'ultrastar').droppedWords).toBe(4);

    // Positive control: bindings intact is clean and loses nothing.
    expect(validateKaraokeMakerProject(project())).toEqual([]);
    expect(exportKaraokeMaker(project(), 'ultrastar').droppedWords).toBe(0);
  });

  it('writes the headers the format requires', () => {
    const contents = exportKaraokeMakerUltraStar(project());

    expect(contents).toContain('#ARTIST:Artist');
    expect(contents).toContain('#MP3:Artist - Song.mp3');
    expect(contents).toContain('#AUDIO:Artist - Song.mp3');
    expect(contents).toContain('#LANGUAGE:English');

    const anonymous = project();
    anonymous.artist = undefined;
    anonymous.lyrics.language = undefined;
    const bare = exportKaraokeMakerUltraStar(anonymous);
    // #ARTIST is required even when empty; #LANGUAGE is written only when known.
    expect(rowsOf(bare)).toContain('#ARTIST:');
    expect(bare).not.toContain('#LANGUAGE');
  });

  it('still refuses a project with no melody', () => {
    const silent = project();
    silent.melody.notes = [];

    expect(() => exportKaraokeMakerUltraStar(silent)).toThrow(
      /at least one melody note/,
    );
    expect(() => exportKaraokeMakerUltraStar(project())).not.toThrow();
  });
});

describe('LRC export', () => {
  it('closes a word that ends before the next one starts', () => {
    const contents = exportKaraokeMakerLrc(project(), true);

    expect(rowsOf(contents)[3]).toBe(
      '[00:01.00]<00:01.000>One<00:01.200> <00:02.000>two<00:02.400>',
    );
    // "Three" ends exactly where "four" starts, so it needs no closing stamp —
    // 00:03.086 appears once, as the opening stamp of "four".
    expect(rowsOf(contents)[4]).toBe(
      '[00:03.04]<00:03.043>Three <00:03.086>four<00:03.300>',
    );
    expect(contents.match(/<00:03\.086>/g)).toHaveLength(1);

    const { lines } = parseLrc(contents);
    const words = lines.flatMap((line) =>
      line.tokens.filter((token) => token.text.trim().length > 0),
    );
    // Read back: 1000–1200, not the 1000–2000 an open stamp implied, and the
    // last word of the last line ends at 3300 instead of never.
    expect(
      words.map((token) => [token.text.trim(), token.startMs, token.endMs]),
    ).toEqual([
      ['One', 1_000, 1_200],
      ['two', 2_000, 2_400],
      ['Three', 3_043, 3_086],
      ['four', 3_086, 3_300],
    ]);
  });

  it('keeps a bracket out of the metadata tags', () => {
    const bracketed = project();
    bracketed.title = 'Song [Live] Take]';
    bracketed.artist = 'A]B';
    const parsed = parseLrc(exportKaraokeMakerLrc(bracketed, false));

    // A `]` inside the value used to end the tag early and lose it entirely.
    expect(parsed.title).toBe('Song (Live) Take)');
    expect(parsed.artist).toBe('A)B');
    // Positive control: an ordinary title survives untouched.
    expect(parseLrc(exportKaraokeMakerLrc(project(), false)).title).toBe(
      'Song',
    );
  });
});

describe('line-timed LRC', () => {
  /**
   * The shape a plain LRC comes back as: one token per LINE holding the whole
   * sentence, a time on the line and none on any word. `[00:20.00]words here`
   * imported and exported straight back out used to lose its lyrics entirely,
   * because `writeLrc` asked for a timed token and there is never one here.
   */
  const lineTimed = (): IKaraokeMakerProject => {
    const timed = project();
    timed.lyrics.lines = [
      {
        id: 'line-1',
        kind: 'section',
        startMs: 10_000,
        tokens: [
          {
            id: 'section-1',
            text: '[Estribillo]',
            startsWord: true,
            source: 'imported',
          },
        ],
      },
      {
        id: 'line-2',
        kind: 'lyrics',
        startMs: 20_000,
        tokens: [
          {
            id: 'whole-line',
            text: 'words here',
            startsWord: true,
            source: 'imported',
          },
        ],
      },
    ];
    return timed;
  };

  it('writes a line the project timed but never split into words', () => {
    const lrc = exportKaraokeMaker(lineTimed(), 'lrc');

    expect(rowsOf(lrc.contents)).toContain('[00:20.00]words here');
    expect(lrc.droppedLines).toBe(0);
    expect(lrc.droppedWords).toBe(0);
    // Read back by the app's own parser rather than only by eye.
    expect(
      parseLrc(lrc.contents).lines.map((line) => [
        line.startMs,
        line.tokens.map((token) => token.text).join(''),
      ]),
    ).toEqual([
      [10_000, '[Estribillo]'],
      [20_000, 'words here'],
    ]);
  });

  it('drops the same line once its own time is gone', () => {
    // Positive control for the fallback: without a line time there is nothing
    // left to write, and the counters have to say so rather than report a
    // clean export of a file missing its only lyric.
    const untimed = lineTimed();
    untimed.lyrics.lines[1].startMs = undefined;
    const lrc = exportKaraokeMaker(untimed, 'lrc');

    expect(rowsOf(lrc.contents)).not.toContain('[00:20.00]words here');
    expect(lrc.droppedLines).toBe(1);
    // Two words, in one token. `tokens.length` reported 1 for this line
    // however many words it held.
    expect(lrc.droppedWords).toBe(2);
  });

  it('carries the line time into enhanced LRC without inventing word stamps', () => {
    const elrc = exportKaraokeMaker(lineTimed(), 'elrc');

    // The words are there and none of them claims a timing nobody measured.
    expect(rowsOf(elrc.contents)).toContain('[00:20.00]words here');
    expect(elrc.contents).not.toContain('<00:20.000>');
  });
});

describe('export reporting', () => {
  it('counts the lines and words the file does not contain', () => {
    const partial = project();
    partial.lyrics.lines[1].tokens.forEach((token) => {
      Object.assign(token, { startMs: undefined, endMs: undefined });
    });
    partial.melody.notes = partial.melody.notes.slice(0, 2);

    const lrc = exportKaraokeMaker(partial, 'lrc');
    expect(lrc.droppedLines).toBe(1);
    expect(lrc.droppedWords).toBe(2);

    const ultrastar = exportKaraokeMaker(partial, 'ultrastar');
    expect(ultrastar.droppedLines).toBe(1);
    expect(ultrastar.droppedWords).toBe(2);

    // Positive control: the complete project reports nothing missing, so the
    // counters are not simply returning the line and word totals.
    const complete = exportKaraokeMaker(project(), 'elrc');
    expect(complete.droppedLines).toBe(0);
    expect(complete.droppedWords).toBe(0);
    expect(exportKaraokeMaker(project(), 'ultrastar').droppedWords).toBe(0);
  });

  it('counts a syllable-split word once, and only when all of it is gone', () => {
    // `Three` as two singable parts, which is what the Maker's own splitter
    // produces and what an UltraStar import arrives as. Counting tokens
    // reported two missing words for one missing word.
    const split = (): IKaraokeMakerProject => {
      const syllabic = project();
      syllabic.lyrics.lines[1].tokens = [
        {
          id: 'word-3a',
          text: 'Th',
          startsWord: true,
          startMs: 3_043,
          endMs: 3_060,
          source: 'manual',
        },
        {
          id: 'word-3b',
          text: 'ree',
          startsWord: false,
          startMs: 3_060,
          endMs: 3_086,
          source: 'manual',
        },
        syllabic.lyrics.lines[1].tokens[1],
      ];
      syllabic.melody.notes[2].tokenId = 'word-3a';
      return syllabic;
    };

    // One part of the word reached a note, so the word is in the file.
    expect(exportKaraokeMaker(split(), 'ultrastar').droppedWords).toBe(0);

    const orphaned = split();
    orphaned.melody.notes[2].tokenId = undefined;
    const ultrastar = exportKaraokeMaker(orphaned, 'ultrastar');
    // One word, two tokens.
    expect(ultrastar.droppedWords).toBe(1);
    expect(ultrastar.droppedLines).toBe(0);
  });

  it('carries the counters on every format', () => {
    const saved = exportKaraokeMaker(project(), 'project');

    expect(saved).toMatchObject({
      extension: 'fluideq-karaoke.json',
      mimeType: 'application/json',
      droppedLines: 0,
      droppedWords: 0,
    });
    expect(exportKaraokeMaker(project(), 'elrc').extension).toBe('elrc');
  });
});

describe('export file names', () => {
  it('folds Latin accents without rewriting other alphabets', () => {
    const cyrillic = project();
    cyrillic.artist = 'Виктор Цой';
    cyrillic.title = 'Café ёлка 한국 が';

    // NFKD splits й and ё the same way it splits é, so stripping every
    // combining mark measured "Цой" out as "Цои" and "ёлка" as "елка".
    expect(karaokeMakerExportFileName(cyrillic, 'ultrastar')).toBe(
      'Виктор Цой - Cafe ёлка 한국 が.txt',
    );

    // Positive control: an ASCII base letter still loses its accent.
    const latin = project();
    latin.artist = undefined;
    latin.title = 'Café Crème';
    expect(karaokeMakerExportFileName(latin, 'lrc')).toBe('Cafe Creme.lrc');
  });
});

describe('exporting a chosen language', () => {
  // IKaraokeAsset takes a File, not a relativePath/fileName pair — copied
  // from the shape karaokeMaker.test.ts already builds one with.
  const asset: IKaraokeAsset = {
    id: 'audio',
    role: 'audio',
    extension: 'mp3',
    file: new File(['audio'], 'Artist - Song.mp3', { type: 'audio/mpeg' }),
  };

  // Two lines of two words each, so 'hola mundo' / 'sol mar' lines up
  // one-for-one with 'One two' / 'Three four'. 'sol' and 'mar' (rather than
  // e.g. 'tres cuatro') are used for line 2 because their syllable counts are
  // already hand-verified premises elsewhere in this suite
  // (karaokeTranslation.test.ts), which the overlap arithmetic below depends
  // on without re-deriving it here.
  const translated = (): IKaraokeMakerProject =>
    addKaraokeTranslation(project(), 'hola mundo\nsol mar', 'es').project;

  const wordsOf = (song: IKaraokeSong): string[] =>
    song.lines.flatMap((line) => line.tokens.map((token) => token.text));

  it('returns the original when no language is asked for', () => {
    const song = karaokeMakerProjectToSong(translated(), asset);

    expect(wordsOf(song)).toEqual(['One', 'two', 'Three', 'four']);
    expect(song.meta.language).toBe('en');
  });

  it('swaps in the chosen sheet and says which language it is', () => {
    const song = karaokeMakerProjectToSong(translated(), asset, [asset], {
      language: 'es',
    });

    expect(wordsOf(song)).toEqual(['hola', 'mundo', 'sol', 'mar']);
    expect(song.meta.language).toBe('es');
  });

  it('falls back to the original when the language is not present', () => {
    const song = karaokeMakerProjectToSong(translated(), asset, [asset], {
      language: 'de',
    });

    expect(wordsOf(song)).toEqual(['One', 'two', 'Three', 'four']);
    expect(song.meta.language).toBe('en');
  });

  it('writes the chosen language into the UltraStar header and swaps the words, with the melody left exactly as addKaraokeTranslation produced it', () => {
    // The real path: seed a translation and export it with the melody
    // untouched — still bound to the ORIGINAL word ids, because nothing
    // rebinds it and nothing should have to. Before the time-overlap fix
    // this produced a header that said Spanish over a body of nothing but
    // "~": a pasted translation is reseeded with fresh ids every time
    // (makerLinesFromPlainText), so a note's tokenId can never reach a
    // translated sheet's tokens, only its timing can.
    const text = exportKaraokeMakerUltraStar(translated(), {
      language: 'es',
    });

    // 'es' resolves through the same ISO-639 name table the header already
    // uses for 'en' -> 'English' elsewhere in this file, so 'Spanish' is the
    // hand-computed value, not 'es' itself.
    expect(text).toContain('#LANGUAGE:Spanish');
    expect(text).toContain('hola');
    expect(text).toContain('mundo');
    expect(text).toContain('sol');
    expect(text).toContain('mar');
    expect(text).not.toContain('~');
    expect(text).not.toContain('One');
    expect(text).not.toContain('Three');

    // Positive control: without the option both the header and the words
    // are the English original's, same as every other test in this file.
    const original = exportKaraokeMakerUltraStar(translated());
    expect(original).toContain('#LANGUAGE:English');
    expect(original).toContain('One');
    expect(original).not.toContain('hola');
  });

  it('exports LRC in the chosen language', () => {
    // writeLrc walks the chosen sheet's own tokens directly, with no id
    // lookup — unlike UltraStar it never had the binding problem above — but
    // the options parameter still needs a test that would fail if
    // sheetLines were ever hardcoded to the original inside writeLrc.
    // Enhanced (per-word) LRC is used so parseLrc hands back one token per
    // word rather than one per whole line — plain LRC has no per-word split
    // to read back, as the file's other plain-vs-enhanced tests already show.
    const contents = exportKaraokeMakerLrc(translated(), true, {
      language: 'es',
    });

    expect(contents).toContain('hola');
    expect(contents).toContain('mundo');
    expect(contents).toContain('sol');
    expect(contents).toContain('mar');
    expect(contents).not.toContain('One');
    expect(contents).not.toContain('Three');

    const { lines } = parseLrc(contents);
    const words = lines.flatMap((line) =>
      line.tokens.filter((token) => token.text.trim().length > 0),
    );
    expect(words.map((token) => token.text.trim())).toEqual([
      'hola',
      'mundo',
      'sol',
      'mar',
    ]);

    // Positive control: without the option, the original's words come back.
    const original = exportKaraokeMakerLrc(translated(), true);
    expect(original).toContain('One');
    expect(original).not.toContain('hola');
  });

  it('validates clean when a translation is empty or unfinished, and still catches the original', () => {
    const withRoughTranslation: IKaraokeMakerProject = {
      ...project(),
      lyrics: {
        ...project().lyrics,
        translations: [
          {
            language: 'es',
            source: 'translation-seed',
            lines: [
              {
                id: 'line-1-es',
                tokens: [
                  {
                    id: 'w-es',
                    text: 'hola',
                    startsWord: true,
                    source: 'translation-seed',
                    // No startMs/endMs at all: an error if the validator
                    // judged translations, and it must not.
                  },
                ],
              },
            ],
          },
        ],
      },
    };
    expect(validateKaraokeMakerProject(withRoughTranslation)).toEqual([]);

    // Positive control: an untimed word in the ORIGINAL is still caught, so
    // the clean result above is not just validate() ignoring everything.
    const untimedOriginal: IKaraokeMakerProject = {
      ...withRoughTranslation,
      lyrics: {
        ...withRoughTranslation.lyrics,
        lines: withRoughTranslation.lyrics.lines.map((line) => ({
          ...line,
          tokens: line.tokens.map((token) => ({
            ...token,
            startMs: undefined,
            endMs: undefined,
          })),
        })),
      },
    };
    expect(
      validateKaraokeMakerProject(untimedOriginal).some(
        (issue) => issue.code === 'untimed-word',
      ),
    ).toBe(true);
  });
});
