/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Running the speech model over words it is given rather than asked for.
 *
 * The model is the Whisper the Maker already downloads; nothing new is
 * fetched. Each step of its decoder is handed the next token of the known
 * line, so its output is the text it was given, and the two things worth
 * having are read on the way past: how likely it thought that token was
 * before being made to write it (is this what is sung here?) and where its
 * alignment heads were looking (when?).
 *
 * The library and the loaded pipeline are passed in rather than imported, so
 * the same code runs in the Maker's worker and against the model from Node.
 */
import {
  FORCED_ALIGNMENT_FRAME_MS,
  forcedAlignmentCost,
  forcedAlignmentLineResult,
  forcedAlignmentStarts,
  forcedAlignmentWindows,
  IForcedAlignmentLine,
  IForcedAlignmentLineResult,
  IForcedAlignmentRowLimit,
} from './forcedAlignment';

const SAMPLE_RATE = 16_000;
const SAMPLES_PER_FRAME = (SAMPLE_RATE * FORCED_ALIGNMENT_FRAME_MS) / 1_000;

interface IAlignTensor {
  dims: number[];
  data: ArrayLike<number> & { length: number };
}

/** The part of a loaded speech pipeline forced alignment uses. */
export interface IForcedAlignRecognizer {
  model: {
    generation_config: {
      alignment_heads?: number[][];
      eos_token_id?: number | number[];
    };
    generate: (options: Record<string, unknown>) => Promise<unknown>;
  };
  processor: (audio: Float32Array) => Promise<{ input_features: unknown }>;
  tokenizer: {
    encode: (
      text: string,
      options: { add_special_tokens: boolean },
    ) => number[];
  };
}

/** The two classes of the library a forced decode is built from. */
export interface IForcedAlignRuntime {
  LogitsProcessor: new () => object;
  LogitsProcessorList: new () => { push: (processor: object) => void };
}

interface IForcer {
  logProbabilities: number[];
}

/**
 * A step of the decoder that may write one token only: the next of the text.
 *
 * It reads the model's own probability for that token first, which is the
 * whole of the evidence that these words belong to this audio.
 */
const createForcer = (
  runtime: IForcedAlignRuntime,
  forced: readonly number[],
  endToken: number,
): IForcer & object => {
  class Forcer extends runtime.LogitsProcessor implements IForcer {
    logProbabilities: number[] = [];

    private promptLength: number | undefined;

    // The library calls a processor through `_call`.
    // eslint-disable-next-line no-underscore-dangle -- the library's own method name, not ours to choose
    _call(inputIds: ArrayLike<unknown>[], logits: IAlignTensor): IAlignTensor {
      this.promptLength ??= inputIds[0].length;
      const position = inputIds[0].length - this.promptLength;
      const scores = logits.data as Float32Array;
      const wanted = position < forced.length ? forced[position] : endToken;
      let highest = Number.NEGATIVE_INFINITY;
      for (let index = 0; index < scores.length; index += 1) {
        if (scores[index] > highest) {
          highest = scores[index];
        }
      }
      let sum = 0;
      for (let index = 0; index < scores.length; index += 1) {
        sum += Math.exp(scores[index] - highest);
      }
      if (position < forced.length) {
        this.logProbabilities.push(scores[wanted] - highest - Math.log(sum));
      }
      scores.fill(Number.NEGATIVE_INFINITY);
      scores[wanted] = 0;
      return logits;
    }
  }
  return new Forcer();
};

/** Half-precision bits to a number, for a model whose outputs stay float16. */
const halfToFloat = (bits: number): number => {
  const exponent = Math.floor(bits / 1_024) % 32;
  const fraction = bits % 1_024;
  const sign = bits >= 32_768 ? -1 : 1;
  if (exponent === 0) {
    return sign * 2 ** -14 * (fraction / 1_024);
  }
  if (exponent === 31) {
    return fraction ? Number.NaN : sign * Number.POSITIVE_INFINITY;
  }
  return sign * 2 ** (exponent - 15) * (1 + fraction / 1_024);
};

const valueReader = (tensor: IAlignTensor): ((index: number) => number) =>
  tensor.data instanceof Uint16Array
    ? (index) => halfToFloat(tensor.data[index])
    : (index) => tensor.data[index];

/**
 * The alignment heads' attention as one `rows` x `frames` grid per head.
 *
 * The model reports attention a decoder step at a time: the first step holds
 * a row for each prompt token, every later step one row. Row `r` is the
 * attention while the token after `r` was being written.
 */
const alignmentHeadGrids = (
  crossAttentions: IAlignTensor[][],
  alignmentHeads: readonly number[][],
  frames: number,
): { heads: Float32Array[]; rows: number } => {
  const rows = crossAttentions.reduce(
    (total, layers) => total + (layers[0]?.dims[2] ?? 0),
    0,
  );
  const heads = alignmentHeads.map(([layer, head]) => {
    const grid = new Float32Array(rows * frames);
    let row = 0;
    crossAttentions.forEach((layers) => {
      const tensor = layers[layer];
      if (!tensor) {
        return;
      }
      const [, , stepRows, stepFrames] = tensor.dims;
      const read = valueReader(tensor);
      for (let r = 0; r < stepRows; r += 1) {
        const from = (head * stepRows + r) * stepFrames;
        for (let f = 0; f < Math.min(frames, stepFrames); f += 1) {
          grid[(row + r) * frames + f] = read(from + f);
        }
      }
      row += stepRows;
    });
    return grid;
  });
  return { heads, rows };
};

const wordText = (
  word: IForcedAlignmentLine['words'][number],
  first: boolean,
): string => `${first || word.spaceBefore ? ' ' : ''}${word.text}`;

