/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { SEPARATION_SAMPLE_RATE } from '../../../common/karaoke/separationDsp';
import {
  SEPARATION_CACHE,
  SEPARATION_MODEL_URL,
  SEPARATION_WEIGHTS_URL,
  emitSeparationSession,
  markSeparationDownloaded,
  separationHasGpu,
} from './separationModel';

export interface ISeparationResult {
  /** The isolated voice, for Whisper and pitch detection. */
  vocals: File;
  /** Everything else — the backing track someone would sing over. */
  instrumental: File;
  /** Which backend ran it, so the caller can explain a slow run. */
  backend: string;
}

export type TSeparationStage = 'download' | 'decode' | 'separate';

export type TSeparationProgress = (
  progress: number,
  message: string,
  stage: TSeparationStage,
) => void;

/**
 * Decode any file the browser can read into two 44.1 kHz channels.
 *
 * Resampling is the `AudioContext`'s job rather than ours: the model is fixed
 * at 44.1 kHz and a mismatched rate is not an error, just a transposed song
 * and a mask computed for the wrong frequencies.
 */
const decodeStereo = async (file: File) => {
  const context = new OfflineAudioContext(2, 1, SEPARATION_SAMPLE_RATE);
  const decoded = await context.decodeAudioData(await file.arrayBuffer());
  if (decoded.sampleRate === SEPARATION_SAMPLE_RATE) {
    return {
      left: decoded.getChannelData(0),
      right: decoded.getChannelData(Math.min(1, decoded.numberOfChannels - 1)),
    };
  }
  const resampler = new OfflineAudioContext(
    2,
    Math.ceil(decoded.duration * SEPARATION_SAMPLE_RATE),
    SEPARATION_SAMPLE_RATE,
  );
  const source = resampler.createBufferSource();
  source.buffer = decoded;
  source.connect(resampler.destination);
  source.start();
  const rendered = await resampler.startRendering();
  return {
    left: rendered.getChannelData(0),
    right: rendered.getChannelData(Math.min(1, rendered.numberOfChannels - 1)),
  };
};

/**
 * Fetch one model file, reporting progress, and keep it in the cache.
 *
 * Read whole rather than streamed into place. Streaming a download through
 * `pipeline` crashes inside Node's HTTP parser when the disk is slower than
 * the socket, and while this is the renderer rather than main, the same shape
 * of bug is not worth courting for a file this size — every byte has to arrive
 * before the session can be created regardless.
 */
const fetchModelFile = async (
  url: string,
  onBytes: (received: number, total: number) => void,
  signal?: AbortSignal,
): Promise<ArrayBuffer> => {
  const cache =
    typeof caches !== 'undefined'
      ? await caches.open(SEPARATION_CACHE)
      : undefined;
  const cached = await cache?.match(url);
  if (cached) {
    return cached.arrayBuffer();
  }
  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(
      `The separation model could not be downloaded (${response.status}).`,
    );
  }
  const total = Number(response.headers.get('content-length') ?? 0);
  const reader = response.body?.getReader();
  if (!reader) {
    const buffer = await response.arrayBuffer();
    await cache?.put(url, new Response(buffer));
    return buffer;
  }
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
  const buffer = new Uint8Array(received);
  let offset = 0;
  parts.forEach((part) => {
    buffer.set(part, offset);
    offset += part.length;
  });
  await cache?.put(url, new Response(buffer));
  return buffer.buffer;
};

/** Encode two channels as a 16-bit PCM WAV, which every decoder here accepts. */
const encodeWav = (
  left: Float32Array,
  right: Float32Array,
  name: string,
): File => {
  const frames = left.length;
  const buffer = new ArrayBuffer(44 + frames * 4);
  const view = new DataView(buffer);
  const ascii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i += 1) {
      view.setUint8(offset + i, text.charCodeAt(i));
    }
  };
  ascii(0, 'RIFF');
  view.setUint32(4, 36 + frames * 4, true);
  ascii(8, 'WAVE');
  ascii(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 2, true);
  view.setUint32(24, SEPARATION_SAMPLE_RATE, true);
  view.setUint32(28, SEPARATION_SAMPLE_RATE * 4, true);
  view.setUint16(32, 4, true);
  view.setUint16(34, 16, true);
  ascii(36, 'data');
  view.setUint32(40, frames * 4, true);
  for (let i = 0; i < frames; i += 1) {
    const l = Math.max(-1, Math.min(1, left[i]));
    const r = Math.max(-1, Math.min(1, right[i]));
    view.setInt16(44 + i * 4, Math.round(l * 32767), true);
    view.setInt16(46 + i * 4, Math.round(r * 32767), true);
  }
  return new File([buffer], name, { type: 'audio/wav' });
};

