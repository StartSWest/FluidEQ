/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import basicPitchModelUrl from '@spotify/basic-pitch/model/model.json?url';
import basicPitchShardUrl from '@spotify/basic-pitch/model/group1-shard1of1.bin?url';
import {
  IKaraokeMakerAnalysisNote,
  karaokeMakerAnalysisOffsetMs,
  repairEstimatedWhisperTimingWithMelody,
} from './makerAnalysis';
import {
  IKaraokeMakerLicenseRecord,
  IKaraokeMakerProject,
  IKaraokeMakerToken,
  KARAOKE_MAKER_WHISPER_ALIGNMENT_VERSION,
  karaokeMakerLineIsSection,
  karaokeMakerId,
  karaokeMakerMaximumAutomaticWordDurationMs,
  karaokeMakerWordDurationIsPlausible,
  synchronizeKaraokeMakerSections,
  touchKaraokeMakerProject,
} from '../../common/karaoke/makerProject';
import { splitKaraokeWordSyllables } from '../../common/karaoke/syllables';

const BASIC_PITCH_SAMPLE_RATE = 22_050;
const WHISPER_SAMPLE_RATE = 16_000;
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

const decodeMono = async (
  file: File,
  sampleRate: number,
): Promise<Float32Array> => {
  const decoded = await decodeSourceMono(file);
  return resampleLinear(decoded.samples, decoded.sampleRate, sampleRate);
};

export interface IKaraokeMakerAnalysisWindow {
  startMs: number;
  endMs: number;
}

/** Merge timed lyric words into padded vocal phrases for pitch analysis. */
export const karaokeMakerVocalAnalysisWindows = (
  project: IKaraokeMakerProject,
): IKaraokeMakerAnalysisWindow[] => {
  const durationMs = project.audio.durationMs ?? Number.POSITIVE_INFINITY;
  const raw = project.lyrics.lines
    .filter((line) => !karaokeMakerLineIsSection(line))
    .flatMap((line) => {
      const timed = line.tokens.filter(
        (token) =>
          token.startMs !== undefined &&
          token.endMs !== undefined &&
          token.endMs > token.startMs,
      );
      if (!timed.length) {
        return [];
      }
      return [
        {
          startMs: Math.max(
            0,
            Math.min(...timed.map((token) => token.startMs as number)) - 220,
          ),
          endMs: Math.min(
            durationMs,
            Math.max(...timed.map((token) => token.endMs as number)) + 220,
          ),
        },
      ];
    })
    .sort((left, right) => left.startMs - right.startMs);
  const merged: IKaraokeMakerAnalysisWindow[] = [];
  raw.forEach((window) => {
    const previous = merged[merged.length - 1];
    if (previous && window.startMs - previous.endMs <= 500) {
      previous.endMs = Math.max(previous.endMs, window.endMs);
    } else {
      merged.push({ ...window });
    }
  });
  return merged;
};

/**
 * Run Spotify's bundled Apache-2.0 Basic Pitch model entirely in the renderer.
 * It is most useful with a vocal stem; mixed masters can include instruments.
 */
