/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useLayoutEffect, useReducer } from 'react';
import { prefersReducedMotion } from '../utils/bandReveal';
import { useScenePanelsSeeThrough } from '../utils/scenePanels';
import { SCENE_SETTLED_EVENT } from './sceneCanvasHold';

/**
 * Whether the EQ column's scene runs on under the bands' card, and where it
 * is in coming and going (`data-reach` on the layer, `App.scss`):
 *
 * - `off`: the layer stops at the tab row's foot and no pixel under the card
 *   is drawn — See through at 0, as it always was.
 * - `arriving`: the layer reaches under the card, the strip there hidden
 *   until a frame drawn for the taller box is on the canvas.
 * - `revealing`: that strip fading in.
 * - `on`: all of it shown, nothing laid over it.
 * - `leaving`: the strip fading out, the layer still reaching; it stops at
 *   the row again once the fade has run.
 *
 * The strip used to come with the box: See through left 0, the layer grew,
 * and the picture already on the canvas, drawn for the shorter box, was laid
 * over the taller one until the worker drew a frame for it — scaled up, then
 * stretched (Ivan, 2026-11-25: "the scene kind of stretches out for a second
 * to be able to draw into the equalizer"). The canvas now keeps that picture
 * at its own size (`sceneCanvasHold.ts`) and this keeps the strip it does not
 * cover out of sight until it does, then fades it in — and fades it out
 * before the layer is cut back, rather than cutting it off.
 *
 * Moving See through between values over 0 changes nothing here. With
 * Animations off there is no fade: the strip appears once drawn, and goes at
 * once.
 */
export type TSceneColumnReach =
  'off' | 'arriving' | 'revealing' | 'on' | 'leaving';

export type TSceneColumnReachEvent =
  /** See through over 0 or not; `still` with Animations off. */
  | { kind: 'through'; through: boolean; still: boolean }
  /** A frame drawn for a box as tall as the layer is on the canvas. */
  | { kind: 'settled'; still: boolean }
  /** The strip's fade has run to `shown` (1) or hidden (0). */
  | { kind: 'faded'; shown: number };

export const nextSceneColumnReach = (
  reach: TSceneColumnReach,
  event: TSceneColumnReachEvent,
): TSceneColumnReach => {
  if (event.kind === 'through') {
    if (event.through) {
      if (reach === 'off') {
        return 'arriving';
      }
      if (reach === 'leaving') {
        // Still drawn under the card: back without waiting for anything.
        return event.still ? 'on' : 'revealing';
      }
      return reach;
    }
    if (reach === 'arriving') {
      // Nothing of the strip has been shown, so there is nothing to fade.
      return 'off';
    }
    if (reach === 'revealing' || reach === 'on') {
      return event.still ? 'off' : 'leaving';
    }
    return reach;
  }
  if (event.kind === 'settled') {
    if (reach !== 'arriving') {
      return reach;
    }
    return event.still ? 'on' : 'revealing';
  }
  if (reach === 'revealing' && event.shown === 1) {
    return 'on';
  }
  if (reach === 'leaving' && event.shown === 0) {
    return 'off';
  }
  return reach;
};

/** The property the strip's fade runs on (`@property`, `SceneColumn.scss`). */
const REACH_PROPERTY = '--scene-reach';

/** A box rounded to whole pixels against a layer measured in fractions. */
const ROUNDING_PX = 1;

/**
 * The EQ column layer's reach under the bands' card (`TSceneColumnReach`),
 * for `layer` to wear as `data-reach`.
 */
export default function useSceneColumnReach(
  layer: HTMLElement | null,
): TSceneColumnReach {
  const through = useScenePanelsSeeThrough() > 0;
  // Already through at the start, there is nothing to bring in: the scene's
  // own first picture fades in over the whole layer.
  const [reach, dispatch] = useReducer(
    nextSceneColumnReach,
    through ? 'on' : 'off',
  );

  // Before the paint, so the layer never grows for a frame with its strip
  // shown.
  useLayoutEffect(() => {
    dispatch({ kind: 'through', through, still: prefersReducedMotion() });
  }, [through]);

  useEffect(() => {
    if (!layer) {
      return undefined;
    }
    // Only a frame for a box as tall as the layer: one settling for the box
    // the layer had before it reached is no picture under the card.
    const settled = (event: Event) => {
      const { target } = event;
      if (
        target instanceof HTMLElement &&
        target.getBoundingClientRect().height >=
          layer.getBoundingClientRect().height - ROUNDING_PX
      ) {
        dispatch({ kind: 'settled', still: prefersReducedMotion() });
      }
    };
    // Read from where the fade ended, so the end of a fade already reversed
    // (shown again mid-way out) is not taken for the new one's.
    const faded = (event: TransitionEvent) => {
      if (event.target !== layer || event.propertyName !== REACH_PROPERTY) {
        return;
      }
      const shown = Number(
        getComputedStyle(layer).getPropertyValue(REACH_PROPERTY),
      );
      dispatch({ kind: 'faded', shown });
    };
    layer.addEventListener(SCENE_SETTLED_EVENT, settled);
    layer.addEventListener('transitionend', faded);
    return () => {
      layer.removeEventListener(SCENE_SETTLED_EVENT, settled);
      layer.removeEventListener('transitionend', faded);
    };
  }, [layer]);

  return reach;
}
