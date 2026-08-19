/* FluidEQ Karaoke Maker speech-recognition worker. GPL-3.0-or-later. */

import wasmUrl from '@fluideq/whisper-wasm';
import runtimeUrl from '@fluideq/whisper-runtime';
import { env, pipeline } from '@huggingface/transformers';

// One name, imported — this worker carried its own hardcoded copy once, and a
// model upgrade in audio.ts silently did nothing: the app checked caches and
// wrote provenance for a model the worker never loaded.
import { WHISPER_MODEL as MODEL } from './makerAi/audio';

interface IWhisperChunk {
  text?: string;
  timestamp?: [number | null, number | null];
}

interface IWhisperOutput {
  text?: string;
  chunks?: IWhisperChunk[];
}

interface IRecognizer {
  (
    samples: Float32Array,
    options: {
      return_timestamps: 'word' | true;
      chunk_length_s: number;
      stride_length_s: number;
      force_full_sequences: boolean;
      language?: string;
      task: 'transcribe';
      streamer?: {
        put: (value: bigint[][]) => void;
        end: () => void;
      };
    },
  ): Promise<IWhisperOutput>;
  dispose?: () => Promise<void> | void;
}

interface IWorkerRequest {
  id: string;
  type: 'transcribe' | 'release';
  samples?: Float32Array;
  downloadedAtStart?: boolean;
  language?: string;
  /**
   * Whether to spend a second decode on Whisper's own phrase segmentation.
   *
   * Asked for only when the transcript is about to become the lyrics, because
   * that is the only path that decides where a line ends. A project that
   * already has lyrics keeps its own line breaks and would pay the decode for
   * nothing.
   *
   * It is a second decode because the two cannot be had from one: requesting
   * word timestamps makes the pipeline force `<|notimestamps|>` into the
   * prompt (`pipelines.js:1812`), so the segment boundaries are never
   * predicted, and `_decode_asr` discards the segment structure it builds
   * whenever word timestamps were asked for.
   */
  wantSegments?: boolean;
}

let recognizer: IRecognizer | undefined;
let recognizerTask: Promise<IRecognizer> | undefined;

const WHISPER_SAMPLE_RATE = 16_000;

/** One column of Whisper's cross-attention grid; every timestamp is a multiple. */
const WHISPER_TIME_PRECISION = 0.02;

/**
 * Words the timestamp head reported a position it does not have.
 *
 * When the DTW backtrack runs out of audio columns it parks every remaining
 * token on the window's last one, so the value is closed form: chunk k starts
 * at k*(chunkLength - 2*strideLength) and its final column sits chunkLength -
 * 0.02 s later. Measured before the library patch, one 253 s song put 27 of
 * 158 words on those columns and one word 13 s past the end of the audio.
 *
 * Counted here because only the worker knows the chunk geometry — by the time
 * a transcript reaches the project, 169.98 is just a number. Reported rather
 * than repaired: a run that quietly drops a third of its words still reads as
 * a successful detection, which is how this went unnoticed.
 */
const unplacedWordCount = (
  output: IWhisperOutput,
  chunkLength: number,
  strideLength: number,
  durationSeconds: number,
): { terminal: number; pastEnd: number; stacked: number; at: number[] } => {
  const jump = chunkLength - strideLength * 2;
  const terminalAt = chunkLength - WHISPER_TIME_PRECISION;
  const starts = (output.chunks ?? []).flatMap((word) => {
    const start = word.timestamp?.[0];
    return typeof start === 'number' ? [start] : [];
  });
  const seen = new Map<number, number>();
  starts.forEach((start) => seen.set(start, (seen.get(start) ?? 0) + 1));
  const isTerminal = (start: number): boolean => {
    if (jump <= 0) {
      return false;
    }
    const offset = start - terminalAt;
    return (
      offset >= -WHISPER_TIME_PRECISION &&
      Math.abs(offset - Math.round(offset / jump) * jump) <=
        WHISPER_TIME_PRECISION
    );
  };
  const at = [...seen.entries()]
    .filter(([, count]) => count > 1)
    .map(([start]) => Math.round(start * 100) / 100)
    .sort((left, right) => left - right)
    .slice(0, 12);
  return {
    // Three shapes, because they have different causes and one patch cannot
    // answer for all of them: DTW walking off the end of its window, DTW
    // placing a word past the audio entirely, and DTW piling many tokens onto
    // one frame in the middle of a window.
    terminal: starts.filter(isTerminal).length,
    pastEnd: starts.filter((start) => start >= durationSeconds).length,
    stacked: starts.filter((start) => (seen.get(start) ?? 0) > 1).length,
    at,
  };
};

