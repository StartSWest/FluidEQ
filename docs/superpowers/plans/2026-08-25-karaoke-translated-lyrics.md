# Karaoke Translated Lyrics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a karaoke song carry lyric sheets in more languages than the one it was sung in, laid over the original's timing, with a per-line indicator of how the syllables sit against the shared melody.

**Architecture:** `project.lyrics.lines` keeps meaning "the sung original" — 314 call sites across 24 files depend on that — so alternate languages are added as an optional `translations` array of self-contained sheets. The melody is not duplicated: `project.melody.notes` is already language-independent and stays shared. Switching language is a view concern; the project's spine is never reassigned.

**Tech Stack:** TypeScript (strict), React, Electron, Jest, canvas 2D for both lyric surfaces, SCSS with the `$weight-*` scale.

**Spec:** `docs/superpowers/specs/2026-08-25-karaoke-translated-lyrics-design.md` — read it before Task 1. Section references below (§4, §7, …) point into it.

## Global Constraints

- **Order of work: the change first, tests after Ivan is happy with it.** Tasks 1–6 are pure logic with no window to look at, so they are written test-first as specified. Tasks 7–11 are UI: build it, show him, and only then write the tests named in each task. Do not stop a UI task to chase a red suite.
- **Type-check and lint as you go:** `pnpm typecheck` and `pnpm lint` after every task. Those are seconds and catch what would otherwise reach his window broken.
- **Jest will not start without a build.** Run `pnpm build` once before the first `pnpm test` in a fresh tree.
- Strict TS: no `any` (use `unknown` + guards), no `!` non-null, no `@ts-ignore`, no `==`, no `var`, no empty `catch`, no dead code, no `console.log` left in source.
- No `eslint-disable` without an inline justification on the same line.
- Files stay under 500 lines unless there is genuinely no seam.
- No `setTimeout`/`setInterval` to make a race behave.
- Comments state what the code cannot: constraints, measured numbers, the failure the code prevents — never what the next line does.
- **Every user-facing string goes through i18n, all ten locales in the same commit** (`en de es fr hi it ja pt ru zh`).
- **UI reuses the app's existing classes; never invent a style.** `button small` is the filled accent, `button small subtle` the quiet outline.
- **No raw `font-weight` numbers** — use the `$weight-*` scale in `_theme.scss`. `$weight-bold` is the ceiling at UI sizes.
- Do not run the app. Ivan runs it. State plainly what has and has not been verified.
- Commit messages are a declarative sentence in the house style (see `git log`), not conventional-commit prefixes.

---

### Task 1: The sheet type, the new source, and the schema bump

**Files:**

- Modify: `src/common/karaoke/makerProject/model.ts` (add `IKaraokeMakerLyricSheet`, extend `TKaraokeMakerSource`, `safeSource`, `karaokeMakerSourceIsAutomatic`, bump `KARAOKE_MAKER_PROJECT_VERSION`)
- Modify: `src/common/karaoke/makerProject/project.ts` (parse guard, extract the line sanitiser, serialise translations)
- Test: `src/__tests__/unit_tests/common/karaokeMaker.test.ts`

**Interfaces:**

- Consumes: nothing.
- Produces: `IKaraokeMakerLyricSheet { language: string; source: TKaraokeMakerSource; lines: IKaraokeMakerLine[] }`; `project.lyrics.translations?: IKaraokeMakerLyricSheet[]`; the source-union member `'translation-seed'`; `KARAOKE_MAKER_PROJECT_VERSION === 2`.

- [ ] **Step 1: Write the failing tests**

Add to `src/__tests__/unit_tests/common/karaokeMaker.test.ts`. Import `IKaraokeMakerLyricSheet` alongside the existing imports from `'../../../common/karaoke/makerProject'`.

```ts
describe('translated lyric sheets', () => {
  const sheet: IKaraokeMakerLyricSheet = {
    language: 'es',
    source: 'translation-seed',
    lines: [
      {
        id: 'line-es-1',
        kind: 'lyrics',
        startMs: 1_000,
        endMs: 3_000,
        tokens: [
          {
            id: 'word-es-1',
            text: 'hola',
            startsWord: true,
            source: 'translation-seed',
            startMs: 1_000,
            endMs: 2_000,
          },
        ],
      },
    ],
  };

  it('round-trips translations through serialize and parse', () => {
    const project = createKaraokeMakerProject({
      name: 'song.mp3',
      relativePath: 'song.mp3',
      size: 1,
      lastModified: 1,
    });
    const withSheet = {
      ...project,
      lyrics: { ...project.lyrics, translations: [sheet] },
    };

    const parsed = parseKaraokeMakerProject(
      serializeKaraokeMakerProject(withSheet),
    );

    expect(parsed?.lyrics.translations).toHaveLength(1);
    expect(parsed?.lyrics.translations?.[0].language).toBe('es');
    expect(parsed?.lyrics.translations?.[0].lines[0].tokens[0].text).toBe(
      'hola',
    );
    expect(parsed?.lyrics.translations?.[0].lines[0].tokens[0].startMs).toBe(
      1_000,
    );
  });

  it('loads a version 1 draft with no translations rather than rejecting it', () => {
    const project = createKaraokeMakerProject({
      name: 'song.mp3',
      relativePath: 'song.mp3',
      size: 1,
      lastModified: 1,
    });
    const legacy = JSON.parse(serializeKaraokeMakerProject(project)) as Record<
      string,
      unknown
    >;
    legacy.version = 1;

    const parsed = parseKaraokeMakerProject(JSON.stringify(legacy));

    expect(parsed).not.toBeNull();
    expect(parsed?.lyrics.translations).toBeUndefined();
  });

  it('treats translation-seed timings as automatic, so the aligner may replace them', () => {
    expect(karaokeMakerSourceIsAutomatic('translation-seed')).toBe(true);
  });
});
```

`karaokeMakerSourceIsAutomatic` must be added to the test file's import list.

