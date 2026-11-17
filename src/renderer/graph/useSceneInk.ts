/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  createSceneInkFollower,
  type ISceneInkFollower,
  type TSceneProbeRect,
} from './sceneInk';
import type { ISceneRunnerProbe } from './sceneRunnerTypes';

/**
 * The ink the words standing on the graph's scene wear, while the scene is
 * drawn on the EQ column's layer (`SceneColumnLayer.tsx`): the EQ head, the
 * graph's options row, and each of the graph's figures — the dB scales, the
 * frequency names, the slope's label. The picture behind each is read on the scene's own frames
 * (`sceneProbe.ts`), and one that is bright turns that word dark
 * (`sceneInk.ts` for where):
 *
 * - the head, as one strip, by `data-scene-head-ink="dark"` on the root,
 *   which the head's styles answer (`App.scss`, `.center-head--eq`);
 * - each figure on its own, by `data-scene-ink="dark"` on its own text
 *   (`_graphThemeChart.scss`): a scale runs from the sky at the top of the
 *   plot to the ground at its foot, and one ink for the whole column would
 *   be wrong at one end of it;
 * - the graph's options row, by the same mark on the row, read behind its
 *   bare controls together (`App.scss`, `.live-output-controls`).
 *
 * Written straight to the DOM from the reading, never through a render, and
 * taken off again with the scene, the column or the layer. Nothing is read
 * and nothing marked with the scene anywhere else or no scene at all.
 *
 * Where the words stand is measured again on the frame after each reading,
 * so the places follow a resize, a scale that changes its figures and a
 * graph switched on or off, at the pace the scene is read and no faster.
 */

/** The graph's figures that stand straight on the picture. */
const FIGURES =
  ':scope > .graph-wrapper :is(.chart-axis--inside, .chart-axis--inside-bottom, .chart-slope-line) text';

/** The graph's options row, marked as one by the picture behind its controls. */
const OPTIONS = ':scope > .graph-wrapper > .live-output-controls';

/**
 * The options row's controls that have no face of their own, which are what
 * its mark changes (`App.scss`): the picture behind them is the row's.
 */
const BARE_OPTIONS =
  '.graph-edit-hint-mark, .graph-look-step, .graph-auto-cycle > [role="menu"], .graph-solo, .view-bar__icon';

/**
 * The head as a whole, marked on the root; or one element marked on itself —
 * a figure, or the options row.
 */
type TInkTarget = { kind: 'head' } | { kind: 'element'; element: Element };

interface IInkPlaces {
  /** Each place's box on the layer, rounded to pixels: what moved, at a glance. */
  key: string;
  targets: readonly TInkTarget[];
  rects: readonly TSceneProbeRect[];
}

const sameTargets = (a: readonly TInkTarget[], b: readonly TInkTarget[]) =>
  a.length === b.length &&
  a.every((target, at) => {
    const other = b[at];
    return target.kind === 'element' && other.kind === 'element'
      ? target.element === other.element
      : target.kind === other.kind;
  });

/** The smallest box round `boxes`, or undefined for none. */
const unionOf = (boxes: readonly DOMRect[]): DOMRect | undefined => {
  const drawn = boxes.filter((box) => box.width > 0 && box.height > 0);
  if (drawn.length === 0) {
    return undefined;
  }
  const left = Math.min(...drawn.map((box) => box.left));
  const top = Math.min(...drawn.map((box) => box.top));
  const right = Math.max(...drawn.map((box) => box.right));
  const bottom = Math.max(...drawn.map((box) => box.bottom));
  return new DOMRect(left, top, right - left, bottom - top);
};

