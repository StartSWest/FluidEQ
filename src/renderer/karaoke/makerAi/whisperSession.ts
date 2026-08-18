/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { WHISPER_MODEL } from './audio';

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
  'fluideq.karaoke.whisperDownloaded.v4.large-v3-turbo';
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

export const emitWhisperSession = (
  update: Partial<IKaraokeWhisperSessionSnapshot>,
) => {
  whisperSessionSnapshot = { ...whisperSessionSnapshot, ...update };
  whisperSessionListeners.forEach((listener) => listener());
};

export const clearWhisperIdleTimer = () => {
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

export const markWhisperDownloaded = () => {
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

export const scheduleWhisperIdleAction = () => {
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

export const beginWhisperRecognition = () => {
  whisperActiveRecognitionTasks += 1;
  clearWhisperIdleTimer();
  emitWhisperSession({
    status: 'working',
    inMemory: true,
    busy: true,
    releasePrompt: false,
  });
};

export const finishWhisperRecognition = () => {
  whisperActiveRecognitionTasks = Math.max(
    0,
    whisperActiveRecognitionTasks - 1,
  );
  if (whisperActiveRecognitionTasks === 0 && whisperWorker) {
    emitWhisperSession({ status: 'ready', inMemory: true, busy: false });
    scheduleWhisperIdleAction();
  }
};

/**
 * The worker and the snapshot, reached through functions rather than directly.
 *
 * `transcribeKaraokeWithWhisper` creates the worker, and tears it down when it
 * dies, so it has to write both of these. An imported binding is read-only —
 * assigning to one is a compile error, not a subtle bug — so the two values
 * stay owned here and the writes come back through these.
 *
 * Deliberately not a mutable object passed around: the lifetime rules for this
 * worker (idle release, keep-for-now, refuse while busy) all live in this file,
 * and handing out the reference would put them nowhere.
 */
export const getWhisperWorker = (): Worker | undefined => whisperWorker;

export const setWhisperWorker = (next: Worker | undefined) => {
  whisperWorker = next;
};

export const readWhisperSessionSnapshot = (): IKaraokeWhisperSessionSnapshot =>
  whisperSessionSnapshot;
