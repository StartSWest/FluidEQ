/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  createSceneInkFollower,
  SCENE_INK_SMOOTHING,
  type ISceneInkFollower,
  type TSceneProbeRect,
} from './sceneInk';
import { scenePanelFloor } from './scenePanelFloor';
import type { ISceneRunnerProbe } from './sceneRunnerTypes';
import { readSurface } from '../utils/theme';
import { TEXT_CONTRAST } from '../utils/themeInk';

/**
 * The ink the words standing on the graph's scene wear, while the scene is
 * drawn on the EQ column's layer (`SceneColumnLayer.tsx`): the EQ head, the
 * graph's options, and each of the graph's figures — the dB scales, the
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
 * - each of the graph's options, the looks' gallery's crystals, by the same
 *   mark on itself (`GraphGallery.scss`);
 * - and while the EQ page's panels let the picture through
 *   (`has-scene-panel-glass`), the picture behind the bands' card, which sets
 *   how thin their face may go and keep the window's words readable
 *   (`--scene-panel-floor`, `scenePanelFloor.ts`).
 *
 * Written straight to the DOM from the reading, never through a render, and
 * taken off again with the scene, the column or the layer. Nothing is read
 * and nothing marked with the scene anywhere else or no scene at all.
 *
 * Where the words stand is measured again on the frame after each reading,
 * so the places follow a resize, a scale that changes its figures and a
 * graph switched on or off, at the pace the scene is read and no faster.
 */

/** The bands' card, measured while its face lets the picture through. */
const PANEL = ':scope > .middle-content > .workspace-tab-panel--eq';

/** Where the card's face floor is written for the stylesheet (`_themeTokens.scss`). */
const PANEL_FLOOR = '--scene-panel-floor';

/**
 * The card's words: the window's primary ink at its own contrast, and the
 * muted ink that labels its bands at WCAG AA, which over a moving picture is
 * the honest bar rather than the solid card's 5.8.
 */
const MUTED_ON_GLASS_CONTRAST = 4.5;

/** The floor's step, in percent of the face. */
const PANEL_FLOOR_STEP = 2;

/**
 * The floor for the card's face over a picture of mean relative luminance
 * `picture`, as the stylesheet takes it. In steps of two: a face that moved
 * by a hair on every reading would restyle the window seven times a second
 * for nothing.
 */
const panelFloorOf = (picture: number): string => {
  const floor = scenePanelFloor(
    picture,
    readSurface('--surface-panel', '#0c0e12'),
    [
      {
        colour: readSurface('--text-primary', '#ecf5fb'),
        contrast: TEXT_CONTRAST['--text-primary'],
      },
      {
        colour: readSurface('--text-muted', '#d6e9f7'),
        contrast: MUTED_ON_GLASS_CONTRAST,
      },
    ],
  );
  return `${Math.ceil(floor / PANEL_FLOOR_STEP) * PANEL_FLOOR_STEP}%`;
};

/** The graph's figures that stand straight on the picture. */
const FIGURES =
  ':scope > .graph-wrapper :is(.chart-axis--inside, .chart-axis--inside-bottom, .chart-slope-line) text';

/**
 * The graph's options, the looks' gallery: each crystal marked on itself by
 * the picture behind it alone (`GraphGallery.scss`): the reel, one bar at the
 * plot's foot, and the corner at its top. One ink for all of it was the
 * old row's failure over a scene bright in one place and dark in the next.
 */
const CRYSTALS =
  ':scope > .graph-wrapper > .live-output-controls > :is(.graph-gallery-reel, .graph-gallery-keys)';

/**
 * The head as a whole, marked on the root; or one element marked on itself —
 * a figure, or one of the gallery's crystals.
 */
type TInkTarget =
  { kind: 'head' } | { kind: 'panel' } | { kind: 'element'; element: Element };

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
  const panel = document.documentElement.classList.contains(
    'has-scene-panel-glass',
  )
    ? column.querySelector(PANEL)
    : null;
  if (panel) {
    found.push([{ kind: 'panel' }, panel.getBoundingClientRect()]);
  }
  column.querySelectorAll(CRYSTALS).forEach((element) => {
    found.push([{ kind: 'element', element }, element.getBoundingClientRect()]);
  });
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
  /** The picture behind the bands' card, smoothed as the inks' readings are. */
  const panelLevelRef = useRef<number | undefined>(undefined);
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
      document.documentElement.style.removeProperty(PANEL_FLOOR);
      panelLevelRef.current = undefined;
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
    const root = document.documentElement;
    if (!targets.some((target) => target.kind === 'panel')) {
      // The face lets nothing through, or there is no card: no floor.
      root.style.removeProperty(PANEL_FLOOR);
      panelLevelRef.current = undefined;
    }
    const heard = (luminances: readonly number[]) => {
      targets.forEach((target, at) => {
        const luminance = luminances[at];
        if (target.kind === 'panel') {
          if (!Number.isFinite(luminance)) {
            return;
          }
          const previous = panelLevelRef.current;
          const level =
            previous === undefined
              ? luminance
              : previous + (luminance - previous) * SCENE_INK_SMOOTHING;
          panelLevelRef.current = level;
          const floor = panelFloorOf(level);
          if (root.style.getPropertyValue(PANEL_FLOOR) !== floor) {
            root.style.setProperty(PANEL_FLOOR, floor);
          }
          return;
        }
        if (target.kind === 'head') {
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
