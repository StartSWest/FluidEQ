/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useSyncExternalStore } from 'react';
import type {
  TAnimationHistoryOutcome,
  TAnimationHistoryRequest,
} from 'main/ipc/studioAnimationHistory';
import type { TAnimationShowOutcome } from 'main/ipc/studioAnimationShow';

/**
 * What a card or an opened animation asks of main: its history (undo, redo,
 * the original, rename), and the file manager on its sheet. Every answer is
 * main's; nothing here guesses at a file.
 */

const bridge = () => window.electron?.ipcRenderer;

export const animationHistory = (
  request: TAnimationHistoryRequest,
): Promise<TAnimationHistoryOutcome> =>
  bridge()?.studioAnimationHistory?.(request) ??
  Promise.resolve({ ok: false, reason: 'closed' });

export const showAnimationFile = (
  name: string,
): Promise<TAnimationShowOutcome> =>
  bridge()?.showStudioAnimation?.(name) ?? Promise.resolve('closed');

/**
 * Animations whose removal the scene's chat was asked for, by project and
 * name, so their card says it is being handled until the chat has taken
 * them away (the card goes with the files). Kept for the window's life, so
 * a visit to another tab does not forget it.
 */
const removals = new Set<string>();
const listeners = new Set<() => void>();
const keyOf = (projectId: string, name: string) => `${projectId}/${name}`;

export const markRemovalAsked = (projectId: string, name: string) => {
  removals.add(keyOf(projectId, name));
  listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const useRemovalAsked = (projectId: string, name: string): boolean =>
  useSyncExternalStore(
    subscribe,
    () => removals.has(keyOf(projectId, name)),
    () => false,
  );

/** For tests: forget every removal asked, as a new window does. */
export const resetRemovalsAsked = () => {
  removals.clear();
  listeners.clear();
};
