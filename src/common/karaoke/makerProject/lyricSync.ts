/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.
*/

/**
 * What timing a song's lyrics arrived with, and keeping it.
 *
 * A detector used to treat every song as untimed. A word-synced file had each
 * word re-timed from a transcript, and a line-synced one had its words spread
 * over the whole song by the melody, each line following wherever they went.
 * Three levels, read per line because one project can hold more than one:
 *
 * - `word`  every word has a time the file or the user gave. Nothing to detect
 *           but the notes.
 * - `line`  the file says when the line is sung and not when its words are.
 *           The words are timed inside that window and the window stays.
 * - `open`  no time at all. Detection may place the words; the text is still
 *           the user's.
 *
 * Whatever a run did, `karaokeMakerKeepGivenLyrics` is the last step of it:
 * the given words, times and line windows are put back exactly, so no path
 * through the detectors can overwrite them.
 */
import { karaokeMakerLineTokens } from './lineTokens';
import {
  IKaraokeMakerLine,
  IKaraokeMakerProject,
  IKaraokeMakerToken,
  karaokeMakerId,
  karaokeMakerLineIsSection,
  karaokeMakerMaximumAutomaticWordDurationMs,
} from './model';

export type TKaraokeMakerLineSync = 'word' | 'line' | 'open';

export interface IKaraokeMakerLyricSyncPlan {
  /** Sung lines whose every word has a given time. */
  word: number;
  /** Sung lines with a given window and words still to time inside it. */
  line: number;
  /** Sung lines with no given time at all. */
  open: number;
}

/**
 * A word time that came from the lyric file or from the user's own hand.
 *
 * `imported` and `manual` are the two sources that are not a detector, and a
 * locked time is one the user set whatever its source. An end may be missing:
 * the last word of an enhanced LRC has a start and nothing after it to say
 * where it stops.
 */
export const karaokeMakerTokenTimingIsGiven = (
  token: Pick<IKaraokeMakerToken, 'startMs' | 'source' | 'timingLocked'>,
): boolean =>
  token.startMs !== undefined &&
  (token.timingLocked === true ||
    token.source === 'imported' ||
    token.source === 'manual');

export const karaokeMakerLineSync = (
  line: IKaraokeMakerLine,
): TKaraokeMakerLineSync => {
  if (
    line.tokens.length > 0 &&
    line.tokens.every(karaokeMakerTokenTimingIsGiven)
  ) {
    return 'word';
  }
  return line.given ? 'line' : 'open';
};

/**
 * What a detector run is for, said in one word: `word` when every sung line
 * already has its words timed (only the notes are missing), `line` when some
 * line has a window to time words inside, `open` otherwise.
 */
export const karaokeMakerLyricSyncKind = (
  plan: IKaraokeMakerLyricSyncPlan,
): TKaraokeMakerLineSync => {
  if (plan.line > 0) {
    return 'line';
  }
  return plan.word > 0 && plan.open === 0 ? 'word' : 'open';
};

export const karaokeMakerLyricSyncPlan = (
  project: IKaraokeMakerProject,
): IKaraokeMakerLyricSyncPlan => {
  const plan: IKaraokeMakerLyricSyncPlan = { word: 0, line: 0, open: 0 };
  project.lyrics.lines.forEach((line) => {
    if (karaokeMakerLineIsSection(line) || !line.tokens.length) {
      return;
    }
    plan[karaokeMakerLineSync(line)] += 1;
  });
  return plan;
};

/**
 * When a line starts for the singer: where its file put it, even if the first
 * word inside is sung later. A word moved in front of that by hand wins — the
 * user has then said the line begins earlier than its file did.
 */
export const karaokeMakerLineStartMs = (
  line: IKaraokeMakerLine,
): number | undefined => {
  const starts = line.tokens.flatMap((token) =>
    token.startMs === undefined ? [] : [token.startMs],
  );
  const firstWordMs = starts.length ? Math.min(...starts) : undefined;
  if (line.given === undefined) {
    return firstWordMs ?? line.startMs;
  }
  return firstWordMs === undefined
    ? line.given.startMs
    : Math.min(firstWordMs, line.given.startMs);
};

/**
 * Where each given line's window ends: the end its file gave, else the next
 * given line's start, else the end of the song.
 */
