/* FluidEQ karaoke translation seeding tests. GPL-3.0-or-later. */

import {
  addKaraokeTranslation,
  createKaraokeMakerProject,
  IKaraokeMakerLine,
  IKaraokeMakerNote,
  IKaraokeMakerProject,
  karaokeTranslationFit,
  karaokeTranslationLanguages,
  removeKaraokeTranslation,
  seedKaraokeTranslation,
} from '../../../common/karaoke/makerProject';
import { splitKaraokeWordSyllables } from '../../../common/karaoke/syllables';
import { IKaraokeSong } from '../../../common/karaoke/types';

const lyricLine = (
  id: string,
  text: string,
  startMs: number,
  endMs: number,
): IKaraokeMakerLine => ({
  id,
  kind: 'lyrics',
  startMs,
  endMs,
  tokens: text.split(' ').map((word, index) => ({
    id: `${id}-w${index}`,
    text: word,
    startsWord: true,
    source: 'manual' as const,
  })),
});

describe('seedKaraokeTranslation', () => {
  it('divides a line span in proportion to syllable count', () => {
    // Guard the premise before the arithmetic: if the splitter ever disagrees,
    // the failure must name that rather than look like a distributor bug. If
    // this guard fails, change the test's WORDS, never the expectations below.
    expect(splitKaraokeWordSyllables('hola', 'es')).toHaveLength(2);
    expect(splitKaraokeWordSyllables('mundo', 'es')).toHaveLength(2);

    const result = seedKaraokeTranslation(
      [lyricLine('l1', 'hello world', 1_000, 3_000)],
      'hola mundo',
      'es',
    );

    const tokens = result.sheet?.lines[0].tokens ?? [];
    expect(tokens.map((token) => token.text)).toEqual(['hola', 'mundo']);
    // 2000ms across 4 syllables, 2 each: the boundary lands dead centre.
    expect(tokens[0].startMs).toBe(1_000);
    expect(tokens[0].endMs).toBe(2_000);
    expect(tokens[1].startMs).toBe(2_000);
    expect(tokens[1].endMs).toBe(3_000);
  });

  it('gives a longer word proportionally more of the span', () => {
    expect(splitKaraokeWordSyllables('sol', 'es')).toHaveLength(1);
    expect(splitKaraokeWordSyllables('cantaba', 'es')).toHaveLength(3);

    const result = seedKaraokeTranslation(
      [lyricLine('l1', 'sun sang', 0, 4_000)],
      'sol cantaba',
      'es',
    );

    const tokens = result.sheet?.lines[0].tokens ?? [];
    // 4000ms across 4 syllables: 1000 for `sol`, 3000 for `cantaba`.
    expect(tokens[0].endMs).toBe(1_000);
    expect(tokens[1].startMs).toBe(1_000);
    expect(tokens[1].endMs).toBe(4_000);
  });

  it('divides three tokens by a ratio where the middle boundary is wrong under equal division too', () => {
    expect(splitKaraokeWordSyllables('sol', 'es')).toHaveLength(1);
    expect(splitKaraokeWordSyllables('mundo', 'es')).toHaveLength(2);
    expect(splitKaraokeWordSyllables('cantaba', 'es')).toHaveLength(3);

    const result = seedKaraokeTranslation(
      [lyricLine('l1', 'sun sings brightly', 0, 6_000)],
      'sol mundo cantaba',
      'es',
    );

    const tokens = result.sheet?.lines[0].tokens ?? [];
    // 6000ms across weights 1:2:3 (6 total): 1000 / 2000 / 3000. Equal
    // thirds would put every edge at 2000/4000 — wrong at the shared
    // boundary too, not only at the ends, which is what a two-token
    // 1-vs-3 case cannot tell apart from a three-way equal split.
    expect(tokens[0].startMs).toBe(0);
    expect(tokens[0].endMs).toBe(1_000);
    expect(tokens[1].startMs).toBe(1_000);
    expect(tokens[1].endMs).toBe(3_000);
    expect(tokens[2].startMs).toBe(3_000);
    expect(tokens[2].endMs).toBe(6_000);
  });

  it('keeps a fractional division exact instead of accumulating rounded steps', () => {
    expect(splitKaraokeWordSyllables('sol', 'es')).toHaveLength(1);
    expect(splitKaraokeWordSyllables('mar', 'es')).toHaveLength(1);
    expect(splitKaraokeWordSyllables('luz', 'es')).toHaveLength(1);

    const result = seedKaraokeTranslation(
      [lyricLine('l1', 'a b c', 0, 1_000)],
      'sol mar luz',
      'es',
    );

    const tokens = result.sheet?.lines[0].tokens ?? [];
    // Three equal-weight tokens over 1000ms, which does not divide evenly:
    // 0 / 333 / 667 / 1000. This guards against the common wrong refactor
    // that accumulates Math.round(span / total) per step instead of
    // recomputing each boundary from the running total — that version
    // drifts to 0 / 333 / 666 / 999, a millisecond short of the line's
    // real end. A distributor that is merely "close" here is the bug this
    // test exists to catch; the literal numbers are the point.
    expect(tokens.map((token) => token.startMs)).toEqual([0, 333, 667]);
    expect(tokens.map((token) => token.endMs)).toEqual([333, 667, 1_000]);
  });

  it('reports a count mismatch and produces no sheet', () => {
    const result = seedKaraokeTranslation(
      [
        lyricLine('l1', 'hello world', 0, 1_000),
        lyricLine('l2', 'again', 1_000, 2_000),
      ],
      'hola mundo',
      'es',
    );

    expect(result.sheet).toBeUndefined();
    expect(result.mismatch).toEqual({ expected: 2, received: 1 });
  });

  it('copies section lines through and does not spend a pasted line on them', () => {
    const section: IKaraokeMakerLine = {
      id: 'sec',
      kind: 'section',
      tokens: [
        { id: 'sec-t', text: '[Chorus]', startsWord: true, source: 'manual' },
      ],
    };

    const result = seedKaraokeTranslation(
      [section, lyricLine('l1', 'hello world', 0, 2_000)],
      'hola mundo',
      'es',
    );

    expect(result.sheet?.lines).toHaveLength(2);
    expect(result.sheet?.lines[0].kind).toBe('section');
    expect(result.sheet?.lines[0].tokens[0].text).toBe('[Chorus]');
    expect(result.sheet?.lines[1].tokens.map((token) => token.text)).toEqual([
      'hola',
      'mundo',
    ]);
  });

  it('leaves an untimed original line untimed rather than inventing a span', () => {
    const untimed: IKaraokeMakerLine = {
      id: 'l1',
      kind: 'lyrics',
      tokens: [
        { id: 'l1-w0', text: 'hello', startsWord: true, source: 'manual' },
      ],
    };

    const result = seedKaraokeTranslation([untimed], 'hola', 'es');

    expect(result.sheet?.lines[0].tokens[0].startMs).toBeUndefined();
  });

  it('divides an unspaced script per character without inventing spaces', () => {
    // Japanese is one token per character, as makerLinesFromPlainText records.
    // A target language may be unspaced even when the source is not, which is
    // the case the original sheet never exercises.
    const result = seedKaraokeTranslation(
      [lyricLine('l1', 'hello world', 0, 5_000)],
      'こんにちは',
      'ja',
    );

    const tokens = result.sheet?.lines[0].tokens ?? [];
    expect(tokens.map((token) => token.text)).toEqual([
      'こ',
      'ん',
      'に',
      'ち',
      'は',
    ]);
    // Five single-syllable units across 5000ms: 1000ms each, exactly.
    expect(tokens.map((token) => token.startMs)).toEqual([
      0, 1_000, 2_000, 3_000, 4_000,
    ]);
    expect(tokens[4].endMs).toBe(5_000);
  });

  it('never marks a seeded timing as user-authored', () => {
    const result = seedKaraokeTranslation(
      [lyricLine('l1', 'hello world', 0, 2_000)],
      'hola mundo',
      'es',
    );

    expect(
      result.sheet?.lines[0].tokens.every(
        (token) => token.timingLocked !== true,
      ),
    ).toBe(true);
  });
});