let worker: Worker | undefined;

const separationWorker = (): Worker => {
  if (!worker) {
    worker = new Worker(
      new URL(
        process.env.NODE_ENV === 'production'
          ? './karaoke-separation-worker.js'
          : '/karaoke-separation-worker.dev.js',
        window.location.href,
      ),
    );
  }
  return worker;
};

/**
 * Split a song into a vocal stem and a backing track, entirely on this machine.
 *
 * The vocal stem is the point for the Maker: Whisper transcribes a clean voice
 * far more reliably than a voice buried in a mix, and pitch detection stops
 * reporting the bassline as melody. The instrumental falls out of the same
 * pass because the two stems sum back to the original.
 */
export const separateVocals = async (
  file: File,
  onProgress: TSeparationProgress,
  signal?: AbortSignal,
): Promise<ISeparationResult> => {
  emitSeparationSession({ status: 'downloading' });
  onProgress(0.01, 'Preparing the separation model', 'download');
  const weightShare = 0.35;
  const graph = await fetchModelFile(
    SEPARATION_MODEL_URL,
    () => undefined,
    signal,
  );
  const weights = await fetchModelFile(
    SEPARATION_WEIGHTS_URL,
    (received, total) => {
      if (total > 0) {
        onProgress(
          0.01 + (received / total) * weightShare,
          'Downloading the separation model',
          'download',
        );
      }
    },
    signal,
  );
  markSeparationDownloaded();

  emitSeparationSession({ status: 'loading' });
  onProgress(weightShare + 0.02, 'Reading the song', 'decode');
  const { left, right } = await decodeStereo(file);

  const preferGpu = await separationHasGpu();
  emitSeparationSession({ status: 'working', inMemory: true });

  return new Promise<ISeparationResult>((resolve, reject) => {
    const id = `separate-${Date.now()}`;
    const active = separationWorker();
    const onAbort = () => {
      active.terminate();
      worker = undefined;
      emitSeparationSession({ status: 'unloaded', inMemory: false });
      reject(new DOMException('Separation cancelled.', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });

    const finish = (handler: () => void) => {
      signal?.removeEventListener('abort', onAbort);
      active.removeEventListener('message', onMessage);
      handler();
    };

    function onMessage(event: MessageEvent<Record<string, unknown>>) {
      const message = event.data;
      if (message.id !== id) {
        return;
      }
      if (message.type === 'progress') {
        const fraction = Number(message.progress ?? 0);
        onProgress(
          weightShare + 0.05 + fraction * (0.95 - weightShare - 0.05),
          'Separating the voice from the music',
          'separate',
        );
        return;
      }
      if (message.type === 'error') {
        emitSeparationSession({ status: 'error', inMemory: false });
        finish(() => reject(new Error(String(message.error))));
        return;
      }
      if (message.type === 'complete') {
        emitSeparationSession({ status: 'ready' });
        const base = file.name.replace(/\.[^.]+$/, '');
        finish(() =>
          resolve({
            vocals: encodeWav(
              message.vocalsLeft as Float32Array,
              message.vocalsRight as Float32Array,
              `${base} (vocals).wav`,
            ),
            instrumental: encodeWav(
              message.musicLeft as Float32Array,
              message.musicRight as Float32Array,
              `${base} (instrumental).wav`,
            ),
            backend: String(message.backend ?? ''),
          }),
        );
      }
    }

    active.addEventListener('message', onMessage);
    active.postMessage({
      id,
      type: 'separate',
      left,
      right,
      graph,
      weights,
      preferGpu,
    });
  });
};

/** Drop the model from memory; the cached download is untouched. */
export const releaseSeparationModel = async (): Promise<void> => {
  if (!worker) {
    return;
  }
  worker.postMessage({ id: 'release', type: 'release' });
  worker.terminate();
  worker = undefined;
  emitSeparationSession({ status: 'unloaded', inMemory: false });
};
