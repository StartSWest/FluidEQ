/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { useSyncExternalStore } from 'react';

/**
 * What Smart EQ is doing, and the handles for starting and stopping it.
 *
 * Both measurements used to live inside the EQ page's component, which meant
 * they lived and died with it. Switching to the Voicing tab unmounted the page,
 * React ran the effect cleanup, the cleanup aborted the capture, and a
 * continuous mode that was meant to run all evening stopped because somebody
 * looked at something else. Coming back started it again from nothing, so every
 * visit to another tab cost a minute of re-measuring and threw away the
 * accumulated evidence that made the correction worth having.
 *
 * The measurement is a background process. It is not a view, it does not belong
 * to a view, and no view should be able to end it — so it is hosted once,
 * above the tabs, in something that never unmounts, and this module is how the
 * page talks to it.
 *
 * Not a Web Worker, despite being the obvious phrase for it. The capture is a
 * MediaStream through an AnalyserNode and the writes go out over IPC, and both
 * are bound to this thread; a worker could not reach either. What "background"
 * means here is the achievable and more important half — that it is out of the
 * component tree, so nothing about what is on screen can interrupt it.
 *
 * Plain module state rather than a context, because a context provider is a
 * component too, and the whole point is to be somewhere React's rendering
 * cannot reach in to stop things.
 */

export interface ISmartEqControl {
  /** Start a one-shot measurement, or cancel the one running. */
  run: () => void;
  cancel: () => void;
}

interface IRunState {
  /** An announcement with a timer on it — a run finishing, a correction made. */
  status: string;
  /** The running measurement, which is a condition rather than a remark. */
  listeningFor: string;
  /** Whether the one-shot is in progress, which is what the button says. */
  isRunning: boolean;
}

let state: IRunState = { status: '', listeningFor: '', isRunning: false };
let control: ISmartEqControl | undefined;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((listener) => listener());

const update = (next: Partial<IRunState>) => {
  // Compared before publishing, because these are written from a callback that
  // fires at every checkpoint and each publish re-renders the toolbar.
  if (
    (next.status ?? state.status) === state.status &&
    (next.listeningFor ?? state.listeningFor) === state.listeningFor &&
    (next.isRunning ?? state.isRunning) === state.isRunning
  ) {
    return;
  }
  state = { ...state, ...next };
  emit();
};

export const setSmartEqStatus = (status: string) => update({ status });
export const setSmartEqListening = (listeningFor: string) =>
  update({ listeningFor });
export const setSmartEqRunning = (isRunning: boolean) => update({ isRunning });

/**
 * Registered by the host as it mounts, so the page can drive a measurement it
 * does not own. Absent until then, and pressing the button before the host is
 * up simply does nothing — which is the right answer for a window that has not
 * finished starting.
 */
export const registerSmartEqControl = (next: ISmartEqControl | undefined) => {
  control = next;
};

export const runSmartEq = () => control?.run();
export const cancelSmartEq = () => control?.cancel();

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const read = () => state;

export const useSmartEqRun = () =>
  useSyncExternalStore(subscribe, read, read) as IRunState;
