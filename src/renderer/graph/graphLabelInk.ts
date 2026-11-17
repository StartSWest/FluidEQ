/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { reportError } from '../utils/logger';
import type { ILabelInkReply, ILabelInkRequest } from './graphLabelInkMessages';
import {
  createSceneInkFollower,
  PLAIN_TEXT_INK_TURNS,
  type ISceneInkFollower,
} from './sceneInk';

/**
 * Which ink each of the graph's scale labels wears — the gain and level
 * figures inside the plot's edges and the frequency names along its foot —
 * read from what is drawn behind that label (Ivan, 2026-11-17: "the detector
 * must also detect the label: if it is very bright, over the bars, on the
 * standard look"). A label over a bright bar, a bright engine look or a pale
 * scene on the plot turns to the floor's dark with a soft light shadow; it
 * is the mark and the turns the column's scene uses for the same figures
 * (`data-scene-ink="dark"`, `useSceneInk.ts`, `sceneInk.ts`), so one rule
 * draws both (`_graphThemeChart.scss`). While a scene is drawn on the EQ
 * column that hook reads the figures from the scene's own frames and this
 * steps aside, taking its marks off first: two readers would mark the same
 * text against each other.
 *
 * Read from the picture rather than from the bars' data, because the same
 * labels stand over some sixty looks — bars, waves, scenery, the engine's
 * looks in their worker, a Plus scene on the plot or the column — each with
 * its own geometry, palette, glow and fill, and only the drawn pixels say
 * all of that at once. The canvases behind the chart are drawn, shrunk by
 * `SHRINK`, onto one small canvas — a copy on the GPU, never a readback of a
 * full frame — and that small picture, about 520 by 200 pixels for a
 * full-screen EQ graph, is handed as a bitmap to a worker that reads it back
 * and measures each label's box (`graphLabelInk.worker.ts`): the page never
 * waits on the GPU, and one read is in flight at a time.
 *
 * Paced by the frames the graph's painters draw (`noteGraphFrame`), never by
 * a clock: a still picture asks for nothing.
 */

/** Painted frames between reads: about seven reads a second at 60 Hz. */
const READ_EVERY_FRAMES = 8;

/**
 * The picture is read at a quarter of its CSS size: a label of 16px stands
 * on four rows of the small picture, each a filtered sample of four, which
 * is the whole label for a mean.
 */
const SHRINK = 4;

/** The figures read, each on its own: the scales, the names, the slope's. */
const LABEL_SELECTOR =
  ':is(.chart-axis--inside, .chart-axis--inside-bottom, .chart-slope-line) text';

/**
 * Scenes are drawn on a layer of their own behind the pages, wherever the
 * scene stands (`SceneCanvas`), so they are found by their host, not under
 * the chart; they always lie behind the graph and are drawn first.
 */
const SCENE_CANVAS_SELECTOR = '.chart-scene-canvas canvas';

const INK_ATTRIBUTE = 'data-scene-ink';

const charts = new Set<SVGSVGElement>();
let followers = new WeakMap<Element, ISceneInkFollower>();
/** The figures this has marked dark, to take its marks off when it stops. */
const marked = new Set<Element>();
/** Whether the column's scene has the figures and this has stepped aside. */
let aside = false;

let frames = 0;
let shrunk: OffscreenCanvas | undefined;
let worker: Worker | undefined;
/** The read in flight: its number and its labels, in the boxes' order. */
let inFlight: { id: number; labels: Element[] } | undefined;
let reads = 0;
/** The chart read last, so several take turns. */
let turn = 0;

const setInk = (label: Element, dark: boolean) => {
  if (marked.has(label) === dark) {
    return;
  }
  if (dark) {
    label.setAttribute(INK_ATTRIBUTE, 'dark');
    marked.add(label);
  } else {
    label.removeAttribute(INK_ATTRIBUTE);
    marked.delete(label);
  }
};

const forget = (svg: SVGSVGElement) => {
  svg.querySelectorAll(LABEL_SELECTOR).forEach((label) => {
    setInk(label, false);
    followers.get(label)?.reset();
  });
};

/** Every mark of this one's off, and nothing remembered or in flight. */
const letGo = () => {
  marked.forEach((label) => label.removeAttribute(INK_ATTRIBUTE));
  marked.clear();
  followers = new WeakMap();
  inFlight = undefined;
};

/**
 * A scene drawn on the EQ column reads the figures from its own frames
 * (`useSceneInk.ts`), and its root class says so.
 */
const sceneHasFigures = (): boolean =>
  document.documentElement.classList.contains('is-scene-column');

const isShown = (element: Element, box: DOMRect): boolean =>
  box.width > 0 &&
  box.height > 0 &&
  (typeof element.checkVisibility !== 'function' ||
    element.checkVisibility({
      opacityProperty: true,
      visibilityProperty: true,
    }));

const overlaps = (a: DOMRect, b: DOMRect): boolean =>
  a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

/** The canvases that paint behind `svg`'s labels, back to front. */
const canvasesBehind = (
  svg: SVGSVGElement,
  box: DOMRect,
): { canvas: HTMLCanvasElement; box: DOMRect }[] => {
  const wrapper = svg.closest('.graph-wrapper');
  const candidates = [
    ...document.querySelectorAll<HTMLCanvasElement>(SCENE_CANVAS_SELECTOR),
    ...(wrapper ? wrapper.querySelectorAll<HTMLCanvasElement>('canvas') : []),
  ];
  return candidates.flatMap((canvas) => {
    const canvasBox = canvas.getBoundingClientRect();
    return canvas.width > 0 &&
      canvas.height > 0 &&
      isShown(canvas, canvasBox) &&
      overlaps(canvasBox, box)
      ? [{ canvas, box: canvasBox }]
      : [];
  });
};