export const karaokeMakerGivenWindows = (
  lines: readonly IKaraokeMakerLine[],
  durationMs: number | undefined,
): Map<string, { startMs: number; endMs: number }> => {
  const given = lines
    .filter((line) => line.given && !karaokeMakerLineIsSection(line))
    .sort(
      (left, right) => (left.given?.startMs ?? 0) - (right.given?.startMs ?? 0),
    );
  const windows = new Map<string, { startMs: number; endMs: number }>();
  given.forEach((line, index) => {
    const startMs = line.given?.startMs ?? 0;
    const next = given
      .slice(index + 1)
      .find((candidate) => (candidate.given?.startMs ?? 0) > startMs);
    const endMs =
      line.given?.endMs ??
      next?.given?.startMs ??
      durationMs ??
      Number.POSITIVE_INFINITY;
    if (endMs > startMs) {
      windows.set(line.id, { startMs, endMs });
    }
  });
  return windows;
};

/**
 * A line an LRC timed as a whole arrives as one token holding every word.
 * Nothing can be timed inside one token, so it is cut into its words here —
 * the text and its order unchanged.
 */
export const karaokeMakerWordsOfUntimedToken = (
  token: IKaraokeMakerToken,
): IKaraokeMakerToken[] => {
  const words = karaokeMakerLineTokens(token.text);
  if (words.length <= 1) {
    return [token];
  }
  return words.map((text, index) => ({
    id: index === 0 ? token.id : karaokeMakerId('word'),
    text,
    startsWord: index === 0 ? token.startsWord : true,
    source: token.source,
  }));
};

const isWholeLineToken = (line: IKaraokeMakerLine): boolean =>
  line.tokens.length === 1 && /\s/u.test(line.tokens[0].text.trim());

/**
 * Find the given windows of a draft saved before `given` was written.
 *
 * Such a draft still shows where it came from: a line-timed file left each
 * line as one token holding the whole sentence, with the line's start beside
 * it and its end on the next line's start. Only a draft carrying that mark is
 * read this way — a range alone proves nothing, because every detector writes
 * one from the words it placed. The whole-line tokens are cut into words, and
 * a time a detector had put on one goes with it: it was a time for a sentence,
 * laid across other lines.
 *
 * One more line is read this way whatever the draft: one whose words have
 * given times but for a few. Its range can only be the file's, since no
 * detector has had an untimed word of it to write a range from.
 */
export const karaokeMakerInferGivenWindows = (
  lines: readonly IKaraokeMakerLine[],
): IKaraokeMakerLine[] => {
  const sung = lines.filter(
    (line) => !karaokeMakerLineIsSection(line) && line.tokens.length > 0,
  );
  const fromLineTimedFile = sung.some(
    (line) =>
      line.given === undefined &&
      line.startMs !== undefined &&
      isWholeLineToken(line),
  );
  return lines.map((line) => {
    if (
      line.given ||
      line.startMs === undefined ||
      karaokeMakerLineIsSection(line) ||
      !line.tokens.length
    ) {
      return line;
    }
    // A word-timed file that left a word of a line untimed: the line's own
    // start is still the file's, and the word belongs between its neighbours
    // inside it rather than wherever a transcript would put it.
    const lacksAWord =
      line.tokens.some(karaokeMakerTokenTimingIsGiven) &&
      line.tokens.some((token) => token.startMs === undefined);
    if (!fromLineTimedFile && !lacksAWord) {
      return line;
    }
    return {
      ...line,
      given: {
        startMs: line.startMs,
        endMs:
          line.endMs !== undefined && line.endMs > line.startMs
            ? line.endMs
            : undefined,
      },
      tokens: isWholeLineToken(line)
        ? karaokeMakerWordsOfUntimedToken({
            id: line.tokens[0].id,
            text: line.tokens[0].text,
            startsWord: true,
            source: 'imported',
          })
        : line.tokens,
    };
  });
};

/**
 * Give a word the file started and never ended an end.
 *
 * Only a missing value is filled: the next word's start, else the line's own
 * end, and never longer than a sung word plausibly lasts.
 */
export const karaokeMakerCloseGivenWordEnds = (
  project: IKaraokeMakerProject,
): IKaraokeMakerProject => {
  const windows = karaokeMakerGivenWindows(
    project.lyrics.lines,
    project.audio.durationMs,
  );
  let changed = false;
  const lines = project.lyrics.lines.map((line) => {
    if (karaokeMakerLineIsSection(line)) {
      return line;
    }
    const tokens = line.tokens.map((token, index) => {
      if (
        !karaokeMakerTokenTimingIsGiven(token) ||
        token.startMs === undefined ||
        (token.endMs !== undefined && token.endMs > token.startMs)
      ) {
        return token;
      }
      const nextStartMs = line.tokens
        .slice(index + 1)
        .find(
          (candidate) => (candidate.startMs ?? -1) > (token.startMs ?? 0),
        )?.startMs;
      const limitMs =
        token.startMs + karaokeMakerMaximumAutomaticWordDurationMs(token.text);
      const lineEndMs = windows.get(line.id)?.endMs ?? line.endMs;
      const endMs = Math.min(
        limitMs,
        nextStartMs ?? lineEndMs ?? limitMs,
        project.audio.durationMs ?? limitMs,
      );
      if (!(endMs > token.startMs)) {
        return token;
      }
      changed = true;
      return { ...token, endMs };
    });
    return { ...line, tokens };
  });
  return changed
    ? { ...project, lyrics: { ...project.lyrics, lines } }
    : project;
};