- [ ] **Step 2: Run the tests to verify they fail**

```bash
pnpm test -- karaokeMaker.test.ts -t "translated lyric sheets"
```

Expected: FAIL. The first two on `translations` being undefined or the version check rejecting, the third on `'translation-seed'` not being assignable to `TKaraokeMakerSource`.

- [ ] **Step 3: Extend the model**

In `src/common/karaoke/makerProject/model.ts`:

Bump the version constant at line 29:

```ts
// 2 adds `lyrics.translations`. The parse guard rejects any other version, so
// an older build refuses a newer draft out loud rather than silently dropping
// the translations on its next save.
export const KARAOKE_MAKER_PROJECT_VERSION = 2 as const;
```

Add `'translation-seed'` to `TKaraokeMakerSource` (line 38), to the array inside `karaokeMakerSourceIsAutomatic` (line 165), and to the array inside `safeSource` (line 424):

```ts
export type TKaraokeMakerSource =
  | 'manual'
  | 'imported'
  | 'pitch-analysis'
  | 'basic-pitch'
  | 'whisper'
  | 'auto-align'
  // The words are the user's, but the timings were derived from the original
  // language's line spans. Derived timings must stay replaceable by the fit
  // tools, which is what marking them automatic buys.
  | 'translation-seed';
```

Add the sheet interface next to `IKaraokeMakerLine`:

```ts
/**
 * One language's words for a song.
 *
 * No notes here. The melody is shared across every language and already lives
 * in `project.melody`; languages differ only in the words and in where the
 * word boundaries fall, so a sheet carries tokens and nothing else.
 */
export interface IKaraokeMakerLyricSheet {
  language: string;
  source: TKaraokeMakerSource;
  lines: IKaraokeMakerLine[];
}
```

Add the field to `IKaraokeMakerProject.lyrics` (line 371):

```ts
  lyrics: {
    language?: string;
    source: TKaraokeMakerSource;
    lines: IKaraokeMakerLine[];
    translations?: IKaraokeMakerLyricSheet[];
  };
```

- [ ] **Step 4: Extract the line sanitiser in `project.ts` and reuse it for translations**

The parse guard builds `lines` inline at `project.ts:238`. Lift that expression into a named function above the parser, unchanged in behaviour, so translations get the same sanitising — the same length caps, the same section re-derivation, the same token guards:

```ts
const sanitiseMakerLines = (
  rawLines: readonly unknown[],
  legacyWhisperAlignment: boolean,
): IKaraokeMakerLine[] => {
  /* the body currently inline at project.ts:238, moved verbatim */
};
```

Call it for the original exactly as before, and add the translations branch inside the returned `lyrics` object:

```ts
    lyrics: {
      language:
        typeof value.lyrics?.language === 'string'
          ? value.lyrics.language.slice(0, 64)
          : undefined,
      source: safeSource(value.lyrics?.source),
      lines,
      translations: Array.isArray(value.lyrics?.translations)
        ? value.lyrics.translations
            // A cap, because this array is reachable from a file on disk.
            .slice(0, 32)
            .flatMap((sheet: unknown): IKaraokeMakerLyricSheet[] => {
              const language =
                typeof (sheet as { language?: unknown })?.language === 'string'
                  ? String((sheet as { language: string }).language).slice(0, 64)
                  : '';
              if (!language) {
                return [];
              }
              const rawSheetLines = (sheet as { lines?: unknown }).lines;
              return [
                {
                  language,
                  source: safeSource((sheet as { source?: unknown }).source),
                  lines: sanitiseMakerLines(
                    Array.isArray(rawSheetLines) ? rawSheetLines : [],
                    legacyWhisperAlignment,
                  ),
                },
              ];
            })
        : undefined,
    },
```

Leave `translations` as `undefined` rather than `[]` when absent, so a v1 draft parses to something indistinguishable from a project that has never had one.

- [ ] **Step 5: Run the tests to verify they pass**

```bash
pnpm test -- karaokeMaker.test.ts -t "translated lyric sheets"
```

Expected: PASS, all three.

- [ ] **Step 6: Run the whole karaoke suite and the type-check**

```bash
pnpm typecheck && pnpm test -- karaoke
```

Expected: PASS. The version bump touches `karaokeEditorPersistence.test.ts` and any fixture that hard-codes `version: 1` — update those fixtures to 2; do not weaken the version guard.

- [ ] **Step 7: Commit**

```bash
git add src/common/karaoke/makerProject/model.ts src/common/karaoke/makerProject/project.ts src/__tests__/unit_tests/common/
git commit -m "A song can hold more than one set of words for the same melody"
```

---

### Task 2: The distributor

**Files:**

- Create: `src/common/karaoke/makerProject/translationSeed.ts`
- Modify: `src/common/karaoke/makerProject/index.ts` (add `export * from './translationSeed';` after `./syllables`)
- Test: `src/__tests__/unit_tests/common/karaokeTranslation.test.ts`

**Interfaces:**

- Consumes: `IKaraokeMakerLyricSheet`, `'translation-seed'` (Task 1); `makerLinesFromPlainText`, `karaokeMakerLineIsSection`, `karaokeMakerTimedLineRange`, `karaokeMakerId` from `./model`; `splitKaraokeWordSyllables` from `../syllables`.
- Produces: `seedKaraokeTranslation(original, text, language) => IKaraokeTranslationSeedResult` where `IKaraokeTranslationSeedResult = { sheet?: IKaraokeMakerLyricSheet; mismatch?: { expected: number; received: number } }`.

- [ ] **Step 1: Write the failing tests**

Create `src/__tests__/unit_tests/common/karaokeTranslation.test.ts`:

```ts
/* FluidEQ karaoke translation seeding tests. GPL-3.0-or-later. */

import {
  IKaraokeMakerLine,
  seedKaraokeTranslation,
} from '../../../common/karaoke/makerProject';
import { splitKaraokeWordSyllables } from '../../../common/karaoke/syllables';

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
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
pnpm test -- karaokeTranslation.test.ts
```

