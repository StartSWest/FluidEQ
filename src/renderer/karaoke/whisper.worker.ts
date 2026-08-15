/* FluidEQ Karaoke Maker speech-recognition worker. GPL-3.0-or-later. */

import wasmUrl from '@fluideq/whisper-wasm';
import runtimeUrl from '@fluideq/whisper-runtime';
import { env, pipeline } from '@huggingface/transformers';

const MODEL = 'onnx-community/whisper-base_timestamped';

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
}

let recognizer: IRecognizer | undefined;
let recognizerTask: Promise<IRecognizer> | undefined;

const WHISPER_SAMPLE_RATE = 16_000;

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
    recognizerTask = (
      pipeline('automatic-speech-recognition', MODEL, {
        dtype: 'q8',
        device: 'wasm',
        progress_callback: (event: unknown) => {
          send(id, 'model-progress', {
            event,
            downloadedAtStart,
          });
        },
      }) as unknown as Promise<IRecognizer>
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
  const reportProgress = (completedChunks: number) => {
    reportedChunks = Math.max(reportedChunks, completedChunks);
    const fraction = Math.min(1, reportedChunks / totalChunks);
    send(id, 'progress', {
      progress: 0.52 + fraction * 0.44,
      stage: 'transcribe',
      message: 'Detecting lyric timing',
      pass: 1,
      totalPasses: 1,
      completedChunks: reportedChunks,
      totalChunks,
    });
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
    const output = await loaded(request.samples, {
      return_timestamps: 'word',
      chunk_length_s: profile.chunkLength,
      stride_length_s: profile.strideLength,
      force_full_sequences: false,
      language: request.language,
      task: 'transcribe',
      streamer: progressStreamer(),
    });
    reportProgress(totalChunks);
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
