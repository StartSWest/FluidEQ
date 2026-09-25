/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { app, ipcMain } from 'electron';
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import log from 'electron-log';
import ort, { onInferenceInvalidated } from './nativeInference';
import withRendererOperation from './rendererOperation';
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
} from '../common/karaoke/separationDsp';
import { scheduleWriteOperation } from './asyncWriter';
import onWindowMessage from './ipc/windowMessages';
import { saveDownload } from './modelDownload';

/**
 * Vocal separation, with native ONNX calls isolated in a utility process.
 *
 * It lived in a renderer worker on onnxruntime-web first, and that version is
 * gone for a reason worth recording: session creation died with a bare
 * Emscripten abort — a number, no message, nothing on the console, identical
 * on the WebGPU and plain-WASM paths — and a production Emscripten build
 * strips the assertions that would have said why. Meanwhile the same model on
 * the same machine ran perfectly on the native runtime: 0.82 s per 11 s chunk
 * on WebGPU against 12.4 s on CPU, measured before any of this was wired in.
 * An opaque runtime that fails silently lost to a native one that was already
 * proven, and inference moved here.
 *
 * The renderer still does everything except inference: decoding, the WAV
 * encode, and the UI. What crosses the IPC boundary is four Float32 channels
 * in and four out, plus progress events.
 */

const MODEL_BASE =
  'https://huggingface.co/silverdaw/mel-band-roformer-vocals-onnx/resolve/main';
const MODEL_FILE = 'syhft_core_folded_fp16_webgpu.onnx';
const WEIGHTS_FILE = `${MODEL_FILE}.data`;

/** Where the two model files live on disk, downloaded once and kept. */
const modelDir = () => path.join(app.getPath('userData'), 'karaoke-models');

/** Where separated songs' stems are kept, two WAVs per song. */
export const karaokeStemsDir = () =>
  path.join(app.getPath('userData'), 'karaoke-stems');

type TOnnxSession = {
  release?: () => Promise<void> | void;
  run: (
    feeds: Record<string, unknown>,
  ) => Promise<Record<string, { data: Float32Array }>>;
};

let session: TOnnxSession | undefined;
let sessionBackend = '';
let cancelRequested = false;
onInferenceInvalidated(() => {
  session = undefined;
  sessionBackend = '';
});

/** Whether the separation network is resident right now. */
export const isSeparationLoaded = () => session !== undefined;

/**
 * The two files this network is made of, measured on disk.
 *
 * Both, always: the graph without its external weights is a 5MB file that
 * fails at session creation, so reporting the graph alone would describe a
 * five-megabyte model that is in fact seven hundred.
 */
export const separationWeightBytes = (): number =>
  [MODEL_FILE, WEIGHTS_FILE].reduce((total, name) => {
    try {
      return total + fs.statSync(path.join(modelDir(), name)).size;
    } catch {
      return total;
    }
  }, 0);
// True while a separation is in flight, so a release request cannot pull the
// session out from under a run. Written by the separate handler only.
let running = false;

/**
 * Fetch one model file to disk if it is not already there.
 *
 * Written chunk by chunk as it arrives, never streamed through `pipeline` —
 * fetch + pipeline crashes inside Node's HTTP parser when the disk is slower
 * than the socket, and the failure arrives after every byte has been
 * received, which looks exactly like a flaky mirror and is not. See
 * `modelDownload.ts` for how, and for why it is not read whole any more.
 */
const ensureFile = async (
  name: string,
  onBytes: (received: number, total: number) => void,
  signal: AbortSignal,
): Promise<string> => {
  const target = path.join(modelDir(), name);
  if (fs.existsSync(target)) {
    return target;
  }
  await fs.promises.mkdir(modelDir(), { recursive: true });
  const response = await fetch(`${MODEL_BASE}/${name}`, { signal });
  if (!response.ok || !response.body) {
    throw new Error(`Separation model download failed (${response.status}).`);
  }
  await saveDownload({
    body: response.body,
    total: Number(response.headers.get('content-length') ?? 0),
    target,
    onBytes,
  });
  return target;
};

/**
 * Where one song's two stems live, keyed by the song's stable id made safe for
 * a file name.
 */