Expected: FAIL with `seedKaraokeTranslation is not a function` / not exported.

- [ ] **Step 3: Write the module**

Create `src/common/karaoke/makerProject/translationSeed.ts`:

```ts
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Laying a second language's words over the timing the first one already has.
 *
 * The melody is not here and never will be: notes live in `project.melody` and
 * are shared by every language, because a translation changes the words and
 * not the tune. What a sheet has to invent is only where the word boundaries
 * fall inside a line whose start and end are already known.
 *
 * The division is proportional to syllable count, which assumes every syllable
 * takes equal time — something no singer has ever done. It is a starting point
 * that puts the words near their notes so the user is correcting rather than
 * typing timings from nothing.
 */
import {
  IKaraokeMakerLine,
  IKaraokeMakerLyricSheet,
  karaokeMakerId,
  karaokeMakerLineIsSection,
  karaokeMakerTimedLineRange,
  makerLinesFromPlainText,
} from './model';
import { splitKaraokeWordSyllables } from '../syllables';

export interface IKaraokeTranslationSeedResult {
  sheet?: IKaraokeMakerLyricSheet;
  /** Lyric lines the original has, against lyric lines the paste supplied. */
  mismatch?: { expected: number; received: number };
}

const syllableWeight = (text: string, language: string): number =>
  Math.max(1, splitKaraokeWordSyllables(text, language).length);

const timedTranslatedLine = (
  original: IKaraokeMakerLine,
  translated: IKaraokeMakerLine,
  language: string,
): IKaraokeMakerLine => {
  const range = karaokeMakerTimedLineRange(original);
  if (!range) {
    return { ...translated, startMs: undefined, endMs: undefined };
  }
  const weights = translated.tokens.map((token) =>
    syllableWeight(token.text, language),
  );
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  const span = range.endMs - range.startMs;
  let consumed = 0;
  const tokens = translated.tokens.map((token, index) => {
    const startMs = range.startMs + (span * consumed) / total;
    consumed += weights[index];
    return {
      ...token,
      startMs: Math.round(startMs),
      endMs: Math.round(range.startMs + (span * consumed) / total),
    };
  });
  return { ...translated, startMs: range.startMs, endMs: range.endMs, tokens };
};

/**
 * Build a sheet for `language` from pasted `text`, over `original`'s timing.
 *
 * Matching is by index over lyric lines only. Section headings are structure
 * rather than words: they copy through and consume no pasted line, which is
 * why a paste that omits them still lines up.
 */
export const seedKaraokeTranslation = (
  original: readonly IKaraokeMakerLine[],
  text: string,
  language: string,
): IKaraokeTranslationSeedResult => {
  const pasted = makerLinesFromPlainText(text, 'translation-seed').filter(
    (line) => !karaokeMakerLineIsSection(line),
  );
  const originalLyrics = original.filter(
    (line) => !karaokeMakerLineIsSection(line),
  );
  if (pasted.length !== originalLyrics.length) {
    return {
      mismatch: { expected: originalLyrics.length, received: pasted.length },
    };
  }
  let next = 0;
  const lines = original.map((line): IKaraokeMakerLine => {
    if (karaokeMakerLineIsSection(line)) {
      return {
        ...line,
        id: karaokeMakerId('line'),
        tokens: line.tokens.map((token) => ({
          ...token,
          id: karaokeMakerId('word'),
        })),
      };
    }
    const translated = pasted[next];
    next += 1;
    return timedTranslatedLine(line, translated, language);
  });
  return { sheet: { language, source: 'translation-seed', lines } };
};
```

Add to `src/common/karaoke/makerProject/index.ts`, after the `./syllables` line:

```ts
export * from './translationSeed';
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
pnpm test -- karaokeTranslation.test.ts
```

Expected: PASS, all seven. **If one of the syllable-count guards fails, change the test's words to ones the splitter does divide as stated — do not adjust the millisecond expectations to match whatever the code produced.** A proportional distributor that returns the same number for everything passes a lazily-written test perfectly; the fixed arithmetic is the only thing that catches it.

- [ ] **Step 5: Type-check, lint, commit**

```bash
pnpm typecheck && pnpm lint
git add src/common/karaoke/makerProject/translationSeed.ts src/common/karaoke/makerProject/index.ts src/__tests__/unit_tests/common/karaokeTranslation.test.ts
git commit -m "The second language borrows the first one's clock"
```

---

### Task 3: The fit check

**Files:**

- Modify: `src/common/karaoke/makerProject/translationSeed.ts`
- Test: `src/__tests__/unit_tests/common/karaokeTranslation.test.ts`

**Interfaces:**

- Consumes: `IKaraokeMakerLyricSheet` (Task 1), `IKaraokeMakerNote` from `./model`.
- Produces: `karaokeTranslationFit(sheet, notes) => IKaraokeTranslationFit[]` where `IKaraokeTranslationFit = { lineId: string; syllables: number; notes: number }`.

- [ ] **Step 1: Write the failing test**

Append to `src/__tests__/unit_tests/common/karaokeTranslation.test.ts`. Add `IKaraokeMakerNote` and `karaokeTranslationFit` to the imports.

```ts
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
      [lyricLine('l1', 'hello world', 0, 2_000)],
      'hola mundo',
      'es',
    );
    const sheet = seeded.sheet;
    if (!sheet) {
      throw new Error('expected a sheet');
    }

    const fit = karaokeTranslationFit(sheet, [
      note('n1', 0, 500),
      note('n2', 500, 1_000),
      note('n3', 1_000, 2_000),
      // Outside the line entirely: must not be counted.
      note('n4', 5_000, 6_000),
    ]);

    expect(fit).toHaveLength(1);
    // hola (2) + mundo (2) against three notes: one syllable too many.
    expect(fit[0].syllables).toBe(4);
    expect(fit[0].notes).toBe(3);
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
    const sheet = seeded.sheet;
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
    const sheet = seeded.sheet;
    if (!sheet) {
      throw new Error('expected a sheet');
    }

    expect(karaokeTranslationFit(sheet, [note('n1', 0, 500)])[0].notes).toBe(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm test -- karaokeTranslation.test.ts -t "karaokeTranslationFit"
```

