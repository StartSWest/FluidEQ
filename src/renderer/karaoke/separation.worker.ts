/* FluidEQ Karaoke Maker vocal-separation worker. GPL-3.0-or-later. */

import * as ort from 'onnxruntime-web';
import {
  SEPARATION_CHUNK_SAMPLES,
  SEPARATION_FRAMES,
  SEPARATION_FREQ_BINS,
  SEPARATION_PACKED_ROWS,
  SEPARATION_STEP_SAMPLES,
  separationApplyMask,
  separationHammingWindow,
  separationIstft,
  separationNormalisationGain,
  separationPackedRow,
  separationStft,
} from '../../common/karaoke/separationDsp';

interface IWorkerRequest {
  id: string;
  type: 'separate' | 'release';
  left?: Float32Array;
  right?: Float32Array;
  /** The model graph and its external weights, already fetched and cached. */
  graph?: ArrayBuffer;
  weights?: ArrayBuffer;
  weightsPath?: string;
  preferGpu?: boolean;
}

// A dedicated Worker does not expose Window even though the renderer tsconfig
// includes DOM globals.
// eslint-disable-next-line no-restricted-globals
const workerScope = self as unknown as {
  location: Location;
  postMessage: (
    message: Record<string, unknown>,
    transfer?: Transferable[],
  ) => void;
  addEventListener: (
    type: 'message',
    listener: (event: MessageEvent<IWorkerRequest>) => void,
  ) => void;
};

const send = (id: string, type: string, payload?: Record<string, unknown>) =>
  workerScope.postMessage({ id, type, ...payload });

const errorDetail = (error: unknown): string =>
  error instanceof Error ? `${error.name}: ${error.message}` : String(error);

let session: ort.InferenceSession | undefined;
let sessionBackend = '';

/**
 * Create the inference session, preferring WebGPU by a wide margin.
 *
 * The export is built for WebGPU and the gap is not subtle: 0.82 s per chunk
 * there against 11.5 s on DirectML and 12.4 s on CPU, because the other
 * backends fall back to CPU for most of the graph. WASM still works and is
 * kept as the fallback — six minutes for a song is slow but it is not broken,
 * and refusing to run at all on a machine without a GPU would be worse.
 */
