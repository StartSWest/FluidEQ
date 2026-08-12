/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import basicPitchModelUrl from '@spotify/basic-pitch/model/model.json?url';
import basicPitchShardUrl from '@spotify/basic-pitch/model/group1-shard1of1.bin?url';
import whisperWasmUrl from '@fluideq/whisper-wasm';
import whisperRuntimeUrl from '@fluideq/whisper-runtime';
import {
  IKaraokeMakerAnalysisNote,
  karaokeMakerAnalysisOffsetMs,
} from './makerAnalysis';
import {
  IKaraokeMakerLicenseRecord,
  IKaraokeMakerProject,
  IKaraokeMakerToken,
  karaokeMakerLineIsSection,
  karaokeMakerId,
  synchronizeKaraokeMakerSections,
  touchKaraokeMakerProject,
} from '../../common/karaoke/makerProject';

const BASIC_PITCH_SAMPLE_RATE = 22_050;
const WHISPER_SAMPLE_RATE = 16_000;
const MAX_AI_DURATION_SECONDS = 30 * 60;
const MAX_AI_FILE_BYTES = 1024 * 1024 * 1024;
export const WHISPER_MODEL = 'onnx-community/whisper-tiny';

export const BASIC_PITCH_PROVENANCE: IKaraokeMakerLicenseRecord = {
  component: '@spotify/basic-pitch model and runtime',
  version: '1.0.1',
  license: 'Apache-2.0',
  sourceUrl: 'https://github.com/spotify/basic-pitch-ts',
};

export const WHISPER_PROVENANCE: IKaraokeMakerLicenseRecord = {
  component: WHISPER_MODEL,
  version: 'main (downloaded on demand)',
  license: 'Apache-2.0',
  sourceUrl: `https://huggingface.co/${WHISPER_MODEL}`,
};

const upsertProvenance = (
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

const decodeMono = async (
  file: File,
  sampleRate: number,
  vocalFocus: boolean,
): Promise<Float32Array> => {
  if (file.size > MAX_AI_FILE_BYTES) {
    throw new Error('AI analysis is limited to audio files of 1 GB or less.');
  }
  const context = new AudioContext();
  try {
    const buffer = await context.decodeAudioData(await file.arrayBuffer());
    if (buffer.duration > MAX_AI_DURATION_SECONDS) {
      throw new Error('AI analysis is limited to recordings under 30 minutes.');
    }
    const mono = new Float32Array(buffer.length);
    if (vocalFocus && buffer.numberOfChannels >= 2) {
      const left = buffer.getChannelData(0);
      const right = buffer.getChannelData(1);
      for (let index = 0; index < mono.length; index += 1) {
        mono[index] = (left[index] + right[index]) * 0.5;
      }
    } else {
      for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
        const samples = buffer.getChannelData(channel);
        for (let index = 0; index < mono.length; index += 1) {
          mono[index] += samples[index] / buffer.numberOfChannels;
        }
      }
    }
    return resampleLinear(mono, buffer.sampleRate, sampleRate);
  } finally {
    await context.close().catch(() => undefined);
  }
};

/**
 * Run Spotify's bundled Apache-2.0 Basic Pitch model entirely in the renderer.
 * It is most useful with a vocal stem; mixed masters can include instruments.
 */