Expected: FAIL — `karaokeTranslationFit` is not exported.

- [ ] **Step 3: Implement it**

Append to `src/common/karaoke/makerProject/translationSeed.ts` (and add `IKaraokeMakerNote` to its import list from `./model`):

```ts
export interface IKaraokeTranslationFit {
  lineId: string;
  syllables: number;
  notes: number;
}

/**
 * How a translated line sits against the melody it has to be sung to.
 *
 * Not stored. Recomputed as the user types, because it is the only feedback
 * available before anything is synthesised — and the mismatch is fixable from
 * either side: change the words, or split a held note in two.
 */
export const karaokeTranslationFit = (
  sheet: IKaraokeMakerLyricSheet,
  notes: readonly IKaraokeMakerNote[],
): IKaraokeTranslationFit[] =>
  sheet.lines
    .filter((line) => !karaokeMakerLineIsSection(line))
    .map((line) => {
      const range = karaokeMakerTimedLineRange(line);
      return {
        lineId: line.id,
        syllables: line.tokens.reduce(
          (sum, token) => sum + syllableWeight(token.text, sheet.language),
          0,
        ),
        notes: range
          ? notes.filter(
              (note) =>
                note.startMs < range.endMs && note.endMs > range.startMs,
            ).length
          : 0,
      };
    });
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
pnpm test -- karaokeTranslation.test.ts
```

Expected: PASS, all ten.

- [ ] **Step 5: Type-check, lint, commit**

```bash
pnpm typecheck && pnpm lint
git add src/common/karaoke/makerProject/translationSeed.ts src/__tests__/unit_tests/common/karaokeTranslation.test.ts
git commit -m "Four syllables and three notes is a thing the editor can say out loud"
```

---

### Task 4: Adding and removing a language on the project

**Files:**

- Modify: `src/common/karaoke/makerProject/translationSeed.ts`
- Test: `src/__tests__/unit_tests/common/karaokeTranslation.test.ts`

**Interfaces:**

- Consumes: `IKaraokeMakerProject`, `seedKaraokeTranslation` (Task 2).
- Produces: `addKaraokeTranslation(project, text, language) => { project: IKaraokeMakerProject; mismatch?: { expected: number; received: number } }`; `removeKaraokeTranslation(project, language) => IKaraokeMakerProject`; `karaokeTranslationLanguages(project) => string[]`.

- [ ] **Step 1: Write the failing tests**

Append to `src/__tests__/unit_tests/common/karaokeTranslation.test.ts`, adding `addKaraokeTranslation`, `removeKaraokeTranslation`, `karaokeTranslationLanguages`, `createKaraokeMakerProject` and `IKaraokeMakerProject` to the imports.

```ts
describe('translations on a project', () => {
  const projectWithLines = (): IKaraokeMakerProject => {
    const base = createKaraokeMakerProject({
      name: 'song.mp3',
      relativePath: 'song.mp3',
      size: 1,
      lastModified: 1,
    });
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
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
pnpm test -- karaokeTranslation.test.ts -t "translations on a project"
```

Expected: FAIL — the three functions are not exported.

- [ ] **Step 3: Implement them**

Append to `src/common/karaoke/makerProject/translationSeed.ts`, adding `IKaraokeMakerProject` to its `./model` import:

```ts
/**
 * The languages this project can be shown in, original first.
 *
 * The original has no sheet of its own — it is `lyrics.lines` — so it is named
 * here rather than found, and a project whose original language was never
 * declared answers with the tag the UI uses for "as recorded".
 */
export const KARAOKE_ORIGINAL_LANGUAGE = 'original';

export const karaokeTranslationLanguages = (
  project: IKaraokeMakerProject,
): string[] => [
  project.lyrics.language ?? KARAOKE_ORIGINAL_LANGUAGE,
  ...(project.lyrics.translations ?? []).map((sheet) => sheet.language),
];

export const addKaraokeTranslation = (
  project: IKaraokeMakerProject,
  text: string,
  language: string,
): {
  project: IKaraokeMakerProject;
  mismatch?: { expected: number; received: number };
} => {
  const target = language.trim();
  if (!target || target === project.lyrics.language) {
    return { project };
  }
  const seeded = seedKaraokeTranslation(project.lyrics.lines, text, target);
  if (!seeded.sheet) {
    return { project, mismatch: seeded.mismatch };
  }
  const sheet = seeded.sheet;
  const existing = project.lyrics.translations ?? [];
  const replaced = existing.some((entry) => entry.language === target);
  return {
    project: {
      ...project,
      lyrics: {
        ...project.lyrics,
        translations: replaced
          ? existing.map((entry) => (entry.language === target ? sheet : entry))
          : [...existing, sheet],
      },
    },
  };
};

export const removeKaraokeTranslation = (
  project: IKaraokeMakerProject,
  language: string,
): IKaraokeMakerProject => {
  const remaining = (project.lyrics.translations ?? []).filter(
    (sheet) => sheet.language !== language,
  );
  return {
    ...project,
    lyrics: {
      ...project.lyrics,
      // Undefined rather than [], so a project that has had its last
      // translation removed parses identically to one that never had any.
      translations: remaining.length ? remaining : undefined,
    },
  };
};
```

- [ ] **Step 4: Run the tests, type-check, lint**

```bash
pnpm test -- karaokeTranslation.test.ts && pnpm typecheck && pnpm lint
```

Expected: PASS, all sixteen.

- [ ] **Step 5: Check the file length**

