/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Timing words the song already has, inside the line they belong to.
 *
 * A transcription asks the speech model what was sung. This asks it something
 * narrower and much safer: given exactly these words, where in this stretch of
 * audio is each one? The model is made to write the known text (it chooses
 * nothing), and what is read from it is where its attention sat while it wrote
 * each word. No word can be invented, dropped or respelt, because none is ever
 * taken from the model.
 *
 * The arithmetic is here and touches no model, so it can be measured alone:
 * grouping lines into the windows the model hears, turning attention into a
 * cost, and the path through it. `whisperForcedAlign.ts` runs the model.
 *
 * Every line's words are confined to the line's own frames — from its start
 * to the next line's — so a word cannot land outside its line however the
 * attention wanders. That is what makes this safe to run on a song whose
 * line times were given.
 */

/** One column of Whisper's cross-attention: 20 ms of audio. */
export const FORCED_ALIGNMENT_FRAME_MS = 20;

/**
 * The longest stretch handed to the model at once. Its window is 30 s; a
 * second is left so the last word's attention is not pressed against the end.
 */
export const FORCED_ALIGNMENT_WINDOW_MS = 29_000;

/**
 * Text tokens one window may carry. The decoder holds 448 positions including
 * its prompt, and the attention read back grows with every token (four
 * layers of twenty heads over 1500 frames each); 300 is several times what
 * 29 s of singing holds — the measured songs ran 45 to 60 a window — and a
 * denser lyric simply takes one more window.
 */
export const FORCED_ALIGNMENT_WINDOW_TOKENS = 300;

/**
 * How far outside its line a word may be heard, unconfined, and still count
 * as inside: the model's own reading wanders by a few frames, and a line's
 * first word is often heard a little before the stamp its file gave it.
 */
const ASTRAY_TOLERANCE_MS = 300;

/** A line too short to hold an alignment is spread instead. */
const MINIMUM_LINE_WINDOW_MS = 200;

export interface IForcedAlignmentWord {
  text: string;
  /** Whether a space is written before this word. False inside a CJK run. */
  spaceBefore: boolean;
}

export interface IForcedAlignmentLine {
  id: string;
  /** The line's given start. */
  startMs: number;
  /** Where its window ends: the next line's start. */
  endMs: number;
  words: IForcedAlignmentWord[];
}

export interface IForcedAlignmentWindow {
  startMs: number;
  endMs: number;
  lines: IForcedAlignmentLine[];
}

export interface IForcedAlignmentLineResult {
  id: string;
  /**
   * How readily the model wrote these words over this audio, 0..1: the mean
   * probability it gave each word before being made to write it. Words that
   * are sung there score high; the wrong words, or no voice, score low.
   */
  confidence: number;
  /** The share of words placed on the very frame of the word before. */
  stacked: number;
  /**
   * The share of the line's words the model hears outside the line's window
   * when nothing confines them. High when the lyric file's line time and the
   * recording disagree — lyrics timed for another version of the song — and
   * then the confined reading is words pressed against a wall, not a timing.
   */
  astray: number;
  words: { startMs: number; probability: number }[];
}

/**
 * Group consecutive lines into the windows the model hears.
 *
 * One window per line would encode thirty seconds of audio for every line of
 * the song. Lines that fit together share one pass, and each is still held to
 * its own frames inside it.
 */
export const forcedAlignmentWindows = (
  lines: readonly IForcedAlignmentLine[],
  tokenCount: (line: IForcedAlignmentLine) => number,
): IForcedAlignmentWindow[] => {
  const usable = lines
    .map((line) => ({
      ...line,
      endMs: Math.min(line.endMs, line.startMs + FORCED_ALIGNMENT_WINDOW_MS),
    }))
    .filter(
      (line) =>
        line.words.length > 0 &&
        Number.isFinite(line.startMs) &&
        line.endMs - line.startMs >= MINIMUM_LINE_WINDOW_MS,
    )
    .sort((left, right) => left.startMs - right.startMs);
  const windows: IForcedAlignmentWindow[] = [];
  let tokens = 0;
  usable.forEach((line) => {
    const current = windows[windows.length - 1];
    const count = tokenCount(line);
    const previous = current?.lines[current.lines.length - 1];
    if (
      current &&
      previous &&
      // Two lines given the same stretch cannot both be solved in it.
      line.startMs >= previous.endMs &&
      line.endMs - current.startMs <= FORCED_ALIGNMENT_WINDOW_MS &&
      tokens + count <= FORCED_ALIGNMENT_WINDOW_TOKENS
    ) {
      current.lines.push(line);
      current.endMs = line.endMs;
      tokens += count;
      return;
    }
    windows.push({ startMs: line.startMs, endMs: line.endMs, lines: [line] });
    tokens = count;
  });
  return windows;
};

