/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useSyncExternalStore } from 'react';
import type { TSceneTintMode } from '../utils/sceneTintStore';
import type { ISceneInteraction } from './sceneInteraction';

/**
 * Where the graph's Plus visualizer is drawn, and what its one renderer and
 * the graph tell each other.
 *
 * The graph used to run its scene itself, on a canvas made for the place it
 * stood in — the plot, the EQ column's layer or the window's back
 * (`sceneCover.ts`) — and keyed on that place, because a canvas in a React
 * portal cannot change containers without being made again. So every change
 * of place built the scene from nothing, a new worker, a new GPU context and
 * the program compiled again: Colours to Backdrop, normal to full screen, an
 * EQ page to another page with the graph. And the graph leaving the screen
 * with its page took the Backdrop's picture with it, because the graph was
 * what ran it (Ivan, 2026-09-26: "when switching between color, ambient and
 * bg not to reload the viz because at the end it is the same").
 *
 * Now one renderer above the pages keeps it (`GraphScene`), and its canvas is
 * one element moved between those places (`useMovableContainer`). Never a
 * second renderer: every place costs what it did, and moving is free where a
 * reload was a compile.
 */

/** The graph's plot, while the graph is on screen and draws its scene. */
export interface IScenePlot {
  /** Where on the plot the canvas stands while the scene is drawn there. */
  slot: HTMLElement;
  /**
   * The scene's panel: what it is framed by on a larger layer, what the
   * pointer is read against, and where the window's pulse starts from.
   */
  panel: HTMLElement;
  /** The full panel, including the toolbar and axis gutters. */
  width: number;
  height: number;
  spectrumRect: readonly [number, number, number, number];
  /** Whether a plain drag on the plot turns a scene that can be turned. */
  dragTurns: boolean;
  /**
   * Whether the plot is one part of the window: the normal size, in the
   * app's own window. Expanded or full screen the graph is the window
   * already, and the player's window shows its own deck, not this graph.
   */
  isPartOfWindow: boolean;
}

/** What the running scene tells the plot. */
export interface IGraphSceneRun {
  /** The viewer's hands on it, for the plot's pointer and its reset. */
  interaction: ISceneInteraction;
  /** The scene that has drawn its first frame: the plot's loading goes. */
  drawnIdentity?: string;
}

export interface IGraphScenePlaces {
  /** Whether a scene is chosen and the graph draws it (`isGraphWaveDrawn`). */
  drawsScene: boolean;
  mode: TSceneTintMode;
  plot: IScenePlot | undefined;
  /** The window's back layer (`SceneCover`). */
  backdrop: HTMLElement | null;
  /** The layer behind an EQ page's head and graph (`SceneColumnLayer`). */
  column: HTMLElement | null;
}

/**
 * Where the graph's scene is drawn, or nowhere.
 *
 * With the plot on screen, the plot decides: a layer of the window while it
 * is one part of it — the back in the Backdrop, the EQ column's otherwise,
 * where there is one — and the plot itself everywhere else.
 *
 * With no plot — the graph closed on this page, or still loading — only the
 * Backdrop has anywhere to put it: the scene is the window's there, and goes
 * on behind every page (Ivan, 2026-09-26: "when I have a viz on the graph and
 * I switch to another page we need to keep same viz on"). In Colours and
 * Ambient nothing would show it, and the window keeps the colours measured
 * for it (`SceneTint`) without it running.
 */
export const graphScenePlace = ({
  drawsScene,
  mode,
  plot,
  backdrop,
  column,
}: IGraphScenePlaces): HTMLElement | undefined => {
  if (!drawsScene) {
    return undefined;
  }
  const layer = mode === 'cover' ? backdrop : column;
  if (!plot) {
    return mode === 'cover' ? (backdrop ?? undefined) : undefined;
  }
  return (plot.isPartOfWindow ? layer : null) ?? plot.slot;
};

/**
 * Whether the graph draws its wave, which is what a scene is drawn as: not in
 * Clean, and not with the wave switched off — unless the equaliser cannot be
 * heard, when the wave is the graph and is drawn whatever the switch says.
 * One rule for the graph and for its scene off the graph, so the Backdrop
 * never draws a scene the graph beside it has put away.
 */
export const isGraphWaveDrawn = ({
  isClean,
  isEngineUsable,
  isWaveHidden,
}: {
  isClean: boolean;
  isEngineUsable: boolean;
  isWaveHidden: boolean;
}): boolean => !isClean && !(isEngineUsable && isWaveHidden);

const createValueStore = <T>(initial: T) => {
  let value = initial;
  const listeners = new Set<() => void>();
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };
  return {
    publish: (next: T) => {
      if (next === value) {
        return;
      }
      value = next;
      listeners.forEach((listener) => listener());
    },
    use: () =>
      useSyncExternalStore(
        subscribe,
        () => value,
        () => initial,
      ),
  };
};

const plotStore = createValueStore<IScenePlot | undefined>(undefined);
const runStore = createValueStore<IGraphSceneRun | undefined>(undefined);

/** From the plot (`ScenePlot`): where it is, as it changes; gone as it goes. */
export const publishScenePlot = plotStore.publish;
export const useScenePlot = plotStore.use;

/** From the renderer (`SceneCanvas`), for the plot's loading and reset. */
export const publishGraphSceneRun = runStore.publish;
export const useGraphSceneRun = runStore.use;
