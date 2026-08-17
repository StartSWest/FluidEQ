/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

export interface IWhisperChunk {
  text?: string;
  timestamp?: [number | null, number | null];
}

export interface IWhisperOutput {
  text?: string;
  chunks?: IWhisperChunk[];
}
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

export interface IWhisperPipelineProgressEvent {
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