const medianOfSeven = (values: Float32Array, out: Float32Array) => {
  const { length } = values;
  const window = new Float32Array(7);
  for (let index = 0; index < length; index += 1) {
    for (let offset = -3; offset <= 3; offset += 1) {
      // Reflected at both ends, as the model's own timestamp code pads it.
      let at = index + offset;
      if (at < 0) {
        at = -at;
      }
      if (at >= length) {
        at = 2 * (length - 1) - at;
      }
      window[offset + 3] = values[Math.max(0, Math.min(length - 1, at))];
    }
    window.sort();
    const [, , , median] = window;
    out[index] = median;
  }
};

/**
 * Turn the attention of the model's alignment heads into one cost per
 * (token, frame): low where the token was being read.
 *
 * Each head is a `rows` x `frames` grid. A frame every token looks at says
 * nothing about any one of them, so each frame is normalised across the
 * tokens; a seven-frame median takes out single-frame spikes; the heads are
 * averaged and the sign turned so the cheapest path is the best reading.
 * The same steps Whisper's own word timestamps take, kept in that order.
 */
export const forcedAlignmentCost = (
  heads: readonly Float32Array[],
  rows: number,
  frames: number,
): Float32Array => {
  const cost = new Float32Array(rows * frames);
  if (!heads.length || rows <= 0 || frames <= 0) {
    return cost;
  }
  const row = new Float32Array(frames);
  const filtered = new Float32Array(frames);
  heads.forEach((head) => {
    const mean = new Float32Array(frames);
    const deviation = new Float32Array(frames);
    for (let r = 0; r < rows; r += 1) {
      for (let f = 0; f < frames; f += 1) {
        mean[f] += head[r * frames + f] / rows;
      }
    }
    for (let r = 0; r < rows; r += 1) {
      for (let f = 0; f < frames; f += 1) {
        const difference = head[r * frames + f] - mean[f];
        deviation[f] += (difference * difference) / rows;
      }
    }
    for (let r = 0; r < rows; r += 1) {
      for (let f = 0; f < frames; f += 1) {
        const spread = Math.sqrt(deviation[f]);
        // A frame no token tells apart carries no evidence either way.
        row[f] = spread > 0 ? (head[r * frames + f] - mean[f]) / spread : 0;
      }
      medianOfSeven(row, filtered);
      for (let f = 0; f < frames; f += 1) {
        cost[r * frames + f] -= filtered[f] / heads.length;
      }
    }
  });
  return cost;
};

/**
 * The frames one row of the grid may be read on: `from` up to `to`.
 *
 * `startBy` is for a row that may run on past where it has to begin: it must
 * be entered on or before that frame, and may then stay as long as it likes.
 */
export interface IForcedAlignmentRowLimit {
  from: number;
  to: number;
  startBy?: number;
}

/**
 * The frame each row of the grid starts on.
 *
 * Dynamic time warping: the cheapest way through the grid that moves forward
 * in the text and forward in time and never back in either. A row's start is
 * the first frame the path spends on it. The same walk Whisper's own word
 * timestamps take, with one addition: a row may be confined to some frames,
 * and the path cannot leave them. That is how a line's words are kept between
 * the line's own start and the next line's.
 *
 * The rows in front of the text (the model's prompt) are left free, and they
 * are what stands on the audio before the first word is sung; a line's last
 * word has to begin inside its line and is then free to run on until the next
 * line's first word is heard. Empty when no path satisfies the limits.
 */
