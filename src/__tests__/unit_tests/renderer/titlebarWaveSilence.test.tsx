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
 * Read back from the path the canvas is handed. The pane is the `fluid`
 * style's box, 58 tall with its centre line at 29: a wave's height is how far
 * its highest point stands above that line.
 */

import { act, render } from '@testing-library/react';
import type { IChartPointData } from 'renderer/graph/ChartController';
import {
  SILENT_WAVEFORM,
  WAVEFORM_POINT_COUNT,
} from 'renderer/graph/liveSpectrumFrames';
import {
  WAVEFORM_AMPLITUDE_MAX,
  WAVEFORM_HEIGHT,
} from 'renderer/waveformPaint';
import WaveformVisualizer from 'renderer/WaveformVisualizer';

const mockAudio = {
  frame: {
    isClipping: false,
    points: [] as IChartPointData[],
    waveform: [] as number[],
  },
  /** What the analyser holds now; read by the drawing on its own clock. */
  capture: [] as number[],
};

jest.mock('renderer/audio/LiveAudioContext', () => ({
  useLiveAudioFrame: () => mockAudio.frame,
  useLiveAudioControl: () => ({
    isActive: true,
    isPaused: false,
    // The reader's audio clock runs with the (fake) wall clock here.
    readFrame: () => ({
      points: [],
      graphPoints: [],
      waveform: mockAudio.capture,
      audioMs: performance.now(),
      channelPeaks: [],
    }),
  }),
  useLiveAudioCapture: () => undefined,
}));

const gradient = { addColorStop: () => undefined };
const drawing: Record<string | symbol, unknown> = {};
const context = new Proxy(drawing, {
  get: (target, property) =>
    property in target ? target[property] : () => gradient,
  set: (target, property, value) => {
    Reflect.set(target, property, value);
    return true;
  },
});

/** Every path the frame loop builds, kept so the last one can be read. */
const paths: string[] = [];
const FakePath2D = jest.fn((data?: string) => {
  if (typeof data === 'string') {
    paths.push(data);
  }
  return { addPath: () => undefined };
});

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

const CENTRE = WAVEFORM_HEIGHT / 2;

const flatAt = (db: number) =>
  Array.from({ length: WAVEFORM_POINT_COUNT }, () => 10 ** (db / 20));

const digitalSilence = () =>
  Array.from({ length: WAVEFORM_POINT_COUNT }, () => 0);

/** How far the newest drawn line stands above the centre line. */
const drawnHeight = () => {
  const latest = paths[paths.length - 1] ?? '';
  const ys = [...latest.matchAll(/-?\d+(?:\.\d+)?,(-?\d+(?:\.\d+)?)/g)].map(
    (match) => Number(match[1]),
  );
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
  paths.length = 0;
  window.localStorage.clear();
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
    expect(drawnHeight()).toBeGreaterThan(WAVEFORM_AMPLITUDE_MAX * 0.9);
  });

  it('keeps the wave through 300 ms of silence', () => {
    const view = playSoftly();
    const sounding = drawnHeight();
    const drawnBefore = paths.length;
    fallSilent(view);
    advance(300);
    // Drawn all the while, not merely left standing by a stopped loop.
    expect(paths.length).toBeGreaterThan(drawnBefore + 5);
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
    expect(drawnHeight()).toBeGreaterThan(WAVEFORM_AMPLITUDE_MAX * 0.9);
  });
});
