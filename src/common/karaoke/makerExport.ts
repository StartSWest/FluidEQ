/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  IKaraokeMakerLine,
  IKaraokeMakerProject,
  KARAOKE_MAKER_EXTENSION,
  karaokeMakerLineIsSection,
  serializeKaraokeMakerProject,
  sheetLines,
} from './makerProject';
import { IWrittenKaraokeFile, countWords } from './makerExportText';
import {
  exportKaraokeMakerUltraStar,
  writeUltraStar,
} from './makerExportUltraStar';

export { exportKaraokeMakerUltraStar };

export type TKaraokeMakerExportFormat =
  'project' | 'ultrastar' | 'lrc' | 'elrc';

export interface IKaraokeMakerExport {
  format: TKaraokeMakerExportFormat;
  extension: string;
  mimeType: string;
  contents: string;
  /**
   * What the written file does not contain. LRC cannot carry a line with no
   * time on it at all and UltraStar cannot carry a word with no melody note,
   * and the Maker reported every export as a plain success — a half-empty file
   * and a complete one looked identical to the user.
   *
   * The two numbers mean different things per format, which is why the notice
   * that reports them is chosen by format rather than shared: LRC drops whole
   * lines, so `droppedLines` is the unit there and `droppedWords` only ever
   * counts what was inside them; UltraStar drops individual words, so
   * `droppedWords` is the unit and a line is only counted once every word in
   * it has gone.
   */
  droppedLines: number;
  droppedWords: number;
}

/**
 * Fold the accents an ASCII filename cannot keep, without eating letters that
 * are not accents. NFKD splits `й` into `и` + U+0306 exactly as it splits `é`,
 * so a blanket strip of U+0300–U+036F turned `Виктор Цой` into `Виктор Цои`
 * and `ёлка` into `елка`. A mark is dropped only where its base letter is
 * ASCII; everything else is put back together by NFC, which also recomposes
 * the Hangul syllables NFKD had taken apart.
 */
const foldLatinDiacritics = (value: string): string => {
  const folded: string[] = [];
  let baseIsAscii = false;
  Array.from(value.normalize('NFKD')).forEach((character) => {
    const code = character.codePointAt(0) ?? 0;
    if (code >= 0x0300 && code <= 0x036f) {
      if (!baseIsAscii) {
        folded.push(character);
      }
      return;
    }
    baseIsAscii = code < 0x80;
    folded.push(character);
  });
  return folded.join('').normalize('NFC');
};

const safeFileStem = (value: string): string =>
  Array.from(foldLatinDiacritics(value))
    .filter((character) => (character.codePointAt(0) ?? 0) >= 32)
    .join('')
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160) || 'karaoke';

export const karaokeMakerExportFileName = (
  project: IKaraokeMakerProject,
  format: TKaraokeMakerExportFormat,
): string => {
  const stem = safeFileStem(
    project.artist ? `${project.artist} - ${project.title}` : project.title,
  );
  let extension: string = format;
  if (format === 'project') {
    extension = KARAOKE_MAKER_EXTENSION;
  } else if (format === 'ultrastar') {
    extension = 'txt';
  }
  return `${stem}.${extension}`;
};

