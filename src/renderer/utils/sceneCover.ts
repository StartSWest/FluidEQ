/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import { useSyncExternalStore } from 'react';

/**
 * The layers a Plus visualizer can be drawn on instead of its own plot, for
 * the graph's scene to be drawn into, the plot still its frame:
 *
 * - the column (`SceneColumnLayer.tsx`), behind the EQ pages' head and their
 *   graph, so the scene runs up under the section pills and the title
 *   instead of stopping in a straight line at the plot's top (Ivan,
 *   2026-09-25: "fill up to the top the graph only when plus viz").
 *
 * Each is one element, made once where it has to stand and published here,
 * rather than a canvas the graph makes for itself: the graph is several
 * layers deep inside the panes, and a layer behind them has to be made where
 * it stands. Each names itself with `data-scene-layer`, which is what the
 * scene marks the root with while it is drawn there (`SceneCanvas`).
 */
const createLayerStore = <T>(same: (a: T, b: T) => boolean = Object.is) => {
  let host: T | null = null;
  const listeners = new Set<() => void>();
  const publish = (next: T | null) => {
    if (next === host || (next !== null && host !== null && same(next, host))) {
      return;
    }
    host = next;
    listeners.forEach((listener) => listener());
  };
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };
  const useHost = () =>
    useSyncExternalStore(
      subscribe,
      () => host,
      () => null,
    );
  return { publish, useHost };
};

const column = createLayerStore<HTMLElement>();

export const publishSceneColumnHost = column.publish;
export const useSceneColumnHost = column.useHost;

/**
 * Where the EQ head stands on the column's layer, in CSS pixels from the
 * layer's top-left corner: the strip of picture its words are read against
 * (`useSceneHeadInk.ts`). Measured by the layer (`SceneColumnLayer.tsx`),
 * which already watches the head and the graph for its own height.
 */
export interface ISceneHeadBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

// Measured again on every resize of the column; a box that has not moved
// wakes nobody.
const head = createLayerStore<ISceneHeadBox>(
  (a, b) =>
    a.left === b.left &&
    a.top === b.top &&
    a.width === b.width &&
    a.height === b.height,
);

export const publishSceneColumnHead = head.publish;
export const useSceneColumnHead = head.useHost;