`translationSeed.ts` now holds seeding, fit and project edits. Run `wc -l src/common/karaoke/makerProject/translationSeed.ts`. If it is over 300 lines, split the project edits into `translationEdits.ts` and export it from `index.ts` — the seam is clean, because nothing in the edits touches the arithmetic.

- [ ] **Step 6: Commit**

```bash
git add src/common/karaoke/makerProject/ src/__tests__/unit_tests/common/karaokeTranslation.test.ts
git commit -m "Adding a language twice replaces it, which is what the second paste meant"
```

---

### Task 5: Reading a chosen language out of the project

**Files:**

- Modify: `src/common/karaoke/makerProject/song.ts:188` (`karaokeMakerProjectToSong`)
- Modify: `src/common/karaoke/makerExport.ts`, `src/common/karaoke/makerExportUltraStar.ts`
- Test: `src/__tests__/unit_tests/common/karaokeMakerExport.test.ts`

**Interfaces:**

- Consumes: `IKaraokeMakerLyricSheet`, `addKaraokeTranslation` (Tasks 1, 4).
- Produces: an optional fourth parameter `{ language?: string }` on `karaokeMakerProjectToSong`, and the same option on `exportKaraokeMakerLrc` and `exportKaraokeMakerUltraStar`.

- [ ] **Step 1: Write the failing tests**

Append to `src/__tests__/unit_tests/common/karaokeMakerExport.test.ts`:

```ts
describe('exporting a chosen language', () => {
  const translated = () => {
    const base = createKaraokeMakerProject({
      name: 'song.mp3',
      relativePath: 'song.mp3',
      size: 1,
      lastModified: 1,
    });
    const withLines: IKaraokeMakerProject = {
      ...base,
      lyrics: {
        ...base.lyrics,
        language: 'en',
        lines: [
          {
            id: 'l1',
            kind: 'lyrics',
            startMs: 0,
            endMs: 2_000,
            tokens: [
              {
                id: 'w0',
                text: 'hello',
                startsWord: true,
                source: 'manual',
                startMs: 0,
                endMs: 1_000,
              },
              {
                id: 'w1',
                text: 'world',
                startsWord: true,
                source: 'manual',
                startMs: 1_000,
                endMs: 2_000,
              },
            ],
          },
        ],
      },
    };
    return addKaraokeTranslation(withLines, 'hola mundo', 'es').project;
  };

  it('returns the original when no language is asked for', () => {
    const project = translated();
    const asset = {
      id: 'a',
      role: 'audio' as const,
      fileName: 'song.mp3',
      relativePath: 'song.mp3',
    };

    const song = karaokeMakerProjectToSong(project, asset);

    expect(song.lines[0].tokens.map((token) => token.text)).toEqual([
      'hello',
      'world',
    ]);
    expect(song.meta.language).toBe('en');
  });

  it('swaps in the chosen sheet and says which language it is', () => {
    const project = translated();
    const asset = {
      id: 'a',
      role: 'audio' as const,
      fileName: 'song.mp3',
      relativePath: 'song.mp3',
    };

    const song = karaokeMakerProjectToSong(project, asset, [asset], {
      language: 'es',
    });

    expect(song.lines[0].tokens.map((token) => token.text)).toEqual([
      'hola',
      'mundo',
    ]);
    expect(song.meta.language).toBe('es');
  });

  it('falls back to the original when the language is not present', () => {
    const project = translated();
    const asset = {
      id: 'a',
      role: 'audio' as const,
      fileName: 'song.mp3',
      relativePath: 'song.mp3',
    };

    const song = karaokeMakerProjectToSong(project, asset, [asset], {
      language: 'de',
    });

    expect(song.lines[0].tokens.map((token) => token.text)).toEqual([
      'hello',
      'world',
    ]);
  });

  it('writes the chosen language into the UltraStar header', () => {
    const text = exportKaraokeMakerUltraStar(translated(), { language: 'es' });

    expect(text).toContain('#LANGUAGE:es');
    expect(text).toContain('hola');
    expect(text).not.toContain('hello');
  });
});
```

Match the `IKaraokeAsset` literal to the shape already used elsewhere in this test file; copy an existing one rather than inventing fields.

- [ ] **Step 2: Run the tests to verify they fail**

```bash
pnpm test -- karaokeMakerExport.test.ts -t "exporting a chosen language"
```

Expected: FAIL — the fourth parameter does not exist.

- [ ] **Step 3: Add the option to `projectToSong`**

In `src/common/karaoke/makerProject/song.ts`, add a resolver above `karaokeMakerProjectToSong`:

```ts
/**
 * The lines to play, for a language.
 *
 * An absent or unknown language answers with the original rather than with
 * nothing: a song whose Spanish sheet was removed elsewhere must still play.
 */
const sheetLines = (
  project: IKaraokeMakerProject,
  language: string | undefined,
): { lines: IKaraokeMakerLine[]; language: string | undefined } => {
  const sheet = language
    ? (project.lyrics.translations ?? []).find(
        (entry) => entry.language === language,
      )
    : undefined;
  return sheet
    ? { lines: sheet.lines, language: sheet.language }
    : { lines: project.lyrics.lines, language: project.lyrics.language };
};
```

Change the signature and the two places that read lyrics:

```ts
export const karaokeMakerProjectToSong = (
  project: IKaraokeMakerProject,
  audioAsset: IKaraokeAsset,
  sourceAssets: readonly IKaraokeAsset[] = [audioAsset],
  options?: { language?: string },
): IKaraokeSong => {
  const chosen = sheetLines(project, options?.language);
  const lines = makePlayableLines(project, chosen.lines);
  /* … unchanged … */
    meta: {
      sourceFormat: 'fluideq-maker',
      gapMs: project.meta.gapMs,
      bpm: project.meta.bpm,
      language: chosen.language,
    },
```