/** Where the head, the options and the figures stand on `layer`, or none. */
const measurePlaces = (layer: HTMLElement): IInkPlaces | undefined => {
  const column = layer.parentElement;
  const frame = layer.getBoundingClientRect();
  if (!column || frame.width <= 0 || frame.height <= 0) {
    return undefined;
  }
  const found: [TInkTarget, DOMRect | undefined][] = [];
  const head = column.querySelector(':scope > .center-head');
  if (head) {
    found.push([{ kind: 'head' }, head.getBoundingClientRect()]);
  }
  const options = column.querySelector(OPTIONS);
  if (options) {
    found.push([
      { kind: 'element', element: options },
      unionOf(
        Array.from(options.querySelectorAll(BARE_OPTIONS), (control) =>
          control.getBoundingClientRect(),
        ),
      ),
    ]);
  }
  column.querySelectorAll(FIGURES).forEach((element) => {
    found.push([{ kind: 'element', element }, element.getBoundingClientRect()]);
  });
  const targets: TInkTarget[] = [];
  const rects: TSceneProbeRect[] = [];
  const boxes: string[] = [];
  found.forEach(([target, box]) => {
    if (!box) {
      return;
    }
    const left = Math.round(box.left - frame.left);
    const top = Math.round(box.top - frame.top);
    const width = Math.round(box.width);
    const height = Math.round(box.height);
    // A word not drawn, or off the layer, has nothing behind it to read.
    if (
      width <= 0 ||
      height <= 0 ||
      left + width <= 0 ||
      top + height <= 0 ||
      left >= frame.width ||
      top >= frame.height
    ) {
      return;
    }
    targets.push(target);
    rects.push([
      left / frame.width,
      top / frame.height,
      (left + width) / frame.width,
      (top + height) / frame.height,
    ]);
    boxes.push(`${left},${top},${width},${height}`);
  });
  return targets.length > 0
    ? { key: boxes.join(';'), targets, rects }
    : undefined;
};

export default function useSceneInk(
  layer: HTMLElement | undefined,
): ISceneRunnerProbe | undefined {
  const [places, setPlaces] = useState<IInkPlaces>();
  // One follower for the head, one for each element for as long as that
  // element lives; the elements marked dark, to take the marks off.
  const [head] = useState(createSceneInkFollower);
  const elementsRef = useRef(new WeakMap<Element, ISceneInkFollower>());
  const markedRef = useRef(new Set<Element>());
  /** Measures again on the next frame; set while there is a layer. */
  const remeasureRef = useRef<(() => void) | undefined>(undefined);

  useEffect(() => {
    if (!layer) {
      setPlaces(undefined);
      return undefined;
    }
    let frame: number | undefined;
    const measure = () => {
      frame = undefined;
      const next = measurePlaces(layer);
      setPlaces((previous) =>
        previous &&
        next &&
        previous.key === next.key &&
        sameTargets(previous.targets, next.targets)
          ? previous
          : next,
      );
    };
    const remeasure = () => {
      frame ??= requestAnimationFrame(measure);
    };
    remeasureRef.current = remeasure;
    remeasure();
    // Readings measure again as they come; these cover what changes while
    // nothing is being read — the first layout, a resize, the head or the
    // graph arriving.
    const resized = new ResizeObserver(remeasure);
    resized.observe(layer);
    const arrived = new MutationObserver(remeasure);
    if (layer.parentElement) {
      arrived.observe(layer.parentElement, { childList: true });
    }
    const marked = markedRef.current;
    return () => {
      resized.disconnect();
      arrived.disconnect();
      remeasureRef.current = undefined;
      if (frame !== undefined) {
        cancelAnimationFrame(frame);
      }
      // The words' own ink comes back with the scene gone from the column,
      // and the next scene starts from it.
      delete document.documentElement.dataset.sceneHeadInk;
      marked.forEach((element) => element.removeAttribute('data-scene-ink'));
      marked.clear();
      head.reset();
      elementsRef.current = new WeakMap();
    };
  }, [layer, head]);

  return useMemo(() => {
    if (!places) {
      return undefined;
    }
    const { targets, rects } = places;
    const heard = (luminances: readonly number[]) => {
      targets.forEach((target, at) => {
        const luminance = luminances[at];
        if (target.kind === 'head') {
          const root = document.documentElement;
          const dark = head.hear(luminance) === 'dark';
          if (dark !== (root.dataset.sceneHeadInk === 'dark')) {
            if (dark) {
              root.dataset.sceneHeadInk = 'dark';
            } else {
              delete root.dataset.sceneHeadInk;
            }
          }
          return;
        }
        const { element } = target;
        let follower = elementsRef.current.get(element);
        if (!follower) {
          follower = createSceneInkFollower();
          elementsRef.current.set(element, follower);
        }
        const dark = follower.hear(luminance) === 'dark';
        if (dark !== markedRef.current.has(element)) {
          if (dark) {
            element.setAttribute('data-scene-ink', 'dark');
            markedRef.current.add(element);
          } else {
            element.removeAttribute('data-scene-ink');
            markedRef.current.delete(element);
          }
        }
      });
      // Figures that have gone from the page take their marks with them.
      markedRef.current.forEach((element) => {
        if (!element.isConnected) {
          markedRef.current.delete(element);
        }
      });
      remeasureRef.current?.();
    };
    return { rects, heard };
  }, [places, head]);
}