describe('karaokeTranslationFit', () => {
  const note = (
    id: string,
    startMs: number,
    endMs: number,
  ): IKaraokeMakerNote => ({
    id,
    startMs,
    endMs,
    targetMidi: 60,
    kind: 'normal',
    source: 'pitch-analysis',
  });

  it('counts syllables against the notes overlapping the line', () => {
    const seeded = seedKaraokeTranslation(
      [lyricLine('l1', 'hello world', 1_000, 3_000)],
      'hola mundo',
      'es',
    );
    const { sheet } = seeded;
    if (!sheet) {
      throw new Error('expected a sheet');
    }

    const fit = karaokeTranslationFit(sheet, [
      note('n1', 1_000, 1_500),
      note('n2', 1_500, 2_000),
      note('n3', 2_000, 3_000),
      // Outside the line entirely: must not be counted.
      note('n4', 6_000, 7_000),
      // Ends exactly at the line's startMs (1000): touches but does not
      // overlap, so a `>=` filter that treats touching as overlap must not
      // count it.
      note('n5', 500, 1_000),
      // Starts exactly at the line's endMs (3000): the mirror case at the
      // other edge, catching a `<=` filter the same way.
      note('n6', 3_000, 3_500),
      // Starts before the line and ends inside it: overlapping without
      // being contained, which is ordinary for a note held across a line
      // break. A containment check (`startMs >= range.startMs && endMs <=
      // range.endMs`) would wrongly drop this one.
      note('n7', 700, 1_300),
    ]);

    expect(fit).toHaveLength(1);
    // hola (2) + mundo (2).
    expect(fit[0].syllables).toBe(4);
    // n1-n3 sit inside the line and n7 overlaps it from before the start;
    // n4-n6 must not count: outside, and touching either edge exactly.
    expect(fit[0].notes).toBe(4);
  });

  it("counts syllables by the sheet's language, not a hardcoded default", () => {
    // A trailing 'y' is a vowel in English but never in Spanish (see
    // isVowelAt in src/common/karaoke/syllables.ts), so this word's split
    // depends on which language is actually passed through.
    expect(splitKaraokeWordSyllables('baby', 'es')).toHaveLength(1);
    expect(splitKaraokeWordSyllables('baby', 'en')).toHaveLength(2);

    const seeded = seedKaraokeTranslation(
      [lyricLine('l1', 'hello', 0, 1_000)],
      'baby',
      'es',
    );
    const { sheet } = seeded;
    if (!sheet) {
      throw new Error('expected a sheet');
    }

    // A hardcoded 'en' (or a dropped sheet.language) would read 2 here.
    expect(karaokeTranslationFit(sheet, [])[0].syllables).toBe(1);
  });

  it('skips section lines, which are never sung', () => {
    const section: IKaraokeMakerLine = {
      id: 'sec',
      kind: 'section',
      tokens: [
        { id: 'sec-t', text: '[Chorus]', startsWord: true, source: 'manual' },
      ],
    };
    const seeded = seedKaraokeTranslation(
      [section, lyricLine('l1', 'hello world', 0, 2_000)],
      'hola mundo',
      'es',
    );
    const { sheet } = seeded;
    if (!sheet) {
      throw new Error('expected a sheet');
    }

    expect(karaokeTranslationFit(sheet, [])).toHaveLength(1);
  });

  it('reports zero notes for an untimed line rather than counting every note', () => {
    const untimed: IKaraokeMakerLine = {
      id: 'l1',
      kind: 'lyrics',
      tokens: [
        { id: 'l1-w0', text: 'hello', startsWord: true, source: 'manual' },
      ],
    };
    const seeded = seedKaraokeTranslation([untimed], 'hola', 'es');
    const { sheet } = seeded;
    if (!sheet) {
      throw new Error('expected a sheet');
    }

    expect(karaokeTranslationFit(sheet, [note('n1', 0, 500)])[0].notes).toBe(0);
  });
});