`makePlayableLines` currently reads `project.lyrics.lines` internally. Give it a second parameter defaulting to `project.lyrics.lines` so every other caller is unaffected. Do the same for `makePlayablePitchNotes` only if it reads lyrics; it reads `melody.notes`, which is shared, so it should not change.

- [ ] **Step 4: Add the option to both exporters**

`exportKaraokeMakerLrc` and `exportKaraokeMakerUltraStar` take `options?: { language?: string }` and resolve their lines through the same helper — export `sheetLines` from `song.ts` rather than writing it twice. In `makerExportUltraStar.ts:215`, `ultraStarLanguage` receives the resolved language instead of `project.lyrics.language`.

- [ ] **Step 5: Confirm validation still only judges the original, and say so in the code**

Spec §9: a translation is not required to be complete — an empty one is a normal intermediate state — so it must never raise a validation error. `validateKaraokeMakerProject` reads `project.lyrics.lines`, so this is already true and **no logic changes**. Add one line to its doc comment recording that, so a later reader does not "fix" it by folding translations in:

```ts
// Judges the sung original only. A translation may be empty or half-fitted at
// any time — that is a normal state of the work, not a defect in the project.
```

Then add a test asserting a project with an empty translation still validates clean.

- [ ] **Step 6: Run the tests to verify they pass**

```bash
pnpm test -- karaokeMakerExport.test.ts
```

Expected: PASS.

- [ ] **Step 7: Run the whole suite — this is the regression gate for 314 call sites**

```bash
pnpm typecheck && pnpm lint && pnpm test
```

Expected: PASS with no changes to any existing assertion. **If an existing test's expectation has to change, stop.** The no-options call must behave exactly as it did; a changed expectation means the default path moved, and that is the one thing this task must not do.

- [ ] **Step 8: Commit**

```bash
git add src/common/karaoke/makerProject/song.ts src/common/karaoke/makerExport.ts src/common/karaoke/makerExportUltraStar.ts src/__tests__/unit_tests/common/karaokeMakerExport.test.ts
git commit -m "Ask the project for Spanish and it hands back a song that is in Spanish"
```

---

### Task 6: The strings, in ten languages

**Files:**

- Modify: `src/common/i18n/en/karaoke.ts` and the nine siblings under `src/common/i18n/{de,es,fr,hi,it,ja,pt,ru,zh}/karaoke.ts`
- Test: `src/__tests__/unit_tests/common/i18n.test.ts` (already asserts key parity — run it, do not extend it)

**Interfaces:**

- Consumes: nothing.
- Produces: the keys below, used by Tasks 7, 8, 10.

- [ ] **Step 1: Add the English strings**

Append to the `karaoke` object in `src/common/i18n/en/karaoke.ts`:

```ts
  'karaoke.translation.picker': 'Lyrics language',
  'karaoke.translation.original': 'As recorded',
  'karaoke.translation.add': 'Add a language',
  'karaoke.translation.remove': 'Remove this language',
  'karaoke.translation.target': 'Language of the lyrics you are pasting',
  'karaoke.translation.paste': 'Paste the lyrics in that language, one line per line of the song.',
  'karaoke.translation.mismatch':
    'The song has {expected} sung lines and this text has {received}. Line them up against the numbered lines beside the box.',
  'karaoke.translation.fit': '{syllables} syllables, {notes} notes',
  'karaoke.translation.fitOk': 'Fits the melody',
  'karaoke.translation.empty': 'No lyrics in this language yet.',
```

Do not add a language-name table: names come from `Intl.DisplayNames` (Task 7).

- [ ] **Step 2: Add the same keys, translated, to the other nine locales**

Same keys, same placeholder tokens (`{expected}`, `{received}`, `{syllables}`, `{notes}`), in `de es fr hi it ja pt ru zh`. Keep the placeholders in the order the target language reads naturally; do not translate the token names.

- [ ] **Step 3: Run the parity test**

```bash
pnpm test -- i18n.test.ts
```

Expected: PASS. A missing key in one locale fails here, which is the whole point of doing this as one commit.

- [ ] **Step 4: Commit**

```bash
git add src/common/i18n/
git commit -m "Ten locales learn to say how many syllables and how many notes"
```

---

### Task 7: The language picker in the Maker

> UI from here on. Build it, show Ivan, and write the tests named at the end of each task only once he is happy with what he sees.

**Files:**

- Create: `src/renderer/karaoke/useMakerTranslations.ts`
- Create: `src/renderer/karaoke/karaokeLanguageOptions.ts`
- Modify: `src/renderer/karaoke/KaraokeMakerToolbar.tsx`
- Modify: `src/renderer/karaoke/KaraokeMaker.tsx` (wiring only)

**Interfaces:**

- Consumes: `karaokeTranslationLanguages`, `addKaraokeTranslation`, `removeKaraokeTranslation`, `KARAOKE_ORIGINAL_LANGUAGE` (Task 4); the i18n keys (Task 6).
- Produces: `useMakerTranslations(project, onProjectChange)` returning `{ language, setLanguage, languages, addTranslation, removeTranslation, mismatch, clearMismatch }`; `karaokeLanguageName(code) => string`, the endonym for a language tag, used to build the `IOptionEntry[]` passed to `widgets/Dropdown`.

- [ ] **Step 1: Write the language-option builder**

Create `src/renderer/karaoke/karaokeLanguageOptions.ts`:

```ts
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { ReactNode } from 'react';
import { KARAOKE_ORIGINAL_LANGUAGE } from '../../common/karaoke/makerProject';

/**
 * Each language names itself — "Español", not "Spanish".
 *
 * Same reason as the app's own LanguagePicker: someone looking for their
 * language scans for the word they know, and by definition may not read the
 * language the app is currently in. `Intl.DisplayNames` asked in the target
 * locale returns the endonym, which is why there is no name table here to keep
 * in step across ten locale files.
 */
export const karaokeLanguageName = (code: string): string => {
  try {
    return new Intl.DisplayNames([code], { type: 'language' }).of(code) ?? code;
  } catch {
    // An invalid or unknown tag: show the tag. Never throw out of a label.
    return code;
  }
};
```

