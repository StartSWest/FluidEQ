/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useSyncExternalStore } from 'react';
import type { ILabelBox } from './bandLabelLayout';

/**
 * The plot's corner legend (`GraphCornerLegend`), for the band labels to keep
 * off it as they keep off the analyser's key (`legendPlace.ts`): a band near
 * the corner put its label under the block's names.
 *
 * The legend hands over its element and says each time its box changes; the
 * labels measure it against their own svg (`cornerLegendBox`). Measured by
 * the legend instead, the box was taken before the chart had drawn its svg —
 * the chart waits for its own size — and the labels never heard of it.
 */
interface ICornerLegend {
  element?: HTMLElement;
  /** Moves whenever the element's box may have: a resize, a fold of the row. */
  version: number;
}

let current: ICornerLegend = { version: 0 };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

/** The legend's element while it is drawn, undefined once it is not. */
export const setCornerLegendElement = (element: HTMLElement | undefined) => {
  if (current.element === element) {
    return;
  }
  current = { element, version: current.version + 1 };
  emit();
};

/** The legend's box changed: the labels measure it again. */
export const noteCornerLegendMoved = () => {
  current = { ...current, version: current.version + 1 };
  emit();
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const useCornerLegend = () =>
  useSyncExternalStore(
    subscribe,
    () => current,
    () => current,
  );

/** The legend's box in `svg`'s own coordinates, which are the chart's. */
export const cornerLegendBox = (
  element: HTMLElement | undefined,
  svg: SVGSVGElement | null | undefined,
): ILabelBox | undefined => {
  if (!element || !svg || !element.isConnected) {
    return undefined;
  }
  const own = element.getBoundingClientRect();
  const origin = svg.getBoundingClientRect();
  return {
    x: own.left - origin.left,
    y: own.top - origin.top,
    width: own.width,
    height: own.height,
  };
};

/** Whether two boxes are the same to the pixel. */
export const isSameBox = (one?: ILabelBox, other?: ILabelBox) =>
  one === other ||
  (one !== undefined &&
    other !== undefined &&
    Math.round(one.x) === Math.round(other.x) &&
    Math.round(one.y) === Math.round(other.y) &&
    Math.round(one.width) === Math.round(other.width) &&
    Math.round(one.height) === Math.round(other.height));
