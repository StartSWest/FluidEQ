/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Putting word times inside the lines a lyric file timed.
 *
 * The line's start and the next line's start are the file's, and they are the
 * walls: a word is timed between them or not at all. Where the forced
 * alignment read the voice clearly its word starts are used; where it did not
 * — the words scored low against the audio, it piled them on one frame, or it
 * heard them outside the line (lyrics timed for another cut of the song) —
 * the line's words are spread evenly over the part of the window where the
 * voice is heard. Either way the words, their order and the line are exactly
 * as given.
 */
import {
  IKaraokeMakerLine,
  IKaraokeMakerProject,
  IKaraokeMakerToken,
  karaokeMakerGivenWindows,
  karaokeMakerLineIsSection,
  karaokeMakerLineSync,
  karaokeMakerMaximumAutomaticWordDurationMs,
  karaokeMakerNeedsSpaceBetween,
  karaokeMakerTokenTimingIsGiven,
  touchKaraokeMakerProject,
} from '../../../common/karaoke/makerProject';
import { splitKaraokeWordSyllables } from '../../../common/karaoke/syllables';
import {
  FORCED_ALIGNMENT_WINDOW_MS,
  IForcedAlignmentLine,
  IForcedAlignmentLineResult,
} from './forcedAlignment';
import { IKaraokeMakerVocalRest } from './vocalRests';

/**
 * Below this the alignment is not believed and the line is spread instead.
 *
 * Measured with the shipped model on two songs' vocal stems (67 and 87
 * lines): a line's own words scored 0.58 and up on one and 0.60 and up for
 * nine lines in ten on the other; another song's words over the same audio
 * never passed 0.20, and the right words over silence never passed 0.32.
 * The five right lines that fell under this were spread, which is the safe
 * side to be wrong on.
 */
export const KARAOKE_LINE_ALIGNMENT_MINIMUM_CONFIDENCE = 0.4;

/** More than this share of words on one frame is a collapse, not a reading. */
const MAXIMUM_STACKED_SHARE = 0.5;

/**
 * More than this share of a line's words heard outside the line, and the
 * file's line time and the recording disagree. The words are spread inside
 * the line as the file has it: the file is the user's, and it wins.
 */
const MAXIMUM_ASTRAY_SHARE = 0.5;

/** The shortest a word is drawn for; two words never share an instant. */
const MINIMUM_WORD_MS = 60;

/** A rest has to leave this much of the word before it to end the word. */
const MINIMUM_WORD_BEFORE_REST_MS = 120;

const ALIGNED_CONFIDENCE_FLOOR = 0.5;
const ALIGNED_CONFIDENCE_CEILING = 0.96;
const SPREAD_CONFIDENCE = 0.4;

interface ISpan {
  startMs: number;
  endMs: number;
}

const wordGroups = (line: IKaraokeMakerLine): IKaraokeMakerToken[][] => {
  const groups: IKaraokeMakerToken[][] = [];
  line.tokens.forEach((token) => {
    if (!groups.length || token.startsWord !== false) {
      groups.push([token]);
    } else {
      groups[groups.length - 1].push(token);
    }
  });
  return groups;
};

const groupText = (group: readonly IKaraokeMakerToken[]): string =>
  group.map((token) => token.text).join('');

/**
 * Every given line's window, each with an end.
 *
 * The song's last line has none of its own: an LRC ends a line where the next
 * begins, and nothing begins after the last. Where the project does not know
 * how long the song is either — a draft opened before its audio was measured
 * — the line gets as far as the model can hear at once, which is far longer
 * than a line is sung.
 */
const lineWindows = (project: IKaraokeMakerProject): Map<string, ISpan> => {
  const windows = karaokeMakerGivenWindows(
    project.lyrics.lines,
    project.audio.durationMs,
  );
  windows.forEach((window, id) => {
    if (!Number.isFinite(window.endMs)) {
      windows.set(id, {
        startMs: window.startMs,
        endMs: window.startMs + FORCED_ALIGNMENT_WINDOW_MS,
      });
    }
  });
  return windows;
};

/** A line with no given word in it: the model times all of it. */
const lineIsWhollyUntimed = (line: IKaraokeMakerLine): boolean =>
  !line.tokens.some(karaokeMakerTokenTimingIsGiven);

/** The lines forced alignment is asked about, each with its window. */
export const karaokeMakerLinesForAlignment = (
  project: IKaraokeMakerProject,
): IForcedAlignmentLine[] => {
  const windows = lineWindows(project);
  let previousText: string | undefined;
  return project.lyrics.lines.flatMap((line): IForcedAlignmentLine[] => {
    const window = windows.get(line.id);
    if (
      karaokeMakerLineIsSection(line) ||
      !window ||
      karaokeMakerLineSync(line) !== 'line' ||
      !lineIsWhollyUntimed(line)
    ) {
      return [];
    }
    const words = wordGroups(line).map((group) => {
      const text = groupText(group);
      const spaceBefore =
        previousText === undefined ||
        karaokeMakerNeedsSpaceBetween(previousText, text);
      previousText = text;
      return { text, spaceBefore };
    });
    return [
      { id: line.id, startMs: window.startMs, endMs: window.endMs, words },
    ];
  });
};

