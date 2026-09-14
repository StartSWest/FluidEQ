import { useSyncExternalStore } from 'react';
import type { IWallpaperWave } from '../../common/wallpaper';

/**
 * The desktop background dialogs, opened from wherever the controls are.
 *
 * Owned by one host in `App.tsx` rather than by the control that opens them:
 * the graph's View menu closes when a row is chosen, and a dialog living
 * inside it went with it.
 */
export type TWallpaperDialog =
  | {
      kind: 'set';
      lookId: string;
      /**
       * The wave the background takes. Absent, the graph's as set for
       * watching; the Studio passes its stage's own sliders.
       */
      wave?: IWallpaperWave;
    }
  | { kind: 'manage' }
  | undefined;

let current: TWallpaperDialog;
const listeners = new Set<() => void>();

const show = (next: TWallpaperDialog) => {
  current = next;
  listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const openWallpaperDialog = (lookId: string, wave?: IWallpaperWave) =>
  show({ kind: 'set', lookId, ...(wave ? { wave } : {}) });

export const openWallpaperManager = () => show({ kind: 'manage' });

export const closeWallpaperDialog = () => show(undefined);

export const useWallpaperDialog = (): TWallpaperDialog =>
  useSyncExternalStore(
    subscribe,
    () => current,
    () => current,
  );