const stemFiles = (key: unknown) => {
  const dir = karaokeStemsDir();
  const safe = String(key)
    .replace(/[^a-z0-9-]/gi, '_')
    .slice(0, 80);
  return {
    dir,
    vocals: path.join(dir, `${safe}-vocals.wav`),
    instrumental: path.join(dir, `${safe}-instrumental.wav`),
  };
};

/**
 * One stem, written beside its file and renamed over it, so a stem is never
 * half there.
 *
 * In turn with any other save of the same file, and inside the quit's wait
 * (`scheduleWriteOperation`, `flushPendingWrites`): stems used to be written
 * synchronously, which a quit right after a split could not cut short, and an
 * asynchronous write it could. Its temporary is named the way `asyncWriter`
 * names its own, so one left by a run killed mid-write — End task, a crash, a
 * power cut — is swept at the next launch (`sweepAbandonedWrites`) instead of
 * staying behind, tens of megabytes at a time.
 */
const writeStem = (file: string, bytes: ArrayBuffer): Promise<void> =>
  scheduleWriteOperation(file, async () => {
    const temporary = `${file}.${process.pid}-${randomUUID()}.tmp`;
    try {
      await fs.promises.writeFile(temporary, Buffer.from(bytes));
      await fs.promises.rename(temporary, file);
    } finally {
      await fs.promises.rm(temporary, { force: true });
    }
  });

const isMissingFile = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  (error as { code: unknown }).code === 'ENOENT';

/**
 * The inference session, created once and kept.
 *
 * The weights file is found by the runtime itself: ONNX external data is
 * resolved relative to the model path, so keeping both files in one directory
 * under their original names is the entire wiring. Backends are tried in the
 * order the bench ranked them — WebGPU at 0.82 s per chunk, DirectML at
 * 11.5 s, CPU at 12.4 s — and the one that loads is reported to the renderer
 * so a slow run can say why it is slow.
 */