/** The stretches of a window where the voice is heard. */
const voicedSpans = (
  window: ISpan,
  rests: readonly IKaraokeMakerVocalRest[],
): ISpan[] => {
  const spans: ISpan[] = [];
  let cursor = window.startMs;
  rests.forEach((rest) => {
    if (rest.endMs <= window.startMs || rest.startMs >= window.endMs) {
      return;
    }
    if (rest.startMs > cursor) {
      spans.push({ startMs: cursor, endMs: rest.startMs });
    }
    cursor = Math.max(cursor, rest.endMs);
  });
  if (cursor < window.endMs) {
    spans.push({ startMs: cursor, endMs: window.endMs });
  }
  const usable = spans.filter((span) => span.endMs - span.startMs >= 40);
  // A window the detector hears no voice in still holds the line: the file
  // says it is sung here, and the whole window is the only span there is.
  return usable.length ? usable : [window];
};

/** A point `offsetMs` into the voiced time, back on the song's clock. */
const voicedTimeAt = (
  spans: readonly ISpan[],
  offsetMs: number,
  asEnd: boolean,
): number => {
  let remaining = offsetMs;
  for (let index = 0; index < spans.length; index += 1) {
    const length = spans[index].endMs - spans[index].startMs;
    // An end that falls exactly on a rest stays before it; a start after it.
    if (remaining < length || (asEnd && remaining === length)) {
      return spans[index].startMs + remaining;
    }
    remaining -= length;
  }
  return spans[spans.length - 1].endMs;
};

/**
 * Spread words evenly over where the voice is heard, a syllable's share each.
 */
const spreadWords = (
  texts: readonly string[],
  window: ISpan,
  rests: readonly IKaraokeMakerVocalRest[],
  language: string,
): ISpan[] => {
  const spans = voicedSpans(window, rests);
  const voicedMs = spans.reduce(
    (total, span) => total + span.endMs - span.startMs,
    0,
  );
  // No longer than these words could plausibly be held: a line followed by a
  // long instrumental does not stretch across it.
  const plausibleMs = texts.reduce(
    (total, text) => total + karaokeMakerMaximumAutomaticWordDurationMs(text),
    0,
  );
  const sungMs = Math.min(voicedMs, plausibleMs);
  const weights = texts.map((text) =>
    Math.max(1, splitKaraokeWordSyllables(text, language).length),
  );
  const totalWeight = weights.reduce((total, weight) => total + weight, 0);
  let consumed = 0;
  return texts.map((_text, index) => {
    const startMs = voicedTimeAt(
      spans,
      (sungMs * consumed) / totalWeight,
      false,
    );
    consumed += weights[index];
    const endMs = voicedTimeAt(spans, (sungMs * consumed) / totalWeight, true);
    return { startMs, endMs: Math.max(startMs + 1, endMs) };
  });
};

/** Where the voice next stops after `timeMs`, or the window's end. */
const voiceStopsAfter = (
  timeMs: number,
  window: ISpan,
  rests: readonly IKaraokeMakerVocalRest[],
): number =>
  rests.find((rest) => rest.startMs > timeMs && rest.startMs < window.endMs)
    ?.startMs ?? window.endMs;

/** Word spans from the alignment's starts, kept in order inside the window. */
const alignedWords = (
  texts: readonly string[],
  result: IForcedAlignmentLineResult,
  window: ISpan,
  rests: readonly IKaraokeMakerVocalRest[],
): ISpan[] => {
  const starts: number[] = [];
  result.words.forEach((word, index) => {
    const earliest = index
      ? starts[index - 1] + MINIMUM_WORD_MS
      : window.startMs;
    const latest = window.endMs - (texts.length - index) * MINIMUM_WORD_MS;
    starts.push(
      Math.max(
        window.startMs,
        Math.min(Math.max(word.startMs, earliest), latest),
      ),
    );
  });
  return starts.map((startMs, index) => {
    const limitMs =
      startMs + karaokeMakerMaximumAutomaticWordDurationMs(texts[index]);
    let endMs = Math.min(
      limitMs,
      index + 1 < starts.length
        ? starts[index + 1]
        : voiceStopsAfter(startMs, window, rests),
    );
    // A word does not hold through a breath: it ends where the voice stops.
    const rest = rests.find(
      (candidate) =>
        candidate.startMs >= startMs + MINIMUM_WORD_BEFORE_REST_MS &&
        candidate.startMs < endMs,
    );
    if (rest) {
      endMs = rest.startMs;
    }
    return { startMs, endMs: Math.max(startMs + 1, endMs) };
  });
};

