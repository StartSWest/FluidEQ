/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { decodeMono, WHISPER_MODEL, WHISPER_SAMPLE_RATE } from './audio';
import {
  beginWhisperRecognition,
  emitWhisperSession,
  finishWhisperRecognition,
  getWhisperWorker,
  markWhisperDownloaded,
  readWhisperSessionSnapshot,
  refreshKaraokeWhisperDownloaded,
  setWhisperWorker,
} from './whisperSession';
import {
  accumulateKaraokeMakerDownloadProgress,
  IKaraokeMakerDownloadProgress,
  IKaraokeMakerDownloadSummary,
  IKaraokeMakerWhisperTranscribeProgress,
  IKaraokeMakerWhisperTranscript,
  IWhisperOutput,
  IWhisperPipelineProgressEvent,
  karaokeMakerAbortableTask,
  karaokeMakerWhisperErrorDetail,
  karaokeMakerWhisperPipelineProgress,
  karaokeMakerWhisperTranscriptWords,
  TKaraokeMakerWhisperLogger,
  TKaraokeMakerWhisperLogLevel,
  TKaraokeMakerWhisperStage,
} from './whisperProgress';
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
    readWhisperSessionSnapshot().downloaded ||
    (await refreshKaraokeWhisperDownloaded());
  const workerWasReady =
    readWhisperSessionSnapshot().inMemory && getWhisperWorker();
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
  // Held in a local as well as in the session, so the type stays narrowed. A
  // getter cannot be narrowed by an `if` the way the module variable it
  // replaced could — every later use would have to assert it is there.
  let worker = getWhisperWorker();
  if (!worker) {
    worker = new Worker(
      new URL(
        process.env.NODE_ENV === 'production'
          ? './karaoke-whisper-worker.js'
          : '/karaoke-whisper-worker.dev.js',
        window.location.href,
      ),
    );
    setWhisperWorker(worker);
  }
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
        if (getWhisperWorker() === worker) {
          setWhisperWorker(undefined);
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