const loadSession = async (
  modelPath: string,
  assertCurrent: () => void,
): Promise<TOnnxSession> => {
  if (session) {
    return session;
  }
  let lastError: unknown;
  const backends = ['webgpu', 'dml', 'cpu'];
  for (let index = 0; index < backends.length; index += 1) {
    assertCurrent();
    try {
      // eslint-disable-next-line no-await-in-loop
      session = (await ort.InferenceSession.create(modelPath, {
        executionProviders: [backends[index]],
      })) as TOnnxSession;
      sessionBackend = backends[index];
      log.info(`[karaoke][separation] session on ${sessionBackend}`);
      return session;
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(
    `The separation model could not be loaded. ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`,
  );
};

interface ISeparateRequest {
  left: Float32Array;
  right: Float32Array;
}

/** The full chunk loop, identical in shape to the bench that validated it. */
const separate = async (
  request: ISeparateRequest,
  onProgress: (fraction: number) => void,
  assertCurrent: () => void,
) => {
  const modelPath = path.join(modelDir(), MODEL_FILE);
  const loaded = await loadSession(modelPath, assertCurrent);
  assertCurrent();
  const { left, right } = request;
  const total = left.length;

  const gain = separationNormalisationGain(left, right);
  const vocalsLeft = new Float64Array(total);
  const vocalsRight = new Float64Array(total);
  const weightSum = new Float64Array(total);
  const taper = separationHammingWindow(SEPARATION_CHUNK_SAMPLES);
  const feed = new Float32Array(SEPARATION_PACKED_ROWS * SEPARATION_FRAMES * 2);
  const chunkLeft = new Float64Array(SEPARATION_CHUNK_SAMPLES);
  const chunkRight = new Float64Array(SEPARATION_CHUNK_SAMPLES);

  const starts: number[] = [];
  for (let start = 0; start < total; start += SEPARATION_STEP_SAMPLES) {
    starts.push(start);
  }

  for (let index = 0; index < starts.length; index += 1) {
    assertCurrent();
    if (cancelRequested) {
      throw new Error('cancelled');
    }
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
          const targetIndex = (row * SEPARATION_FRAMES + frame) * 2;
          const sourceIndex = frame * SEPARATION_FREQ_BINS + bin;
          feed[targetIndex] = source.real[sourceIndex];
          feed[targetIndex + 1] = source.imaginary[sourceIndex];
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
    const mask = output.masks.data;
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
    onProgress((index + 1) / starts.length);
  }

  const outVocalsLeft = new Float32Array(total);
  const outVocalsRight = new Float32Array(total);
  const outMusicLeft = new Float32Array(total);
  const outMusicRight = new Float32Array(total);
  for (let i = 0; i < total; i += 1) {
    const weight = (weightSum[i] > 1e-6 ? weightSum[i] : 1) * gain;
    const vocalLeft = vocalsLeft[i] / weight;
    const vocalRight = vocalsRight[i] / weight;
    outVocalsLeft[i] = vocalLeft;
    outVocalsRight[i] = vocalRight;
    outMusicLeft[i] = left[i] - vocalLeft;
    outMusicRight[i] = right[i] - vocalRight;
  }
  return {
    vocalsLeft: outVocalsLeft,
    vocalsRight: outVocalsRight,
    musicLeft: outMusicLeft,
    musicRight: outMusicRight,
    backend: sessionBackend,
  };
};

/** Wire the channels. Called once from main during startup. */
export const registerKaraokeSeparation = () => {
  ipcMain.handle('karaoke-separate', (event, request: ISeparateRequest) =>
    withRendererOperation(event, async (assertCurrent, signal) => {
      if (running) {
        throw new Error('Vocal separation is already running');
      }
      running = true;
      cancelRequested = false;
      const report = (stage: string, fraction: number) => {
        assertCurrent();
        if (!event.sender.isDestroyed()) {
          event.sender.send('karaoke-separate-progress', { stage, fraction });
        }
      };
      try {
        await ensureFile(MODEL_FILE, () => report('download', 0.01), signal);
        await ensureFile(
          WEIGHTS_FILE,
          (received, totalBytes) =>
            report('download', totalBytes > 0 ? received / totalBytes : 0),
          signal,
        );
        report('separate', 0);
        const result = await separate(
          request,
          (fraction) => report('separate', fraction),
          assertCurrent,
        );
        return result;
      } catch (error) {
        log.error('[karaoke][separation] failed', error);
        throw error;
      } finally {
        running = false;
      }
    }),
  );
  onWindowMessage('karaoke-separate-cancel', () => {
    cancelRequested = true;
  });
  // The model holds GPU memory worth reclaiming once the user has moved on.
  // Releasing is cheap to undo — the files stay on disk and a fresh session
  // loads in seconds — so the renderer may call this freely; a run in flight
  // is the one thing that must never be pulled out from under itself.
  // The stems a split produces are kept on disk and handed back on the next
  // launch, so a refresh does not cost forty seconds of GPU work the machine
  // already did. Keyed by the song's stable id; two WAVs per song — tens of
  // megabytes each for a long one, which is why they are written and read
  // without holding main while the disk works.
  ipcMain.handle(
    'karaoke-stems-save',
    async (
      _event,
      request: { key: string; vocals: ArrayBuffer; instrumental: ArrayBuffer },
    ) => {
      const files = stemFiles(request.key);
      await fs.promises.mkdir(files.dir, { recursive: true });
      await Promise.all([
        writeStem(files.vocals, request.vocals),
        writeStem(files.instrumental, request.instrumental),
      ]);
    },
  );
  ipcMain.handle('karaoke-stems-load', async (_event, key: string) => {
    const files = stemFiles(key);
    try {
      const [vocals, instrumental] = await Promise.all([
        fs.promises.readFile(files.vocals),
        fs.promises.readFile(files.instrumental),
      ]);
      return { vocals, instrumental };
    } catch (error) {
      // A song with either stem missing has not been split here; anything
      // else is a failure the window is told about.
      if (isMissingFile(error)) {
        return null;
      }
      throw error;
    }
  });
  onWindowMessage('karaoke-separate-release', () => {
    if (running || !session) {
      return;
    }
    Promise.resolve(session.release?.()).catch(() => undefined);
    session = undefined;
    log.info('[karaoke][separation] session released');
  });
};
