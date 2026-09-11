import { useSyncExternalStore } from 'react';
import type { TPlusTermsNoticeState } from 'main/ipc/plusTermsNotice';

/**
 * The Plus terms notice, as the renderer sees it: what the main process says
 * to show, or null.
 *
 * Same shape as `entitlementStore`, for the same reason. Every fact the
 * notice depends on — the account, the membership, the server's record of the
 * agreement, what was already shown — lives on the other side, and this only
 * mirrors the answer and reports that the notice was put away.
 */

let notice: TPlusTermsNoticeState = null;
let subscribed = false;
const listeners = new Set<() => void>();

const publish = (next: TPlusTermsNoticeState) => {
  notice = next;
  listeners.forEach((listener) => listener());
};

const bridge = () => window.electron?.ipcRenderer;

const start = () => {
  if (subscribed) {
    return () => {};
  }
  subscribed = true;
  const api = bridge();
  api
    ?.getPlusTermsNotice?.()
    .then(publish)
    .catch(() => {
      // No backend, or no handler: no notice, which is already the state.
    });
  return api?.onPlusTermsNotice?.(publish) ?? (() => {});
};

let stop: () => void = () => {};

export const subscribePlusTermsNotice = (listener: () => void) => {
  if (listeners.size === 0) {
    stop = start();
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const getPlusTermsNoticeSnapshot = (): TPlusTermsNoticeState => notice;

export const usePlusTermsNotice = (): TPlusTermsNoticeState =>
  useSyncExternalStore(
    subscribePlusTermsNotice,
    getPlusTermsNoticeSnapshot,
    getPlusTermsNoticeSnapshot,
  );

/**
 * The notice for `version` was put away, or its terms were opened from it.
 *
 * Gone from the screen at once rather than when the main process answers: it
 * was closed, and a notice that lingers after its close button is pressed
 * reads as a button that did nothing.
 */
export const markPlusTermsNoticeSeen = async (version: number) => {
  publish(null);
  const next = await bridge()?.plusTermsNoticeSeen?.(version);
  if (next !== undefined) {
    publish(next);
  }
};

/** Releases the IPC listener. For a test that wants a clean module between runs. */
export const resetPlusTermsNoticeStore = () => {
  stop();
  stop = () => {};
  subscribed = false;
  listeners.clear();
  notice = null;
};
