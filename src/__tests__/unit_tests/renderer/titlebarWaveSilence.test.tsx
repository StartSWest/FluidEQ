/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The titlebar wave, drawn: soft music stands up in the pane, and the flat
 * line comes only after real silence has lasted — with nothing published to
 * wake the drawing, as the capture sends nothing once the output is at rest.
 *
 * Read back from the calls the canvas is handed (`waveformFlatPaint.ts`
 * paints straight onto it). The canvas reports 180 x 44 and is grown by the
 * 10 px bleed on every side, so the pane is 160 x 24 with its centre line at
 * 22, and the `fluid` wave reaches 10 above it at most (half the pane less
 * two): a wave's height is how far its highest point stands above that line.
 */

import { act, render } from '@testing-library/react';
import type { IChartPointData } from 'renderer/graph/ChartController';
import {
  SILENT_WAVEFORM,
  WAVEFORM_POINT_COUNT,
} from 'renderer/graph/liveSpectrumFrames';
import { WAVEFORM_BLEED, WAVEFORM_STYLE_KEY } from 'renderer/waveformPaint';
import WaveformVisualizer, {
  RECORDER_INTRODUCED_KEY,
} from 'renderer/WaveformVisualizer';

const mockAudio = {
  frame: {
    isClipping: false,
    points: [] as IChartPointData[],
    waveform: [] as number[],
  },
  /** What the analyser holds now; read by the drawing on its own clock. */
  capture: [] as number[],
  /** The spectrum the analyser holds now; none unless a case gives one. */
  capturePoints: [] as IChartPointData[],
};

jest.mock('renderer/audio/LiveAudioContext', () => ({
  ...jest
    .requireActual<typeof import('../../utils/liveFrameHooks')>(
      '../../utils/liveFrameHooks',
    )
    .liveFrameHooks(() => mockAudio.frame),
  useLiveAudioFrame: () => mockAudio.frame,
  useLiveAudioControl: () => ({
    isActive: true,
    isPaused: false,
    // The reader's audio clock runs with the (fake) wall clock here.
    readFrame: () => ({
      points: mockAudio.capturePoints,
      graphPoints: [],
      waveform: mockAudio.capture,
      audioMs: performance.now(),
      channelPeaks: [],
    }),
  }),
  useLiveAudioCapture: () => undefined,
}));

/** One drawn frame: the curve's points and every rounded piece. */
interface IDrawnFrame {
  curveYs: number[];
  pieces: [number, number, number, number][];
}
const frames: IDrawnFrame[] = [];
const current = () => frames[frames.length - 1];

const gradient = { addColorStop: () => undefined };
const drawing: Record<string | symbol, unknown> = {
  // Every frame starts by clearing the canvas.
  clearRect: () => {
    frames.push({ curveYs: [], pieces: [] });
  },
  moveTo: (_x: number, y: number) => current()?.curveYs.push(y),
  bezierCurveTo: (...args: number[]) => current()?.curveYs.push(args[5]),
  roundRect: (x: number, y: number, width: number, height: number) =>
    current()?.pieces.push([x, y, width, height]),
};
const context = new Proxy(drawing, {
  get: (target, property) =>
    property in target ? target[property] : () => gradient,
  set: (target, property, value) => {
    Reflect.set(target, property, value);
    return true;
  },
});

/** jsdom has no Path2D; the styles that build one only need it to exist. */
class FakePath2D {
  moveTo() {
    return this;
  }

  arc() {
    return this;
  }

  rect() {
    return this;
  }

  roundRect() {
    return this;
  }
}

const SizedResizeObserver = jest.fn(
  (
    report: (
      entries: { contentRect: { width: number; height: number } }[],
    ) => void,
  ) => ({
    observe: () => report([{ contentRect: { width: 180, height: 44 } }]),
    unobserve: () => undefined,
    disconnect: () => undefined,
  }),
);

const PANE_HEIGHT = 44 - WAVEFORM_BLEED * 2;
const CENTRE = WAVEFORM_BLEED + PANE_HEIGHT / 2;
/** How far the fluid wave may stand above the centre line. */
const REACH = PANE_HEIGHT / 2 - 2;

