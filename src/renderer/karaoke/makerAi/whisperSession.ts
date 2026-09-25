/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { WHISPER_MODEL } from './audio';

/**
 * What happens to the speech model once nothing needs it: ask, let it go, or
 * keep it.
 *
 * "Nothing needs it" is a moment, not a length of time. It used to be five,
 * ten or thirty minutes of a timer, which asked the question — or took the
 * gigabyte back — in the middle of an editing session that simply had not
 * transcribed anything for a while, and held it for the whole wait after the
 * Maker had closed. The model is now idle when the Maker, the one thing that
 * runs it, has closed and no transcription is still finishing
 * (`holdKaraokeWhisperModel`). The karaoke tab going out of sight frees it
 * outright, whatever the choice, as it always has (`KaraokeWorkspace`).
 *
 * The window being hidden is not counted. With the Maker open, the next
 * transcription is one press away when the window comes back, and minimising
 * is not a decision to stop editing.
 */
export type TKaraokeWhisperMemoryPolicy = 'ask' | 'auto' | 'keep';
export type TKaraokeWhisperSessionStatus =
  'unloaded' | 'loading' | 'ready' | 'working' | 'releasing' | 'error';

export interface IKaraokeWhisperMemorySettings {
  policy: TKaraokeWhisperMemoryPolicy;
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
      // A stored `idleMinutes` from before is read past: there is no wait.
      const policy = ['ask', 'auto', 'keep'].includes(parsed?.policy ?? '')
        ? (parsed?.policy as TKaraokeWhisperMemoryPolicy)
        : DEFAULT_WHISPER_MEMORY_SETTINGS.policy;
      return { policy };
    } catch {
      return DEFAULT_WHISPER_MEMORY_SETTINGS;
    }
  };

let whisperWorker: Worker | undefined;
let whisperActiveRecognitionTasks = 0;
/** Open Makers: while there is one, the model may be asked for at any time. */
let whisperHolders = 0;
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

/**
 * Ask the cache what is there now, not the flag for what was there once.
 *
 * This used to return early whenever the stored flag said "downloaded", so the
 * answer could never come back down: a cache the browser evicted, a model
 * deleted underneath the app, a cleared profile — all of them left the Maker
 * insisting the model was on disk. The run then reported "Loading cached
 * speech model" with no file list while it quietly fetched a gigabyte and a
 * half. The flag stays, as the first answer before the cache has been read,
 * and loses every argument with it.
 */
export const refreshKaraokeWhisperDownloaded = async (): Promise<boolean> => {
  if (typeof caches === 'undefined') {
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
    try {
      window.localStorage.removeItem(WHISPER_DOWNLOADED_KEY);
    } catch {
      // The in-memory session is corrected either way.
    }
    emitWhisperSession({ downloaded: false });
    return false;
  } catch {
    // Cache introspection is an optimization. The model loader remains the
    // source of truth when the browser hides its cache metadata.
  }
  return whisperSessionSnapshot.downloaded;
};

/**
 * How many bytes of speech model are cached, summed from the stored responses.
 *
 * `Content-Length` off each cached response, because reading the bodies to
 * measure them would pull a gigabyte through the renderer to answer a question
 * about a status line. A response that arrived without the header is skipped
 * rather than estimated, so this can only ever under-report.
 */
export const karaokeWhisperCachedBytes = async (): Promise<number> => {
  if (typeof caches === 'undefined') {
    return 0;
  }
  try {
    const modelPath = WHISPER_MODEL.toLocaleLowerCase();
    const cacheNames = await caches.keys();
    const totals = await Promise.all(
      cacheNames.map(async (cacheName) => {
        const cache = await caches.open(cacheName);
        const requests = (await cache.keys()).filter((request) =>
          request.url.toLocaleLowerCase().includes(modelPath),
        );
        const sizes = await Promise.all(
          requests.map(async (request) => {
            const response = await cache.match(request);
            return Number(response?.headers.get('content-length') ?? 0);
          }),
        );
        return sizes.reduce((total, size) => total + size, 0);
      }),
    );
    return totals.reduce((total, size) => total + size, 0);
  } catch {
    return 0;
  }
};

export const releaseKaraokeWhisperModel = async (): Promise<boolean> => {
  if (
    whisperActiveRecognitionTasks > 0 ||
    whisperSessionSnapshot.status === 'releasing'
  ) {
    return false;
  }
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

/**
 * The model is loaded and nothing will ask for it: do what the setting says.
 *
 * Called at the two moments that can make it so — the last Maker closing, and
 * a transcription finishing — and at a change of setting. A loaded model with
 * a Maker still open, or still working, is left alone.
 */
export const settleWhisperIdle = () => {
  if (
    !whisperWorker ||
    whisperActiveRecognitionTasks > 0 ||
    whisperHolders > 0
  ) {
    return;
  }
  const { policy } = whisperSessionSnapshot.settings;
  if (policy === 'auto') {
    releaseKaraokeWhisperModel().catch(() => undefined);
  } else if (policy === 'ask') {
    emitWhisperSession({ releasePrompt: true });
  }
};

/**
 * A Maker is open, so the model is needed; returns the let-go, for when it
 * closes. The question from the last time it was idle is withdrawn: the model
 * is about to be used again.
 */
export const holdKaraokeWhisperModel = (): (() => void) => {
  whisperHolders += 1;
  if (whisperSessionSnapshot.releasePrompt) {
    emitWhisperSession({ releasePrompt: false });
  }
  let isHeld = true;
  return () => {
    if (!isHeld) {
      return;
    }
    isHeld = false;
    whisperHolders -= 1;
    settleWhisperIdle();
  };
};

/**
 * "Keep loaded" on the question: kept until it is idle again — the next time
 * a Maker closes — rather than asked again after a wait.
 */
export const keepKaraokeWhisperModelForNow = () => {
  emitWhisperSession({ releasePrompt: false });
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
  settleWhisperIdle();
};

export const beginWhisperRecognition = () => {
  whisperActiveRecognitionTasks += 1;
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
    settleWhisperIdle();
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
 * worker (held while a Maker is open, released or asked about when idle,
 * keep-for-now, refuse while busy) all live in this file, and handing out the
 * reference would put them nowhere.
 */
export const getWhisperWorker = (): Worker | undefined => whisperWorker;

export const setWhisperWorker = (next: Worker | undefined) => {
  whisperWorker = next;
};

export const readWhisperSessionSnapshot = (): IKaraokeWhisperSessionSnapshot =>
  whisperSessionSnapshot;
