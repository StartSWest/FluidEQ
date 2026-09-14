/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Where visualizers stand in the window, for the Ambient mode to stay off
 * them: its birds, petals and stars (`SceneAmbient.tsx`) and its light
 * (`ScenePulse.tsx`) belong to the room around a visualizer, never over one.
 *
 * Every visualizer, not only the one lending the window its mode. Only that
 * one's box used to be kept clear, so a bird crossing the Visualizers page
 * flew over the scenes' pictures, and one crossing the Studio flew over the
 * graph below it.
 *
 * Read every frame the layer draws, because anything else is late: a gallery
 * scrolled, a page swapped, a stage dragged taller all move a visualizer with
 * nothing to observe, and a box measured even a few frames earlier let a bird
 * across the edge of a picture that had moved.
 */

export interface IVisualizerBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Each marks an element that shows a visualizer, drawn live or as its picture. */
export const VISUALIZER_SURFACE_CLASSES = [
  // The graph, whatever it draws: a scene, or the spectrum under the curve.
  'graph-plot',
  // The Studio's stage, and the well standing in its shape while it is paused.
  'studio-stage',
  'studio-stage__well--empty',
  // A scene playing in the library: its page, its taste, the publish camera.
  'gallery-preview__frame',
  // A scene's picture, wherever the library shows one.
  'gallery-picture',
] as const;

/**
 * Live lists, which the browser keeps current as elements come and go, so a
 * frame reads what is there without searching the page for it.
 */
let surfaces: HTMLCollectionOf<Element>[] | undefined;
const surfaceLists = () => {
  surfaces ??= VISUALIZER_SURFACE_CLASSES.map((name) =>
    document.getElementsByClassName(name),
  );
  return surfaces;
};

const CLIPPING = new Set(['hidden', 'clip', 'auto', 'scroll']);

const clips = (element: Element) => {
  const style = getComputedStyle(element);
  return CLIPPING.has(style.overflowX) || CLIPPING.has(style.overflowY);
};

/**
 * The nearest ancestor that cuts off what overflows it — a scrolling list, a
 * pane — or null. An element's place in the tree does not change while it is
 * mounted, so each is looked up once.
 */
const clippers = new WeakMap<Element, Element | null>();
const clipperOf = (element: Element): Element | null => {
  const parent = element.parentElement;
  if (!parent) {
    return null;
  }
  const known = clippers.get(parent);
  if (known !== undefined) {
    return known;
  }
  const clipper = clips(parent) ? parent : clipperOf(parent);
  clippers.set(parent, clipper);
  return clipper;
};

const shown = (element: Element) =>
  typeof element.checkVisibility !== 'function' ||
  element.checkVisibility({ opacityProperty: true, visibilityProperty: true });

/**
 * The part of every visualizer that is on screen, in CSS pixels of the
 * window `width` by `height`: cut to the list or pane it scrolls in, so a
 * picture scrolled half under a bar leaves the bar alone.
 */
export const visualizerBoxes = (
  width: number,
  height: number,
): IVisualizerBox[] => {
  const boxes: IVisualizerBox[] = [];
  surfaceLists().forEach((list) => {
    for (let index = 0; index < list.length; index += 1) {
      const element = list[index];
      const box = element?.getBoundingClientRect();
      if (element && box && box.width > 0 && box.height > 0) {
        let { left, top, right, bottom } = box;
        const clipper = clipperOf(element);
        if (clipper) {
          const edge = clipper.getBoundingClientRect();
          left = Math.max(left, edge.left);
          top = Math.max(top, edge.top);
          right = Math.min(right, edge.right);
          bottom = Math.min(bottom, edge.bottom);
        }
        left = Math.max(left, 0);
        top = Math.max(top, 0);
        right = Math.min(right, width);
        bottom = Math.min(bottom, height);
        if (right > left && bottom > top && shown(element)) {
          boxes.push({ left, top, width: right - left, height: bottom - top });
        }
      }
    }
  });
  return boxes;
};

/**
 * `boxes` without those lying wholly inside another — a picture shown within
 * a preview's frame — for a cut that has to be one hole per place.
 */
export const outermostBoxes = (boxes: readonly IVisualizerBox[]) =>
  boxes.filter(
    (box, index) =>
      !boxes.some(
        (other, otherIndex) =>
          otherIndex !== index &&
          other.left <= box.left &&
          other.top <= box.top &&
          other.left + other.width >= box.left + box.width &&
          other.top + other.height >= box.top + box.height &&
          // Of two identical boxes, the first one stays.
          (otherIndex < index ||
            other.left !== box.left ||
            other.top !== box.top ||
            other.width !== box.width ||
            other.height !== box.height),
      ),
  );
