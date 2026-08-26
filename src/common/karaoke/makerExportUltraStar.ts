/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Writing the UltraStar half of a Maker project.
 *
 * Split from `makerExport` because the two writers share only a file stem and
 * a word count: everything else here is the text format's own arithmetic —
 * beats, `#GAP`, note types and the line break the format requires.
 */
import {
  IKaraokeMakerLine,
  IKaraokeMakerNote,
  IKaraokeMakerProject,
  karaokeMakerLineIsSection,
  sheetLines,
} from './makerProject';
import {
  IWrittenKaraokeFile,
  countWords,
  wordTokenGroups,
} from './makerExportText';

/**
 * UltraStar beats are a timing grid, not a tempo anybody hears: the format
 * specification calls the value arbitrary and one beat "the smallest unit of
 * time that can be present in a song". One beat lasts 60000/(BPM*4) ms, so the
 * exported value is chosen for resolution.
 *
 * 3000 gives a 5 ms beat. The old fallback of 120 gave 125 ms, which swallowed
 * the editor's 25 ms nudge whole and put two syllables 43 ms apart on the same
 * beat. 5 ms divides that nudge exactly — 25 ms is 5 beats — and costs at most
 * 2.5 ms of placement error against 62.5 ms before.
 *
 * Finer was rejected on evidence rather than taste: UltraStar Deluxe runs its
 * pitch detection once per beat (`for ActualBeat := OldBeatD+1 to
 * CurrentBeatD` in UNote.pas), so the beat rate is work a player must do every
 * frame. 200 beats/s here; a 1 ms beat would be 1000.
 */
const ULTRASTAR_EXPORT_BPM = 3_000;
const ULTRASTAR_BEAT_MS = 60_000 / (ULTRASTAR_EXPORT_BPM * 4);

/** ISO 639-2 English names, which is what `#LANGUAGE` is compared against. */
const ULTRASTAR_LANGUAGE_NAMES: Record<string, string> = {
  de: 'German',
  en: 'English',
  es: 'Spanish',
  fr: 'French',
  hi: 'Hindi',
  it: 'Italian',
  ja: 'Japanese',
  pt: 'Portuguese',
  ru: 'Russian',
  zh: 'Chinese',
};

const ultraStarLanguage = (language?: string): string | undefined => {
  const declared = language?.trim();
  if (!declared) {
    return undefined;
  }
  const [base] = declared.toLowerCase().split(/[-_]/);
  return ULTRASTAR_LANGUAGE_NAMES[base] ?? declared;
};

const ultraStarBeat = (timeMs: number, gapMs: number): number =>
  Math.round((timeMs - gapMs) / ULTRASTAR_BEAT_MS);

/**
 * `start-beat = 1*DIGIT`: the format has no beat before zero. Clamping the
 * beat instead moved every note recorded ahead of the gap onto beat 0 — a song
 * imported with `#GAP:5000` and a line recorded at 1 s exported four notes all
 * starting together — so the gap is moved back to the first note instead.
 */
const ultraStarGapMs = (
  project: IKaraokeMakerProject,
  notes: readonly IKaraokeMakerNote[],
): number =>
  Math.min(
    Math.round(project.meta.gapMs),
    Math.floor(
      notes.reduce(
        (earliest, note) => Math.min(earliest, note.startMs),
        Number.POSITIVE_INFINITY,
      ),
    ),
  );

interface ILyricLineStart {
  index: number;
  startMs: number;
}

const lyricLineStarts = (
  lines: readonly IKaraokeMakerLine[],
): ILyricLineStart[] => {
  const starts = lines.flatMap((line, index): ILyricLineStart[] => {
    if (karaokeMakerLineIsSection(line)) {
      return [];
    }
    const timed = line.tokens.flatMap((token) =>
      token.startMs === undefined ? [] : [token.startMs],
    );
    if (timed.length) {
      return [{ index, startMs: Math.min(...timed) }];
    }
    return line.startMs === undefined ? [] : [{ index, startMs: line.startMs }];
  });
  return starts.sort((left, right) => left.startMs - right.startMs);
};

const lineIndexAtTime = (
  starts: readonly ILyricLineStart[],
  timeMs: number,
): number | undefined => {
  let found: number | undefined;
  starts.forEach((line) => {
    if (line.startMs <= timeMs) {
      found = line.index;
    }
  });
  return found;
};

interface IUltraStarBody {
  rows: string[];
  writtenTokenIds: Set<string>;
}

