/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { app, ipcMain } from 'electron';
import fs from 'fs';
import path from 'path';
import log from 'electron-log';
import { separationFft } from '../common/karaoke/separationDsp';
import { isSeparationLoaded } from './karaokeSeparation';

/**
 * Vocal pitch detection in the main process: RMVPE first, SwiftF0 always.
 *
 * RMVPE is the tracker the voice-conversion world standardised on — trained
 * to find a singing voice's pitch through noise and residue, which is exactly
 * what a separated stem still is. It is 361MB from Hugging Face, downloaded
 * once to disk. SwiftF0 is 398KB of MIT ONNX bundled inside the installer:
 * the answer when the download has not happened yet, is refused, or fails —
 * pitch detection works on a fresh offline install and gets better online.
 *
 * Both contracts were mapped empirically before integration:
 *  - SwiftF0: raw 16kHz audio [1,N] → pitch_hz + confidence per 256-sample
 *    hop. A 440Hz sine reads 437.5 at 0.99.
 *  - RMVPE: log-mel [1,128,T] (T a multiple of 32, hop 160) → salience
 *    [1,T,360] over 20-cent bins. The mel filterbank is HTK, not slaney —
 *    measured, not assumed: slaney decoded a 440Hz sine as 328Hz, HTK as
 *    439.6 at 0.87, with 220 and 110 confirming.
 */

const RMVPE_URL =
  'https://huggingface.co/lj1995/VoiceConversionWebUI/resolve/main/rmvpe.onnx';

const modelDir = () => path.join(app.getPath('userData'), 'karaoke-models');
const rmvpePath = () => path.join(modelDir(), 'rmvpe.onnx');
const swiftPath = () =>
  path.join(
    app.isPackaged
      ? path.join(process.resourcesPath, 'assets')
      : path.join(__dirname, '../../assets'),
    'models/swift-f0.onnx',
  );

const SR = 16_000;
const RMVPE_HOP = 160;
const RMVPE_FFT = 1024;
const MELS = 128;
const FMIN = 30;
const FMAX = 8_000;
/** First cent bin's centre; bins step by 20 cents. From the RMVPE reference. */
const CENTS_FIRST = 1997.3794084376191;
/** U-Net frames per inference; a multiple of 32, ~32 seconds of audio. */
const CHUNK_FRAMES = 3_200;

type TOnnxSession = {
  run: (
    feeds: Record<string, unknown>,
  ) => Promise<Record<string, { data: Float32Array; dims: readonly number[] }>>;
};

let rmvpeSession: TOnnxSession | undefined;
let swiftSession: TOnnxSession | undefined;

/** HTK mel filter bank over the 513 FFT bins, built once. */
let melBankCache: Float64Array[] | undefined;
const melBank = (): Float64Array[] => {
  if (melBankCache) {
    return melBankCache;
  }
  const hzToMel = (hz: number) => 2595 * Math.log10(1 + hz / 700);
  const melToHz = (mel: number) => 700 * (10 ** (mel / 2595) - 1);
  const bins = RMVPE_FFT / 2 + 1;
  const centres = Array.from({ length: MELS + 2 }, (_, index) =>
    melToHz(
      hzToMel(FMIN) + ((hzToMel(FMAX) - hzToMel(FMIN)) * index) / (MELS + 1),
    ),
  );
  melBankCache = Array.from({ length: MELS }, (_, m) => {
    const weights = new Float64Array(bins);
    for (let k = 0; k < bins; k += 1) {
      const hz = (k * SR) / RMVPE_FFT;
      const lower = (hz - centres[m]) / (centres[m + 1] - centres[m]);
      const upper = (centres[m + 2] - hz) / (centres[m + 2] - centres[m + 1]);
      const value = Math.max(0, Math.min(lower, upper));
      weights[k] = (value * 2) / (centres[m + 2] - centres[m]);
    }
    return weights;
  });
  return melBankCache;
};

