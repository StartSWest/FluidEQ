/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useSyncExternalStore } from 'react';
import type { ISceneReviewState } from 'main/ipc/plusReview';
import { setReviewWaiting } from './moderationStore';

/**
 * Scenes under review, as the window sees them: the corner notice the main
 * process decided on, and how many scenes wait for the admin.
 *
 * Same shape as `plusTermsNoticeStore`, for the same reason: every fact the
 * notice depends on — the account, what the server said, what this computer
 * already told — lives on the other side. This mirrors the answer, and says
 * when the notice was put away.
 */

const NONE: ISceneReviewState = { notice: null };

let current: ISceneReviewState = NONE;
let subscribed = false;
const listeners = new Set<() => void>();

const bridge = () => window.electron?.ipcRenderer;

const publish = (next: ISceneReviewState) => {
  current = next;
  // The admin's badge follows the freshest count there is.
  if (next.waiting !== undefined) {
    setReviewWaiting(next.accountId, next.waiting);
  }
  listeners.forEach((listener) => listener());
};

const start = () => {
  if (subscribed) {
    return () => {};
  }
  subscribed = true;
  const api = bridge();
  api
    ?.getSceneReviewNotice?.()
    .then(publish)
    .catch(() => {
      // No backend, or no handler: no notice, which is already the state.
    });
  return api?.onSceneReviewNotice?.(publish) ?? (() => {});
};

let stop: () => void = () => {};

export const subscribeSceneReview = (listener: () => void) => {
  if (listeners.size === 0) {
    stop = start();
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const getSnapshot = (): ISceneReviewState => current;

export const useSceneReview = (): ISceneReviewState =>
  useSyncExternalStore(subscribeSceneReview, getSnapshot, getSnapshot);

/**
 * The notice was put away, or what it points at was opened. Gone from the
 * screen at once rather than when the main process answers: a notice that
 * lingers after its button is pressed reads as a button that did nothing.
 */
export const markSceneReviewSeen = async (keys: string[]) => {
  publish({ ...current, notice: null });
  const next = await bridge()?.sceneReviewNoticeSeen?.(keys);
  if (next !== undefined) {
    publish(next);
  }
};

/** Releases the IPC listener. For a test that wants a clean module between runs. */
export const resetSceneReviewStore = () => {
  stop();
  stop = () => {};
  subscribed = false;
  listeners.clear();
  current = NONE;
};
