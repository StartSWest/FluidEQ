/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useSyncExternalStore } from 'react';
import type { ISceneInteraction } from './sceneInteraction';

/**
 * Where the graph's Plus visualizer is drawn, and what its one renderer and
 * the graph tell each other.
 *
 * The graph used to run its scene itself, on a canvas made for the place it
 * stood in — the plot or the EQ column's layer (`sceneCover.ts`) — and
 * keyed on that place, because a canvas in a React
 * portal cannot change containers without being made again. So every change
 * of place built the scene from nothing, a new worker, a new GPU context and
 * the program compiled again: normal to full screen, an EQ page to another
 * page with the graph (Ivan, 2026-09-26: "when switching between color,
 * ambient and bg not to reload the viz because at the end it is the same").
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
   * The scene's panel: what it is framed by on a larger layer and what the
   * pointer is read against.
   */
  panel: HTMLElement;
  /** The full panel, including the toolbar and axis gutters. */
  width: number;
  height: number;
  spectrumRect: readonly [number, number, number, number];
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
  plot: IScenePlot | undefined;
  /** The layer behind an EQ page's head and graph (`SceneColumnLayer`). */
  column: HTMLElement | null;
}

/**
 * Where the graph's scene is drawn, or nowhere.
 *
 * With the plot on screen: the EQ column's layer while the plot is one part
 * of the window and the page has one, and the plot itself everywhere else.
 *
 * With no plot — the graph closed on this page, or still loading — nothing
 * shows it, so it is let go and its memory with it, and the window keeps the
 * colours measured for it (`SceneTint`) without it running. It went on
 * behind every page while the full app had the Backdrop, which was taken out
 * (Ivan, 2026-11-16: "I didn't like the scene backdrop experiment so remove
 * that").
 */
export const graphScenePlace = ({
  drawsScene,
  plot,
  column,
}: IGraphScenePlaces): HTMLElement | undefined => {
  if (!drawsScene || !plot) {
    return undefined;
  }
  return (plot.isPartOfWindow ? column : null) ?? plot.slot;
};

/**
 * Whether the graph draws its wave, which is what a scene is drawn as: not in
 * Clean, and not with the wave switched off — unless the equaliser cannot be
 * heard, when the wave is the graph and is drawn whatever the switch says.
 * One rule for the graph and for its scene on the column's layer, so the
 * layer never draws a scene the graph beside it has put away.
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

const frontStore = createValueStore<HTMLElement | undefined>(undefined);

/**
 * The place on the plot over its scene and under its drawing, while a scene
 * is drawn there: for a page's own picture that stands in front of the scene
 * rather than behind it — the Library's record (`LibraryStageArt`), as the
 * Karaoke's words stand over its scene. Outside the scene's surface, so the
 * see-through slider fades the scene and never the picture; inside the card,
 * so the card's blur reaches only what lies behind the card.
 */
export const publishSceneFront = frontStore.publish;
export const useSceneFront = frontStore.use;