/** One word's span shared among its syllable tokens, by their length. */
const timedGroup = (
  group: readonly IKaraokeMakerToken[],
  span: ISpan,
  confidence: number,
): IKaraokeMakerToken[] => {
  const weights = group.map((token) =>
    Math.max(1, Array.from(token.text).length),
  );
  const totalWeight = weights.reduce((total, weight) => total + weight, 0);
  let consumed = 0;
  return group.map((token, index) => {
    const startMs =
      span.startMs + ((span.endMs - span.startMs) * consumed) / totalWeight;
    consumed += weights[index];
    const endMs =
      span.startMs + ((span.endMs - span.startMs) * consumed) / totalWeight;
    return {
      ...token,
      startMs: Math.round(startMs),
      endMs: Math.max(Math.round(startMs) + 1, Math.round(endMs)),
      confidence,
      source: 'auto-align' as const,
      timingLocked: undefined,
    };
  });
};

const isTimed = (token: IKaraokeMakerToken): boolean =>
  token.startMs !== undefined && token.endMs !== undefined;

/**
 * Time the untimed words of a line that already has some timed — a word the
 * user placed by hand, or the timed part of a file that left one word out.
 * Each untimed run is spread in the gap its timed neighbours leave, and no
 * timed word is touched.
 */
const fillBetweenGivenWords = (
  line: IKaraokeMakerLine,
  window: ISpan,
  rests: readonly IKaraokeMakerVocalRest[],
  language: string,
): IKaraokeMakerToken[] => {
  // The untimed runs, each with the timed words either side of it.
  const runs: { from: number; to: number }[] = [];
  line.tokens.forEach((token, index) => {
    if (isTimed(token)) {
      return;
    }
    const current = runs[runs.length - 1];
    if (current && current.to === index) {
      current.to = index + 1;
    } else {
      runs.push({ from: index, to: index + 1 });
    }
  });
  const filled = new Map<number, IKaraokeMakerToken>();
  runs.forEach(({ from, to }) => {
    const before = line.tokens[from - 1];
    const after = line.tokens[to];
    const gap = {
      startMs: Math.max(
        window.startMs,
        before?.endMs ?? before?.startMs ?? window.startMs,
      ),
      endMs: Math.min(window.endMs, after?.startMs ?? window.endMs),
    };
    if (gap.endMs - gap.startMs < (to - from) * MINIMUM_WORD_MS) {
      return;
    }
    const run = line.tokens.slice(from, to);
    const spans = spreadWords(
      run.map((token) => token.text),
      gap,
      rests,
      language,
    );
    run.forEach((token, offset) => {
      const [timed] = timedGroup([token], spans[offset], SPREAD_CONFIDENCE);
      filled.set(from + offset, timed);
    });
  });
  return line.tokens.map((token, index) => filled.get(index) ?? token);
};

export interface IKaraokeMakerLineAlignmentOutcome {
  project: IKaraokeMakerProject;
  /** Lines whose words were timed from the voice. */
  aligned: number;
  /** Lines whose words were spread evenly instead. */
  spread: number;
}

export const applyKaraokeMakerLineAlignment = (
  project: IKaraokeMakerProject,
  results: readonly IForcedAlignmentLineResult[],
  rests: readonly IKaraokeMakerVocalRest[],
): IKaraokeMakerLineAlignmentOutcome => {
  const windows = lineWindows(project);
  const byLine = new Map(results.map((result) => [result.id, result]));
  const language = project.lyrics.language ?? 'en';
  let aligned = 0;
  let spread = 0;
  const lines = project.lyrics.lines.map((line) => {
    const window = windows.get(line.id);
    if (
      karaokeMakerLineIsSection(line) ||
      !line.tokens.length ||
      !window ||
      karaokeMakerLineSync(line) !== 'line'
    ) {
      return line;
    }
    const kept = {
      ...line,
      startMs: window.startMs,
      endMs: line.given?.endMs ?? line.endMs,
    };
    if (!lineIsWhollyUntimed(line)) {
      if (line.tokens.every(isTimed)) {
        return kept;
      }
      spread += 1;
      return {
        ...kept,
        tokens: fillBetweenGivenWords(line, window, rests, language),
      };
    }
    const groups = wordGroups(line);
    const texts = groups.map(groupText);
    const result = byLine.get(line.id);
    const believed =
      result !== undefined &&
      result.words.length === groups.length &&
      result.confidence >= KARAOKE_LINE_ALIGNMENT_MINIMUM_CONFIDENCE &&
      result.stacked <= MAXIMUM_STACKED_SHARE &&
      result.astray <= MAXIMUM_ASTRAY_SHARE &&
      window.endMs - window.startMs >= groups.length * MINIMUM_WORD_MS;
    const spans = believed
      ? alignedWords(texts, result, window, rests)
      : spreadWords(texts, window, rests, language);
    if (believed) {
      aligned += 1;
    } else {
      spread += 1;
    }
    return {
      ...kept,
      tokens: groups.flatMap((group, index) =>
        timedGroup(
          group,
          spans[index],
          believed
            ? Math.min(
                ALIGNED_CONFIDENCE_CEILING,
                Math.max(
                  ALIGNED_CONFIDENCE_FLOOR,
                  result.words[index].probability,
                ),
              )
            : SPREAD_CONFIDENCE,
        ),
      ),
    };
  });
  return {
    project: touchKaraokeMakerProject({
      ...project,
      lyrics: { ...project.lyrics, lines },
    }),
    aligned,
    spread,
  };
};
