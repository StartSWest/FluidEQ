/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useSyncExternalStore } from 'react';
import type { IAnnouncement } from 'common/sceneAnnouncements';
import type { TSceneAnnouncementState } from 'main/ipc/sceneAnnouncements';

/**
 * The announcement of new scenes this account has not been shown yet, as
 * main has it (`ipc/sceneAnnouncements.ts`), and the admin's preview of one
 * being written, which shows the same card without recording anything.
 */

let announcement: TSceneAnnouncementState = null;
let preview: IAnnouncement | null = null;
let subscribed = false;
const listeners = new Set<() => void>();

const notify = () => listeners.forEach((listener) => listener());

const publish = (next: TSceneAnnouncementState) => {
  announcement = next;
  notify();
};

const bridge = () => window.electron?.ipcRenderer;

const start = () => {
  if (subscribed) {
    return () => {};
  }
  subscribed = true;
  const api = bridge();
  api
    ?.getSceneAnnouncement?.()
    .then(publish)
    .catch(() => {
      // No backend, or no handler: nothing to announce, already the state.
    });
  return api?.onSceneAnnouncement?.(publish) ?? (() => {});
};

let stop: () => void = () => {};

const subscribe = (listener: () => void) => {
  if (listeners.size === 0) {
    stop = start();
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** What the card shows: the admin's preview first, then the real one. */
export interface IShownAnnouncement {
  announcement: IAnnouncement;
  preview: boolean;
}

let shown: IShownAnnouncement | null = null;
const snapshot = (): IShownAnnouncement | null => {
  const next = preview ?? announcement;
  if (shown?.announcement !== next) {
    shown = next ? { announcement: next, preview: next === preview } : null;
  }
  return shown;
};

export const useShownAnnouncement = (): IShownAnnouncement | null =>
  useSyncExternalStore(subscribe, snapshot, snapshot);

/**
 * The card was put away, by any of its ways out: never shown again on this
 * computer for this account. A preview records nothing.
 */
export const putAnnouncementAway = async (shownNow: IShownAnnouncement) => {
  if (shownNow.preview) {
    preview = null;
    notify();
    return;
  }
  publish(null);
  const next = await bridge()?.sceneAnnouncementSeen?.(
    shownNow.announcement.id,
  );
  if (next !== undefined) {
    publish(next);
  }
};

/** The admin's composer showing its draft as members will see it. */
export const previewAnnouncement = (draft: IAnnouncement) => {
  preview = draft;
  notify();
};

/** For a test that wants a clean module between runs. */
export const resetSceneAnnouncementStore = () => {
  stop();
  stop = () => {};
  subscribed = false;
  listeners.clear();
  announcement = null;
  preview = null;
  shown = null;
};