const loadSession = async (
  request: IWorkerRequest,
): Promise<ort.InferenceSession> => {
  if (session) {
    return session;
  }
  if (!request.graph || !request.weights) {
    throw new Error('The separation model was not supplied to the worker.');
  }
  // Tell ONNX Runtime where its own WASM lives before creating a session.
  //
  // It defaults to fetching `ort-wasm-simd-threaded.jsep.wasm` from a CDN
  // relative to the script, which this app neither ships nor permits: the
  // content security policy allows the model hosts and nothing else, so the
  // request is refused and session creation fails with a message about the
  // backend rather than about the network. Webpack emits both files next to
  // the app under a stable name, which is what these point at.
  const wasmBackend = ort.env.wasm;
  if (wasmBackend) {
    wasmBackend.wasmPaths = {
      wasm: new URL(
        'karaoke-models/whisper/ort-wasm-simd-threaded.jsep.wasm',
        workerScope.location.href,
      ).href,
      mjs: new URL(
        'karaoke-models/whisper/ort-wasm-simd-threaded.jsep.mjs',
        workerScope.location.href,
      ).href,
    };
  }

  const externalData = [
    {
      path: request.weightsPath ?? 'syhft_core_folded_fp16_webgpu.onnx.data',
      data: request.weights,
    },
  ];
  const backends: ort.InferenceSession.ExecutionProviderConfig[] =
    request.preferGpu === false ? ['wasm'] : ['webgpu', 'wasm'];
  let lastError: unknown;
  for (let index = 0; index < backends.length; index += 1) {
    const backend = backends[index];
    try {
      // Sequential on purpose: the fallback only runs when the preferred
      // backend has actually failed, and creating two sessions for a 700MB
      // model at once would hold both in memory to discard one.
      // eslint-disable-next-line no-await-in-loop
      session = await ort.InferenceSession.create(request.graph, {
        executionProviders: [backend],
        externalData,
      });
      sessionBackend = String(backend);
      return session;
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(
    `The separation model could not be loaded. ${errorDetail(lastError)}`,
  );
};

/**
 * Separate one song into a vocal stem and everything else.
 *
 * The instrumental is the original minus the vocals rather than a second pass:
 * the model emits one mask, and subtracting what it found is both exact — the
 * two stems sum back to the input sample for sample — and half the work.
 */
const separate = async (request: IWorkerRequest) => {
  const { id } = request;
  const { left } = request;
  const { right } = request;
  if (!left || !right) {
    throw new Error('The decoded audio channels are missing.');
  }
  const loaded = await loadSession(request);
  send(id, 'ready', { backend: sessionBackend });

  const total = left.length;
  // Bring the song inside the range the model was trained on, and divide it
  // back out at the end so the stems come back at the original level.
  const gain = separationNormalisationGain(left, right);
  const vocalsLeft = new Float64Array(total);
  const vocalsRight = new Float64Array(total);
  const weightSum = new Float64Array(total);
  const taper = separationHammingWindow(SEPARATION_CHUNK_SAMPLES);
  const feed = new Float32Array(SEPARATION_PACKED_ROWS * SEPARATION_FRAMES * 2);

  const starts: number[] = [];
  for (let start = 0; start < total; start += SEPARATION_STEP_SAMPLES) {
    starts.push(start);
  }

  const chunkLeft = new Float64Array(SEPARATION_CHUNK_SAMPLES);
  const chunkRight = new Float64Array(SEPARATION_CHUNK_SAMPLES);

  for (let index = 0; index < starts.length; index += 1) {
    const start = starts[index];
    chunkLeft.fill(0);
    chunkRight.fill(0);
    for (let i = 0; i < SEPARATION_CHUNK_SAMPLES && start + i < total; i += 1) {
      chunkLeft[i] = left[start + i] * gain;
      chunkRight[i] = right[start + i] * gain;
    }
    const spectra = [separationStft(chunkLeft), separationStft(chunkRight)];

    for (let channel = 0; channel < 2; channel += 1) {
      const source = spectra[channel];
      for (let bin = 0; bin < SEPARATION_FREQ_BINS; bin += 1) {
        const row = separationPackedRow(channel, bin);
        for (let frame = 0; frame < SEPARATION_FRAMES; frame += 1) {
          const target = (row * SEPARATION_FRAMES + frame) * 2;
          const sourceIndex = frame * SEPARATION_FREQ_BINS + bin;
          feed[target] = source.real[sourceIndex];
          feed[target + 1] = source.imaginary[sourceIndex];
        }
      }
    }

    // eslint-disable-next-line no-await-in-loop
    const output = await loaded.run({
      stft_repr: new ort.Tensor('float32', feed, [
        1,
        SEPARATION_PACKED_ROWS,
        SEPARATION_FRAMES,
        2,
      ]),
    });
    const mask = output.masks.data as Float32Array;

    for (let channel = 0; channel < 2; channel += 1) {
      const source = spectra[channel];
      const maskReal = new Float32Array(
        SEPARATION_FRAMES * SEPARATION_FREQ_BINS,
      );
      const maskImaginary = new Float32Array(
        SEPARATION_FRAMES * SEPARATION_FREQ_BINS,
      );
      for (let bin = 0; bin < SEPARATION_FREQ_BINS; bin += 1) {
        const row = separationPackedRow(channel, bin);
        for (let frame = 0; frame < SEPARATION_FRAMES; frame += 1) {
          const packed = (row * SEPARATION_FRAMES + frame) * 2;
          const target = frame * SEPARATION_FREQ_BINS + bin;
          maskReal[target] = mask[packed];
          maskImaginary[target] = mask[packed + 1];
        }
      }
      separationApplyMask(source, maskReal, maskImaginary);
    }

    const stemLeft = separationIstft(
      spectra[0].real,
      spectra[0].imaginary,
      SEPARATION_CHUNK_SAMPLES,
    );
    const stemRight = separationIstft(
      spectra[1].real,
      spectra[1].imaginary,
      SEPARATION_CHUNK_SAMPLES,
    );
    for (let i = 0; i < SEPARATION_CHUNK_SAMPLES && start + i < total; i += 1) {
      const weight = taper[i];
      vocalsLeft[start + i] += stemLeft[i] * weight;
      vocalsRight[start + i] += stemRight[i] * weight;
      weightSum[start + i] += weight;
    }
    send(id, 'progress', {
      progress: (index + 1) / starts.length,
      completedChunks: index + 1,
      totalChunks: starts.length,
    });
  }

  const outVocalsLeft = new Float32Array(total);
  const outVocalsRight = new Float32Array(total);
  const outMusicLeft = new Float32Array(total);
  const outMusicRight = new Float32Array(total);
  for (let i = 0; i < total; i += 1) {
    // The taper sums to less than one wherever only a single chunk covers a
    // sample — the first and last few seconds — so normalise rather than
    // assume, or the song fades in and out.
    const weight = (weightSum[i] > 1e-6 ? weightSum[i] : 1) * gain;
    const vocalLeft = vocalsLeft[i] / weight;
    const vocalRight = vocalsRight[i] / weight;
    outVocalsLeft[i] = vocalLeft;
    outVocalsRight[i] = vocalRight;
    outMusicLeft[i] = left[i] - vocalLeft;
    outMusicRight[i] = right[i] - vocalRight;
  }

  send(id, 'complete', {
    vocalsLeft: outVocalsLeft,
    vocalsRight: outVocalsRight,
    musicLeft: outMusicLeft,
    musicRight: outMusicRight,
    backend: sessionBackend,
  });
};

workerScope.addEventListener(
  'message',
  (event: MessageEvent<IWorkerRequest>) => {
    const request = event.data;
    if (request.type === 'release') {
      const active = session;
      session = undefined;
      Promise.resolve(active?.release?.())
        .then(() => send(request.id, 'released'))
        .catch((error) =>
          send(request.id, 'error', { error: errorDetail(error) }),
        );
      return;
    }
    separate(request).catch((error) =>
      send(request.id, 'error', { error: errorDetail(error) }),
    );
  },
);