/** Log-mel of the whole take, laid out [mel][frame]. */
const melSpectrogram = (samples: Float32Array) => {
  const window = new Float64Array(RMVPE_FFT);
  for (let i = 0; i < RMVPE_FFT; i += 1) {
    window[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / RMVPE_FFT);
  }
  const pad = RMVPE_FFT / 2;
  const padded = new Float64Array(samples.length + pad * 2);
  padded.set(samples, pad);
  for (let i = 0; i < pad; i += 1) {
    padded[pad - 1 - i] = samples[Math.min(i + 1, samples.length - 1)] ?? 0;
    padded[pad + samples.length + i] =
      samples[Math.max(samples.length - 2 - i, 0)] ?? 0;
  }
  const frames = 1 + Math.floor(samples.length / RMVPE_HOP);
  const bank = melBank();
  const mel = new Float32Array(MELS * frames);
  const real = new Float64Array(RMVPE_FFT);
  const imaginary = new Float64Array(RMVPE_FFT);
  const power = new Float64Array(RMVPE_FFT / 2 + 1);
  for (let frame = 0; frame < frames; frame += 1) {
    const offset = frame * RMVPE_HOP;
    for (let i = 0; i < RMVPE_FFT; i += 1) {
      real[i] = (padded[offset + i] ?? 0) * window[i];
      imaginary[i] = 0;
    }
    separationFft(real, imaginary, false);
    for (let k = 0; k <= RMVPE_FFT / 2; k += 1) {
      power[k] = real[k] * real[k] + imaginary[k] * imaginary[k];
    }
    for (let m = 0; m < MELS; m += 1) {
      let sum = 0;
      const weights = bank[m];
      for (let k = 0; k <= RMVPE_FFT / 2; k += 1) {
        if (weights[k] !== 0) {
          sum += weights[k] * power[k];
        }
      }
      mel[m * frames + frame] = Math.log(Math.max(sum, 1e-5));
    }
  }
  return { mel, frames };
};

/** Salience [T,360] → f0 and confidence per frame, RMVPE's own decode. */
const decodeSalience = (
  salience: Float32Array,
  frames: number,
  f0: Float32Array,
  confidence: Float32Array,
  targetOffset: number,
) => {
  for (let t = 0; t < frames; t += 1) {
    let best = 0;
    let bestIndex = 0;
    for (let i = 0; i < 360; i += 1) {
      const value = salience[t * 360 + i];
      if (value > best) {
        best = value;
        bestIndex = i;
      }
    }
    confidence[targetOffset + t] = best;
    if (best < 0.03) {
      f0[targetOffset + t] = 0;
    } else {
      let weighted = 0;
      let total = 0;
      const from = Math.max(0, bestIndex - 4);
      const to = Math.min(359, bestIndex + 4);
      for (let i = from; i <= to; i += 1) {
        const value = salience[t * 360 + i];
        weighted += value * (20 * i + CENTS_FIRST);
        total += value;
      }
      f0[targetOffset + t] = 10 * 2 ** (weighted / total / 1200);
    }
  }
};

