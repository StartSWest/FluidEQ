/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { IKaraokeMakerLicenseRecord } from '../../../common/karaoke/makerProject';

export const BASIC_PITCH_SAMPLE_RATE = 22_050;
export const WHISPER_SAMPLE_RATE = 16_000;
const MAX_AI_DURATION_SECONDS = 30 * 60;
const MAX_AI_FILE_BYTES = 1024 * 1024 * 1024;
// Large-v3-turbo, because recall is now the product: with no reference text
// the transcript IS the lyric sheet, and Spanish singing through a small
// model came back as soup. Turbo is large-v3's accuracy at a quarter of the
// decoder, multilingual across ~100 languages — Spanish and English very much
// included — and it loads on WebGPU (q4f16) where this is seconds per song,
// with WASM q8 as the everywhere-fallback.
export const WHISPER_MODEL =
  'onnx-community/whisper-large-v3-turbo_timestamped';

/**
 * Product gate for automatic lyric timing and melody detection.
 *
 * Off since the detector was written, for a specific reason: repeated lyrics,
 * section coverage and word boundaries were unreliable, because Whisper was
 * being asked to transcribe a voice buried under a full mix. Vocal separation
 * addresses exactly that — the transcriber now reads an isolated voice — so
 * the gate is open for development.
 *
 * **What is proven, and what is not.** The separation is verified on a real
 * commercial mix: an isolated vocal at -18 dB RMS carrying voice in 40 of 41
 * five-second windows, with silence only where the song ends. The transform
 * round-trips to the double-precision floor.
 *
 * The vocal-free null case is also verified — fed an instrumental it extracts
 * nothing — but it is worth recording that this test alone was actively
 * misleading. It cannot separate a working pipeline from one that returns zero
 * for every input, and for a while this code was the latter: a transposed
 * tensor packing scored 52 dB on the null case, better than the correct
 * packing's 4 dB, while in truth separating nothing at all. One real song
 * exposed it immediately. A null result needs a positive control beside it.
 *
 * What has *not* been measured is how much the alignment improves once the
 * transcriber is given that stem. That needs transcriptions of real songs.
 *
 * **So this must be re-examined before a release, not before a merge.** These
 * changes sit on master unreleased by design. If the alignment quality does not
 * hold up on a representative karaoke corpus, turn this back off — it is one
 * line, and every path behind it is inert when it is false.
 */
export const KARAOKE_AUTOMATIC_DETECTOR_UI_ENABLED = true;

export const BASIC_PITCH_PROVENANCE: IKaraokeMakerLicenseRecord = {
  component: '@spotify/basic-pitch model and runtime',
  version: '1.0.1',
  license: 'Apache-2.0',
  sourceUrl: 'https://github.com/spotify/basic-pitch-ts',
};

export const WHISPER_PROVENANCE: IKaraokeMakerLicenseRecord = {
  component: WHISPER_MODEL,
  version: 'main (downloaded on demand)',
  license: 'MIT',
  sourceUrl: `https://huggingface.co/${WHISPER_MODEL}`,
};

export const upsertProvenance = (
  records: readonly IKaraokeMakerLicenseRecord[],
  incoming: IKaraokeMakerLicenseRecord,
): IKaraokeMakerLicenseRecord[] => [
  ...records.filter((record) => record.component !== incoming.component),
  incoming,
];

const resampleLinear = (
  source: Float32Array,
  sourceRate: number,
  targetRate: number,
): Float32Array => {
  if (sourceRate === targetRate) {
    return source.slice();
  }
  const output = new Float32Array(
    Math.max(1, Math.round((source.length * targetRate) / sourceRate)),
  );
  const ratio = sourceRate / targetRate;
  for (let index = 0; index < output.length; index += 1) {
    const sourcePosition = index * ratio;
    const before = Math.min(source.length - 1, Math.floor(sourcePosition));
    const after = Math.min(source.length - 1, before + 1);
    const mix = sourcePosition - before;
    output[index] = source[before] * (1 - mix) + source[after] * mix;
  }
  return output;
};

interface IDecodedMonoAudio {
  samples: Float32Array;
  sampleRate: number;
}

const decodedMonoCache = new WeakMap<File, Promise<IDecodedMonoAudio>>();

const decodeSourceMono = (file: File): Promise<IDecodedMonoAudio> => {
  const cached = decodedMonoCache.get(file);
  if (cached) {
    return cached;
  }
  const task = (async () => {
    if (file.size > MAX_AI_FILE_BYTES) {
      throw new Error('AI analysis is limited to audio files of 1 GB or less.');
    }
    const context = new AudioContext();
    try {
      const buffer = await context.decodeAudioData(await file.arrayBuffer());
      if (buffer.duration > MAX_AI_DURATION_SECONDS) {
        throw new Error(
          'AI analysis is limited to recordings under 30 minutes.',
        );
      }
      const mono = new Float32Array(buffer.length);
      for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
        const samples = buffer.getChannelData(channel);
        for (let index = 0; index < mono.length; index += 1) {
          mono[index] += samples[index] / buffer.numberOfChannels;
        }
      }
      return { samples: mono, sampleRate: buffer.sampleRate };
    } finally {
      await context.close().catch(() => undefined);
    }
  })();
  decodedMonoCache.set(file, task);
  task.catch(() => decodedMonoCache.delete(file));
  return task;
};

/**
 * Decoded audio, kept per file so a second detection does not pay for the
 * first one's decode again.
 *
 * Every run used to re-decode from scratch — several seconds of
 * "Decoding audio locally" before any recognition, repeated identically for
 * a file that had not changed. Keyed weakly on the File object: the stems and
 * the imported song keep their identity for a whole session, and when the
 * File goes, its samples go with it.
 */
const decodedCache = new WeakMap<File, Map<number, Promise<Float32Array>>>();

export const decodeMono = (
  file: File,
  sampleRate: number,
): Promise<Float32Array> => {
  let byRate = decodedCache.get(file);
  if (!byRate) {
    byRate = new Map();
    decodedCache.set(file, byRate);
  }
  const cached = byRate.get(sampleRate);
  // Every caller gets its own copy; the cached master never leaves this
  // module. The Whisper worker transfers its buffer away for speed
  // (postMessage with a transfer list), and before the copy, that transfer
  // neutered the shared cache entry: the next consumer received a detached
  // array and the whole melody pass died as "An object could not be cloned".
  if (cached) {
    return cached.then((samples) => samples.slice());
  }
  const task = (async () => {
    const decoded = await decodeSourceMono(file);
    return resampleLinear(decoded.samples, decoded.sampleRate, sampleRate);
  })();
  // A failed decode is not a result; the next attempt should try again.
  task.catch(() => byRate.delete(sampleRate));
  byRate.set(sampleRate, task);
  return task.then((samples) => samples.slice());
};