const lrcTimestamp = (timeMs: number, enhanced = false): string => {
  const safe = Math.max(0, timeMs);
  const minutes = Math.floor(safe / 60_000);
  const seconds = Math.floor((safe % 60_000) / 1_000);
  const fraction = enhanced
    ? String(Math.floor(safe % 1_000)).padStart(3, '0')
    : String(Math.floor((safe % 1_000) / 10)).padStart(2, '0');
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(
    2,
    '0',
  )}.${fraction}`;
};

/**
 * A metadata tag ends at the first `]` — our own reader matches `[^\]]*` — so
 * a bracket inside the value deleted the whole `[ti:]` or `[ar:]` line rather
 * than truncating it.
 */
const lrcMetadataValue = (value: string): string =>
  value.replace(/\[/g, '(').replace(/\]/g, ')').trim();

/** LRC writes a word boundary as a space; UltraStar writes it as a marker. */
const tokenSuffix = (line: IKaraokeMakerLine, tokenIndex: number): string =>
  line.tokens[tokenIndex + 1]?.startsWord ? ' ' : '';

const nextTimedStartMs = (
  line: IKaraokeMakerLine,
  tokenIndex: number,
): number | undefined =>
  line.tokens.slice(tokenIndex + 1).find((token) => token.startMs !== undefined)
    ?.startMs;

const plainLineText = (line: IKaraokeMakerLine): string =>
  line.tokens
    .map((token, tokenIndex) => `${token.text}${tokenSuffix(line, tokenIndex)}`)
    .join('');

/**
 * Enhanced LRC has no duration field: a reader ends each word where the next
 * one starts. Without a closing stamp a word sung 1000–1200 before an 800 ms
 * rest reads back as 1000–2000, and the last word of the last line never ends
 * at all. One is written wherever the word ends before the next one begins,
 * and always on the last timed word of a line.
 */
const enhancedLineText = (line: IKaraokeMakerLine): string =>
  line.tokens
    .map((token, tokenIndex) => {
      const suffix = tokenSuffix(line, tokenIndex);
      const { startMs, endMs } = token;
      if (startMs === undefined) {
        return `${token.text}${suffix}`;
      }
      const nextStartMs = nextTimedStartMs(line, tokenIndex);
      const close =
        endMs !== undefined &&
        (nextStartMs === undefined || nextStartMs > endMs)
          ? `<${lrcTimestamp(endMs, true)}>`
          : '';
      return `<${lrcTimestamp(startMs, true)}>${token.text}${close}${suffix}`;
    })
    .join('');

const writeLrc = (
  project: IKaraokeMakerProject,
  enhanced: boolean,
  options?: { language?: string },
): IWrittenKaraokeFile => {
  const { lines } = sheetLines(project, options?.language);
  const rows = [
    `[ti:${lrcMetadataValue(project.title)}]`,
    ...(project.artist ? [`[ar:${lrcMetadataValue(project.artist)}]`] : []),
    '[by:FluidEQ Karaoke Maker]',
  ];
  let droppedLines = 0;
  let droppedWords = 0;
  lines.forEach((line) => {
    if (karaokeMakerLineIsSection(line)) {
      if (line.startMs === undefined) {
        droppedLines += 1;
        return;
      }
      rows.push(
        `[${lrcTimestamp(line.startMs)}]${line.tokens
          .map((token) => token.text)
          .join(' ')}`,
      );
      return;
    }
    const timedStarts = line.tokens.flatMap((token) =>
      token.startMs === undefined ? [] : [token.startMs],
    );
    // The line's own stamp is the fallback `lyricLineStarts` has always given
    // the UltraStar path, and requiring a timed *word* here threw away the
    // commonest LRC there is: `[00:20.00]words here` imported and exported
    // straight back out came out holding its section headings and none of its
    // lyrics, because no token in a line-timed file carries a time.
    const startMs = timedStarts.length
      ? Math.min(...timedStarts)
      : line.startMs;
    if (startMs === undefined) {
      // A line with no tokens has no lyrics to lose, and counting it would
      // raise the partial-export notice over a blank.
      if (line.tokens.length) {
        droppedLines += 1;
        droppedWords += countWords(line.tokens);
      }
      return;
    }
    const text = enhanced ? enhancedLineText(line) : plainLineText(line);
    rows.push(`[${lrcTimestamp(startMs)}]${text}`);
  });
  return { contents: `${rows.join('\n')}\n`, droppedLines, droppedWords };
};

export const exportKaraokeMakerLrc = (
  project: IKaraokeMakerProject,
  enhanced: boolean,
  options?: { language?: string },
): string => writeLrc(project, enhanced, options).contents;

export const exportKaraokeMaker = (
  project: IKaraokeMakerProject,
  format: TKaraokeMakerExportFormat,
): IKaraokeMakerExport => {
  if (format === 'project') {
    return {
      format,
      extension: KARAOKE_MAKER_EXTENSION,
      mimeType: 'application/json',
      contents: serializeKaraokeMakerProject(project),
      droppedLines: 0,
      droppedWords: 0,
    };
  }
  if (format === 'ultrastar') {
    return {
      format,
      extension: 'txt',
      mimeType: 'text/plain',
      ...writeUltraStar(project),
    };
  }
  return {
    format,
    extension: format,
    mimeType: 'text/plain',
    ...writeLrc(project, format === 'elrc'),
  };
};