const flatAt = (db: number) =>
  Array.from({ length: WAVEFORM_POINT_COUNT }, () => 10 ** (db / 20));

const digitalSilence = () =>
  Array.from({ length: WAVEFORM_POINT_COUNT }, () => 0);

/** How far the newest drawn wave stands above the centre line. */
const drawnHeight = () => {
  const ys = current()?.curveYs ?? [];
  return ys.length === 0 ? Number.NaN : CENTRE - Math.min(...ys);
};

const publish = (waveform: number[]) => {
  mockAudio.frame = { ...mockAudio.frame, waveform };
};

const advance = (ms: number) => {
  act(() => {
    jest.advanceTimersByTime(ms);
  });
};

let realResizeObserver: unknown;

beforeEach(() => {
  jest.useFakeTimers();
  frames.length = 0;
  mockAudio.capturePoints = [];
  window.localStorage.clear();
  // The styles these cases were written for, with the recorder already
  // introduced: it would otherwise replace them on first render.
  window.localStorage.setItem(RECORDER_INTRODUCED_KEY, 'true');
  window.localStorage.setItem(WAVEFORM_STYLE_KEY, 'fluid');
  jest
    .spyOn(HTMLCanvasElement.prototype, 'getContext')
    .mockReturnValue(context as unknown as CanvasRenderingContext2D);
  realResizeObserver = globalThis.ResizeObserver;
  Object.assign(globalThis, {
    ResizeObserver: SizedResizeObserver,
    Path2D: FakePath2D,
  });
});

afterEach(() => {
  Object.assign(globalThis, { ResizeObserver: realResizeObserver });
  Reflect.deleteProperty(globalThis, 'Path2D');
  jest.restoreAllMocks();
  jest.useRealTimers();
});

/** Soft music playing and drawn, as the window shows it before each case. */
const playSoftly = () => {
  mockAudio.capture = flatAt(-45);
  publish(flatAt(-45));
  const view = render(<WaveformVisualizer />);
  advance(200);
  return view;
};

/** The output falls silent: the capture's resting frame, once, and no more. */
const fallSilent = (view: ReturnType<typeof render>) => {
  mockAudio.capture = digitalSilence();
  publish(SILENT_WAVEFORM);
  view.rerender(<WaveformVisualizer />);
};

describe('the titlebar wave', () => {
  it('stands a -45 dBFS record up to the top of the pane', () => {
    playSoftly();
    // It used to be drawn at 28% of the pane, on the centre line's doorstep.
    expect(drawnHeight()).toBeGreaterThan(REACH * 0.9);
  });

  it('keeps the wave through 300 ms of silence', () => {
    const view = playSoftly();
    const sounding = drawnHeight();
    const drawnBefore = frames.length;
    fallSilent(view);
    advance(300);
    // Drawn all the while, not merely left standing by a stopped loop.
    expect(frames.length).toBeGreaterThan(drawnBefore + 5);
    expect(drawnHeight()).toBeCloseTo(sounding, 1);
  });

  it('draws the line after 600 ms of silence, with nothing published to wake it', () => {
    const view = playSoftly();
    const sounding = drawnHeight();
    fallSilent(view);
    advance(600);
    // Past the hold, and on its way down to the line.
    expect(drawnHeight()).toBeLessThan(sounding * 0.9);
    advance(1500);
    expect(drawnHeight()).toBeCloseTo(0, 1);
  });

  it('stands the wave up again on the first frame of sound', () => {
    const view = playSoftly();
    fallSilent(view);
    advance(2500);
    expect(drawnHeight()).toBeCloseTo(0, 1);

    mockAudio.capture = flatAt(-45);
    publish(flatAt(-45));
    view.rerender(<WaveformVisualizer />);
    advance(50);
    expect(drawnHeight()).toBeGreaterThan(REACH * 0.9);
  });
});

