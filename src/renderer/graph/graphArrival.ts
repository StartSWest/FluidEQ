/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useSyncExternalStore } from 'react';

/**
 * The graph's scene holding its picture while the window changes size under
 * it, until the window has its new size.
 *
 * Leaving full screen is two layouts at least: the docked one at the screen's
 * size, the moment the mode changes, and the docked one at the window's, once
 * Windows has moved the window — and a frame of each was painted. A scene is
 * framed by the plot, so it was drawn once for every one of them, and what
 * showed was the picture squashed into the first plot and pulled into the
 * next (Ivan, 2026-09-26: "the scene itself kind of compresses when exiting
 * full screen"). The graph was taken out of sight for those moments, and
 * then blinked out on every change of mode (Ivan, 2026-09-27: "avoid hiding
 * the graph for a milise"); it stays now, and a scene held here keeps its
 * picture at its own proportions until the settled size is drawn
 * (`sceneWorkerClient.ts`).
 *
 * The mark is on the root, and a scene drawn on a layer of the window, which
 * is outside the plot, holds its picture on it (`SceneCanvas`). An attribute
 * the drawings' visibility watch does not follow (`observeShown`), on
 * purpose: nothing is hidden from them, so every one of them keeps drawing.
 *
 * No clock decides when it ends: what is handed in is the window's own answer
 * and the page's frame at the new size. A later hold replaces an earlier one,
 * so pressing the mode twice ends on the second's answer.
 */
const ARRIVING = 'data-graph-arriving';

let turn = 0;
let arriving = false;
const listeners = new Set<() => void>();

const publish = (next: boolean) => {
  if (arriving === next) {
    return;
  }
  arriving = next;
  document.documentElement.toggleAttribute(ARRIVING, next);
  listeners.forEach((listener) => listener());
};

/** Out of sight now, and back once `settled` answers, however it answers. */
export const holdGraphUntil = (settled: Promise<unknown>): void => {
  turn += 1;
  const held = turn;
  publish(true);
  const release = () => {
    if (held === turn) {
      publish(false);
    }
  };
  settled.then(release, release);
};

export const isGraphArriving = (): boolean => arriving;

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const useGraphArriving = (): boolean =>
  useSyncExternalStore(subscribe, isGraphArriving, () => false);
