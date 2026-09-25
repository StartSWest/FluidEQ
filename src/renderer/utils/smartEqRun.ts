/*
<FluidEQ: System-wide parametric audio equalizer interface>
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
import type { ISmartEqSettings } from 'common/constants';

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
  /**
   * Somebody other than the engine has just put a layer into the chain.
   *
   * The continuous loop remembers where it was steering and what it has heard,
   * and both describe the chain as it was a moment ago. A song's remembered
   * curve landing over the top — or being handed back at the end of the song
   * — is exactly the write the loop must not measure through its old memory:
   * it would read the new layer as a disagreement with its own destination and
   * walk it back, undoing the match within a quiet window. See the engine's
   * `layerReplaced`.
   */
  layerReplaced: (settings: ISmartEqSettings | undefined) => void;
}

interface IRunState {
  /** The running measurement, which is a condition rather than a remark. */
  listeningFor: string;
  /** Whether the one-shot is in progress, which is what the button says. */
  isRunning: boolean;
}

let state: IRunState = { listeningFor: '', isRunning: false };
let control: ISmartEqControl | undefined;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((listener) => listener());

const update = (next: Partial<IRunState>) => {
  // Compared before publishing, because these are written from a callback that
  // fires at every checkpoint and each publish re-renders the toolbar.
  if (
    (next.listeningFor ?? state.listeningFor) === state.listeningFor &&
    (next.isRunning ?? state.isRunning) === state.isRunning
  ) {
    return;
  }
  state = { ...state, ...next };
  emit();
};

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
/**
 * Told synchronously, at the moment of the write, rather than left for the
 * engine to notice on its next render. The loop acts from an interval that
 * can fire between a state update and the render that carries it, and a step
 * taken in that gap is solved against the old layer and written over the new
 * one — the match lost to its own timing.
 */
export const noteSmartEqLayerReplaced = (
  settings: ISmartEqSettings | undefined,
) => control?.layerReplaced(settings);

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const read = () => state;

export const useSmartEqRun = () =>
  useSyncExternalStore(subscribe, read, read) as IRunState;

/**
 * An announcement — a run finishing, a correction made — and which one it is.
 *
 * Said, then gone. These modes run for hours and are silent for most of that,
 * so a remark that stayed up would be a stale sentence hanging over the
 * toolbar all evening. How long it stays is the stylesheet's: whatever shows
 * it holds it for a `smart-eq-status-hold` animation and ends it by id when
 * that ends (`endSmartEqStatus`). Long enough to read twice, and anything new
 * starts a new hold, so a measurement reporting progress keeps it up for as
 * long as it is working; the same words again are not news and start none.
 *
 * It was a six-second timer in the engine, which ran whether or not anything
 * was drawn: a remark made behind a minimised window was gone before anybody
 * looked.
 */
export interface ISmartEqStatus {
  id: number;
  text: string;
}

let status: ISmartEqStatus | undefined;
let lastStatusId = 0;
/** What is showing the status now: the EQ page's bubble, the player's line. */
const statusViews = new Set<() => void>();

const emitStatus = () => statusViews.forEach((listener) => listener());

export const setSmartEqStatus = (text: string) => {
  if (text === (status?.text ?? '')) {
    return;
  }
  // Said to nobody, a remark is over — kept, it would come up over whatever
  // the page next opened on, long after the moment it was about.
  if (!text || statusViews.size === 0) {
    status = undefined;
    emitStatus();
    return;
  }
  lastStatusId += 1;
  status = { id: lastStatusId, text };
  emitStatus();
};

/**
 * The remark named by `id` has been shown for its moment. By id, because a
 * newer one can arrive while it is showing, and the older one's end must not
 * take the newer away.
 */
export const endSmartEqStatus = (id: number) => {
  if (status?.id !== id) {
    return;
  }
  status = undefined;
  emitStatus();
};

/** Module-level, so React keeps one subscription per view for its life. */
const subscribeStatus = (listener: () => void) => {
  statusViews.add(listener);
  return () => {
    statusViews.delete(listener);
    // The last view has gone, and the animation that would have ended the
    // remark went with it; nothing will end it now, so it is over.
    if (statusViews.size === 0) {
      status = undefined;
    }
  };
};

const readStatus = () => status;

export const useSmartEqStatus = () =>
  useSyncExternalStore(subscribeStatus, readStatus, readStatus);