export const forcedAlignmentStarts = (
  cost: Float32Array,
  rows: number,
  frames: number,
  limits: readonly (IForcedAlignmentRowLimit | undefined)[],
): number[] => {
  if (rows <= 0 || frames <= 0) {
    return [];
  }
  const width = frames + 1;
  const total = new Float32Array((rows + 1) * width).fill(
    Number.POSITIVE_INFINITY,
  );
  // 0 diagonal (next row, next frame), 1 up (next row), 2 left (next frame).
  const step = new Uint8Array((rows + 1) * width);
  total[0] = 0;
  for (let i = 1; i <= rows; i += 1) {
    const limit = limits[i - 1];
    const first = Math.max(1, (limit?.from ?? 0) + 1);
    const last = Math.min(frames, limit?.to ?? frames);
    // Past this frame the row can only be stayed in, not entered.
    const lastEntry = (limit?.startBy ?? frames) + 1;
    for (let j = first; j <= last; j += 1) {
      const canEnter = j <= lastEntry;
      const diagonal = canEnter
        ? total[(i - 1) * width + (j - 1)]
        : Number.POSITIVE_INFINITY;
      const up = canEnter
        ? total[(i - 1) * width + j]
        : Number.POSITIVE_INFINITY;
      const left = total[i * width + (j - 1)];
      let best = diagonal;
      let move = 0;
      if (up < best) {
        best = up;
        move = 1;
      }
      if (left < best) {
        best = left;
        move = 2;
      }
      total[i * width + j] = cost[(i - 1) * frames + (j - 1)] + best;
      step[i * width + j] = move;
    }
  }
  if (!Number.isFinite(total[rows * width + frames])) {
    return [];
  }
  const starts = new Array<number>(rows).fill(0);
  let i = rows;
  let j = frames;
  while (i > 0 && j > 0) {
    // Walking backwards, the last frame seen for a row is its first.
    starts[i - 1] = j - 1;
    const move = step[i * width + j];
    if (move === 0) {
      i -= 1;
      j -= 1;
    } else if (move === 1) {
      i -= 1;
    } else {
      j -= 1;
    }
  }
  return starts;
};

/**
 * One line's result from its tokens' frames and the probability the model
 * gave each token before it was made to write it.
 */
export const forcedAlignmentLineResult = (
  line: IForcedAlignmentLine,
  windowStartMs: number,
  tokensPerWord: readonly number[],
  tokenStartFrames: readonly number[],
  tokenLogProbabilities: readonly number[],
  /** The same tokens read with nothing confining them. */
  unconfinedStartFrames: readonly number[],
): IForcedAlignmentLineResult => {
  let cursor = 0;
  let stacked = 0;
  let astray = 0;
  let previousFrame = -1;
  const words = tokensPerWord.map((count) => {
    const frame = tokenStartFrames[cursor] ?? 0;
    const unconfinedMs =
      windowStartMs +
      (unconfinedStartFrames[cursor] ?? frame) * FORCED_ALIGNMENT_FRAME_MS;
    if (
      unconfinedMs < line.startMs - ASTRAY_TOLERANCE_MS ||
      unconfinedMs > line.endMs + ASTRAY_TOLERANCE_MS
    ) {
      astray += 1;
    }
    let sum = 0;
    for (let index = cursor; index < cursor + count; index += 1) {
      sum += tokenLogProbabilities[index] ?? Number.NEGATIVE_INFINITY;
    }
    cursor += count;
    if (frame === previousFrame) {
      stacked += 1;
    }
    previousFrame = frame;
    return {
      startMs: Math.min(
        line.endMs,
        Math.max(
          line.startMs,
          windowStartMs + frame * FORCED_ALIGNMENT_FRAME_MS,
        ),
      ),
      probability: count > 0 ? Math.exp(sum / count) : 0,
    };
  });
  return {
    id: line.id,
    confidence: words.length
      ? words.reduce((total, word) => total + word.probability, 0) /
        words.length
      : 0,
    stacked: words.length > 1 ? stacked / (words.length - 1) : 0,
    astray: words.length ? astray / words.length : 0,
    words,
  };
};
