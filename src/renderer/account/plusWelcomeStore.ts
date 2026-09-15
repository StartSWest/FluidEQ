/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useSyncExternalStore } from 'react';
import type { TPlusWelcomeState } from 'main/ipc/plusWelcome';

/**
 * The welcome to Plus, as the renderer sees it: the edition the main process
 * says to show, or null.
 *
 * Same shape as `plusTermsNoticeStore`, for the same reason: both facts it
 * rests on — the membership, and whether this account was already welcomed on
 * this computer — live on the other side, and this only mirrors the answer
 * and reports that the welcome was closed.
 */

let welcome: TPlusWelcomeState = null;
let subscribed = false;
const listeners = new Set<() => void>();

const publish = (next: TPlusWelcomeState) => {
  welcome = next;
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
    ?.getPlusWelcome?.()
    .then(publish)
    .catch(() => {
      // No backend, or no handler: no welcome, which is already the state.
    });
  return api?.onPlusWelcome?.(publish) ?? (() => {});
};

let stop: () => void = () => {};

export const subscribePlusWelcome = (listener: () => void) => {
  if (listeners.size === 0) {
    stop = start();
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const getPlusWelcomeSnapshot = (): TPlusWelcomeState => welcome;

export const usePlusWelcome = (): TPlusWelcomeState =>
  useSyncExternalStore(
    subscribePlusWelcome,
    getPlusWelcomeSnapshot,
    getPlusWelcomeSnapshot,
  );

/**
 * The welcome was closed, or led somewhere from its own button.
 *
 * Gone from the screen at once rather than when the main process answers: it
 * was closed, and a dialog that lingers after its button is pressed reads as
 * a button that did nothing.
 */
export const markPlusWelcomeSeen = async (edition: number) => {
  publish(null);
  const next = await bridge()?.plusWelcomeSeen?.(edition);
  if (next !== undefined) {
    publish(next);
  }
};

/** Releases the IPC listener. For a test that wants a clean module between runs. */
export const resetPlusWelcomeStore = () => {
  stop();
  stop = () => {};
  subscribed = false;
  listeners.clear();
  welcome = null;
};