export const analyzeKaraokeWithBasicPitch = async (
  file: File,
  vocalFocus: boolean,
  onProgress: (progress: number) => void,
  signal?: AbortSignal,
): Promise<IKaraokeMakerAnalysisNote[]> => {
  if (!basicPitchModelUrl || !basicPitchShardUrl) {
    throw new Error('The bundled Basic Pitch model is unavailable.');
  }
  onProgress(0.01);
  const samples = await decodeMono(file, BASIC_PITCH_SAMPLE_RATE, vocalFocus);
  if (signal?.aborted) {
    throw new DOMException('Analysis cancelled.', 'AbortError');
  }
  onProgress(0.06);
  const {
    BasicPitch,
    outputToNotesPoly,
    addPitchBendsToNoteEvents,
    noteFramesToTime,
  } = await import('@spotify/basic-pitch');
  if (signal?.aborted) {
    throw new DOMException('Analysis cancelled.', 'AbortError');
  }
  const frames: number[][] = [];
  const onsets: number[][] = [];
  const contours: number[][] = [];
  const model = new BasicPitch(basicPitchModelUrl);
  await model.evaluateModel(
    samples,
    (incomingFrames, incomingOnsets, incomingContours) => {
      frames.push(...incomingFrames);
      onsets.push(...incomingOnsets);
      contours.push(...incomingContours);
    },
    (progress) => {
      if (signal?.aborted) {
        throw new DOMException('Analysis cancelled.', 'AbortError');
      }
      onProgress(0.08 + progress * 0.84);
    },
  );
  if (signal?.aborted) {
    throw new DOMException('Analysis cancelled.', 'AbortError');
  }
  const events = noteFramesToTime(
    addPitchBendsToNoteEvents(
      contours,
      outputToNotesPoly(frames, onsets, 0.32, 0.28, 5),
    ),
  )
    .filter(
      (event) =>
        event.durationSeconds >= 0.055 &&
        event.pitchMidi >= 24 &&
        event.pitchMidi <= 96,
    )
    .sort((left, right) => left.startTimeSeconds - right.startTimeSeconds);

  // When polyphonic candidates begin together, retain the strongest voice.
  // Users can import a clean vocal stem when the master is too dense.
  const melody: IKaraokeMakerAnalysisNote[] = [];
  events.forEach((event) => {
    const candidate: IKaraokeMakerAnalysisNote = {
      startMs: event.startTimeSeconds * 1_000,
      endMs: (event.startTimeSeconds + event.durationSeconds) * 1_000,
      targetMidi: event.pitchMidi,
      confidence: Math.min(1, Math.max(0, event.amplitude)),
    };
    const previous = melody[melody.length - 1];
    if (
      previous &&
      Math.abs(previous.startMs - candidate.startMs) < 35 &&
      previous.endMs > candidate.startMs
    ) {
      if (candidate.confidence > previous.confidence) {
        melody[melody.length - 1] = candidate;
      }
      return;
    }
    melody.push(candidate);
  });
  onProgress(1);
  return melody;
};

interface IWhisperChunk {
  text?: string;
  timestamp?: [number | null, number | null];
}

interface IWhisperOutput {
  text?: string;
  chunks?: IWhisperChunk[];
}

interface IWhisperPipeline {
  (
    samples: Float32Array,
    options: {
      return_timestamps: 'word';
      chunk_length_s: number;
      stride_length_s: number;
    },
  ): Promise<IWhisperOutput>;
  dispose?: () => Promise<void> | void;
}

export interface IKaraokeMakerTranscriptWord {
  text: string;
  startMs: number;
  endMs: number;
}

export interface IKaraokeMakerDownloadProgress {
  loadedBytes?: number;
  totalBytes?: number;
  file?: string;
}

/** Download-on-demand Whisper transcription. Audio is processed locally. */
export const transcribeKaraokeWithWhisper = async (
  file: File,
  vocalFocus: boolean,
  onProgress: (
    progress: number,
    message?: string,
    download?: IKaraokeMakerDownloadProgress,
  ) => void,
  signal?: AbortSignal,
): Promise<IKaraokeMakerTranscriptWord[]> => {
  onProgress(0.01, 'Decoding audio');
  const samples = await decodeMono(file, WHISPER_SAMPLE_RATE, vocalFocus);
  if (signal?.aborted) {
    throw new DOMException('Transcription cancelled.', 'AbortError');
  }
  const { pipeline, env } = await import('@huggingface/transformers');
  env.allowLocalModels = true;
  env.allowRemoteModels = true;
  const wasmBackend = env.backends.onnx.wasm;
  if (!wasmBackend) {
    throw new Error('The local Whisper WASM backend is unavailable.');
  }
  // Supplying only a directory makes ONNX Runtime infer both filenames. The
  // WASM binary used to be bundled there without its dynamically imported MJS
  // bootstrap, which turned the missing local file into a misleading model-
  // download error. Explicit absolute URLs also work in both dev HTTP and the
  // packaged file:// renderer.
  wasmBackend.wasmPaths = {
    wasm: new URL(whisperWasmUrl, window.location.href).href,
    mjs: new URL(whisperRuntimeUrl, window.location.href).href,
  };
  onProgress(0.04, 'Loading the opt-in Whisper model');
  let recognizer: IWhisperPipeline;
  try {
    recognizer = (await pipeline(
      'automatic-speech-recognition',
      WHISPER_MODEL,
      {
        dtype: 'q8',
        device: 'wasm',
        progress_callback: (event: unknown) => {
          if (signal?.aborted) {
            return;
          }
          const progressEvent = event as {
            progress?: number;
            status?: string;
            loaded?: number;
            total?: number;
            file?: string;
          };
          if (typeof progressEvent.progress === 'number') {
            onProgress(
              0.04 +
                (Math.min(100, Math.max(0, progressEvent.progress)) / 100) *
                  0.36,
              progressEvent.status,
              {
                loadedBytes: progressEvent.loaded,
                totalBytes: progressEvent.total,
                file: progressEvent.file,
              },
            );
          }
        },
      },
    )) as unknown as IWhisperPipeline;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    if (
      /no available backend|onnx|wasm|ort-wasm|dynamically imported module/i.test(
        detail,
      )
    ) {
      throw new Error(`Local Whisper WASM runtime failed. ${detail}`);
    }
    throw new Error(`Hugging Face model download failed. ${detail}`);
  }
  try {
    if (signal?.aborted) {
      throw new DOMException('Transcription cancelled.', 'AbortError');
    }
    onProgress(0.42, 'Transcribing locally');
    const output = await recognizer(samples, {
      return_timestamps: 'word',
      chunk_length_s: 30,
      stride_length_s: 5,
    });
    if (signal?.aborted) {
      throw new DOMException('Transcription cancelled.', 'AbortError');
    }
    const words = (output.chunks ?? []).flatMap(
      (chunk): IKaraokeMakerTranscriptWord[] => {
        const text = chunk.text?.trim();
        const start = chunk.timestamp?.[0];
        const end = chunk.timestamp?.[1];
        if (!text || typeof start !== 'number') {
          return [];
        }
        return [
          {
            text,
            startMs: start * 1_000,
            endMs: (typeof end === 'number' ? end : start + 0.4) * 1_000,
          },
        ];
      },
    );
    onProgress(1, 'Transcription complete');
    return words;
  } finally {
    await recognizer.dispose?.();
  }
};