/**
 * Time every line's words inside the line's own window.
 *
 * `samples` is the whole song's voice at 16 kHz. A line the model could not be
 * run on (no room, no words) is simply absent from the answer, and whoever
 * applies it spreads that line's words instead.
 */
export const alignLinesWithWhisperModel = async (
  recognizer: IForcedAlignRecognizer,
  runtime: IForcedAlignRuntime,
  samples: Float32Array,
  lines: readonly IForcedAlignmentLine[],
  language: string | undefined,
  onWindow: (completed: number, total: number) => void,
): Promise<IForcedAlignmentLineResult[]> => {
  const alignmentHeads = recognizer.model.generation_config.alignment_heads;
  if (!alignmentHeads?.length) {
    throw new Error(
      'The speech model has no alignment heads, so words cannot be timed.',
    );
  }
  const endTokens = recognizer.model.generation_config.eos_token_id;
  const endToken = Array.isArray(endTokens) ? endTokens[0] : endTokens;
  if (endToken === undefined) {
    throw new Error('The speech model does not say how a text ends.');
  }
  const durationMs = (samples.length / SAMPLE_RATE) * 1_000;
  // Each word encoded on its own, so which tokens belong to which word is
  // known rather than recovered. For a script written with spaces this is the
  // encoding of the whole line; a CJK character encoded alone may differ from
  // how the run would be merged, and the model reads it all the same.
  const tokensOf = new Map<IForcedAlignmentLine, number[][]>();
  const encoded = (line: IForcedAlignmentLine): number[][] => {
    const known = tokensOf.get(line);
    if (known) {
      return known;
    }
    const tokens = line.words.map((word, index) =>
      recognizer.tokenizer.encode(wordText(word, index === 0), {
        add_special_tokens: false,
      }),
    );
    tokensOf.set(line, tokens);
    return tokens;
  };
  const windows = forcedAlignmentWindows(
    lines.filter((line) => line.startMs < durationMs),
    (line) => encoded(line).reduce((total, word) => total + word.length, 0),
  );
  const results: IForcedAlignmentLineResult[] = [];
  onWindow(0, windows.length);
  for (let index = 0; index < windows.length; index += 1) {
    const window = windows[index];
    const audio = samples.slice(
      Math.round((window.startMs / 1_000) * SAMPLE_RATE),
      Math.round((Math.min(window.endMs, durationMs) / 1_000) * SAMPLE_RATE),
    );
    const frames = Math.floor(audio.length / SAMPLES_PER_FRAME);
    const forced = window.lines.flatMap((line) => encoded(line).flat());
    if (frames > 0 && forced.length > 0) {
      const forcer = createForcer(runtime, forced, endToken);
      const processors = new runtime.LogitsProcessorList();
      processors.push(forcer);
      // eslint-disable-next-line no-await-in-loop -- one window at a time: the model holds one stretch of audio at once
      const features = await recognizer.processor(audio);
      // eslint-disable-next-line no-await-in-loop -- as above, one at a time
      const output = (await recognizer.model.generate({
        inputs: features.input_features,
        language,
        task: 'transcribe',
        return_timestamps: false,
        output_attentions: true,
        return_dict_in_generate: true,
        max_new_tokens: forced.length + 1,
        logits_processor: processors,
      })) as { cross_attentions?: IAlignTensor[][] };
      const crossAttentions = output.cross_attentions;
      if (!crossAttentions?.length) {
        throw new Error(
          'The speech model returned no attention, so words cannot be timed.',
        );
      }
      const { heads, rows } = alignmentHeadGrids(
        crossAttentions,
        alignmentHeads,
        frames,
      );
      const cost = forcedAlignmentCost(heads, rows, frames);
      // The first step's rows are the prompt; its last row wrote the first
      // word's first token, so token `n` of the text is row `promptRows - 1
      // + n`. Each token is held to its own line's frames; a line's last
      // has to begin there and may then run on until the next line's first
      // word is heard.
      const promptRows = crossAttentions[0][0]?.dims[2] ?? 1;
      const limits: (IForcedAlignmentRowLimit | undefined)[] = new Array(
        rows,
      ).fill(undefined);
      let tokenCursor = 0;
      const placed = window.lines.map((line) => {
        const count = encoded(line).reduce(
          (total, word) => total + word.length,
          0,
        );
        const rowFrom = promptRows - 1 + tokenCursor;
        const from = Math.max(
          0,
          Math.round(
            (line.startMs - window.startMs) / FORCED_ALIGNMENT_FRAME_MS,
          ),
        );
        const to = Math.min(
          frames,
          Math.round((line.endMs - window.startMs) / FORCED_ALIGNMENT_FRAME_MS),
        );
        for (let token = 0; token < count; token += 1) {
          if (rowFrom + token < rows) {
            limits[rowFrom + token] =
              token === count - 1
                ? { from, to: frames, startBy: Math.max(from, to - 1) }
                : { from, to };
          }
        }
        tokenCursor += count;
        return { line, rowFrom, count, tokenFrom: tokenCursor - count };
      });
      const starts = forcedAlignmentStarts(cost, rows, frames, limits);
      // The same grid with no walls: where the model hears each word when
      // nothing tells it where the line is. Kept only to be compared.
      const unconfined = forcedAlignmentStarts(cost, rows, frames, []);
      placed.forEach(({ line, rowFrom, count, tokenFrom }) => {
        if (starts.length && rowFrom + count <= rows) {
          results.push(
            forcedAlignmentLineResult(
              line,
              window.startMs,
              encoded(line).map((word) => word.length),
              starts.slice(rowFrom, rowFrom + count),
              forcer.logProbabilities.slice(tokenFrom, tokenFrom + count),
              unconfined.slice(rowFrom, rowFrom + count),
            ),
          );
        }
      });
    }
    onWindow(index + 1, windows.length);
  }
  return results;
};
