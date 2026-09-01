/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { SEPARATION_SAMPLE_RATE } from '../../../common/karaoke/separationDsp';
import {
  emitSeparationSession,
  markSeparationDownloaded,
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

/**
 * Split a song into a vocal stem and a backing track, entirely on this machine.
 *
 * The renderer decodes and draws; the main process runs the model on the
 * native ONNX runtime and reports progress back over IPC. Inference lived in a
 * renderer worker on onnxruntime-web first and died there with a bare
 * Emscripten abort — a number, no message, identical on every backend — while
 * the native runtime had already run this exact model cleanly in a bench. The
 * opaque runtime lost.
 */
export const separateVocals = async (
  file: File,
  onProgress: TSeparationProgress,
  signal?: AbortSignal,
): Promise<ISeparationResult> => {
  emitSeparationSession({ status: 'loading' });
  onProgress(0.02, 'Reading the song', 'decode');
  const { left, right } = await decodeStereo(file);
  if (signal?.aborted) {
    emitSeparationSession({ status: 'unloaded' });
    throw new DOMException('Separation cancelled.', 'AbortError');
  }

  emitSeparationSession({ status: 'working', inMemory: true });
  const onAbort = () => window.electron.ipcRenderer.cancelKaraokeSeparation();
  signal?.addEventListener('abort', onAbort, { once: true });
  // The download happens in main on first use, so its share of the bar is
  // reported from there; afterwards the same events carry inference progress.
  const unsubscribe = window.electron.ipcRenderer.onKaraokeSeparationProgress(
    ({ stage, fraction }) => {
      if (stage === 'download') {
        onProgress(
          0.02 + fraction * 0.38,
          'Downloading the separation model',
          'download',
        );
      } else {
        onProgress(
          0.42 + fraction * 0.56,
          'Separating the voice from the music',
          'separate',
        );
      }
    },
  );
  try {
    const result = await window.electron.ipcRenderer.separateKaraokeVocals(
      left,
      right,
    );
    markSeparationDownloaded();
    emitSeparationSession({ status: 'ready' });
    const base = file.name.replace(/\.[^.]+$/, '');
    return {
      vocals: encodeWav(
        result.vocalsLeft,
        result.vocalsRight,
        `${base} (vocals).wav`,
      ),
      instrumental: encodeWav(
        result.musicLeft,
        result.musicRight,
        `${base} (instrumental).wav`,
      ),
      backend: result.backend,
    };
  } catch (error) {
    if (signal?.aborted || /cancelled/i.test(String(error))) {
      emitSeparationSession({ status: 'unloaded', inMemory: false });
      throw new DOMException('Separation cancelled.', 'AbortError');
    }
    emitSeparationSession({ status: 'error', inMemory: false });
    throw error;
  } finally {
    unsubscribe();
    signal?.removeEventListener('abort', onAbort);
  }
};