The `catch` is not empty — it returns the fallback — so it satisfies the no-empty-catch rule.

- [ ] **Step 2: Write the hook**

Create `src/renderer/karaoke/useMakerTranslations.ts`. It owns the selected language, the add/remove operations and the last mismatch. `KaraokeMaker.tsx` is 2294 lines; this state does not go there.

```ts
export const useMakerTranslations = (
  project: IKaraokeMakerProject,
  onProjectChange: (next: IKaraokeMakerProject) => void,
) => {
  const [language, setLanguage] = useState(KARAOKE_ORIGINAL_LANGUAGE);
  const [mismatch, setMismatch] = useState<
    { expected: number; received: number } | undefined
  >(undefined);

  const languages = useMemo(
    () => karaokeTranslationLanguages(project),
    [project],
  );

  const addTranslation = useCallback(
    (text: string, target: string) => {
      const result = addKaraokeTranslation(project, text, target);
      setMismatch(result.mismatch);
      if (!result.mismatch && result.project !== project) {
        onProjectChange(result.project);
        setLanguage(target);
      }
    },
    [project, onProjectChange],
  );

  const removeTranslation = useCallback(
    (target: string) => {
      onProjectChange(removeKaraokeTranslation(project, target));
      setLanguage(KARAOKE_ORIGINAL_LANGUAGE);
    },
    [project, onProjectChange],
  );

  return {
    language,
    setLanguage,
    languages,
    addTranslation,
    removeTranslation,
    mismatch,
    clearMismatch: useCallback(() => setMismatch(undefined), []),
  };
};
```

Selecting a language whose sheet was just removed must not leave a dangling selection — that is why `removeTranslation` resets to the original.

- [ ] **Step 3: Put the picker on the toolbar**

In `KaraokeMakerToolbar.tsx`, add a `widgets/Dropdown` — **not** a native `<select>`; `LanguagePicker.tsx` records why one was tried here and removed. Follow that component's shape exactly:

```tsx
<Dropdown
  name={t('karaoke.translation.picker')}
  options={languages.map((code) => ({
    value: code,
    label:
      code === KARAOKE_ORIGINAL_LANGUAGE
        ? t('karaoke.translation.original')
        : karaokeLanguageName(code),
    display:
      code === KARAOKE_ORIGINAL_LANGUAGE ? (
        t('karaoke.translation.original')
      ) : (
        // `lang` so Chromium picks the right face per script: the Han
        // characters are not the same shapes drawn Chinese or Japanese.
        <span lang={code}>{karaokeLanguageName(code)}</span>
      ),
  }))}
  value={language}
  isDisabled={false}
  placement="down"
  handleChange={setLanguage}
/>
```

It sits on the toolbar itself, visible — not inside a popover. Controls belong on the surface where the work happens.

The "Add a language" button uses `button small subtle`; it is not the recommended action on a song that already has words.

- [ ] **Step 4: Wire it in `KaraokeMaker.tsx`**

Call the hook, pass its values down to the toolbar. Wiring only — no new `useState` in this file.

- [ ] **Step 5: Type-check and lint**

```bash
pnpm typecheck && pnpm lint
```

- [ ] **Step 6: Show Ivan, then commit**

Tell him what to look at: the picker on the Maker toolbar, that it matches the controls beside it, and that language names appear in their own scripts. Commit after he has seen it.

```bash
git add src/renderer/karaoke/
git commit -m "The Maker asks which language you are looking at"
```

- [ ] **Step 7: Tests, after he is happy**

In `src/__tests__/unit_tests/` add: `karaokeLanguageName('es')` returns a non-empty string different from `'es'`; `karaokeLanguageName('zzzz')` returns `'zzzz'` rather than throwing.

---

### Task 8: Pasting a translation

**Files:**

- Modify: `src/renderer/karaoke/KaraokeMakerLyricsDialog.tsx`
- Create: `src/renderer/karaoke/KaraokeMakerLyricsPasteView.tsx`
- Create: `src/renderer/karaoke/KaraokeMakerLyricsWordList.tsx`

**Interfaces:**

- Consumes: `addTranslation`, `mismatch`, `clearMismatch` (Task 7); the i18n keys (Task 6).
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Take the seam first**

`KaraokeMakerLyricsDialog.tsx` is 346 lines and its own doc comment says it is "really two views sharing a frame — the textarea you paste into, and the word list you check afterwards", with 245 lines of JSX in a single return. Split those two views into the new files above **before** adding anything, and confirm the dialog behaves identically. Do not add the language field to a component that is already the largest thing in the Maker.

- [ ] **Step 2: Add the target-language field**

The paste view gains a target-language `Dropdown` labelled `karaoke.translation.target`, and its placeholder text becomes `karaoke.translation.paste` when a target other than the original is selected.

- [ ] **Step 3: Make the count mismatch a working surface, not an alert**

When `mismatch` is set, render `karaoke.translation.mismatch` with both numbers **beside the original's numbered lyric lines**, in the dialog, with the textarea still editable. This is the error that will happen on nearly every first paste; the user must be able to fix it where they are, without the dialog closing or the text being lost.

The message wears no loud style. The confirm button stays `button small` because it is still the recommended action — the user is being asked to correct the text, not to abandon it.

- [ ] **Step 4: Type-check, lint, show Ivan**

```bash
pnpm typecheck && pnpm lint
```