const whisperChunkCount = (
  sampleCount: number,
  chunkLengthSeconds: number,
  strideLengthSeconds: number,
) => {
  const windowSamples = WHISPER_SAMPLE_RATE * chunkLengthSeconds;
  const jumpSamples =
    windowSamples - WHISPER_SAMPLE_RATE * strideLengthSeconds * 2;
  if (sampleCount <= windowSamples || jumpSamples <= 0) {
    return 1;
  }
  return Math.ceil((sampleCount - windowSamples) / jumpSamples) + 1;
};

// A dedicated Worker does not expose Window even though the renderer tsconfig
// includes DOM globals.
// eslint-disable-next-line no-restricted-globals
const workerScope = self as unknown as {
  location: Location;
  postMessage: (message: Record<string, unknown>) => void;
  addEventListener: (
    type: 'message',
    listener: (event: MessageEvent<IWorkerRequest>) => void,
  ) => void;
};

const send = (id: string, type: string, payload?: Record<string, unknown>) =>
  workerScope.postMessage({ id, type, ...payload });

const errorDetail = (error: unknown): string =>
  error instanceof Error ? `${error.name}: ${error.message}` : String(error);

const isTimestampFailure = (error: unknown): boolean =>
  /cross.?attention|alignment_heads|return_timestamps|ending timestamp|timestamp.*processor/i.test(
    errorDetail(error),
  );

const configureRuntime = () => {
  env.allowLocalModels = true;
  env.allowRemoteModels = true;
  const backend = env.backends.onnx.wasm;
  if (!backend) {
    throw new Error(
      'The local speech-recognition WASM backend is unavailable.',
    );
  }
  backend.wasmPaths = {
    wasm: new URL(wasmUrl, workerScope.location.href).href,
    mjs: new URL(runtimeUrl, workerScope.location.href).href,
  };
};

const loadRecognizer = async (
  id: string,
  downloadedAtStart: boolean,
): Promise<IRecognizer> => {
  if (recognizer) {
    send(id, 'progress', {
      progress: 0.52,
      stage: 'load',
      message: 'Speech model is ready in memory',
    });
    return recognizer;
  }
  configureRuntime();
  if (!recognizerTask) {
    const progressCallback = (event: unknown) => {
      send(id, 'model-progress', {
        event,
        downloadedAtStart,
      });
    };
    // WebGPU first: turbo on a GPU transcribes minutes of audio in seconds,
    // and this machine class is why the model could grow at all. WASM q8
    // remains the everywhere-fallback — slow is a mode, broken is not.
    recognizerTask = (
      (async () => {
        try {
          return await pipeline('automatic-speech-recognition', MODEL, {
            dtype: 'q4f16',
            device: 'webgpu',
            progress_callback: progressCallback,
          });
        } catch {
          return pipeline('automatic-speech-recognition', MODEL, {
            dtype: 'q8',
            device: 'wasm',
            progress_callback: progressCallback,
          });
        }
      })() as unknown as Promise<IRecognizer>
    )
      .then((loaded) => {
        recognizer = loaded;
        return loaded;
      })
      .finally(() => {
        recognizerTask = undefined;
      });
  }
  return recognizerTask;
};

/** Whisper's native window. Anything longer is stitched, by us or by it. */
const WINDOW_SECONDS = 30;
/** Overlap so a word straddling a seam is heard whole by one of the windows. */
const WINDOW_OVERLAP_SECONDS = 2;

