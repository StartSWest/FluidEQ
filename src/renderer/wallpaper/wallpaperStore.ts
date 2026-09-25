import { useSyncExternalStore } from 'react';
import {
  isWallpaperState,
  type IWallpaperStart,
  type IWallpaperState,
  type IWallpaperTuning,
} from '../../common/wallpaper';

const INITIAL_STATE: IWallpaperState = {
  supported: false,
  displays: [],
  screens: [],
  pauseOnBattery: true,
};

export interface IWallpaperMutationState {
  pending: boolean;
  kind?: 'start' | 'stop';
}

interface IWallpaperBridge {
  getWallpaperState?: () => Promise<unknown>;
  startWallpaper?: (request: IWallpaperStart) => Promise<unknown>;
  stopWallpaper?: (displayIds?: number[]) => Promise<unknown>;
  setSceneTuning?: (tuning: Record<string, IWallpaperTuning>) => void;
  setGraphLook?: (lookId: string) => void;
  onWallpaperState?: (listener: (state: unknown) => void) => () => void;
}

let state = INITIAL_STATE;
let mutation: IWallpaperMutationState = { pending: false };
let listening = false;
let revision = 0;
const listeners = new Set<() => void>();

const bridge = (): IWallpaperBridge | undefined =>
  window.electron?.ipcRenderer as IWallpaperBridge | undefined;

const notify = () => listeners.forEach((listener) => listener());

const publishState = (next: IWallpaperState) => {
  state = next;
  revision += 1;
  notify();
};

/** A reply of another shape — main older or newer than this page — is ignored. */
const adopt = (raw: unknown): IWallpaperState | undefined => {
  if (!isWallpaperState(raw)) {
    return undefined;
  }
  publishState(raw);
  return raw;
};

const publishMutation = (next: IWallpaperMutationState) => {
  mutation = next;
  notify();
};

/** A start main could not be asked about: those monitors say so. */
const unreachableStart = (request: IWallpaperStart): IWallpaperState => ({
  ...state,
  screens: [
    ...state.screens.filter(
      (screen) => !request.displayIds.includes(screen.displayId),
    ),
    ...request.displayIds.map((displayId) => ({
      displayId,
      lookId: request.lookId,
      wave: request.wave,
      motion: request.motion,
      phase: 'error' as const,
      error: 'unavailable' as const,
    })),
  ],
});

const beginListening = () => {
  if (listening) {
    return;
  }
  listening = true;
  const api = bridge();
  api?.onWallpaperState?.(adopt);
  api
    ?.getWallpaperState?.()
    .then(adopt)
    .catch(() => undefined);
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  beginListening();
  return () => listeners.delete(listener);
};

export const getWallpaperSnapshot = (): IWallpaperState => state;

export const useWallpaperState = (): IWallpaperState =>
  useSyncExternalStore(subscribe, getWallpaperSnapshot, getWallpaperSnapshot);

export const useWallpaperMutation = (): IWallpaperMutationState =>
  useSyncExternalStore(
    subscribe,
    () => mutation,
    () => mutation,
  );

const mutate = async (
  kind: 'start' | 'stop',
  send: (api: IWallpaperBridge) => Promise<unknown> | undefined,
  failed: () => IWallpaperState,
): Promise<IWallpaperState> => {
  if (mutation.pending) {
    return state;
  }
  publishMutation({ pending: true, kind });
  const requestedAt = revision;
  try {
    const api = bridge();
    const next = api ? adopt(await send(api)) : undefined;
    if (next) {
      return next;
    }
    // Main published something newer while this was in flight; keep it.
    if (revision !== requestedAt) {
      return state;
    }
    const result = failed();
    publishState(result);
    return result;
  } catch {
    if (revision !== requestedAt) {
      return state;
    }
    const result = failed();
    publishState(result);
    return result;
  } finally {
    publishMutation({ pending: false, kind });
  }
};

/**
 * What every visualizer is set to, for the monitors showing one. Nothing to
 * wait on and nothing to fail: main keeps the last record it was given, and
 * the window sends the whole thing again whenever any of it moves.
 */
export const sendSceneTuning = (tuning: Record<string, IWallpaperTuning>) => {
  bridge()?.setSceneTuning?.(tuning);
};

/**
 * The Plus visualizer the graph shows, for the monitors set to follow it.
 * Main keeps the last one it was told; nothing comes back.
 */
export const sendGraphLook = (lookId: string) => {
  bridge()?.setGraphLook?.(lookId);
};

export const startWallpaper = (
  request: IWallpaperStart,
): Promise<IWallpaperState> =>
  mutate(
    'start',
    (api) => api.startWallpaper?.(request),
    () => unreachableStart(request),
  );

/** Without ids, every monitor goes back to its ordinary background. */
export const stopWallpaper = (
  displayIds?: number[],
): Promise<IWallpaperState> =>
  mutate(
    'stop',
    (api) => api.stopWallpaper?.(displayIds),
    // Unanswered, nothing is known to have stopped: the monitors stay listed
    // with their Stop, rather than vanishing from the window while playing.
    () => state,
  );