describe('translations on a project', () => {
  // createKaraokeMakerProject takes an IKaraokeSong, not the project's own
  // fields; projectWithLines overwrites lyrics.lines and lyrics.language
  // right after, so only a minimal, otherwise-empty song is needed here.
  const song = (): IKaraokeSong => ({
    id: 'song-1',
    title: 'Song',
    assets: [],
    timingPrecision: 'syllable',
    lines: [],
    pitch: { kind: 'none', reason: 'missing' },
    meta: { sourceFormat: 'test', gapMs: 0 },
  });

  const projectWithLines = (): IKaraokeMakerProject => {
    const base = createKaraokeMakerProject(song());
    return {
      ...base,
      lyrics: {
        ...base.lyrics,
        language: 'en',
        lines: [lyricLine('l1', 'hello world', 0, 2_000)],
      },
    };
  };

  it('adds a sheet and leaves the original untouched', () => {
    const { project } = addKaraokeTranslation(
      projectWithLines(),
      'hola mundo',
      'es',
    );

    expect(project.lyrics.lines[0].tokens.map((token) => token.text)).toEqual([
      'hello',
      'world',
    ]);
    expect(project.lyrics.translations?.[0].language).toBe('es');
  });

  it('replaces a language already present instead of adding it twice', () => {
    const first = addKaraokeTranslation(
      projectWithLines(),
      'hola mundo',
      'es',
    ).project;
    const second = addKaraokeTranslation(first, 'adios mundo', 'es').project;

    expect(second.lyrics.translations).toHaveLength(1);
    expect(second.lyrics.translations?.[0].lines[0].tokens[0].text).toBe(
      'adios',
    );
  });

  it('refuses the original language and returns the project unchanged', () => {
    const before = projectWithLines();
    const { project, mismatch } = addKaraokeTranslation(
      before,
      'hello world',
      'en',
    );

    expect(project).toBe(before);
    expect(mismatch).toBeUndefined();
  });

  it('returns the project unchanged when the counts disagree', () => {
    const before = projectWithLines();
    const { project, mismatch } = addKaraokeTranslation(
      before,
      'hola\nmundo',
      'es',
    );

    expect(project).toBe(before);
    expect(mismatch).toEqual({ expected: 1, received: 2 });
  });

  it('removes a sheet, and drops the key entirely when the last one goes', () => {
    const added = addKaraokeTranslation(
      projectWithLines(),
      'hola mundo',
      'es',
    ).project;

    const removed = removeKaraokeTranslation(added, 'es');

    expect(removed.lyrics.translations).toBeUndefined();
  });

  it('lists the original first, then the translations in the order added', () => {
    const withEs = addKaraokeTranslation(
      projectWithLines(),
      'hola mundo',
      'es',
    ).project;
    const withFr = addKaraokeTranslation(withEs, 'bonjour monde', 'fr').project;

    expect(karaokeTranslationLanguages(withFr)).toEqual(['en', 'es', 'fr']);
  });
});