/**
 * A word no detector may move: one with a given time, or one timed inside a
 * line whose window was given. The second was placed between the file's own
 * walls, and a transcript or a melody pass run afterwards knows nothing of
 * them.
 */
const tokenIsHeld = (
  line: IKaraokeMakerLine,
  token: IKaraokeMakerToken,
): boolean =>
  karaokeMakerTokenTimingIsGiven(token) ||
  (line.given !== undefined &&
    token.startMs !== undefined &&
    token.endMs !== undefined);

/**
 * Lock every held word for one detector run, so each pass treats it as an
 * anchor. The copy is never published: `karaokeMakerKeepGivenLyrics` puts the
 * original flags back.
 */
export const karaokeMakerLockGivenTiming = (
  project: IKaraokeMakerProject,
): IKaraokeMakerProject => ({
  ...project,
  lyrics: {
    ...project.lyrics,
    lines: project.lyrics.lines.map((line) => ({
      ...line,
      tokens: line.tokens.map((token) =>
        tokenIsHeld(line, token) && token.endMs !== undefined
          ? { ...token, timingLocked: true }
          : token,
      ),
    })),
  },
});

const insideWindow = (
  token: IKaraokeMakerToken,
  window: { startMs: number; endMs: number },
): boolean =>
  token.startMs === undefined ||
  token.endMs === undefined ||
  (token.startMs >= window.startMs && token.endMs <= window.endMs);

/**
 * Put back everything the song was given, after any detector has run.
 *
 * `given` is the project as it stood before the run (with whatever this run
 * was allowed to add inside the given windows); `detected` is what came out.
 * The lines and the words are the given ones, in the given order: a detector
 * supplies times and nothing else, so a line or a word it dropped is still
 * here and one it made up is not. A given word, and a word already timed
 * inside a given line, keeps its time, source and lock byte for byte. A given
 * line keeps its window, and a word a detector left outside it loses that
 * time rather than keeping a wrong one.
 *
 * A project that had no lyrics has nothing to keep: there the transcript is
 * the lyric sheet, and it passes through.
 */
export const karaokeMakerKeepGivenLyrics = (
  given: IKaraokeMakerProject,
  detected: IKaraokeMakerProject,
): IKaraokeMakerProject => {
  if (!given.lyrics.lines.some((line) => line.tokens.length > 0)) {
    return detected;
  }
  const detectedLines = new Map(
    detected.lyrics.lines.map((line) => [line.id, line] as const),
  );
  const detectedTokens = new Map(
    detected.lyrics.lines.flatMap((line) =>
      line.tokens.map((token) => [token.id, token] as const),
    ),
  );
  const windows = karaokeMakerGivenWindows(
    given.lyrics.lines,
    given.audio.durationMs ?? detected.audio.durationMs,
  );
  const lines = given.lyrics.lines.map((original) => {
    const line = detectedLines.get(original.id) ?? original;
    if (karaokeMakerLineIsSection(original)) {
      // A heading is placed from the lines around it after every run.
      return line;
    }
    const window = windows.get(original.id);
    const tokens = original.tokens.map((before) => {
      const token = detectedTokens.get(before.id) ?? before;
      if (tokenIsHeld(original, before)) {
        return { ...before, endMs: before.endMs ?? token.endMs };
      }
      const kept = {
        ...token,
        text: before.text,
        startsWord: before.startsWord,
      };
      return window && !insideWindow(kept, window)
        ? {
            ...kept,
            startMs: undefined,
            endMs: undefined,
            confidence: undefined,
          }
        : kept;
    });
    return original.given
      ? {
          ...line,
          given: original.given,
          startMs: original.given.startMs,
          endMs: original.given.endMs ?? line.endMs,
          tokens,
        }
      : { ...line, tokens };
  });
  return {
    ...detected,
    lyrics: { ...detected.lyrics, source: given.lyrics.source, lines },
  };
};
