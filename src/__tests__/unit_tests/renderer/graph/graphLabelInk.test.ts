/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The graph's scale labels wear the ink of what is drawn behind each one
 * (Ivan, 2026-11-17: "if it is very bright, over the bars, on the standard
 * look"): every label read is marked light or dark (`data-scene-ink`), by
 * the plain figures' turns, paced by the frames the graph's painters draw;
 * a label with nothing drawn behind it is left to the window's own words,
 * and while a scene on the EQ column reads the figures itself this steps
 * aside and takes its marks off.
 *
 * jsdom has no OffscreenCanvas and no workers: both stand in here, and the
 * worker's answer — each label's mean luminance — is given by the case.
 */

import type { ILabelInkReply } from '../../../../renderer/graph/graphLabelInkMessages';

type TModule = typeof import('../../../../renderer/graph/graphLabelInk');

const INK = 'data-scene-ink';
/** Painted frames between reads (`READ_EVERY_FRAMES`). */
const READ_EVERY = 8;

/** The worker the module starts: what it was asked, and a way to answer. */
const workers: {
  posted: { id: number; boxes: Float32Array }[];
  answer: (levels: number[]) => void;
  terminated: number;
} = { posted: [], answer: () => undefined, terminated: 0 };

/**
 * What `new Worker(…)` hands the module: a constructor that returns an
 * object stands in for the class, and its answer is the case's to give.
 */
const FakeWorker = jest.fn(() => {
  const worker: {
    onmessage: ((event: MessageEvent<ILabelInkReply>) => void) | null;
    onerror: ((event: ErrorEvent) => void) | null;
    postMessage: (request: { id: number; boxes: Float32Array }) => void;
    terminate: () => void;
  } = {
    onmessage: null,
    onerror: null,
    postMessage: (request) => workers.posted.push(request),
    terminate: () => {
      workers.terminated += 1;
    },
  };
  workers.answer = (levels) => {
    const last = workers.posted[workers.posted.length - 1];
    worker.onmessage?.({
      data: { id: last.id, levels: Float32Array.from(levels) },
    } as MessageEvent<ILabelInkReply>);
  };
  return worker;
});

/** The small picture's canvas: drawn on, and handed over as a bitmap. */
const FakeOffscreenCanvas = jest.fn((width: number, height: number) => ({
  width,
  height,
  getContext: () => ({
    fillStyle: '',
    imageSmoothingQuality: 'low',
    fillRect: () => undefined,
    drawImage: () => undefined,
  }),
  transferToImageBitmap: () => ({}),
}));

const box = (left: number, top: number, width: number, height: number) =>
  ({
    x: left,
    y: top,
    left,
    top,
    right: left + width,
    bottom: top + height,
    width,
    height,
    toJSON: () => ({}),
  }) as DOMRect;

const place = (element: Element, rect: DOMRect) =>
  jest.spyOn(element, 'getBoundingClientRect').mockReturnValue(rect);

const SVG = 'http://www.w3.org/2000/svg';

/** A graph: two scale labels in its svg, and a drawn canvas behind them. */
const graph = (withCanvas = true) => {
  const wrapper = document.createElement('div');
  wrapper.className = 'graph-wrapper';
  const svg = document.createElementNS(SVG, 'svg');
  const axis = document.createElementNS(SVG, 'g');
  axis.setAttribute('class', 'chart-axis--inside');
  const low = document.createElementNS(SVG, 'text');
  const high = document.createElementNS(SVG, 'text');
  axis.append(low, high);
  svg.append(axis);
  wrapper.append(svg);
  document.body.append(wrapper);
  place(svg, box(0, 0, 800, 400));
  place(low, box(10, 360, 40, 14));
  place(high, box(10, 20, 40, 14));
  if (withCanvas) {
    const canvas = document.createElement('canvas');
    wrapper.prepend(canvas);
    place(canvas, box(0, 0, 800, 400));
  }
  return { svg, low, high };
};

const load = (): TModule => {
  const loaded: { module?: TModule } = {};
  jest.isolateModules(() => {
    // eslint-disable-next-line global-require -- a fresh copy: the module keeps its reads and marks in its own state
    loaded.module = require('../../../../renderer/graph/graphLabelInk');
  });
  if (!loaded.module) {
    throw new Error('graphLabelInk did not load');
  }
  return loaded.module;
};

const paint = (module: TModule, frames = READ_EVERY) => {
  for (let frame = 0; frame < frames; frame += 1) {
    module.noteGraphFrame();
  }
};

beforeEach(() => {
  workers.posted = [];
  workers.terminated = 0;
  Object.assign(globalThis, {
    Worker: FakeWorker,
    OffscreenCanvas: FakeOffscreenCanvas,
  });
  document.documentElement.classList.remove('is-scene-column');
});

afterEach(() => {
  document.body.innerHTML = '';
  jest.restoreAllMocks();
});

it('reads only every few painted frames, never on a clock', () => {
  const module = load();
  const { svg } = graph();
  const stop = module.registerGraphLabels(svg);
  paint(module, READ_EVERY - 1);
  expect(workers.posted).toHaveLength(0);
  module.noteGraphFrame();
  expect(workers.posted).toHaveLength(1);
  // Both labels' boxes, in the shrunk picture's pixels.
  expect(workers.posted[0].boxes).toHaveLength(2 * 4);
  stop();
});

it('marks each label by what is behind it, by the plain figures’ turns', () => {
  const module = load();
  const { svg, low, high } = graph();
  const stop = module.registerGraphLabels(svg);
  paint(module);
  // The low label over a bright bar top at 0.35, the high one over the dark.
  workers.answer([0.35, 0.05]);
  expect(low.getAttribute(INK)).toBe('dark');
  expect(high.getAttribute(INK)).toBe('light');
  // A scene's own turns would have left 0.35 light (`sceneInk.ts`); it is
  // the plain figures' 0.30 that takes it dark.
  stop();
  // Unregistered, the marks go and so does the worker.
  expect(low.hasAttribute(INK)).toBe(false);
  expect(workers.terminated).toBe(1);
});

it('leaves labels with nothing drawn behind them to the window’s own words', () => {
  const module = load();
  const { svg, low } = graph(false);
  low.setAttribute(INK, 'dark');
  const stop = module.registerGraphLabels(svg);
  paint(module);
  expect(workers.posted).toHaveLength(0);
  expect(low.hasAttribute(INK)).toBe(false);
  stop();
});

it('steps aside, marks off, while a scene on the EQ column reads the figures', () => {
  const module = load();
  const { svg, low } = graph();
  const stop = module.registerGraphLabels(svg);
  paint(module);
  workers.answer([0.9, 0.9]);
  expect(low.getAttribute(INK)).toBe('dark');

  document.documentElement.classList.add('is-scene-column');
  paint(module);
  expect(low.hasAttribute(INK)).toBe(false);
  expect(workers.posted).toHaveLength(1);

  // The scene gone, reading starts again.
  document.documentElement.classList.remove('is-scene-column');
  paint(module);
  expect(workers.posted).toHaveLength(2);
  stop();
});