const normalizedWord = (value: string): string =>
  value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '');

/**
 * Global sequence alignment maps recognised words onto user-supplied lyrics.
 * The lyric spelling is never replaced; only timestamps and confidence are.
 */
const alignWordSequences = (
  lyrics: readonly IKaraokeMakerToken[],
  transcript: readonly IKaraokeMakerTranscriptWord[],
): Map<string, IKaraokeMakerTranscriptWord> => {
  const lyricCount = Math.min(4_000, lyrics.length);
  const transcriptCount = Math.min(4_000, transcript.length);
  const width = transcriptCount + 1;
  const directions = new Uint8Array((lyricCount + 1) * width);
  let previous = new Uint16Array(width);
  let current = new Uint16Array(width);
  for (let column = 0; column <= transcriptCount; column += 1) {
    previous[column] = column;
  }
  for (let row = 1; row <= lyricCount; row += 1) {
    current[0] = row;
    for (let column = 1; column <= transcriptCount; column += 1) {
      const equal =
        normalizedWord(lyrics[row - 1].text) ===
        normalizedWord(transcript[column - 1].text);
      const diagonal = previous[column - 1] + (equal ? 0 : 2);
      const removeLyric = previous[column] + 1;
      const skipTranscript = current[column - 1] + 1;
      const best = Math.min(diagonal, removeLyric, skipTranscript);
      current[column] = best;
      let direction = 3;
      if (best === diagonal) {
        direction = 1;
      } else if (best === removeLyric) {
        direction = 2;
      }
      directions[row * width + column] = direction;
    }
    [previous, current] = [current, previous];
  }
  const mapping = new Map<string, IKaraokeMakerTranscriptWord>();
  let row = lyricCount;
  let column = transcriptCount;
  while (row > 0 && column > 0) {
    const direction = directions[row * width + column];
    if (direction === 1) {
      if (
        normalizedWord(lyrics[row - 1].text) ===
        normalizedWord(transcript[column - 1].text)
      ) {
        mapping.set(lyrics[row - 1].id, transcript[column - 1]);
      }
      row -= 1;
      column -= 1;
    } else if (direction === 2) {
      row -= 1;
    } else {
      column -= 1;
    }
  }
  return mapping;
};

const linesFromTranscript = (words: readonly IKaraokeMakerTranscriptWord[]) => {
  const lines: IKaraokeMakerProject['lyrics']['lines'] = [];
  let current: IKaraokeMakerProject['lyrics']['lines'][number] | undefined;
  words.forEach((word, index) => {
    const previous = words[index - 1];
    if (
      !current ||
      current.tokens.length >= 9 ||
      (previous && word.startMs - previous.endMs > 1_100)
    ) {
      current = { id: karaokeMakerId('line'), tokens: [] };
      lines.push(current);
    }
    current.tokens.push({
      id: karaokeMakerId('word'),
      text: word.text,
      startsWord: true,
      startMs: word.startMs,
      endMs: Math.max(word.startMs + 40, word.endMs),
      confidence: 0.72,
      source: 'whisper',
    });
  });
  return lines;
};