/**
 * Transcribe a long take as a sequence of single-window decodes.
 *
 * Handing the pipeline the whole song and letting it chunk was the problem it
 * looked like a solution to. Measured on one four-minute song, the isolated
 * voice and the released mix — two entirely different signals — came back with
 * the same 150 words and the same six broken timestamps, 68.32, 109.98,
 * 143.48, 189.98, 203.56 and 229.98. Output that does not vary with the audio
 * is not a reading of the audio: after the first minute the library's chunk
 * stitching stops tracking the file and emits structure instead of speech.
 *
 * A window Whisper's own size needs no stitching. Each decode is the case the
 * model is built for, and the only arithmetic left is adding the window's own
 * offset — the stem shares the song's timeline, so that is all a position is.
 */
const transcribeInWindows = async (
  loaded: IRecognizer,
  samples: Float32Array,
  language: string | undefined,
  onWindow: () => void,
): Promise<IWhisperOutput> => {
  // A window is the model's own 30 s, of which the middle is this window's to
  // report and a second at each end is context it may hear but not claim.
  const overlapSamples = WHISPER_SAMPLE_RATE * WINDOW_OVERLAP_SECONDS;
  const stepSamples = WHISPER_SAMPLE_RATE * WINDOW_SECONDS - overlapSamples * 2;
  const chunks: IWhisperChunk[] = [];
  const texts: string[] = [];
  for (let owned = 0; owned < samples.length; owned += stepSamples) {
    // Context on both sides of the part this window is responsible for. The
    // overlap used to run forwards only, so the next window began exactly on
    // the seam with no lead-in: a word straddling it was discarded by the
    // window that heard it whole and offered to one that heard only its tail.
    // Nine seams in a four-minute song, nine chances to lose or double a word.
    const start = Math.max(0, owned - overlapSamples);
    const end = Math.min(samples.length, owned + stepSamples + overlapSamples);
    const offsetSeconds = start / WHISPER_SAMPLE_RATE;
    const ownedFrom = owned / WHISPER_SAMPLE_RATE;
    // Each window reports only the span it owns, so the context it was given
    // on either side informs the recognition without being reported twice.
    const ownedUntil =
      end >= samples.length
        ? Number.POSITIVE_INFINITY
        : (owned + stepSamples) / WHISPER_SAMPLE_RATE;
    // eslint-disable-next-line no-await-in-loop
    const output = await loaded(samples.slice(start, end), {
      return_timestamps: 'word',
      chunk_length_s: WINDOW_SECONDS,
      stride_length_s: 0,
      force_full_sequences: false,
      language,
      task: 'transcribe',
    });
    (output.chunks ?? []).forEach((chunk) => {
      const from = chunk.timestamp?.[0];
      const to = chunk.timestamp?.[1];
      if (typeof from !== 'number') {
        return;
      }
      const at = offsetSeconds + from;
      if (at < ownedFrom || at >= ownedUntil) {
        return;
      }
      chunks.push({
        text: chunk.text,
        timestamp: [at, typeof to === 'number' ? offsetSeconds + to : null],
      });
    });
    if (output.text) {
      texts.push(output.text);
    }
    onWindow();
    if (end >= samples.length) {
      break;
    }
  }
  return { text: texts.join(' '), chunks };
};