export const analyzeKaraokeWithBasicPitch = async (
  file: File,
  onProgress: (progress: number) => void,
  signal?: AbortSignal,
  analysisWindows?: readonly IKaraokeMakerAnalysisWindow[],
): Promise<IKaraokeMakerAnalysisNote[]> => {
  if (!basicPitchModelUrl || !basicPitchShardUrl) {
    throw new Error('The bundled Basic Pitch model is unavailable.');
  }
  onProgress(0.01);
  const samples = await decodeMono(file, BASIC_PITCH_SAMPLE_RATE);
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
  const model = new BasicPitch(basicPitchModelUrl);
  const windows = analysisWindows?.length
    ? analysisWindows
        .map((window) => ({
          startSample: Math.max(
            0,
            Math.floor((window.startMs / 1_000) * BASIC_PITCH_SAMPLE_RATE),
          ),
          endSample: Math.min(
            samples.length,
            Math.ceil((window.endMs / 1_000) * BASIC_PITCH_SAMPLE_RATE),
          ),
        }))
        .filter((window) => window.endSample > window.startSample)
    : [{ startSample: 0, endSample: samples.length }];
  const totalWindowSamples = Math.max(
    1,
    windows.reduce(
      (sum, window) => sum + window.endSample - window.startSample,
      0,
    ),
  );
  let completedSamples = 0;
  const candidateBatches: IKaraokeMakerAnalysisNote[][] = [];
  await windows.reduce<Promise<void>>(async (prior, window) => {
    await prior;
    const windowFrames: number[][] = [];
    const windowOnsets: number[][] = [];
    const windowContours: number[][] = [];
    const windowSamples = samples.subarray(
      window.startSample,
      window.endSample,
    );
    await model.evaluateModel(
      windowSamples,
      (incomingFrames, incomingOnsets, incomingContours) => {
        windowFrames.push(...incomingFrames);
        windowOnsets.push(...incomingOnsets);
        windowContours.push(...incomingContours);
      },
      (progress) => {
        if (signal?.aborted) {
          throw new DOMException('Analysis cancelled.', 'AbortError');
        }
        const processed = completedSamples + windowSamples.length * progress;
        onProgress(0.08 + (processed / totalWindowSamples) * 0.84);
      },
    );
    const offsetSeconds = window.startSample / BASIC_PITCH_SAMPLE_RATE;
    candidateBatches.push(
      noteFramesToTime(
        addPitchBendsToNoteEvents(
          windowContours,
          outputToNotesPoly(windowFrames, windowOnsets, 0.32, 0.28, 5),
        ),
      )
        .filter(
          (event) =>
            event.durationSeconds >= 0.055 &&
            event.pitchMidi >= 24 &&
            event.pitchMidi <= 96,
        )
        .map((event) => ({
          startMs: (offsetSeconds + event.startTimeSeconds) * 1_000,
          endMs:
            (offsetSeconds + event.startTimeSeconds + event.durationSeconds) *
            1_000,
          targetMidi: event.pitchMidi,
          confidence: Math.min(1, Math.max(0, event.amplitude)),
        })),
    );
    completedSamples += windowSamples.length;
  }, Promise.resolve());
  if (signal?.aborted) {
    throw new DOMException('Analysis cancelled.', 'AbortError');
  }
  // Preserve the polyphonic candidates here. Whisper's narrow word windows
  // give the lyric-guided reducer much better context for choosing a vocal
  // path than a global "strongest onset wins" pass can have.
  const melody = candidateBatches
    .flat()
    .sort((left, right) => left.startMs - right.startMs);
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

const maximumAutomaticWordDurationMs = (text: string): number => {
  // Corpus calibration: 99% of one-letter words are below 500 ms and 99% of
  // ordinary words below roughly 2.5 s. This generous ceiling still permits a
  // held note but rejects a chunk-sized 20–30 second "word" timestamp.
  return karaokeMakerMaximumAutomaticWordDurationMs(text);
};

export type TKaraokeWhisperMemoryPolicy = 'ask' | 'auto' | 'keep';
export type TKaraokeWhisperSessionStatus =
  'unloaded' | 'loading' | 'ready' | 'working' | 'releasing' | 'error';

export interface IKaraokeWhisperMemorySettings {
  policy: TKaraokeWhisperMemoryPolicy;
  idleMinutes: 5 | 10 | 30;
}

export interface IKaraokeWhisperSessionSnapshot {
  status: TKaraokeWhisperSessionStatus;
  downloaded: boolean;
  inMemory: boolean;
  busy: boolean;
  releasePrompt: boolean;
  settings: IKaraokeWhisperMemorySettings;
}

const WHISPER_DOWNLOADED_KEY =
  'fluideq.karaoke.whisperDownloaded.v2.base-timestamped';
const WHISPER_MEMORY_SETTINGS_KEY = 'fluideq.karaoke.whisperMemory.v1';
const DEFAULT_WHISPER_MEMORY_SETTINGS: IKaraokeWhisperMemorySettings = {
  policy: 'ask',
  idleMinutes: 10,
};

const readWhisperDownloaded = (): boolean => {
  try {
    return window.localStorage.getItem(WHISPER_DOWNLOADED_KEY) === 'true';
  } catch {
    return false;
  }
};

export const readKaraokeWhisperMemorySettings =
  (): IKaraokeWhisperMemorySettings => {
    try {
      const parsed = JSON.parse(
        window.localStorage.getItem(WHISPER_MEMORY_SETTINGS_KEY) ?? 'null',
      ) as Partial<IKaraokeWhisperMemorySettings> | null;
      const policy = ['ask', 'auto', 'keep'].includes(parsed?.policy ?? '')
        ? (parsed?.policy as TKaraokeWhisperMemoryPolicy)
        : DEFAULT_WHISPER_MEMORY_SETTINGS.policy;
      const idleMinutes = [5, 10, 30].includes(parsed?.idleMinutes ?? 0)
        ? (parsed?.idleMinutes as 5 | 10 | 30)
        : DEFAULT_WHISPER_MEMORY_SETTINGS.idleMinutes;
      return { policy, idleMinutes };
    } catch {
      return DEFAULT_WHISPER_MEMORY_SETTINGS;
    }
  };

let whisperWorker: Worker | undefined;
let whisperActiveRecognitionTasks = 0;
let whisperIdleTimer: number | undefined;
const whisperSessionListeners = new Set<() => void>();
let whisperSessionSnapshot: IKaraokeWhisperSessionSnapshot = {
  status: 'unloaded',
  downloaded: readWhisperDownloaded(),
  inMemory: false,
  busy: false,
  releasePrompt: false,
  settings: readKaraokeWhisperMemorySettings(),
};

const emitWhisperSession = (
  update: Partial<IKaraokeWhisperSessionSnapshot>,
) => {
  whisperSessionSnapshot = { ...whisperSessionSnapshot, ...update };
  whisperSessionListeners.forEach((listener) => listener());
};

const clearWhisperIdleTimer = () => {
  if (whisperIdleTimer !== undefined) {
    window.clearTimeout(whisperIdleTimer);
    whisperIdleTimer = undefined;
  }
};

export const getKaraokeWhisperSessionSnapshot =
  (): IKaraokeWhisperSessionSnapshot => whisperSessionSnapshot;

export const subscribeKaraokeWhisperSession = (listener: () => void) => {
  whisperSessionListeners.add(listener);
  return () => whisperSessionListeners.delete(listener);
};

const markWhisperDownloaded = () => {
  try {
    window.localStorage.setItem(WHISPER_DOWNLOADED_KEY, 'true');
  } catch {
    // The in-memory session remains usable even when storage is unavailable.
  }
  emitWhisperSession({ downloaded: true });
};

export const refreshKaraokeWhisperDownloaded = async (): Promise<boolean> => {
  if (whisperSessionSnapshot.downloaded || typeof caches === 'undefined') {
    return whisperSessionSnapshot.downloaded;
  }
  try {
    const modelPath = WHISPER_MODEL.toLocaleLowerCase();
    const cacheNames = await caches.keys();
    const requestGroups = await Promise.all(
      cacheNames.map(async (cacheName) =>
        (await caches.open(cacheName)).keys(),
      ),
    );
    const modelUrls = requestGroups
      .flat()
      .map((request) => request.url.toLocaleLowerCase())
      .filter((url) => url.includes(modelPath));
    if (
      modelUrls.some((url) => url.includes('encoder_model')) &&
      modelUrls.some((url) => url.includes('decoder_model'))
    ) {
      markWhisperDownloaded();
      return true;
    }
  } catch {
    // Cache introspection is an optimization. The model loader remains the
    // source of truth when the browser hides its cache metadata.
  }
  return false;
};

export const releaseKaraokeWhisperModel = async (): Promise<boolean> => {
  if (
    whisperActiveRecognitionTasks > 0 ||
    whisperSessionSnapshot.status === 'releasing'
  ) {
    return false;
  }
  clearWhisperIdleTimer();
  const worker = whisperWorker;
  whisperWorker = undefined;
  emitWhisperSession({
    status: worker ? 'releasing' : 'unloaded',
    inMemory: false,
    busy: false,
    releasePrompt: false,
  });
  worker?.terminate();
  emitWhisperSession({ status: 'unloaded' });
  return true;
};

const scheduleWhisperIdleAction = () => {
  clearWhisperIdleTimer();
  if (
    !whisperWorker ||
    whisperActiveRecognitionTasks > 0 ||
    whisperSessionSnapshot.settings.policy === 'keep'
  ) {
    return;
  }
  whisperIdleTimer = window.setTimeout(() => {
    whisperIdleTimer = undefined;
    if (whisperSessionSnapshot.settings.policy === 'auto') {
      releaseKaraokeWhisperModel().catch(() => undefined);
      return;
    }
    emitWhisperSession({ releasePrompt: true });
  }, whisperSessionSnapshot.settings.idleMinutes * 60_000);
};

export const keepKaraokeWhisperModelForNow = () => {
  emitWhisperSession({ releasePrompt: false });
  scheduleWhisperIdleAction();
};

export const writeKaraokeWhisperMemorySettings = (
  settings: IKaraokeWhisperMemorySettings,
) => {
  try {
    window.localStorage.setItem(
      WHISPER_MEMORY_SETTINGS_KEY,
      JSON.stringify(settings),
    );
  } catch {
    // Apply the setting for this app session even when it cannot be persisted.
  }
  emitWhisperSession({ settings, releasePrompt: false });
  scheduleWhisperIdleAction();
};

const beginWhisperRecognition = () => {
  whisperActiveRecognitionTasks += 1;
  clearWhisperIdleTimer();
  emitWhisperSession({
    status: 'working',
    inMemory: true,
    busy: true,
    releasePrompt: false,
  });
};

const finishWhisperRecognition = () => {
  whisperActiveRecognitionTasks = Math.max(
    0,
    whisperActiveRecognitionTasks - 1,
  );
  if (whisperActiveRecognitionTasks === 0 && whisperWorker) {
    emitWhisperSession({ status: 'ready', inMemory: true, busy: false });
    scheduleWhisperIdleAction();
  }
};

export type TKaraokeMakerWhisperStage =
  'decode' | 'download' | 'load' | 'transcribe' | 'complete';

export interface IKaraokeMakerTranscriptWord {
  text: string;
  startMs: number;
  endMs: number;
  /** Reference lyric inferred inside a strongly confirmed Whisper sentence. */
  inferred?: boolean;
}

export interface IKaraokeMakerWhisperTranscript extends Array<IKaraokeMakerTranscriptWord> {
  /** Independent complete decodes. Never interleave these word streams. */
  passes?: IKaraokeMakerTranscriptWord[][];
}

export interface IKaraokeMakerDownloadProgress {
  loadedBytes?: number;
  totalBytes?: number;
  file?: string;
  complete?: boolean;
  summary?: IKaraokeMakerDownloadSummary;
}

export interface IKaraokeMakerDownloadFileProgress {
  file: string;
  loadedBytes: number;
  totalBytes?: number;
  complete: boolean;
}

export interface IKaraokeMakerDownloadSummary {
  files: IKaraokeMakerDownloadFileProgress[];
  loadedBytes: number;
  totalBytes?: number;
  completeFiles: number;
  fileCount: number;
  progress?: number;
}

interface IWhisperPipelineProgressEvent {
  progress?: number;
  status?: string;
  loaded?: number;
  total?: number;
  file?: string;
}

export interface IKaraokeMakerWhisperProgressUpdate {
  progress: number;
  message: string;
  stage: TKaraokeMakerWhisperStage;
  download?: IKaraokeMakerDownloadProgress;
}

export interface IKaraokeMakerWhisperTranscribeProgress {
  pass: number;
  totalPasses: number;
  completedChunks: number;
  totalChunks: number;
}

/**
 * Transformers.js interleaves lifecycle events from every model asset. Keep a
 * stable entry for each file so the UI never mistakes one file's byte counter
 * for another's or flickers between whichever event arrived most recently.
 */
export const accumulateKaraokeMakerDownloadProgress = (
  previous: IKaraokeMakerDownloadSummary | undefined,
  update: IKaraokeMakerDownloadProgress,
): IKaraokeMakerDownloadSummary | undefined => {
  const file = update.file?.trim();
  if (!file) {
    return previous;
  }
  const files = previous?.files.map((entry) => ({ ...entry })) ?? [];
  const existingIndex = files.findIndex((entry) => entry.file === file);
  const existing = existingIndex >= 0 ? files[existingIndex] : undefined;
  const reportedTotal =
    typeof update.totalBytes === 'number' &&
    Number.isFinite(update.totalBytes) &&
    update.totalBytes > 0
      ? update.totalBytes
      : undefined;
  const totalBytes = reportedTotal ?? existing?.totalBytes;
  const reportedLoaded =
    typeof update.loadedBytes === 'number' &&
    Number.isFinite(update.loadedBytes)
      ? Math.max(0, update.loadedBytes)
      : undefined;
  let loadedBytes = Math.max(existing?.loadedBytes ?? 0, reportedLoaded ?? 0);
  const complete =
    existing?.complete === true ||
    update.complete === true ||
    (totalBytes !== undefined && loadedBytes >= totalBytes);
  if (complete && totalBytes !== undefined) {
    loadedBytes = totalBytes;
  }
  const nextFile: IKaraokeMakerDownloadFileProgress = {
    file,
    loadedBytes,
    totalBytes,
    complete,
  };
  if (existingIndex >= 0) {
    files[existingIndex] = nextFile;
  } else {
    files.push(nextFile);
  }

  const completeFiles = files.filter((entry) => entry.complete).length;
  const allSizesKnown = files.every(
    (entry) => entry.totalBytes !== undefined && entry.totalBytes > 0,
  );
  const aggregateLoadedBytes = files.reduce(
    (sum, entry) => sum + entry.loadedBytes,
    0,
  );
  const aggregateTotalBytes = allSizesKnown
    ? files.reduce((sum, entry) => sum + (entry.totalBytes ?? 0), 0)
    : undefined;
  let progress: number | undefined;
  if (aggregateTotalBytes !== undefined && aggregateTotalBytes > 0) {
    progress = Math.min(1, aggregateLoadedBytes / aggregateTotalBytes);
  } else if (files.length > 0) {
    progress =
      files.reduce((sum, entry) => {
        if (entry.complete) {
          return sum + 1;
        }
        if (entry.totalBytes !== undefined && entry.totalBytes > 0) {
          return sum + Math.min(1, entry.loadedBytes / entry.totalBytes);
        }
        return sum;
      }, 0) / files.length;
  }

  return {
    files,
    loadedBytes: aggregateLoadedBytes,
    totalBytes: aggregateTotalBytes,
    completeFiles,
    fileCount: files.length,
    progress,
  };
};

export type TKaraokeMakerWhisperLogLevel = 'info' | 'warning' | 'error';

export interface IKaraokeMakerWhisperLogEntry {
  timestamp: string;
  elapsedMs: number;
  level: TKaraokeMakerWhisperLogLevel;
  event: string;
  message: string;
  stage?: TKaraokeMakerWhisperStage;
  data?: Record<string, unknown>;
  error?: string;
}

export type TKaraokeMakerWhisperLogger = (
  entry: IKaraokeMakerWhisperLogEntry,
) => void;

export const karaokeMakerWhisperErrorDetail = (
  error: unknown,
  depth = 0,
): string => {
  if (depth > 3) {
    return '[nested cause omitted]';
  }
  if (error instanceof Error) {
    const { cause } = error as Error & { cause?: unknown };
    return `${error.name}: ${error.message}${
      error.stack ? `\n${error.stack}` : ''
    }${cause !== undefined ? `\nCaused by: ${karaokeMakerWhisperErrorDetail(cause, depth + 1)}` : ''}`;
  }
  if (typeof error === 'string') {
    return error;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
};

export const formatKaraokeMakerWhisperLog = (
  entry: IKaraokeMakerWhisperLogEntry,
): string => {
  const elapsed = (entry.elapsedMs / 1_000).toFixed(2);
  const stage = entry.stage ? ` [${entry.stage}]` : '';
  const data = entry.data ? ` ${JSON.stringify(entry.data)}` : '';
  const error = entry.error ? `\n${entry.error}` : '';
  return `[${entry.timestamp} +${elapsed}s] ${entry.level.toUpperCase()}${stage} ${entry.event}: ${entry.message}${data}${error}`;
};

export const karaokeMakerWhisperTranscriptWords = (
  output: IWhisperOutput,
  approximateSegmentWords = false,
  audioDurationSeconds = 0,
): IKaraokeMakerTranscriptWord[] => {
  let chunks = output.chunks ?? [];
  if (!chunks.length && output.text?.trim()) {
    chunks = [
      {
        text: output.text,
        timestamp: [0, audioDurationSeconds],
      },
    ];
  }

  return chunks.flatMap((chunk): IKaraokeMakerTranscriptWord[] => {
    const text = chunk.text?.trim();
    const start = chunk.timestamp?.[0];
    const end = chunk.timestamp?.[1];
    if (!text || typeof start !== 'number') {
      return [];
    }
    if (!approximateSegmentWords) {
      return [
        {
          text,
          startMs: start * 1_000,
          endMs: (typeof end === 'number' ? end : start + 0.4) * 1_000,
        },
      ];
    }

    const segmentWords = text.split(/\s+/u).filter(Boolean);
    if (!segmentWords.length) {
      return [];
    }
    const safeEnd =
      typeof end === 'number' && end > start
        ? end
        : start + Math.max(0.4, segmentWords.length * 0.28);
    const wordDuration = (safeEnd - start) / segmentWords.length;
    return segmentWords.map((word, index) => ({
      text: word,
      startMs: (start + wordDuration * index) * 1_000,
      endMs: (start + wordDuration * (index + 1)) * 1_000,
    }));
  });
};

/**
 * Combine independent Whisper window passes without concatenating duplicate
 * transcriptions. A later pass may contribute a phrase omitted by the first,
 * but it never replaces or stretches an existing timestamp.
 */
export const mergeKaraokeMakerWhisperPasses = (
  passes: readonly (readonly IKaraokeMakerTranscriptWord[])[],
): IKaraokeMakerTranscriptWord[] => {
  const usablePasses = passes
    .map((pass) =>
      pass
        .filter(
          (word) =>
            normalizedWord(word.text) &&
            Number.isFinite(word.startMs) &&
            Number.isFinite(word.endMs) &&
            word.endMs > word.startMs,
        )
        .map((word) => ({ ...word }))
        .sort(
          (left, right) =>
            left.startMs - right.startMs || left.endMs - right.endMs,
        ),
    )
    .filter((pass) => pass.length);
  if (usablePasses.length <= 1) {
    return usablePasses[0] ?? [];
  }

  const merged = usablePasses[0].map((word) => ({ ...word }));
  usablePasses.slice(1).forEach((pass) => {
    pass.forEach((word) => {
      const normalized = normalizedWord(word.text);
      const wordDuration = Math.max(1, word.endMs - word.startMs);
      const wordCenter = (word.startMs + word.endMs) / 2;
      const sameWord = merged.find((existing) => {
        if (normalizedWord(existing.text) !== normalized) {
          return false;
        }
        const overlap = Math.max(
          0,
          Math.min(existing.endMs, word.endMs) -
            Math.max(existing.startMs, word.startMs),
        );
        const shortestDuration = Math.max(
          1,
          Math.min(wordDuration, existing.endMs - existing.startMs),
        );
        const centerDistance = Math.abs(
          (existing.startMs + existing.endMs) / 2 - wordCenter,
        );
        return overlap / shortestDuration >= 0.18 || centerDistance <= 160;
      });
      if (sameWord) {
        // Independent windows reduce boundary jitter. Keep the complete spoken
        // interval while using their mean onset/offset as a stable timestamp.
        sameWord.startMs = (sameWord.startMs + word.startMs) / 2;
        sameWord.endMs = (sameWord.endMs + word.endMs) / 2;
        return;
      }

      const contradictory = merged.some((existing) => {
        const overlap = Math.max(
          0,
          Math.min(existing.endMs, word.endMs) -
            Math.max(existing.startMs, word.startMs),
        );
        const shortestDuration = Math.max(
          1,
          Math.min(wordDuration, existing.endMs - existing.startMs),
        );
        return overlap / shortestDuration >= 0.62;
      });
      if (!contradictory) {
        merged.push({ ...word });
      }
    });
    merged.sort(
      (left, right) => left.startMs - right.startMs || left.endMs - right.endMs,
    );
  });
  return merged;
};

const karaokeMakerAbortError = (): DOMException =>
  new DOMException('Transcription cancelled.', 'AbortError');

export const karaokeMakerAbortableTask = <T>(
  task: Promise<T>,
  signal?: AbortSignal,
): Promise<T> => {
  if (!signal) {
    return task;
  }
  if (signal.aborted) {
    return Promise.reject(karaokeMakerAbortError());
  }
  return new Promise<T>((resolve, reject) => {
    const abort = () => {
      signal.removeEventListener('abort', abort);
      reject(karaokeMakerAbortError());
    };
    signal.addEventListener('abort', abort, { once: true });
    task.then(
      (value) => {
        signal.removeEventListener('abort', abort);
        resolve(value);
        return undefined;
      },
      (error) => {
        signal.removeEventListener('abort', abort);
        reject(error);
        return undefined;
      },
    );
  });
};

/**
 * Transformers.js reports download percentages per asset, followed by
 * non-numeric `done` and `ready` events while ONNX prepares the model. Keep
 * those events visible so a completed file does not look like a frozen 40%.
 */
export const karaokeMakerWhisperPipelineProgress = (
  event: IWhisperPipelineProgressEvent,
): IKaraokeMakerWhisperProgressUpdate => {
  const status = event.status?.trim().toLowerCase();
  if (status === 'ready') {
    return {
      progress: 0.5,
      message: 'Whisper model ready',
      stage: 'load',
    };
  }
  if (status === 'done') {
    return {
      progress: 0.4,
      message: 'Downloading Whisper model',
      stage: 'download',
      download: { file: event.file, complete: true },
    };
  }
  if (status === 'download') {
    return {
      progress: 0.04,
      message: 'Downloading Whisper model',
      stage: 'download',
      download: { file: event.file },
    };
  }
  if (status === 'initiate') {
    return {
      progress: 0.04,
      message: 'Checking Whisper model file',
      stage: 'download',
      download: { file: event.file },
    };
  }
  if (status === 'progress' && typeof event.progress === 'number') {
    const fileProgress = Math.min(100, Math.max(0, event.progress));
    const complete =
      fileProgress >= 100 ||
      (typeof event.loaded === 'number' &&
        typeof event.total === 'number' &&
        event.total > 0 &&
        event.loaded >= event.total);
    return {
      progress: 0.04 + (fileProgress / 100) * 0.36,
      message: 'Downloading Whisper model',
      stage: 'download',
      download: {
        loadedBytes: event.loaded,
        totalBytes: event.total,
        file: event.file,
        complete,
      },
    };
  }
  return {
    progress: 0.04,
    message: 'Checking Whisper model files',
    stage: 'load',
    download: event.file ? { file: event.file } : undefined,
  };
};

/** Download-on-demand Whisper transcription. Audio is processed locally. */
export const transcribeKaraokeWithWhisper = async (
  file: File,
  onProgress: (
    progress: number,
    message?: string,
    download?: IKaraokeMakerDownloadProgress,
    stage?: TKaraokeMakerWhisperStage,
    transcription?: IKaraokeMakerWhisperTranscribeProgress,
  ) => void,
  signal?: AbortSignal,
  onLog?: TKaraokeMakerWhisperLogger,
  language?: string,
): Promise<IKaraokeMakerWhisperTranscript> => {
  const startedAt = performance.now();
  const logWhisper = (
    level: TKaraokeMakerWhisperLogLevel,
    event: string,
    message: string,
    stage?: TKaraokeMakerWhisperStage,
    data?: Record<string, unknown>,
    error?: unknown,
  ) => {
    try {
      onLog?.({
        timestamp: new Date().toISOString(),
        elapsedMs: performance.now() - startedAt,
        level,
        event,
        message,
        stage,
        data,
        error:
          error === undefined
            ? undefined
            : karaokeMakerWhisperErrorDetail(error),
      });
    } catch {
      // Diagnostics can never be allowed to break transcription.
    }
  };
  const logAbort = () =>
    logWhisper(
      'warning',
      'run.cancelled',
      'The Whisper operation received an abort request.',
    );
  signal?.addEventListener('abort', logAbort, { once: true });
  logWhisper(
    'info',
    'run.start',
    'Starting local Whisper transcription.',
    'decode',
    {
      model: WHISPER_MODEL,
      audioFile: file.name,
      audioBytes: file.size,
      targetSampleRate: WHISPER_SAMPLE_RATE,
      recognitionPasses: 1,
      language: language?.trim() || 'auto',
      page: window.location.href,
    },
  );
  onProgress(0.01, 'Decoding audio', undefined, 'decode');
  logWhisper(
    'info',
    'audio.decode.start',
    'Decoding the selected audio locally.',
    'decode',
  );
  let samples: Float32Array;
  try {
    samples = await karaokeMakerAbortableTask(
      decodeMono(file, WHISPER_SAMPLE_RATE),
      signal,
    );
  } catch (error) {
    logWhisper(
      'error',
      'audio.decode.failed',
      'Audio decoding failed.',
      'decode',
      undefined,
      error,
    );
    signal?.removeEventListener('abort', logAbort);
    throw error;
  }
  logWhisper(
    'info',
    'audio.decode.complete',
    'Audio decoding completed.',
    'decode',
    {
      samples: samples.length,
      durationSeconds: Number(
        (samples.length / WHISPER_SAMPLE_RATE).toFixed(3),
      ),
    },
  );
  if (signal?.aborted) {
    signal.removeEventListener('abort', logAbort);
    throw new DOMException('Transcription cancelled.', 'AbortError');
  }
  const audioDurationSeconds = samples.length / WHISPER_SAMPLE_RATE;
  const downloadedAtStart =
    whisperSessionSnapshot.downloaded ||
    (await refreshKaraokeWhisperDownloaded());
  const workerWasReady = whisperSessionSnapshot.inMemory && whisperWorker;
  let workerStatusMessage = 'Checking speech model files';
  if (workerWasReady) {
    workerStatusMessage = 'Speech model is ready in memory';
  } else if (downloadedAtStart) {
    workerStatusMessage = 'Loading cached speech model';
  }
  onProgress(
    workerWasReady ? 0.52 : 0.04,
    workerStatusMessage,
    undefined,
    downloadedAtStart ? 'load' : 'download',
  );
  if (!whisperWorker) {
    whisperWorker = new Worker(
      new URL(
        process.env.NODE_ENV === 'production'
          ? './karaoke-whisper-worker.js'
          : '/karaoke-whisper-worker.dev.js',
        window.location.href,
      ),
    );
  }
  const worker = whisperWorker;
  const requestId = `whisper-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  let downloadSummary: IKaraokeMakerDownloadSummary | undefined;
  emitWhisperSession({
    status: workerWasReady ? 'working' : 'loading',
    busy: true,
  });
  beginWhisperRecognition();
  try {
    const result = await new Promise<{
      results: Array<{
        output: IWhisperOutput;
        approximateSegmentWords: boolean;
      }>;
    }>((resolve, reject) => {
      const cleanup = () => {
        worker.removeEventListener('message', onMessage);
        signal?.removeEventListener('abort', onAbort);
      };
      const onAbort = () => {
        cleanup();
        worker.terminate();
        if (whisperWorker === worker) {
          whisperWorker = undefined;
        }
        reject(new DOMException('Transcription cancelled.', 'AbortError'));
      };
      const onMessage = (event: MessageEvent<Record<string, unknown>>) => {
        if (event.data.id !== requestId) {
          return;
        }
        if (event.data.type === 'model-progress') {
          const progressEvent = event.data
            .event as IWhisperPipelineProgressEvent;
          const baseUpdate = karaokeMakerWhisperPipelineProgress(progressEvent);
          if (!downloadedAtStart && baseUpdate.download) {
            downloadSummary = accumulateKaraokeMakerDownloadProgress(
              downloadSummary,
              baseUpdate.download,
            );
          }
          logWhisper(
            'info',
            `model.asset.${progressEvent.status ?? 'unknown'}`,
            'Speech-model worker lifecycle event.',
            downloadedAtStart ? 'load' : 'download',
            event.data,
          );
          onProgress(
            !downloadedAtStart && downloadSummary?.progress !== undefined
              ? 0.04 + downloadSummary.progress * 0.36
              : baseUpdate.progress,
            downloadedAtStart
              ? 'Loading cached speech model'
              : baseUpdate.message,
            downloadedAtStart || !baseUpdate.download
              ? undefined
              : { ...baseUpdate.download, summary: downloadSummary },
            downloadedAtStart ? 'load' : baseUpdate.stage,
          );
        } else if (event.data.type === 'ready') {
          markWhisperDownloaded();
          emitWhisperSession({ inMemory: true });
        } else if (event.data.type === 'progress') {
          const transcription =
            event.data.stage === 'transcribe'
              ? {
                  pass: Number(event.data.pass) || 1,
                  totalPasses: Number(event.data.totalPasses) || 1,
                  completedChunks: Number(event.data.completedChunks) || 0,
                  totalChunks: Math.max(1, Number(event.data.totalChunks) || 1),
                }
              : undefined;
          onProgress(
            Number(event.data.progress) || 0.52,
            typeof event.data.message === 'string'
              ? event.data.message
              : undefined,
            undefined,
            event.data.stage as TKaraokeMakerWhisperStage,
            transcription,
          );
        } else if (event.data.type === 'timestamp-fallback') {
          logWhisper(
            'warning',
            'transcription.word-timestamps.fallback',
            'The model retried with segment timestamps.',
            'transcribe',
            event.data,
          );
        } else if (event.data.type === 'pass-warning') {
          logWhisper(
            'warning',
            'transcription.pass.failed',
            'One Whisper window pass failed; another successful pass will still be used.',
            'transcribe',
            event.data,
          );
        } else if (event.data.type === 'complete') {
          cleanup();
          const workerResults = Array.isArray(event.data.results)
            ? (
                event.data.results as Array<{
                  output: IWhisperOutput;
                  approximateSegmentWords?: boolean;
                }>
              ).map((entry) => ({
                output: entry.output,
                approximateSegmentWords: entry.approximateSegmentWords === true,
              }))
            : [
                {
                  output: event.data.output as IWhisperOutput,
                  approximateSegmentWords:
                    event.data.approximateSegmentWords === true,
                },
              ];
          resolve({
            results: workerResults,
          });
        } else if (event.data.type === 'error') {
          cleanup();
          reject(
            new Error(String(event.data.error ?? 'Speech recognition failed.')),
          );
        }
      };
      worker.addEventListener('message', onMessage);
      signal?.addEventListener('abort', onAbort, { once: true });
      worker.postMessage(
        {
          id: requestId,
          type: 'transcribe',
          samples,
          downloadedAtStart,
          language: language?.trim() || undefined,
        },
        [samples.buffer],
      );
    });
    const passWords = result.results
      .slice()
      .sort(
        (left, right) =>
          Number(left.approximateSegmentWords) -
          Number(right.approximateSegmentWords),
      )
      .map((entry) =>
        karaokeMakerWhisperTranscriptWords(
          entry.output,
          entry.approximateSegmentWords,
          audioDurationSeconds,
        ),
      );
    // The worker now returns one canonical chronological stream. Keep the
    // `passes` shape for backward-compatible project alignment without ever
    // constructing a contradictory merged transcript.
    const words = (passWords
      .slice()
      .sort((left, right) => right.length - left.length)[0]
      ?.map((word) => ({ ...word })) ?? []) as IKaraokeMakerWhisperTranscript;
    words.passes = passWords.map((pass) => pass.map((word) => ({ ...word })));
    const usedApproximateTimestamps = result.results.some(
      (entry) => entry.approximateSegmentWords,
    );
    logWhisper(
      'info',
      'transcription.complete',
      'Local speech recognition completed.',
      'complete',
      {
        recognizedWords: words.length,
        recognitionPasses: result.results.length,
        wordsByPass: passWords.map((pass) => pass.length),
        timestamps: usedApproximateTimestamps ? 'segment-estimated' : 'word',
      },
    );
    onProgress(1, 'Transcription complete', undefined, 'complete');
    return words;
  } finally {
    finishWhisperRecognition();
    signal?.removeEventListener('abort', logAbort);
  }
};

const normalizedWord = (value: string): string =>
  value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '');

const normalizedWordDistance = (left: string, right: string): number => {
  if (left === right) {
    return 0;
  }
  if (!left || !right) {
    return 4;
  }
  if (
    Math.min(left.length, right.length) >= 3 &&
    (left.includes(right) || right.includes(left))
  ) {
    return 1;
  }
  let previous = new Uint16Array(right.length + 1);
  let current = new Uint16Array(right.length + 1);
  for (let column = 0; column <= right.length; column += 1) {
    previous[column] = column;
  }
  for (let row = 1; row <= left.length; row += 1) {
    current[0] = row;
    for (let column = 1; column <= right.length; column += 1) {
      current[column] = Math.min(
        previous[column] + 1,
        current[column - 1] + 1,
        previous[column - 1] + (left[row - 1] === right[column - 1] ? 0 : 1),
      );
    }
    [previous, current] = [current, previous];
  }
  const ratio = previous[right.length] / Math.max(left.length, right.length);
  return ratio <= 0.34 ? 1 : 4;
};

/** Map one lyric phrase onto one bounded Whisper phrase. */
const alignWordSequenceSegment = (
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
    previous[column] = column * 2;
  }
  for (let row = 1; row <= lyricCount; row += 1) {
    current[0] = row * 2;
    for (let column = 1; column <= transcriptCount; column += 1) {
      const distance = normalizedWordDistance(
        normalizedWord(lyrics[row - 1].text),
        normalizedWord(transcript[column - 1].text),
      );
      const diagonal = previous[column - 1] + distance;
      const removeLyric = previous[column] + 2;
      const skipTranscript = current[column - 1] + 2;
      const best = Math.min(diagonal, removeLyric, skipTranscript);
      current[column] = best;
      let direction = 3;
      // In an exact tie, keep the earliest lyric occurrence matched and skip
      // the later duplicate. Otherwise one omitted repeated chorus/line makes
      // Whisper's first performance attach to the second reference copy.
      if (best === removeLyric) {
        direction = 2;
      } else if (best === diagonal) {
        direction = 1;
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
        normalizedWordDistance(
          normalizedWord(lyrics[row - 1].text),
          normalizedWord(transcript[column - 1].text),
        ) <= 1
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

/**
 * Align one sentence while pinning the lyric anchor to the exact Whisper
 * occurrence that produced the candidate. An unconstrained edit-distance
 * backtrack naturally prefers the last copy when two performances of the
 * same line fit in the local window. That made a real first performance
 * disappear whenever the singer repeated the phrase immediately afterward.
 */
const alignWordSequenceAtOccurrence = (
  lyrics: readonly IKaraokeMakerToken[],
  transcript: readonly IKaraokeMakerTranscriptWord[],
  lyricAnchorIndex: number,
  transcriptAnchorIndex: number,
): Map<string, IKaraokeMakerTranscriptWord> => {
  const mapping = alignWordSequenceSegment(
    lyrics.slice(0, lyricAnchorIndex),
    transcript.slice(0, transcriptAnchorIndex),
  );
  const lyricAnchor = lyrics[lyricAnchorIndex];
  const transcriptAnchor = transcript[transcriptAnchorIndex];
  if (
    lyricAnchor &&
    transcriptAnchor &&
    normalizedWordDistance(
      normalizedWord(lyricAnchor.text),
      normalizedWord(transcriptAnchor.text),
    ) <= 1
  ) {
    mapping.set(lyricAnchor.id, transcriptAnchor);
  }
  alignWordSequenceSegment(
    lyrics.slice(lyricAnchorIndex + 1),
    transcript.slice(transcriptAnchorIndex + 1),
  ).forEach((timing, tokenId) => mapping.set(tokenId, timing));
  return mapping;
};

/**
 * A single short word is not a trustworthy speech anchor. Whisper can emit
 * common fragments such as "a", "I", or "oh" over an instrumental passage;
 * accepting one of those in isolation is enough to pull an otherwise missing
 * lyric line into the music. Keep them only when neighbouring lyric and
 * transcript words form one locally coherent spoken phrase.
 */
const pruneWeakDirectMappings = (
  lyrics: readonly IKaraokeMakerToken[],
  transcript: readonly IKaraokeMakerTranscriptWord[],
  mapping: ReadonlyMap<string, IKaraokeMakerTranscriptWord>,
): Map<string, IKaraokeMakerTranscriptWord> => {
  const transcriptIndexes = new Map(
    transcript.map((word, index) => [word, index] as const),
  );
  const pairs = lyrics.flatMap((token, lyricIndex) => {
    const word = mapping.get(token.id);
    const transcriptIndex = word ? transcriptIndexes.get(word) : undefined;
    return word && transcriptIndex !== undefined
      ? [{ token, word, lyricIndex, transcriptIndex }]
      : [];
  });
  const coherentWith = (
    current: (typeof pairs)[number],
    neighbour: (typeof pairs)[number] | undefined,
  ): boolean => {
    if (!neighbour) {
      return false;
    }
    const lyricDistance = Math.abs(current.lyricIndex - neighbour.lyricIndex);
    const transcriptDistance = Math.abs(
      current.transcriptIndex - neighbour.transcriptIndex,
    );
    let timeDistance = 0;
    if (current.word.startMs >= neighbour.word.endMs) {
      timeDistance = current.word.startMs - neighbour.word.endMs;
    } else if (neighbour.word.startMs >= current.word.endMs) {
      timeDistance = neighbour.word.startMs - current.word.endMs;
    }
    return (
      lyricDistance <= 2 && transcriptDistance <= 2 && timeDistance <= 2_500
    );
  };
  const pruned = new Map(mapping);
  pairs.forEach((pair, index) => {
    const normalized = normalizedWord(pair.token.text);
    const isShort = Array.from(normalized).length <= 2;
    const isProviderSyllableGroup =
      pair.token.startsWord === false ||
      lyrics[pair.lyricIndex + 1]?.startsWord === false;
    const isApproximate =
      normalizedWordDistance(normalized, normalizedWord(pair.word.text)) > 0;
    const hasPhraseSupport =
      coherentWith(pair, pairs[index - 1]) ||
      coherentWith(pair, pairs[index + 1]);
    const previousTranscript = transcript[pair.transcriptIndex - 1];
    const nextTranscript = transcript[pair.transcriptIndex + 1];
    const hasRecognizedSpeechNeighbour =
      (previousTranscript !== undefined &&
        pair.word.startMs - previousTranscript.endMs <= 2_500) ||
      (nextTranscript !== undefined &&
        nextTranscript.startMs - pair.word.endMs <= 2_500);
    if (
      (lyrics.length > 1 &&
        !isProviderSyllableGroup &&
        !hasRecognizedSpeechNeighbour &&
        !hasPhraseSupport) ||
      ((isShort || (isApproximate && normalized.length <= 3)) &&
        !hasPhraseSupport)
    ) {
      pruned.delete(pair.token.id);
    }
  });
  return pruned;
};

/**
 * Make automatic word windows safe without relocating Whisper evidence.
 * Small timestamp overlap is trimmed. A mapping that is out of order or falls
 * on the wrong side of a manual anchor is rejected instead of being pushed to
 * a different part of the song.
 */
const constrainAutomaticWordTiming = (
  lyrics: readonly IKaraokeMakerToken[],
  mapping: ReadonlyMap<string, IKaraokeMakerTranscriptWord>,
  durationMs: number,
): Map<string, IKaraokeMakerTranscriptWord> => {
  const constrained = new Map<string, IKaraokeMakerTranscriptWord>();
  let previousEndMs = 0;
  lyrics.forEach((token, tokenIndex) => {
    if (
      token.timingLocked &&
      token.startMs !== undefined &&
      token.endMs !== undefined
    ) {
      previousEndMs = Math.max(previousEndMs, token.endMs);
      return;
    }
    const proposed = mapping.get(token.id);
    if (!proposed) {
      return;
    }
    const nextProtected = lyrics
      .slice(tokenIndex + 1)
      .find(
        (candidate) =>
          candidate.timingLocked && candidate.startMs !== undefined,
      );
    const upperBoundMs = Math.min(
      durationMs > 0 ? durationMs : Number.POSITIVE_INFINITY,
      nextProtected?.startMs ?? Number.POSITIVE_INFINITY,
    );
    if (proposed.endMs <= previousEndMs || proposed.startMs >= upperBoundMs) {
      return;
    }
    const startMs = Math.max(previousEndMs, proposed.startMs);
    const endMs = Math.min(
      upperBoundMs,
      proposed.endMs,
      startMs + maximumAutomaticWordDurationMs(token.text),
    );
    if (endMs - startMs < 20) {
      return;
    }
    constrained.set(token.id, { ...proposed, startMs, endMs });
    previousEndMs = endMs;
  });
  return constrained;
};

const constrainTranscriptWords = (
  words: readonly IKaraokeMakerTranscriptWord[],
): IKaraokeMakerTranscriptWord[] => {
  let previousEndMs = 0;
  return words.map((word, index) => {
    const startMs = Math.max(previousEndMs, Math.max(0, word.startMs));
    const nextStartMs = words[index + 1]?.startMs;
    const plausibleEndMs = Math.min(
      word.endMs,
      startMs + maximumAutomaticWordDurationMs(word.text),
    );
    const unclampedEndMs = Math.max(startMs + 1, plausibleEndMs);
    const endMs =
      nextStartMs !== undefined && nextStartMs > startMs
        ? Math.max(startMs + 1, Math.min(unclampedEndMs, nextStartMs))
        : unclampedEndMs;
    previousEndMs = endMs;
    return { ...word, startMs, endMs };
  });
};

interface IKaraokeMakerAlignmentWord {
  word: IKaraokeMakerToken;
  tokens: IKaraokeMakerToken[];
  lineIndex: number;
}

/** Treat provider/FluidEQ syllable tokens as one readable word for Whisper. */
const karaokeMakerAlignmentWords = (
  project: IKaraokeMakerProject,
): IKaraokeMakerAlignmentWord[] =>
  project.lyrics.lines
    .filter((line) => !karaokeMakerLineIsSection(line))
    .flatMap((line, lineIndex) => {
      const groups: IKaraokeMakerToken[][] = [];
      line.tokens.forEach((token) => {
        if (!groups.length || token.startsWord !== false) {
          groups.push([token]);
        } else {
          groups[groups.length - 1].push(token);
        }
      });
      return groups.map((tokens) => {
        const validTokens = tokens.map((token) => {
          const validTiming =
            token.startMs !== undefined &&
            token.endMs !== undefined &&
            karaokeMakerWordDurationIsPlausible(
              token.text,
              token.endMs - token.startMs,
              token.source,
            );
          return validTiming
            ? token
            : {
                ...token,
                startMs: undefined,
                endMs: undefined,
                confidence: undefined,
                timingLocked: undefined,
              };
        });
        const timed = validTokens.filter(
          (token) => token.startMs !== undefined && token.endMs !== undefined,
        );
        const first = validTokens[0];
        return {
          tokens: validTokens,
          lineIndex,
          word: {
            ...first,
            text: tokens.map((token) => token.text).join(''),
            startMs: timed.length
              ? Math.min(...timed.map((token) => token.startMs as number))
              : undefined,
            endMs: timed.length
              ? Math.max(...timed.map((token) => token.endMs as number))
              : undefined,
            timingLocked:
              validTokens.some((token) => token.timingLocked) || undefined,
          },
        };
      });
    });

interface IKaraokeMakerSentenceCandidate {
  mapping: Map<string, IKaraokeMakerTranscriptWord>;
  endMs: number;
  mappedWords: number;
  score: number;
  startMs: number;
}

/**
 * Whisper often drops short sung words even when it recognises the surrounding
 * sentence. Once both sentence edges and enough interior words are confirmed,
 * keep the supplied lyrics authoritative and place only the missing interior
 * words inside that same continuous vocal phrase. Weak/partial matches are left
 * untouched so they cannot paint a whole verse over music.
 */
const fillConfirmedSentenceGaps = (
  lyrics: readonly IKaraokeMakerToken[],
  phrase: readonly IKaraokeMakerTranscriptWord[],
  directMapping: ReadonlyMap<string, IKaraokeMakerTranscriptWord>,
): Map<string, IKaraokeMakerTranscriptWord> => {
  const result = new Map(directMapping);
  if (lyrics.length < 3) {
    return result;
  }
  const phraseIndexes = new Map(
    phrase.map((word, index) => [word, index] as const),
  );
  const anchors = lyrics.flatMap((lyric, lyricIndex) => {
    const timing = directMapping.get(lyric.id);
    const phraseIndex = timing ? phraseIndexes.get(timing) : undefined;
    return timing && phraseIndex !== undefined
      ? [{ lyric, lyricIndex, phraseIndex, timing }]
      : [];
  });
  const first = anchors[0];
  const last = anchors[anchors.length - 1];
  const requiredEvidence = Math.max(3, Math.ceil(lyrics.length * 0.55));
  const hasExactEdges =
    first?.lyricIndex === 0 &&
    last?.lyricIndex === lyrics.length - 1 &&
    normalizedWordDistance(
      normalizedWord(first.lyric.text),
      normalizedWord(first.timing.text),
    ) === 0 &&
    normalizedWordDistance(
      normalizedWord(last.lyric.text),
      normalizedWord(last.timing.text),
    ) === 0;
  if (!hasExactEdges || anchors.length < requiredEvidence) {
    return result;
  }

  anchors.slice(1).forEach((right, anchorIndex) => {
    const left = anchors[anchorIndex];
    const missingLyrics = lyrics.slice(left.lyricIndex + 1, right.lyricIndex);
    if (!missingLyrics.length) {
      return;
    }
    const availableStartMs = left.timing.endMs;
    const availableEndMs = right.timing.startMs;
    const availableDurationMs = availableEndMs - availableStartMs;
    if (
      availableDurationMs < missingLyrics.length * 25 ||
      availableDurationMs > Math.max(2_500, missingLyrics.length * 1_200)
    ) {
      return;
    }
    const recognizedBetween = phrase.slice(
      left.phraseIndex + 1,
      right.phraseIndex,
    );
    if (recognizedBetween.length >= missingLyrics.length) {
      missingLyrics.forEach((lyric, missingIndex) => {
        const groupStart = Math.floor(
          (missingIndex * recognizedBetween.length) / missingLyrics.length,
        );
        const groupEnd = Math.max(
          groupStart + 1,
          Math.floor(
            ((missingIndex + 1) * recognizedBetween.length) /
              missingLyrics.length,
          ),
        );
        const words = recognizedBetween.slice(groupStart, groupEnd);
        result.set(lyric.id, {
          text: lyric.text,
          startMs: words[0].startMs,
          endMs: words[words.length - 1].endMs,
          inferred: true,
        });
      });
      return;
    }

    const weights = missingLyrics.map((lyric) =>
      Math.max(1, Array.from(normalizedWord(lyric.text)).length),
    );
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    let consumedWeight = 0;
    missingLyrics.forEach((lyric, missingIndex) => {
      const startMs =
        availableStartMs + (availableDurationMs * consumedWeight) / totalWeight;
      consumedWeight += weights[missingIndex];
      const endMs =
        availableStartMs + (availableDurationMs * consumedWeight) / totalWeight;
      result.set(lyric.id, {
        text: lyric.text,
        startMs,
        endMs,
        inferred: true,
      });
    });
  });
  return result;
};

const sentenceCandidatesForPass = (
  line: readonly IKaraokeMakerAlignmentWord[],
  transcript: readonly IKaraokeMakerTranscriptWord[],
): IKaraokeMakerSentenceCandidate[] => {
  const lyrics = line.map((group) => group.word);
  const transcriptIndexes = new Map(
    transcript.map((word, index) => [word, index] as const),
  );
  const candidates: IKaraokeMakerSentenceCandidate[] = [];
  const maximumWords = Math.max(
    lyrics.length + 6,
    Math.ceil(lyrics.length * 1.8),
  );
  const maximumSpanMs = Math.max(12_000, lyrics.length * 1_500);
  // A sung attack is the least reliable part of a line: Whisper frequently
  // drops the first few words under accompaniment. Search the complete lyric
  // sentence for an exact anchor, then require multi-word local evidence and
  // let the song-wide monotonic route decide which repeated performance wins.
  const anchorCount = lyrics.length;

  for (let anchorIndex = 0; anchorIndex < anchorCount; anchorIndex += 1) {
    const anchor = normalizedWord(lyrics[anchorIndex].text);
    if (!anchor) {
      return candidates;
    }
    transcript.forEach((word, transcriptIndex) => {
      const anchorDistance = normalizedWordDistance(
        anchor,
        normalizedWord(word.text),
      );
      if (
        anchorDistance !== 0 &&
        !(line[anchorIndex].tokens.length > 1 && anchorDistance <= 1)
      ) {
        return;
      }
      let phraseStart = transcriptIndex;
      const desiredPrefix = anchorIndex + 2;
      while (
        phraseStart > 0 &&
        transcriptIndex - phraseStart < desiredPrefix &&
        transcript[phraseStart].startMs - transcript[phraseStart - 1].endMs <=
          2_500
      ) {
        phraseStart -= 1;
      }
      let phraseEnd = transcriptIndex + 1;
      // Keep this candidate close to its anchor. In particular, do not let a
      // phrase beginning at the first performance consume the complete next
      // performance of the same lyric line.
      const localPhraseEnd = Math.min(
        transcript.length,
        transcriptIndex + (lyrics.length - anchorIndex) + 3,
      );
      while (
        phraseEnd < localPhraseEnd &&
        phraseEnd - phraseStart < maximumWords &&
        transcript[phraseEnd].startMs - transcript[phraseEnd - 1].endMs <=
          2_500 &&
        transcript[phraseEnd].endMs - transcript[phraseStart].startMs <=
          maximumSpanMs
      ) {
        phraseEnd += 1;
      }
      const phrase = transcript.slice(phraseStart, phraseEnd);
      const candidateMapping = pruneWeakDirectMappings(
        lyrics,
        phrase,
        alignWordSequenceAtOccurrence(
          lyrics,
          phrase,
          anchorIndex,
          transcriptIndex - phraseStart,
        ),
      );
      const mappedAnchor = candidateMapping.get(lyrics[anchorIndex].id);
      if (mappedAnchor !== word) {
        return;
      }
      const pairs = lyrics.flatMap((lyric, lyricIndex) => {
        const timing = candidateMapping.get(lyric.id);
        const matchedIndex = timing ? transcriptIndexes.get(timing) : undefined;
        return timing && matchedIndex !== undefined
          ? [{ lyric, lyricIndex, timing, transcriptIndex: matchedIndex }]
          : [];
      });
      const minimumEvidence =
        lyrics.length === 1 ? 1 : Math.max(2, Math.ceil(lyrics.length * 0.32));
      if (pairs.length < minimumEvidence) {
        return;
      }
      const exactMatches = pairs.filter(
        ({ lyric, timing }) =>
          normalizedWordDistance(
            normalizedWord(lyric.text),
            normalizedWord(timing.text),
          ) === 0,
      ).length;
      const first = pairs[0];
      const last = pairs[pairs.length - 1];
      const coverage = pairs.length / lyrics.length;
      const edgeSupport =
        Number(first.lyricIndex === 0) +
        Number(last.lyricIndex === lyrics.length - 1);
      const sentenceStartSupport =
        first.lyricIndex === 0 ? Math.max(1_500, lyrics.length * 650) : 0;
      candidates.push({
        mapping: fillConfirmedSentenceGaps(lyrics, phrase, candidateMapping),
        startMs: first.timing.startMs,
        endMs: last.timing.endMs,
        mappedWords: pairs.length,
        score:
          pairs.length * 1_000 +
          exactMatches * 80 +
          coverage * 100 +
          edgeSupport * 20 +
          sentenceStartSupport,
      });
    });
  }

  const deduplicated = new Map<string, IKaraokeMakerSentenceCandidate>();
  candidates.forEach((candidate) => {
    const key = `${Math.round(candidate.startMs / 120)}:${Math.round(
      candidate.endMs / 120,
    )}`;
    const prior = deduplicated.get(key);
    if (!prior || candidate.score > prior.score) {
      deduplicated.set(key, candidate);
    }
  });
  const uniqueCandidates = [...deduplicated.values()];
  return uniqueCandidates.sort(
    (left, right) => left.startMs - right.startMs || right.score - left.score,
  );
};

/**
 * Build one monotonic route through all lyric sentences. Each sentence uses a
 * single continuous Whisper phrase, but the route is solved across the whole
 * song so repeated verses take distinct chronological performances instead of
 * a greedy early choice shifting every later line.
 */
const alignLyricsBySentence = (
  groups: readonly IKaraokeMakerAlignmentWord[],
  transcripts: readonly (readonly IKaraokeMakerTranscriptWord[])[],
): Map<string, IKaraokeMakerTranscriptWord> => {
  const lineGroups = new Map<number, IKaraokeMakerAlignmentWord[]>();
  groups.forEach((group) => {
    const values = lineGroups.get(group.lineIndex) ?? [];
    values.push(group);
    lineGroups.set(group.lineIndex, values);
  });
  const lines = [...lineGroups.values()];
  interface IRouteNode {
    candidate: IKaraokeMakerSentenceCandidate;
    coveredLines: number;
    lineIndex: number;
    previous?: IRouteNode;
    score: number;
  }
  const compareRoutes = (left: IRouteNode, right: IRouteNode): number =>
    right.coveredLines - left.coveredLines ||
    right.score - left.score ||
    left.candidate.startMs - right.candidate.startMs;
  const priorNodes: IRouteNode[] = [];
  lines.forEach((line, lineIndex) => {
    const candidates = transcripts.flatMap((transcript) =>
      sentenceCandidatesForPass(line, transcript),
    );
    candidates.forEach((candidate) => {
      const previous = priorNodes
        .filter(
          (node) =>
            node.lineIndex < lineIndex &&
            node.candidate.endMs <= candidate.startMs + 40,
        )
        .sort(compareRoutes)[0];
      priorNodes.push({
        candidate,
        coveredLines: (previous?.coveredLines ?? 0) + 1,
        lineIndex,
        previous,
        score: candidate.score + (previous?.score ?? 0),
      });
    });
  });
  const mapping = new Map<string, IKaraokeMakerTranscriptWord>();
  let node: IRouteNode | undefined = priorNodes.sort(compareRoutes)[0];
  while (node) {
    node.candidate.mapping.forEach((timing, tokenId) =>
      mapping.set(tokenId, timing),
    );
    node = node.previous;
  }
  return mapping;
};

/** Whisper occasionally returns a sung word as two adjacent fragments. */
const mergeTranscriptFragmentsForLyrics = (
  lyrics: readonly IKaraokeMakerToken[],
  transcript: readonly IKaraokeMakerTranscriptWord[],
): IKaraokeMakerTranscriptWord[] => {
  const lyricWords = new Set(lyrics.map((token) => normalizedWord(token.text)));
  const merged: IKaraokeMakerTranscriptWord[] = [];
  for (let index = 0; index < transcript.length; index += 1) {
    let take = 1;
    for (
      let candidateCount = Math.min(4, transcript.length - index);
      candidateCount >= 2;
      candidateCount -= 1
    ) {
      const candidate = transcript
        .slice(index, index + candidateCount)
        .map((word) => normalizedWord(word.text))
        .join('');
      const candidateWords = transcript.slice(index, index + candidateCount);
      const hasLargeGap = candidateWords.some(
        (word, wordIndex) =>
          wordIndex > 0 &&
          word.startMs - candidateWords[wordIndex - 1].endMs > 350,
      );
      if (!hasLargeGap && lyricWords.has(candidate)) {
        take = candidateCount;
        break;
      }
    }
    const words = transcript.slice(index, index + take);
    merged.push({
      text: words.map((word) => word.text).join(''),
      startMs: words[0].startMs,
      endMs: words[words.length - 1].endMs,
    });
    index += take - 1;
  }
  return merged;
};

const distributeAlignmentWordTiming = (
  group: IKaraokeMakerAlignmentWord,
  timing: IKaraokeMakerTranscriptWord,
): Map<string, IKaraokeMakerTranscriptWord> => {
  const distributed = new Map<string, IKaraokeMakerTranscriptWord>();
  if (group.tokens.length === 1) {
    distributed.set(group.tokens[0].id, timing);
    return distributed;
  }
  const existingDurations = group.tokens.map((token) =>
    token.startMs !== undefined && token.endMs !== undefined
      ? Math.max(1, token.endMs - token.startMs)
      : 0,
  );
  const usesExistingRatio = existingDurations.every((duration) => duration > 0);
  const weights = usesExistingRatio
    ? existingDurations
    : group.tokens.map((token) =>
        Math.max(1, Array.from(normalizedWord(token.text)).length),
      );
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  let consumed = 0;
  group.tokens.forEach((token, index) => {
    const startMs =
      timing.startMs +
      ((timing.endMs - timing.startMs) * consumed) / totalWeight;
    consumed += weights[index];
    const endMs =
      timing.startMs +
      ((timing.endMs - timing.startMs) * consumed) / totalWeight;
    distributed.set(token.id, {
      text: token.text,
      startMs,
      endMs: Math.max(startMs + 1, endMs),
      inferred: timing.inferred,
    });
  });
  return distributed;
};

export const applyWhisperTranscript = (
  project: IKaraokeMakerProject,
  transcript: readonly IKaraokeMakerTranscriptWord[] & {
    passes?: readonly (readonly IKaraokeMakerTranscriptWord[])[];
  },
): IKaraokeMakerProject => {
  const alignmentGroups = karaokeMakerAlignmentWords(project);
  const existing = alignmentGroups.map(({ word }) => word);
  const sourcePasses = transcript.passes?.length
    ? transcript.passes
    : [transcript];
  const alignmentPasses = sourcePasses.map((pass) => {
    const transcriptOffsetMs = pass.length
      ? karaokeMakerAnalysisOffsetMs(
          project,
          Math.min(...pass.map((word) => word.startMs)),
        )
      : 0;
    const shifted = constrainTranscriptWords(
      pass.map((word) => ({
        ...word,
        startMs: word.startMs + transcriptOffsetMs,
        endMs: word.endMs + transcriptOffsetMs,
      })),
    );
    return mergeTranscriptFragmentsForLyrics(existing, shifted);
  });
  const canonicalSinglePass = transcript.passes?.length === 1;
  const refinementPasses = project.analysis.whisperPasses ?? 0;
  if (!existing.length) {
    // Whisper is evidence for timing; it is not the lyric author. The Maker
    // intentionally requires supplied lyrics, so a hallucinated transcript
    // over music can never become visible karaoke text through this API.
    return touchKaraokeMakerProject({
      ...project,
      provenance: upsertProvenance(project.provenance, WHISPER_PROVENANCE),
      analysis: {
        ...project.analysis,
        whisperPasses: refinementPasses + 1,
        whisperAlignmentVersion: KARAOKE_MAKER_WHISPER_ALIGNMENT_VERSION,
      },
    });
  }
  const timingIsOrdered = existing.map((token, index) => {
    if (token.startMs === undefined || token.endMs === undefined) {
      return false;
    }
    const previous = existing[index - 1];
    const next = existing[index + 1];
    return (
      (previous?.endMs === undefined || token.startMs >= previous.endMs) &&
      (next?.startMs === undefined || token.endMs <= next.startMs)
    );
  });
  const alignmentTranscript =
    alignmentPasses
      .slice()
      .sort((left, right) => right.length - left.length)[0] ?? [];
  const directMapping = alignLyricsBySentence(alignmentGroups, alignmentPasses);
  // Whisper timestamps are the only automatic timing evidence. Missing words
  // are filled only inside a strongly confirmed sentence; unmatched lines and
  // long gaps remain untimed so instrumental sections never receive lyrics.
  // Repeated runs use different Whisper window sizes. Keep a complete earlier
  // line when the new run misses that line entirely, but only when its direct
  // timings were high-confidence and ordered. Any current evidence on the line
  // replaces it, preventing a stale false positive from surviving correction.
  const refinedMapping = new Map(directMapping);
  // Legacy projects may have been refined by several independent profiles.
  // The new worker marks its one canonical pass explicitly; in that mode the
  // current acoustic evidence replaces stale automatic timings instead of
  // averaging them and reintroducing drift from an older analysis.
  if (refinementPasses > 0 && !canonicalSinglePass) {
    const linesWithCurrentEvidence = new Set(
      alignmentGroups
        .filter((group) => directMapping.has(group.word.id))
        .map((group) => group.lineIndex),
    );
    alignmentGroups.forEach((group, index) => {
      const token = existing[index];
      if (
        linesWithCurrentEvidence.has(group.lineIndex) ||
        token.timingLocked ||
        token.source !== 'whisper' ||
        token.startMs === undefined ||
        token.endMs === undefined ||
        (token.confidence ?? 0) < 0.8 ||
        !timingIsOrdered[index]
      ) {
        return;
      }
      refinedMapping.set(token.id, {
        text: token.text,
        startMs: token.startMs,
        endMs: token.endMs,
      });
    });
    existing.forEach((token, index) => {
      if (
        token.timingLocked ||
        token.source !== 'whisper' ||
        token.startMs === undefined ||
        token.endMs === undefined ||
        !timingIsOrdered[index]
      ) {
        return;
      }
      const nextTiming = refinedMapping.get(token.id);
      const isDirect = !nextTiming?.inferred;
      if (!nextTiming) {
        return;
      }
      const largestDelta = Math.max(
        Math.abs(nextTiming.startMs - token.startMs),
        Math.abs(nextTiming.endMs - token.endMs),
      );
      if (isDirect && (token.confidence ?? 0) >= 0.8 && largestDelta <= 1_200) {
        const priorWeight = Math.min(3, refinementPasses);
        refinedMapping.set(token.id, {
          ...nextTiming,
          startMs:
            (token.startMs * priorWeight + nextTiming.startMs) /
            (priorWeight + 1),
          endMs:
            (token.endMs * priorWeight + nextTiming.endMs) / (priorWeight + 1),
        });
      }
    });
  }
  const mapping = constrainAutomaticWordTiming(
    existing,
    refinedMapping,
    project.audio.durationMs ??
      alignmentTranscript[alignmentTranscript.length - 1]?.endMs ??
      0,
  );
  const tokenMapping = new Map<string, IKaraokeMakerTranscriptWord>();
  alignmentGroups.forEach((group) => {
    const timing = mapping.get(group.word.id);
    if (!timing || group.word.timingLocked) {
      return;
    }
    distributeAlignmentWordTiming(group, timing).forEach((word, tokenId) =>
      tokenMapping.set(tokenId, word),
    );
  });
  const lines = project.lyrics.lines.map((line) => ({
    ...line,
    tokens: line.tokens.map((token) => {
      const hasPlausibleLockedTiming =
        token.timingLocked &&
        token.startMs !== undefined &&
        token.endMs !== undefined &&
        karaokeMakerWordDurationIsPlausible(
          token.text,
          token.endMs - token.startMs,
          token.source,
        );
      if (karaokeMakerLineIsSection(line) || hasPlausibleLockedTiming) {
        return token;
      }
      const word = tokenMapping.get(token.id);
      const canPreserveWithoutEvidence =
        (token.source === 'manual' || token.timingLocked) &&
        (token.startMs === undefined ||
          token.endMs === undefined ||
          karaokeMakerWordDurationIsPlausible(
            token.text,
            token.endMs - token.startMs,
            token.source,
          ));
      if (word) {
        return {
          ...token,
          startMs: word.startMs,
          endMs: word.endMs,
          confidence: word.inferred
            ? Math.min(0.78, 0.62 + refinementPasses * 0.04)
            : Math.min(0.96, 0.82 + refinementPasses * 0.04),
          source: 'whisper' as const,
        };
      }
      if (canPreserveWithoutEvidence) {
        return token;
      }
      return {
        ...token,
        startMs: undefined,
        endMs: undefined,
        confidence: undefined,
        source: 'whisper' as const,
      };
    }),
  }));
  return touchKaraokeMakerProject(
    synchronizeKaraokeMakerSections({
      ...project,
      lyrics: { ...project.lyrics, source: 'whisper', lines },
      provenance: upsertProvenance(project.provenance, WHISPER_PROVENANCE),
      analysis: {
        ...project.analysis,
        whisperPasses: refinementPasses + 1,
        whisperAlignmentVersion: KARAOKE_MAKER_WHISPER_ALIGNMENT_VERSION,
      },
    }),
  );
};

export const applyBasicPitchMelody = (
  project: IKaraokeMakerProject,
  notes: readonly IKaraokeMakerAnalysisNote[],
  repairWordTiming = false,
): IKaraokeMakerProject => {
  const repairedProject = repairWordTiming
    ? repairEstimatedWhisperTimingWithMelody(project, notes)
    : project;
  const aligned = autoAlignNotesOnly(
    repairedProject,
    karaokeMakerMelodyNotesForLyrics(repairedProject, notes),
    'basic-pitch',
  );
  return touchKaraokeMakerProject(
    synchronizeKaraokeMakerSections({
      ...aligned,
      provenance: upsertProvenance(aligned.provenance, BASIC_PITCH_PROVENANCE),
    }),
  );
};

/** Apply the lightweight local detector without relabelling it as Basic Pitch. */
export const applyDetectedPitchMelody = (
  project: IKaraokeMakerProject,
  notes: readonly IKaraokeMakerAnalysisNote[],
  repairWordTiming = false,
): IKaraokeMakerProject => {
  const repairedProject = repairWordTiming
    ? repairEstimatedWhisperTimingWithMelody(project, notes)
    : project;
  return touchKaraokeMakerProject(
    synchronizeKaraokeMakerSections(
      autoAlignNotesOnly(
        repairedProject,
        karaokeMakerMelodyNotesForLyrics(repairedProject, notes),
        'pitch-analysis',
      ),
    ),
  );
};

const melodyCandidateScore = (
  note: IKaraokeMakerAnalysisNote,
  startMs: number,
  endMs: number,
  previousMidi?: number,
): number => {
  const overlapMs = Math.max(
    0,
    Math.min(endMs, note.endMs) - Math.max(startMs, note.startMs),
  );
  const segmentDurationMs = Math.max(1, endMs - startMs);
  const noteDurationMs = Math.max(1, note.endMs - note.startMs);
  const coverage = overlapMs / segmentDurationMs;
  const onsetDistanceMs = Math.abs(note.startMs - startMs);
  const onsetBonus = Math.max(0, 1 - onsetDistanceMs / 260) * 0.26;
  const sustainedAccompanimentPenalty =
    noteDurationMs > 1_600
      ? Math.min(0.42, (noteDurationMs - 1_600) / 6_000)
      : 0;
  const continuityPenalty =
    previousMidi === undefined
      ? 0
      : Math.min(0.35, Math.abs(note.targetMidi - previousMidi) * 0.018);
  return (
    coverage * (0.52 + note.confidence * 0.48) +
    onsetBonus -
    sustainedAccompanimentPenalty -
    continuityPenalty
  );
};

const KARAOKE_GUIDE_FRAME_MS = 50;
const KARAOKE_GUIDE_MIN_NOTE_MS = 70;
const KARAOKE_GUIDE_STABLE_CHANGE_MS = 90;
const KARAOKE_GUIDE_MAX_NOTES_PER_TOKEN = 3;

interface IKaraokeMakerPitchRun {
  startMs: number;
  endMs: number;
  targetMidi: number;
  confidence: number;
}

interface IKaraokeMakerPitchFrameOption {
  candidate: IKaraokeMakerAnalysisNote;
  roundedMidi: number;
  emissionScore: number;
}

/**
 * Basic Pitch is polyphonic, so a mixed master can expose bass, chord and vocal
 * candidates at the same instant. Choose one continuous path across the word
 * instead of independently taking the loudest candidate in every frame.
 */
const traceVocalPitchFrames = (
  token: IKaraokeMakerToken & { startMs: number; endMs: number },
  candidates: readonly IKaraokeMakerAnalysisNote[],
  previousMidi?: number,
): IKaraokeMakerPitchRun[] => {
  const tokenDurationMs = token.endMs - token.startMs;
  const frameCount = Math.max(
    1,
    Math.ceil(tokenDurationMs / KARAOKE_GUIDE_FRAME_MS),
  );
  const overlappingCandidates = candidates.filter(
    (candidate) =>
      candidate.startMs < token.endMs && candidate.endMs > token.startMs,
  );
  if (!overlappingCandidates.length) {
    return [];
  }

  const anchorCandidate = overlappingCandidates.reduce<
    IKaraokeMakerAnalysisNote | undefined
  >((best, candidate) => {
    if (!best) {
      return candidate;
    }
    const score = melodyCandidateScore(
      candidate,
      token.startMs,
      token.endMs,
      previousMidi,
    );
    const bestScore = melodyCandidateScore(
      best,
      token.startMs,
      token.endMs,
      previousMidi,
    );
    return score > bestScore ? candidate : best;
  }, undefined);
  const anchorMidi = Math.round(
    anchorCandidate?.targetMidi ?? previousMidi ?? 60,
  );
  const optionsByFrame: IKaraokeMakerPitchFrameOption[][] = [];

  for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
    const frameStartMs =
      token.startMs + (tokenDurationMs * frameIndex) / frameCount;
    const frameEndMs =
      token.startMs + (tokenDurationMs * (frameIndex + 1)) / frameCount;
    const options = overlappingCandidates
      .filter(
        (candidate) =>
          candidate.startMs < frameEndMs && candidate.endMs > frameStartMs,
      )
      .map((candidate): IKaraokeMakerPitchFrameOption => {
        const roundedMidi = Math.round(candidate.targetMidi);
        let vocalRangePenalty = 0;
        if (roundedMidi < 42) {
          vocalRangePenalty = (42 - roundedMidi) * 0.07;
        } else if (roundedMidi > 84) {
          vocalRangePenalty = (roundedMidi - 84) * 0.07;
        }
        const anchorPenalty = Math.min(
          0.72,
          Math.abs(roundedMidi - anchorMidi) * 0.055,
        );
        return {
          candidate,
          roundedMidi,
          emissionScore:
            melodyCandidateScore(
              candidate,
              frameStartMs,
              frameEndMs,
              previousMidi,
            ) -
            vocalRangePenalty -
            anchorPenalty,
        };
      })
      .filter((option) => option.emissionScore >= 0.1)
      .sort((left, right) => right.emissionScore - left.emissionScore)
      .slice(0, 8);
    optionsByFrame.push(options);
  }

  const scores: number[][] = [];
  const parents: number[][] = [];
  optionsByFrame.forEach((options, frameIndex) => {
    scores[frameIndex] = [];
    parents[frameIndex] = [];
    options.forEach((option, optionIndex) => {
      if (frameIndex === 0 || !optionsByFrame[frameIndex - 1].length) {
        const entryPenalty =
          previousMidi === undefined
            ? 0
            : Math.min(0.7, Math.abs(option.roundedMidi - previousMidi) * 0.06);
        scores[frameIndex][optionIndex] = option.emissionScore - entryPenalty;
        parents[frameIndex][optionIndex] = -1;
        return;
      }
      let bestScore = Number.NEGATIVE_INFINITY;
      let bestParent = -1;
      optionsByFrame[frameIndex - 1].forEach((prior, priorIndex) => {
        const distance = Math.abs(option.roundedMidi - prior.roundedMidi);
        const transitionPenalty =
          distance <= 2 ? distance * 0.035 : 0.12 + (distance - 2) * 0.105;
        const score =
          (scores[frameIndex - 1][priorIndex] ?? Number.NEGATIVE_INFINITY) +
          option.emissionScore -
          transitionPenalty;
        if (score > bestScore) {
          bestScore = score;
          bestParent = priorIndex;
        }
      });
      scores[frameIndex][optionIndex] = bestScore;
      parents[frameIndex][optionIndex] = bestParent;
    });
  });

  const selectedByFrame = new Array<IKaraokeMakerPitchFrameOption | undefined>(
    frameCount,
  );
  let lastFrameIndex = frameCount - 1;
  while (lastFrameIndex >= 0 && !optionsByFrame[lastFrameIndex].length) {
    lastFrameIndex -= 1;
  }
  if (lastFrameIndex < 0) {
    return [];
  }
  let selectedIndex = scores[lastFrameIndex].reduce(
    (bestIndex, score, index) =>
      score > scores[lastFrameIndex][bestIndex] ? index : bestIndex,
    0,
  );
  for (let frameIndex = lastFrameIndex; frameIndex >= 0; frameIndex -= 1) {
    if (optionsByFrame[frameIndex].length) {
      selectedByFrame[frameIndex] = optionsByFrame[frameIndex][selectedIndex];
      selectedIndex = parents[frameIndex][selectedIndex] ?? -1;
      if (selectedIndex < 0 && frameIndex > 0) {
        const previousScores = scores[frameIndex - 1];
        selectedIndex = previousScores.length
          ? previousScores.reduce(
              (bestIndex, score, index) =>
                score > previousScores[bestIndex] ? index : bestIndex,
              0,
            )
          : 0;
      }
    }
  }

  return selectedByFrame.flatMap((selected, frameIndex) => {
    if (!selected) {
      return [];
    }
    return [
      {
        startMs: token.startMs + (tokenDurationMs * frameIndex) / frameCount,
        endMs:
          token.startMs + (tokenDurationMs * (frameIndex + 1)) / frameCount,
        targetMidi: selected.roundedMidi,
        confidence: selected.candidate.confidence,
      },
    ];
  });
};

const mergePitchRuns = (
  incoming: readonly IKaraokeMakerPitchRun[],
): IKaraokeMakerPitchRun[] => {
  const merged: IKaraokeMakerPitchRun[] = [];
  incoming.forEach((run) => {
    const previous = merged[merged.length - 1];
    if (previous && previous.targetMidi === run.targetMidi) {
      const previousDuration = previous.endMs - previous.startMs;
      const runDuration = run.endMs - run.startMs;
      previous.endMs = run.endMs;
      previous.confidence =
        (previous.confidence * previousDuration +
          run.confidence * runDuration) /
        Math.max(1, previousDuration + runDuration);
      return;
    }
    merged.push({ ...run });
  });
  return merged;
};

const absorbPitchRun = (runs: IKaraokeMakerPitchRun[], index: number) => {
  const current = runs[index];
  const left = runs[index - 1];
  const right = runs[index + 1];
  if (!current || (!left && !right)) {
    return;
  }
  const mergeLeft =
    !right ||
    (left !== undefined &&
      Math.abs(left.targetMidi - current.targetMidi) <=
        Math.abs(right.targetMidi - current.targetMidi));
  if (mergeLeft && left) {
    left.endMs = current.endMs;
  } else if (right) {
    right.startMs = current.startMs;
  }
  runs.splice(index, 1);
};

const splitLongestPitchRun = (runs: IKaraokeMakerPitchRun[]) => {
  const index = runs.reduce(
    (longestIndex, run, runIndex) =>
      run.endMs - run.startMs >
      runs[longestIndex].endMs - runs[longestIndex].startMs
        ? runIndex
        : longestIndex,
    0,
  );
  const run = runs[index];
  const midpoint = Math.round((run.startMs + run.endMs) / 2);
  runs.splice(
    index,
    1,
    { ...run, endMs: midpoint },
    { ...run, startMs: midpoint },
  );
};

const splitPitchRunAt = (
  runs: IKaraokeMakerPitchRun[],
  boundaryMs: number,
): boolean => {
  const index = runs.findIndex(
    (run) =>
      boundaryMs - run.startMs >= KARAOKE_GUIDE_MIN_NOTE_MS / 2 &&
      run.endMs - boundaryMs >= KARAOKE_GUIDE_MIN_NOTE_MS / 2,
  );
  if (index < 0) {
    return false;
  }
  const run = runs[index];
  runs.splice(
    index,
    1,
    { ...run, endMs: boundaryMs },
    { ...run, startMs: boundaryMs },
  );
  return true;
};

const syllableBoundariesForToken = (
  token: IKaraokeMakerToken & { startMs: number; endMs: number },
  language: string,
  desiredCount: number,
): number[] => {
  const syllables = splitKaraokeWordSyllables(token.text, language);
  if (desiredCount <= 1 || syllables.length <= 1) {
    return [];
  }
  const weights = syllables.map((syllable) =>
    Math.max(
      1,
      Array.from(syllable).filter((character) =>
        /[\p{L}\p{N}]/u.test(character),
      ).length,
    ),
  );
  const cumulative = weights.reduce<number[]>((values, weight) => {
    values.push((values[values.length - 1] ?? 0) + weight);
    return values;
  }, []);
  const totalWeight = cumulative[cumulative.length - 1] ?? 1;
  const durationMs = token.endMs - token.startMs;
  return Array.from({ length: desiredCount - 1 }, (_value, index) => {
    const targetWeight = (totalWeight * (index + 1)) / desiredCount;
    const syllableIndex = Math.min(
      cumulative.length - 2,
      Math.max(
        0,
        cumulative.findIndex((value) => value >= targetWeight),
      ),
    );
    return Math.round(
      token.startMs + (durationMs * cumulative[syllableIndex]) / totalWeight,
    );
  });
};

const pitchRunsForToken = (
  token: IKaraokeMakerToken & { startMs: number; endMs: number },
  candidates: readonly IKaraokeMakerAnalysisNote[],
  language: string,
  previousMidi?: number,
): IKaraokeMakerPitchRun[] => {
  const frames = traceVocalPitchFrames(token, candidates, previousMidi);
  let runs = mergePitchRuns(frames);
  // Short pitch flickers are normally vibrato, consonant transitions or an
  // accompaniment candidate—not a new singable target.
  let shortIndex = runs.findIndex(
    (run) => run.endMs - run.startMs < KARAOKE_GUIDE_STABLE_CHANGE_MS,
  );
  while (shortIndex >= 0 && runs.length > 1) {
    absorbPitchRun(runs, shortIndex);
    runs = mergePitchRuns(runs);
    shortIndex = runs.findIndex(
      (run) => run.endMs - run.startMs < KARAOKE_GUIDE_STABLE_CHANGE_MS,
    );
  }
  if (!runs.length) {
    return [];
  }
  while (runs.length > KARAOKE_GUIDE_MAX_NOTES_PER_TOKEN) {
    let weakestIndex = 0;
    let weakestWeight = runs[0].confidence * (runs[0].endMs - runs[0].startMs);
    for (let runIndex = 1; runIndex < runs.length; runIndex += 1) {
      const run = runs[runIndex];
      const weight = run.confidence * (run.endMs - run.startMs);
      if (weight < weakestWeight) {
        weakestWeight = weight;
        weakestIndex = runIndex;
      }
    }
    absorbPitchRun(runs, weakestIndex);
    runs = mergePitchRuns(runs);
  }
  const syllableCount = splitKaraokeWordSyllables(token.text, language).length;
  const desiredCount = Math.min(
    KARAOKE_GUIDE_MAX_NOTES_PER_TOKEN,
    Math.max(
      1,
      Math.min(
        syllableCount,
        Math.floor((token.endMs - token.startMs) / KARAOKE_GUIDE_MIN_NOTE_MS),
      ),
      runs.length,
    ),
  );
  // A held pitch still needs readable syllable-sized guide blocks. Split a
  // flat run at language-aware syllable boundaries before falling back to a
  // geometric midpoint. Real stable pitch changes retain their measured time.
  syllableBoundariesForToken(token, language, desiredCount).forEach(
    (boundaryMs) => {
      if (runs.length < desiredCount) {
        splitPitchRunAt(runs, boundaryMs);
      }
    },
  );
  while (runs.length < desiredCount) {
    splitLongestPitchRun(runs);
  }
  // Whisper's word window is the timing authority. Make the guide cover that
  // exact sung interval and share every internal boundary without overlap.
  runs[0].startMs = token.startMs;
  runs[runs.length - 1].endMs = token.endMs;
  for (let index = 0; index < runs.length - 1; index += 1) {
    const boundary = Math.round(
      (runs[index].endMs + runs[index + 1].startMs) / 2,
    );
    runs[index].endMs = boundary;
    runs[index + 1].startMs = boundary;
  }
  return runs;
};

/**
 * Basic Pitch intentionally returns polyphonic candidates. Whisper supplies
 * the sung word windows; trace one stable vocal pitch path inside each window,
 * suppress vibrato flicker, and add boundaries for inferred syllables. A pitch
 * change may add another note, but the authored guide stays at three or fewer
 * targets per lyric token—the distribution observed in the calibration set.
 */
export const karaokeMakerMelodyNotesForLyrics = (
  project: IKaraokeMakerProject,
  candidates: readonly IKaraokeMakerAnalysisNote[],
): IKaraokeMakerAnalysisNote[] => {
  const timedTokens = project.lyrics.lines
    .filter((line) => !karaokeMakerLineIsSection(line))
    .flatMap((line) => line.tokens)
    .filter(
      (
        token,
      ): token is IKaraokeMakerToken & { startMs: number; endMs: number } =>
        token.startMs !== undefined &&
        token.endMs !== undefined &&
        token.endMs > token.startMs,
    )
    .sort((left, right) => left.startMs - right.startMs);
  if (!timedTokens.length) {
    return [];
  }
  const timingOffsetMs = candidates.length
    ? karaokeMakerAnalysisOffsetMs(
        project,
        Math.min(...candidates.map((note) => note.startMs)),
      )
    : 0;
  const usableCandidates = candidates
    .filter(
      (note) =>
        Number.isFinite(note.targetMidi) &&
        note.targetMidi >= 38 &&
        note.targetMidi <= 88 &&
        note.endMs - note.startMs >= 55 &&
        note.endMs - note.startMs <= 8_000 &&
        note.confidence >= 0.12,
    )
    .map((note) => ({
      ...note,
      startMs: note.startMs + timingOffsetMs,
      endMs: note.endMs + timingOffsetMs,
    }))
    .sort((left, right) => left.startMs - right.startMs);
  const melody: IKaraokeMakerAnalysisNote[] = [];
  let previousMidi: number | undefined;
  let candidateCursor = 0;
  timedTokens.forEach((token) => {
    while (
      candidateCursor < usableCandidates.length &&
      usableCandidates[candidateCursor].endMs <= token.startMs
    ) {
      candidateCursor += 1;
    }
    let candidateEnd = candidateCursor;
    while (
      candidateEnd < usableCandidates.length &&
      usableCandidates[candidateEnd].startMs < token.endMs
    ) {
      candidateEnd += 1;
    }
    const runs = pitchRunsForToken(
      token,
      usableCandidates.slice(candidateCursor, candidateEnd),
      project.lyrics.language ?? 'en',
      previousMidi,
    );
    if (runs.length) {
      previousMidi = runs[runs.length - 1].targetMidi;
      melody.push(
        ...runs.map((run) => ({
          startMs: Math.round(run.startMs),
          endMs: Math.round(run.endMs),
          targetMidi: run.targetMidi,
          confidence: run.confidence,
        })),
      );
    }
  });
  return melody;
};

const autoAlignNotesOnly = (
  project: IKaraokeMakerProject,
  notes: readonly IKaraokeMakerAnalysisNote[],
  source: 'basic-pitch' | 'pitch-analysis',
): IKaraokeMakerProject => {
  const tokens = project.lyrics.lines
    .filter((line) => !karaokeMakerLineIsSection(line))
    .flatMap((line) => line.tokens);
  return {
    ...project,
    melody: {
      ...project.melody,
      source,
      notes: [
        ...project.melody.notes.filter((note) => note.source === 'manual'),
        ...notes
          .filter(
            (note) =>
              !project.melody.notes.some(
                (existing) =>
                  existing.source === 'manual' &&
                  existing.startMs < note.endMs &&
                  note.startMs < existing.endMs,
              ),
          )
          .map((note) => {
            const { startMs, endMs } = note;
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
              source,
            };
          }),
      ].sort((left, right) => left.startMs - right.startMs),
    },
  };
};
