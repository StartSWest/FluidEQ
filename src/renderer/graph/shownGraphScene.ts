/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useLayoutEffect, useSyncExternalStore } from 'react';
import { useSceneLook, useSelectedLookId } from '../utils/graphStyle';
import type { TDrawableScene } from './sceneIdentity';

/**
 * The graph's look as the window shows it: the one whose picture is on
 * screen, which is not always the one just chosen.
 *
 * What a scene puts in the window outside its own picture - the elements its
 * Ambient flies round the app (`SceneAmbient`) and the window's colours
 * (`SceneTint`) - belongs to that picture. Both followed the choice instead,
 * and the choice moves before the picture does: Auto takes the next scene the
 * moment its interval ends, and the graph keeps the last scene's picture up
 * until the next one's first frame is drawn (`useSceneRunner`'s `adopt`), so
 * for that whole wait the window flew the next scene's snow and stars round
 * the one still on screen (Ivan, 2026-11-27: "after 10 sec is loading next
 * one and showing the sparkles of the nextone right there on current
 * alpine"), already in the next scene's colours. The switch is one moment:
 * the old look with everything of its own until the new one's first frame,
 * the new one with everything of its own from then on.
 *
 * The colours used to change as a scene was chosen, ahead of its picture
 * (Ivan, 2026-09-25: "I want the color to change first then it loads the
 * viz"); he asked for them to wait as well (2026-11-27: "que los colores
 * también esperen a la imagen").
 *
 * The graph's scene host decides (`useKeepShownGraphScene`, in `GraphScene`).
 * Wherever no picture of the graph's is on screen to keep - no plot, the
 * canvas out of sight (the amp, a page over it), a standard look chosen - the
 * window shows the choice, as it always did. With nothing said yet, at
 * launch, it shows the choice too: there is no earlier picture to keep, and
 * the look the window opens with is the one it closed with.
 */

/**
 * The look shown: its id as the selection named it, and its scene, null for
 * a standard look. Undefined: nothing is held, and the window shows the
 * choice.
 */
type THeld = { lookId: string; scene: TDrawableScene | null } | undefined;

let held: THeld;
const listeners = new Set<() => void>();

const hold = (next: THeld) => {
  const same =
    next === undefined
      ? held === undefined
      : held !== undefined &&
        held.lookId === next.lookId &&
        held.scene === next.scene;
  if (same) {
    return;
  }
  held = next;
  listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const useHeld = () =>
  useSyncExternalStore(
    subscribe,
    () => held,
    () => undefined,
  );

/** The graph's Plus scene whose picture is on screen, or the choice. */
export const useShownGraphScene = (): TDrawableScene | null => {
  const chosen = useSceneLook();
  const kept = useHeld();
  return kept ? kept.scene : chosen;
};

/** The id of the graph's look whose picture is on screen, or the choice. */
export const useShownGraphLookId = (): string => {
  const chosen = useSelectedLookId();
  const kept = useHeld();
  return kept ? kept.lookId : chosen;
};

/**
 * From the graph's scene host: the look chosen - `lookId`, and `scene`, null
 * for a standard look - is what the window shows from now on, unless the
 * host's canvas is `puttingUp` a scene over a picture still on screen, when
 * the window goes on showing what it showed until that scene's first frame
 * is up. Before the paint, so no frame of the window shows the new scene's
 * pieces or colours with the old one's picture.
 */
export const useKeepShownGraphScene = (
  lookId: string,
  scene: TDrawableScene | null,
  puttingUp: boolean,
) => {
  useLayoutEffect(() => {
    if (!puttingUp) {
      hold({ lookId, scene });
    }
  }, [lookId, scene, puttingUp]);
  // The host gone, nothing of the graph's is on screen to keep.
  useLayoutEffect(() => () => hold(undefined), []);
};