const transcribe = async (request: IWorkerRequest) => {
  const { id } = request;
  if (!request.samples) {
    throw new Error('The decoded audio samples are missing.');
  }
  const loaded = await loadRecognizer(id, request.downloadedAtStart === true);
  // Run one canonical decode. The old implementation decoded the complete
  // song three times with different window sizes, which tripled latency and
  // produced mutually contradictory word streams. A 30 s window with the
  // standard 5 s overlap gives Whisper enough phrase context while preserving
  // every boundary once in the final chronological transcript.
  const profile = { chunkLength: 30, strideLength: 5 };
  send(id, 'ready');
  const results: Array<{
    output: IWhisperOutput;
    approximateSegmentWords: boolean;
  }> = [];
  const totalChunks = whisperChunkCount(
    request.samples.length,
    profile.chunkLength,
    profile.strideLength,
  );
  let reportedChunks = 0;
  // The segmentation pass is a second walk over the same windows, so the bar
  // has to share its span with it. Reporting both against pass one's range
  // left it pinned at the end for the length of an entire extra decode, which
  // reads as a hang and is what makes somebody cancel a run that is working.
  const passes = request.wantSegments ? 2 : 1;
  let pass = 1;
  const reportProgress = (completedChunks: number) => {
    reportedChunks = Math.max(reportedChunks, completedChunks);
    const fraction = Math.min(1, reportedChunks / totalChunks);
    const span = 0.44 / passes;
    send(id, 'progress', {
      progress: 0.52 + span * (pass - 1) + fraction * span,
      stage: 'transcribe',
      message: 'Detecting lyric timing',
      pass,
      totalPasses: passes,
      completedChunks: reportedChunks,
      totalChunks,
    });
  };
  const beginSegmentPass = () => {
    pass = 2;
    reportedChunks = 0;
    reportProgress(0);
  };
  const progressStreamer = () => {
    let completedChunks = 0;
    return {
      put: (_value: bigint[][]) => undefined,
      end: () => {
        completedChunks += 1;
        reportProgress(completedChunks);
      },
    };
  };
  reportProgress(0);
  try {
    let completedWindows = 0;
    const output = await transcribeInWindows(
      loaded,
      request.samples,
      request.language,
      () => {
        completedWindows += 1;
        reportProgress(completedWindows);
      },
    );
    reportProgress(totalChunks);
    send(id, 'timestamp-health', {
      words: output.chunks?.length ?? 0,
      ...unplacedWordCount(
        output,
        profile.chunkLength,
        profile.strideLength,
        request.samples.length / WHISPER_SAMPLE_RATE,
      ),
    });
    results.push({ output, approximateSegmentWords: false });
  } catch (error) {
    if (!isTimestampFailure(error)) {
      throw error;
    }
    send(id, 'timestamp-fallback', {
      error: errorDetail(error),
      pass: 1,
    });
    // Only retry when the timestamp head itself rejects the final partial
    // audio chunk. The fallback still yields one transcript, with conservative
    // word durations distributed inside its recognized segments.
    try {
      const output = await loaded(request.samples, {
        return_timestamps: true,
        chunk_length_s: profile.chunkLength,
        stride_length_s: profile.strideLength,
        force_full_sequences: false,
        language: request.language,
        task: 'transcribe',
        streamer: progressStreamer(),
      });
      reportProgress(totalChunks);
      results.push({ output, approximateSegmentWords: true });
    } catch (fallbackError) {
      throw new Error(`Whisper timing failed. ${errorDetail(fallbackError)}`);
    }
  }
  if (request.wantSegments && results.length) {
    try {
      beginSegmentPass();
      // When the word pass failed, the fallback already decoded with
      // `return_timestamps: true` — its chunks are the segments. Decoding a
      // third time would spend another full pass to learn what is in hand.
      const segmented = results[0].approximateSegmentWords
        ? results[0].output
        : await loaded(request.samples, {
            return_timestamps: true,
            chunk_length_s: profile.chunkLength,
            stride_length_s: profile.strideLength,
            force_full_sequences: false,
            language: request.language,
            task: 'transcribe',
            streamer: progressStreamer(),
          });
      const segments = (segmented.chunks ?? []).flatMap((chunk) => {
        const start = chunk.timestamp?.[0];
        const end = chunk.timestamp?.[1];
        return typeof start === 'number' && typeof end === 'number'
          ? [{ startMs: start * 1_000, endMs: end * 1_000 }]
          : [];
      });
      send(id, 'segments', { segments });
    } catch (error) {
      // Line breaks fall back to what the words themselves show.
      send(id, 'segments', { segments: [], error: errorDetail(error) });
    }
  }
  send(id, 'complete', { results });
};

workerScope.addEventListener(
  'message',
  (event: MessageEvent<IWorkerRequest>) => {
    const request = event.data;
    if (request.type === 'release') {
      const active = recognizer;
      recognizer = undefined;
      Promise.resolve(active?.dispose?.())
        .then(() => send(request.id, 'released'))
        .catch((error) =>
          send(request.id, 'error', { error: errorDetail(error) }),
        );
      return;
    }
    transcribe(request).catch((error) =>
      send(request.id, 'error', { error: errorDetail(error) }),
    );
  },
);