/**
 * Ivan, 2026-11-03: talking, the bars "glitch when the volume is reaching 0"
 * and "it changes the band width". Quiet speech sits between the spectrum's
 * silence (no band over -95 dB) and the wave's (-70 dBFS peak), and frames
 * once alternated between the analyser's bands and a narrow bar per sample of
 * the raw wave. The flat bars only ever read the bands, which fall when a
 * frame brings none: the same bars at the same widths, frame after frame.
 */
describe('the titlebar bars on a voice trailing off', () => {
  const SPECTRUM: IChartPointData[] = Array.from(
    { length: 64 },
    (_value, index) => ({ x: 20 * 1.1 ** index, y: 15 }),
  );

  const playBars = () => {
    window.localStorage.setItem(WAVEFORM_STYLE_KEY, 'bars');
    mockAudio.capture = flatAt(-55);
    publish(flatAt(-55));
    return render(<WaveformVisualizer />);
  };

  /** Each piece's left edge and width: what a glitch in band width moves. */
  const columns = (frame: IDrawnFrame) =>
    frame.pieces.map(([x, , width]) => `${x.toFixed(2)}:${width.toFixed(2)}`);

  it('keeps every bar where it was, at its width, when a quiet frame brings no spectrum', () => {
    mockAudio.capturePoints = SPECTRUM;
    const view = playBars();
    advance(200);
    const before = columns(current());
    const from = frames.length;
    // Still over the wave's silence, under the spectrum's; a voice keeps
    // sending blocks, each a little different, so the drawing stays awake.
    mockAudio.capturePoints = [];
    for (let step = 0; step < 6; step += 1) {
      mockAudio.capture = flatAt(-55 - step);
      publish(flatAt(-55 - step));
      view.rerender(<WaveformVisualizer />);
      advance(50);
    }
    // Drawn all the while, so "nothing changed" is not a stopped loop.
    expect(frames.length).toBeGreaterThan(from + 5);
    frames.slice(from).forEach((frame) => {
      expect(columns(frame)).toEqual(before);
    });
  });

  it('stands the bars up on the spectrum and lets them fall without it (the control)', () => {
    mockAudio.capturePoints = SPECTRUM;
    const view = playBars();
    advance(200);
    const tallest = () =>
      Math.max(...current().pieces.map(([, , , height]) => height));
    const standing = tallest();
    expect(standing).toBeGreaterThan(PANE_HEIGHT * 0.5);
    mockAudio.capturePoints = [];
    for (let step = 0; step < 6; step += 1) {
      mockAudio.capture = flatAt(-55 - step);
      publish(flatAt(-55 - step));
      view.rerender(<WaveformVisualizer />);
      advance(50);
    }
    expect(tallest()).toBeLessThan(standing * 0.5);
  });
});

describe('Fluid as the first-run style', () => {
  const styleOf = (container: HTMLElement) =>
    container
      .querySelector('.waveform-visualizer')
      ?.className.match(/waveform-visualizer--([a-z-]+)/)?.[1];

  it('opens on Fluid when nothing is stored', () => {
    window.localStorage.removeItem(RECORDER_INTRODUCED_KEY);
    window.localStorage.removeItem(WAVEFORM_STYLE_KEY);
    const { container } = render(<WaveformVisualizer />);
    expect(styleOf(container)).toBe('fluid');
  });

  it('keeps a style chosen before, where the recorder used to replace it', () => {
    window.localStorage.removeItem(RECORDER_INTRODUCED_KEY);
    window.localStorage.setItem(WAVEFORM_STYLE_KEY, 'bars');
    const { container } = render(<WaveformVisualizer />);
    expect(styleOf(container)).toBe('bars');
    expect(window.localStorage.getItem(WAVEFORM_STYLE_KEY)).toBe('bars');
  });

  it('leaves Off alone', () => {
    window.localStorage.removeItem(RECORDER_INTRODUCED_KEY);
    window.localStorage.setItem(WAVEFORM_STYLE_KEY, 'off');
    const { container } = render(<WaveformVisualizer />);
    expect(styleOf(container)).toBe('off');
  });
});