/** The picture's canvas, `width × height`, kept from one read to the next. */
const pictureCanvas = (width: number, height: number): OffscreenCanvas => {
  if (!shrunk) {
    shrunk = new OffscreenCanvas(width, height);
  } else if (shrunk.width !== width || shrunk.height !== height) {
    shrunk.width = width;
    shrunk.height = height;
  }
  return shrunk;
};

/** Turns each label of a finished read to the ink its picture calls for. */
const applyRead = ({ data }: MessageEvent<ILabelInkReply>): void => {
  const read = inFlight;
  if (!read || read.id !== data.id) {
    return;
  }
  inFlight = undefined;
  read.labels.forEach((label, index) => {
    const luminance = data.levels[index];
    // A label taken away while its picture was being read is let go.
    if (!label.isConnected || !Number.isFinite(luminance)) {
      return;
    }
    let follower = followers.get(label);
    if (!follower) {
      follower = createSceneInkFollower(PLAIN_TEXT_INK_TURNS);
      followers.set(label, follower);
    }
    setInk(label, follower.hear(luminance) === 'dark');
  });
  // Figures gone from the page take their marks with them.
  marked.forEach((label) => {
    if (!label.isConnected) {
      marked.delete(label);
    }
  });
};

/**
 * The worker that reads the pictures, started on the first read. One that
 * fails is logged and let go; the next read starts another.
 */
const readingWorker = (): Worker => {
  if (worker) {
    return worker;
  }
  const started = new Worker(
    new URL(
      process.env.NODE_ENV === 'production'
        ? './label-ink.js'
        : '/label-ink.dev.js',
      window.location.href,
    ),
  );
  started.onmessage = applyRead;
  started.onerror = (event) => {
    reportError('Reading the graph behind its scale labels', event.message);
    started.terminate();
    if (worker === started) {
      worker = undefined;
      inFlight = undefined;
    }
  };
  worker = started;
  return started;
};

/**
 * Takes the picture behind `svg`'s labels and hands it to the worker; true
 * when a read was started. With nothing drawn behind the labels they stand
 * on the card, and take their own ink at once.
 */
const beginChart = (svg: SVGSVGElement): boolean => {
  const box = svg.getBoundingClientRect();
  if (!svg.isConnected || !isShown(svg, box)) {
    return false;
  }
  const placed = [...svg.querySelectorAll(LABEL_SELECTOR)].flatMap((text) => {
    const label = text.getBoundingClientRect();
    return label.width > 0 && label.height > 0 && overlaps(label, box)
      ? [{ text, label }]
      : [];
  });
  if (placed.length === 0) {
    return false;
  }
  const behind = canvasesBehind(svg, box);
  if (behind.length === 0) {
    placed.forEach(({ text }) => {
      setInk(text, false);
      followers.get(text)?.reset();
    });
    return false;
  }

  const width = Math.max(1, Math.ceil(box.width / SHRINK));
  const height = Math.max(1, Math.ceil(box.height / SHRINK));
  const canvas = pictureCanvas(width, height);
  const drawing = canvas.getContext('2d');
  if (!drawing) {
    return false;
  }
  drawing.clearRect(0, 0, width, height);
  drawing.imageSmoothingQuality = 'medium';
  behind.forEach(({ canvas: source, box: at }) => {
    drawing.drawImage(
      source,
      (at.left - box.left) / SHRINK,
      (at.top - box.top) / SHRINK,
      at.width / SHRINK,
      at.height / SHRINK,
    );
  });
  const boxes = new Float32Array(placed.length * 4);
  placed.forEach(({ label }, index) => {
    boxes[index * 4] = (label.left - box.left) / SHRINK;
    boxes[index * 4 + 1] = (label.top - box.top) / SHRINK;
    boxes[index * 4 + 2] = (label.right - box.left) / SHRINK;
    boxes[index * 4 + 3] = (label.bottom - box.top) / SHRINK;
  });
  reads += 1;
  const request: ILabelInkRequest = {
    id: reads,
    // Handed over, not copied: the small canvas starts blank next time.
    picture: canvas.transferToImageBitmap(),
    boxes,
  };
  inFlight = { id: request.id, labels: placed.map(({ text }) => text) };
  readingWorker().postMessage(request, [request.picture, boxes.buffer]);
  return true;
};

/**
 * A painter of the graph — the trace canvas, the engine's looks, a scene —
 * has drawn a frame; every few of them the next read is started, one chart
 * at a time and never while one is still being read.
 */
export const noteGraphFrame = (): void => {
  if (charts.size === 0 || document.hidden) {
    return;
  }
  if (sceneHasFigures()) {
    if (!aside) {
      aside = true;
      letGo();
    }
    return;
  }
  aside = false;
  frames += 1;
  if (frames < READ_EVERY_FRAMES || inFlight) {
    return;
  }
  frames = 0;
  const shown = [...charts];
  for (let tried = 0; tried < shown.length; tried += 1) {
    turn = (turn + 1) % shown.length;
    if (beginChart(shown[turn])) {
      return;
    }
  }
};

/** Reads `svg`'s scale labels from now on; the answer stops reading them. */
export const registerGraphLabels = (svg: SVGSVGElement): (() => void) => {
  charts.add(svg);
  return () => {
    charts.delete(svg);
    forget(svg);
    if (charts.size === 0) {
      // Nothing left to read: the worker and its picture go.
      worker?.terminate();
      worker = undefined;
      inFlight = undefined;
      shrunk = undefined;
    }
  };
};