export const applyWhisperTranscript = (
  project: IKaraokeMakerProject,
  transcript: readonly IKaraokeMakerTranscriptWord[],
): IKaraokeMakerProject => {
  const transcriptOffsetMs = transcript.length
    ? karaokeMakerAnalysisOffsetMs(
        project,
        Math.min(...transcript.map((word) => word.startMs)),
      )
    : 0;
  const shiftedTranscript = transcript.map((word) => ({
    ...word,
    startMs: word.startMs + transcriptOffsetMs,
    endMs: word.endMs + transcriptOffsetMs,
  }));
  const existing = project.lyrics.lines
    .filter((line) => !karaokeMakerLineIsSection(line))
    .flatMap((line) => line.tokens);
  if (!existing.length) {
    return touchKaraokeMakerProject(
      synchronizeKaraokeMakerSections({
        ...project,
        lyrics: {
          ...project.lyrics,
          source: 'whisper',
          lines: linesFromTranscript(shiftedTranscript),
        },
        provenance: upsertProvenance(project.provenance, WHISPER_PROVENANCE),
      }),
    );
  }
  const mapping = alignWordSequences(existing, shiftedTranscript);
  const lines = project.lyrics.lines.map((line) => ({
    ...line,
    tokens: line.tokens.map((token) => {
      if (karaokeMakerLineIsSection(line) || token.timingLocked) {
        return token;
      }
      const word = mapping.get(token.id);
      return word
        ? {
            ...token,
            startMs: word.startMs,
            endMs: Math.max(word.startMs + 40, word.endMs),
            confidence: 0.82,
            source: 'whisper' as const,
          }
        : token;
    }),
  }));
  return touchKaraokeMakerProject(
    synchronizeKaraokeMakerSections({
      ...project,
      lyrics: { ...project.lyrics, source: 'whisper', lines },
      provenance: upsertProvenance(project.provenance, WHISPER_PROVENANCE),
    }),
  );
};

export const applyBasicPitchMelody = (
  project: IKaraokeMakerProject,
  notes: readonly IKaraokeMakerAnalysisNote[],
): IKaraokeMakerProject => {
  const aligned = autoAlignNotesOnly(project, notes);
  return touchKaraokeMakerProject(
    synchronizeKaraokeMakerSections({
      ...aligned,
      provenance: upsertProvenance(aligned.provenance, BASIC_PITCH_PROVENANCE),
    }),
  );
};

const autoAlignNotesOnly = (
  project: IKaraokeMakerProject,
  notes: readonly IKaraokeMakerAnalysisNote[],
): IKaraokeMakerProject => {
  const tokens = project.lyrics.lines
    .filter((line) => !karaokeMakerLineIsSection(line))
    .flatMap((line) => line.tokens);
  const timingOffsetMs = notes.length
    ? karaokeMakerAnalysisOffsetMs(
        project,
        Math.min(...notes.map((note) => note.startMs)),
      )
    : 0;
  return {
    ...project,
    melody: {
      ...project.melody,
      source: 'basic-pitch',
      notes: [
        ...project.melody.notes.filter((note) => note.source === 'manual'),
        ...notes
          .filter(
            (note) =>
              !project.melody.notes.some(
                (existing) =>
                  existing.source === 'manual' &&
                  existing.startMs < note.endMs + timingOffsetMs &&
                  note.startMs + timingOffsetMs < existing.endMs,
              ),
          )
          .map((note) => {
            const startMs = note.startMs + timingOffsetMs;
            const endMs = note.endMs + timingOffsetMs;
            const midpoint = (startMs + endMs) / 2;
            const containing = tokens.find(
              (token) =>
                token.startMs !== undefined &&
                token.endMs !== undefined &&
                midpoint >= token.startMs &&
                midpoint <= token.endMs,
            );
            return {
              id: karaokeMakerId('note'),
              tokenId: containing?.id,
              startMs,
              endMs,
              targetMidi: note.targetMidi,
              confidence: note.confidence,
              kind: 'normal' as const,
              source: 'basic-pitch' as const,
            };
          }),
      ].sort((left, right) => left.startMs - right.startMs),
    },
  };
};