Ask him to paste a Spanish lyric with a deliberately wrong line count and confirm the surface reads as a place to work.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/karaoke/
git commit -m "The line count that does not match is a place to fix it, not a complaint"
```

- [ ] **Step 6: Tests, after he is happy**

A React Testing Library test that renders the paste view with a mismatch and asserts both numbers appear and the textarea keeps its value. Note in the test file that this cannot see placement or emphasis — Task 11 covers those.

---

### Task 9: The second row in the Maker's canvas

**Files:**

- Modify: `src/renderer/karaoke/makerCanvas/paintLyrics.ts`
- Modify: `src/renderer/karaoke/useMakerCanvasModel.ts` (height budget)

**Interfaces:**

- Consumes: the selected language (Task 7), `karaokeTranslationFit` (Task 3).
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Budget the height before drawing anything**

The lane's height is decided in `useMakerCanvasModel.ts`. **Add the translation row's measured height to the lane's budget so the lane grows.** Only where it cannot grow — the small window size — do the original's rows step down; the translation row's own height is never the thing that shrinks.

This project has shipped this exact defect before: three waveforms crushed into a 27px strip. A row that is squeezed into whatever is left over is the bug, not the layout.

- [ ] **Step 2: Paint the translated line under its original**

For each line, after the original's tokens are painted, draw the selected language's line for that index underneath: smaller, quieter, and with **no per-word highlight**. Word order differs between languages, so highlighting the third translated word when the third original word is sung is confidently wrong. The row is line-level until the user has fitted it.

- [ ] **Step 3: Paint the fit indicator**

At the end of the translated row, the syllable/note delta from `karaokeTranslationFit`. Where they agree, `karaoke.translation.fitOk`; where they do not, `karaoke.translation.fit` with both numbers.

- [ ] **Step 4: No raw font weights**

Any weight used here comes from the `$weight-*` scale. `$weight-bold` is the ceiling at these sizes; `check-styles.ts` rejects a raw number.

```bash
pnpm typecheck && pnpm typecheck:styles && pnpm lint
```

- [ ] **Step 5: Show Ivan, then commit**

He needs to see the Maker with a Spanish sheet loaded, at the normal window size and at the small one.

```bash
git add src/renderer/karaoke/
git commit -m "The translation gets its own height rather than what is left over"
```

---

### Task 10: The player

**Files:**

- Modify: `src/renderer/karaoke/KaraokeLyrics.tsx`
- Modify: `src/common/karaoke/types.ts` if the song needs to carry its alternate sheets to the player (see step 1)

**Interfaces:**

- Consumes: `karaokeMakerProjectToSong(..., { language })` (Task 5).
- Produces: nothing.

- [ ] **Step 1: Decide how the sheets reach the player, and write the decision down**

`IKaraokeSong.lines` is flat and `meta.language` is a single tag. The player needs both languages at once, so `IKaraokeSong` gains an optional `translations?: { language: string; lines: IKaraokeLine[] }[]`, populated by `karaokeMakerProjectToSong` from the project's sheets. Put the reason in a comment on the field: the player shows two languages simultaneously, so one set of lines is not enough, and the alternative — calling `projectToSong` twice — would give the player two songs that must be kept in step.

- [ ] **Step 2: Picker beside the lyrics**

The same `widgets/Dropdown`, next to the lyric surface — not in the transport menu. A language switched while singing cannot be two clicks deep. A song with no translations shows no picker at all.

- [ ] **Step 3: Second row in the player canvas, same budget rule as Task 9**

Original at its existing sizes with word highlight intact; translation underneath, quieter, line level. A song with no translation paints exactly as it does today.

- [ ] **Step 4: Type-check, lint, show Ivan**

```bash
pnpm typecheck && pnpm typecheck:styles && pnpm lint
```

- [ ] **Step 5: Commit**

```bash
git add src/renderer/karaoke/ src/common/karaoke/types.ts
git commit -m "You can read what they are singing while they sing it"
```

- [ ] **Step 6: Tests, after he is happy**

`KaraokeWorkspace.test.tsx` gains a case: a song with a translation renders the picker; a song without one does not.

---

### Task 11: Verify in the running window

**Files:** none — this task changes nothing. It produces findings.

**Interfaces:**

- Consumes: everything.
- Produces: a list of defects, each of which becomes a fix commit.

Tests query by role. They cannot see size, colour, placement or taste, and every UI defect that shipped in this project passed the whole suite. Ivan runs the app; ask him to start it, then probe over CDP on `127.0.0.1:9222`.

- [ ] **Step 1: Measure both canvas lanes**

Read the painted pixel heights of the original row and the translation row, in the player and in the Maker. Compare them against what the budget intended. A row measuring under ~20px is the 27px-strip defect returning; report the number, not an impression.

- [ ] **Step 2: Confirm the Dropdowns match their neighbours**

`getComputedStyle` on the Maker toolbar's picker and on a control beside it. Compare height, font size, border and background. Read the values; do not reason about the cascade.

- [ ] **Step 3: Confirm the fonts**

`CSS.getPlatformFontsForNode` on the picker's label and on the dialog's new text. Computed style says what was asked for; this says which file actually painted it, and whether `isCustomFont` is set. Any node coming back as Segoe UI Black at a UI size is a weight bug.

- [ ] **Step 4: The small window size**

Resize to the width the `design-qa-responsive-karaoke.png` screenshot covers and repeat steps 1 and 2. A second row of text has the least room here, and this is where the height budget will fail if it is going to.

- [ ] **Step 5: Read a translated line at line-level precision**

Confirm it reads as deliberately quiet rather than as broken or unfinished. This one is a judgement, and it is Ivan's.

- [ ] **Step 6: Report**

State plainly what was measured and what was not. Each defect found becomes its own fix commit; re-run the affected step afterwards.

---

## What this plan does not build

Recorded so a later reader does not mistake absence for oversight — both are §16 of the spec:

- **Machine translation**, local or cloud, and importing a translated LRC. The data model above accommodates all three without changing: they only produce the text a user pastes today.
- **Singing the translation.** A synthesised guide vocal in the target language, riding the existing guide-vocal fader. It depends on the fit check in Task 3 having produced syllables that actually line up, which is why it comes after.
