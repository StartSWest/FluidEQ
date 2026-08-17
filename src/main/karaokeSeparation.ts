/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { app, ipcMain } from 'electron';
import fs from 'fs';
import path from 'path';
import log from 'electron-log';
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

/**
 * Vocal separation, run in the main process on the native ONNX runtime.
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

type TOnnxSession = {
  release?: () => Promise<void> | void;
  run: (
    feeds: Record<string, unknown>,
  ) => Promise<Record<string, { data: Float32Array }>>;
};

let session: TOnnxSession | undefined;
let sessionBackend = '';
let cancelRequested = false;
const running = false;

/**
 * Fetch one model file to disk if it is not already there.
 *
 * Read whole and then written, never streamed through `pipeline` — fetch +
 * pipeline crashes inside Node's HTTP parser when the disk is slower than the
 * socket, and the failure arrives after every byte has been received, which
 * looks exactly like a flaky mirror and is not.
 */
const ensureFile = async (
  name: string,
  onBytes: (received: number, total: number) => void,
): Promise<string> => {
  const target = path.join(modelDir(), name);
  if (fs.existsSync(target)) {
    return target;
  }
  fs.mkdirSync(modelDir(), { recursive: true });
  const response = await fetch(`${MODEL_BASE}/${name}`);
  if (!response.ok || !response.body) {
    throw new Error(`Separation model download failed (${response.status}).`);
  }
  const total = Number(response.headers.get('content-length') ?? 0);
  const reader = response.body.getReader();
  const parts: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    // eslint-disable-next-line no-await-in-loop
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    parts.push(value);
    received += value.length;
    onBytes(received, total);
  }
  // Written to a temporary name and renamed, so a crash mid-write cannot
  // leave a truncated file that looks cached forever after.
  const temporary = `${target}.download`;
  fs.writeFileSync(temporary, Buffer.concat(parts));
  fs.renameSync(temporary, target);
  return target;
};

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
const loadSession = async (modelPath: string): Promise<TOnnxSession> => {
  if (session) {
    return session;
  }
  // Lazy so the app does not pay for the native runtime at startup, and so a
  // machine that never touches Karaoke never loads it at all.
  // eslint-disable-next-line global-require
  const ort = require('onnxruntime-node');
  let lastError: unknown;
  const backends = ['webgpu', 'dml', 'cpu'];
  for (let index = 0; index < backends.length; index += 1) {
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
) => {
  // eslint-disable-next-line global-require
  const ort = require('onnxruntime-node');
  const modelPath = path.join(modelDir(), MODEL_FILE);
  const loaded = await loadSession(modelPath);
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
  ipcMain.handle(
    'karaoke-separate',
    async (event, request: ISeparateRequest) => {
      cancelRequested = false;
      const report = (stage: string, fraction: number) => {
        if (!event.sender.isDestroyed()) {
          event.sender.send('karaoke-separate-progress', { stage, fraction });
        }
      };
      await ensureFile(MODEL_FILE, () => report('download', 0.01));
      await ensureFile(WEIGHTS_FILE, (received, totalBytes) =>
        report('download', totalBytes > 0 ? received / totalBytes : 0),
      );
      report('separate', 0);
      try {
        const result = await separate(request, (fraction) =>
          report('separate', fraction),
        );
        return result;
      } catch (error) {
        log.error('[karaoke][separation] failed', error);
        throw error;
      }
    },
  );
  ipcMain.on('karaoke-separate-cancel', () => {
    cancelRequested = true;
  });
  // The model holds GPU memory worth reclaiming once the user has moved on.
  // Releasing is cheap to undo — the files stay on disk and a fresh session
  // loads in seconds — so the renderer may call this freely; a run in flight
  // is the one thing that must never be pulled out from under itself.
  // The stems a split produces are kept on disk and handed back on the next
  // launch, so a refresh does not cost forty seconds of GPU work the machine
  // already did. Keyed by the song's stable id; two small WAVs per song.
  ipcMain.handle(
    'karaoke-stems-save',
    (
      _event,
      request: { key: string; vocals: ArrayBuffer; instrumental: ArrayBuffer },
    ) => {
      const dir = path.join(app.getPath('userData'), 'karaoke-stems');
      fs.mkdirSync(dir, { recursive: true });
      const safe = request.key.replace(/[^a-z0-9-]/gi, '_').slice(0, 80);
      fs.writeFileSync(
        path.join(dir, `${safe}-vocals.wav`),
        Buffer.from(request.vocals),
      );
      fs.writeFileSync(
        path.join(dir, `${safe}-instrumental.wav`),
        Buffer.from(request.instrumental),
      );
    },
  );
  ipcMain.handle('karaoke-stems-load', (_event, key: string) => {
    const dir = path.join(app.getPath('userData'), 'karaoke-stems');
    const safe = String(key)
      .replace(/[^a-z0-9-]/gi, '_')
      .slice(0, 80);
    const vocalsPath = path.join(dir, `${safe}-vocals.wav`);
    const instrumentalPath = path.join(dir, `${safe}-instrumental.wav`);
    if (!fs.existsSync(vocalsPath) || !fs.existsSync(instrumentalPath)) {
      return null;
    }
    return {
      vocals: fs.readFileSync(vocalsPath),
      instrumental: fs.readFileSync(instrumentalPath),
    };
  });
  ipcMain.on('karaoke-separate-release', () => {
    if (running || !session) {
      return;
    }
    Promise.resolve(session.release?.()).catch(() => undefined);
    session = undefined;
    log.info('[karaoke][separation] session released');
  });
};
