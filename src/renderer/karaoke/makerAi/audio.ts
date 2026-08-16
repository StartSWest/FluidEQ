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
// `tiny` was fast, but its singing-word recall was not reliable enough for a
// creator: repeated lines were frequently omitted and the reference matcher
// then had no acoustic anchor. Base is still practical in local q8 WASM while
// providing a materially stronger transcript for forced lyric alignment.
export const WHISPER_MODEL = 'onnx-community/whisper-base_timestamped';

/**
 * Temporary product gate for automatic lyric timing and melody detection.
 *
 * The implementation stays in the repository for further experiments, but it
 * must not be exposed or started from the shipped Maker UI until repeated
 * lyrics, section coverage, word boundaries, and syllable-to-note alignment
 * are reliable on a representative karaoke corpus. Manual line recording,
 * lyric editing, note painting, and imported provider timing remain supported.
 */
export const KARAOKE_AUTOMATIC_DETECTOR_UI_ENABLED = false;

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

export const decodeMono = async (
  file: File,
  sampleRate: number,
): Promise<Float32Array> => {
  const decoded = await decodeSourceMono(file);
  return resampleLinear(decoded.samples, decoded.sampleRate, sampleRate);
};