/** Download RMVPE once, atomically, reporting bytes to the renderer. */
const ensureRmvpe = async (
  onBytes: (received: number, total: number) => void,
): Promise<string> => {
  const target = rmvpePath();
  if (fs.existsSync(target)) {
    return target;
  }
  fs.mkdirSync(modelDir(), { recursive: true });
  const response = await fetch(RMVPE_URL);
  if (!response.ok || !response.body) {
    throw new Error(`RMVPE download failed (${response.status}).`);
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
  // A temporary name and a rename, so a crash mid-write cannot leave a
  // truncated file that looks cached forever after.
  const temporary = `${target}.download`;
  fs.writeFileSync(temporary, Buffer.concat(parts));
  fs.renameSync(temporary, target);
  return target;
};

const runRmvpe = async (
  samples: Float32Array,
  onProgress: (fraction: number) => void,
) => {
  // eslint-disable-next-line global-require
  const ort = require('onnxruntime-node');
  if (!rmvpeSession) {
    // The same backend ladder separation climbs: WebGPU carried that model
    // fourteen times faster than CPU on this machine, and RMVPE is the same
    // kind of network. Whichever rung loads is logged, so a slow run says
    // why it is slow.
    const backends = ['webgpu', 'dml', 'cpu'];
    let lastError: unknown;
    for (let index = 0; index < backends.length; index += 1) {
      try {
        // eslint-disable-next-line no-await-in-loop
        rmvpeSession = (await ort.InferenceSession.create(rmvpePath(), {
          executionProviders: [backends[index]],
        })) as TOnnxSession;
        log.info(`[karaoke][pitch] RMVPE session on ${backends[index]}`);
        break;
      } catch (error) {
        lastError = error;
      }
    }
    if (!rmvpeSession) {
      throw lastError;
    }
  }
  const { mel, frames } = melSpectrogram(samples);
  const f0 = new Float32Array(frames);
  const confidence = new Float32Array(frames);
  for (let start = 0; start < frames; start += CHUNK_FRAMES) {
    const chunk = Math.min(CHUNK_FRAMES, frames - start);
    // The U-Net's stride demands a multiple of 32; the tail pads with the
    // silence value and the padded frames are simply not read back.
    const paddedFrames = Math.ceil(chunk / 32) * 32;
    const feed = new Float32Array(MELS * paddedFrames).fill(Math.log(1e-5));
    for (let m = 0; m < MELS; m += 1) {
      feed.set(
        mel.subarray(m * frames + start, m * frames + start + chunk),
        m * paddedFrames,
      );
    }
    // eslint-disable-next-line no-await-in-loop
    const output = await rmvpeSession.run({
      input: new ort.Tensor('float32', feed, [1, MELS, paddedFrames]),
    });
    decodeSalience(output.output.data, chunk, f0, confidence, start);
    onProgress(Math.min(1, (start + chunk) / frames));
  }
  return {
    pitchHz: f0,
    confidence,
    hopSeconds: RMVPE_HOP / SR,
    voicedThreshold: 0.5,
    model: 'rmvpe' as const,
  };
};

const runSwift = async (samples: Float32Array) => {
  // eslint-disable-next-line global-require
  const ort = require('onnxruntime-node');
  if (!swiftSession) {
    swiftSession = (await ort.InferenceSession.create(swiftPath(), {
      executionProviders: ['cpu'],
    })) as TOnnxSession;
    log.info('[karaoke][pitch] SwiftF0 session ready');
  }
  const output = await swiftSession.run({
    input_audio: new ort.Tensor('float32', samples, [1, samples.length]),
  });
  return {
    pitchHz: output.pitch_hz.data,
    confidence: output.confidence.data,
    hopSeconds: 256 / SR,
    voicedThreshold: 0.9,
    model: 'swift-f0' as const,
  };
};

export const registerKaraokePitch = () => {
  ipcMain.handle('karaoke-pitch-f0', async (event, samples: Float32Array) => {
    const report = (stage: string, fraction: number) => {
      if (!event.sender.isDestroyed()) {
        event.sender.send('karaoke-pitch-progress', { stage, fraction });
      }
    };
    try {
      await ensureRmvpe((received, total) =>
        report('download', total > 0 ? received / total : 0),
      );
      return await runRmvpe(samples, (fraction) => report('detect', fraction));
    } catch (error) {
      // Offline, refused, out of disk — the bundled tracker answers instead.
      log.warn('[karaoke][pitch] RMVPE unavailable, using SwiftF0', error);
      return runSwift(samples);
    }
  });
  // What is actually sitting in RAM right now, for the memory panel's
  // release affordance — the renderer cannot see main's sessions otherwise.
  ipcMain.handle('karaoke-models-status', () => ({
    separation: isSeparationLoaded(),
    pitch: rmvpeSession !== undefined || swiftSession !== undefined,
  }));
  ipcMain.on('karaoke-pitch-release', () => {
    rmvpeSession = undefined;
    swiftSession = undefined;
    log.info('[karaoke][pitch] sessions released');
  });
};