const ultraStarBody = (
  lines: readonly IKaraokeMakerLine[],
  notes: readonly IKaraokeMakerNote[],
  gapMs: number,
): IUltraStarBody => {
  const tokensById = new Map(
    lines.flatMap((line) =>
      line.tokens.map((token) => [token.id, token] as const),
    ),
  );
  const lineByToken = new Map(
    lines.flatMap((line, lineIndex) =>
      line.tokens.map((token) => [token.id, lineIndex] as const),
    ),
  );
  const lineStarts = lyricLineStarts(lines);
  const writtenTokenIds = new Set<string>();
  const rows: string[] = [];
  let previousLineIndex: number | undefined;
  notes.forEach((note) => {
    const start = ultraStarBeat(note.startMs, gapMs);
    const end = ultraStarBeat(note.endMs, gapMs);
    // `duration = 1*DIGIT` and a zero-beat note is not singable, so a note
    // shorter than one beat still lasts one. At 5 ms a beat that floor costs
    // at most 5 ms; at the old 125 ms beat it stretched a 40 ms syllable to
    // three times its length.
    const duration = Math.max(1, end - start);
    let marker = ':';
    if (note.kind === 'golden') {
      marker = '*';
    } else if (note.kind === 'free') {
      marker = 'F';
    }
    const token =
      note.tokenId === undefined ? undefined : tokensById.get(note.tokenId);
    const isFirstOfToken =
      note.tokenId !== undefined && !writtenTokenIds.has(note.tokenId);
    // Line breaks used to come only from a note's tokenId. Replacing the lyrics
    // clears that binding, and a detected note outside every timed word never
    // gets one, so the whole song exported as a single unbroken line of `~`.
    // Where the binding is gone the lyric line the note falls inside decides.
    const boundLineIndex =
      note.tokenId === undefined ? undefined : lineByToken.get(note.tokenId);
    const lineIndex =
      boundLineIndex ?? lineIndexAtTime(lineStarts, note.startMs);
    if (
      lineIndex !== undefined &&
      previousLineIndex !== undefined &&
      lineIndex !== previousLineIndex
    ) {
      // `end-of-phrase = %x2D WSP start-beat`. UltraStar Deluxe's
      // ParseLyricIntParam raises EUSDXParseException('Integer expected') on a
      // bare `-` and skips the entire song.
      rows.push(`- ${start}`);
    }
    if (lineIndex !== undefined) {
      previousLineIndex = lineIndex;
    }
    if (note.tokenId !== undefined) {
      writtenTokenIds.add(note.tokenId);
    }
    const lyric =
      token && isFirstOfToken
        ? `${token.startsWord ? ' ' : ''}${token.text}`
        : '~';
    const relativePitch = Math.round(note.targetMidi - 60);
    rows.push(`${marker} ${start} ${duration} ${relativePitch} ${lyric}`);
  });
  return { rows, writtenTokenIds };
};

export const writeUltraStar = (
  project: IKaraokeMakerProject,
  options?: { language?: string },
): IWrittenKaraokeFile => {
  if (!project.melody.notes.length) {
    throw new Error('UltraStar export needs at least one melody note.');
  }
  const notes = [...project.melody.notes].sort(
    (left, right) => left.startMs - right.startMs,
  );
  const chosen = sheetLines(project, options?.language);
  const gapMs = ultraStarGapMs(project, notes);
  const { rows: body, writtenTokenIds } = ultraStarBody(
    chosen.lines,
    notes,
    gapMs,
  );
  const language = ultraStarLanguage(chosen.language);
  const rows = [
    `#TITLE:${project.title}`,
    // Required by the format even when the Maker never learned one.
    `#ARTIST:${project.artist ?? ''}`,
    `#MP3:${project.audio.name}`,
    // Implementations SHOULD prefer #AUDIO and disregard #MP3 when both are
    // present; #MP3 stays for players that predate it.
    `#AUDIO:${project.audio.name}`,
    `#BPM:${ULTRASTAR_EXPORT_BPM}`,
    `#GAP:${gapMs}`,
    ...(language ? [`#LANGUAGE:${language}`] : []),
    '#CREATOR:FluidEQ Karaoke Maker',
    ...body,
    'E',
  ];
  const sungLines = chosen.lines.filter(
    (line) => !karaokeMakerLineIsSection(line),
  );
  // Counted by word rather than by token so the number the user is shown means
  // the same thing here as it does for LRC. A word is gone only when no
  // syllable of it reached a note: one syllable of three still puts the word
  // in the file, and reporting it as missing would be as wrong as saying
  // nothing.
  const droppedWordGroups = sungLines
    .flatMap(wordTokenGroups)
    .filter((group) => group.every((token) => !writtenTokenIds.has(token.id)));
  return {
    contents: `${rows.join('\n')}\n`,
    droppedLines: sungLines.filter(
      (line) =>
        line.tokens.length > 0 &&
        line.tokens.every((token) => !writtenTokenIds.has(token.id)),
    ).length,
    droppedWords: droppedWordGroups.reduce(
      (total, group) => total + countWords(group),
      0,
    ),
  };
};

export const exportKaraokeMakerUltraStar = (
  project: IKaraokeMakerProject,
  options?: { language?: string },
): string => writeUltraStar(project, options).contents;
