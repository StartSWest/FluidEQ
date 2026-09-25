/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The titlebar's held peak coming down after the capture goes quiet.
 *
 * The readout lets go of a peak a step per published frame, and the capture
 * now publishes one resting frame and then nothing until sound returns
 * (`SILENT_WAVEFORM`). A quiet passage stopping dead leaves a peak between
 * -70 and -60 dBFS showing when the meters reach their floor, and with no
 * frames left to count it would have stood there through the silence. What
 * is held here is that it finishes the count on its own clock, at the pump's
 * cadence — and that it does not while a stream is still publishing, which
 * would count every step twice, or while the capture is paused.
 */

import { act, render } from '@testing-library/react';
import type { IChartPointData } from 'renderer/graph/ChartController';
import {
  SILENT_WAVEFORM,
  UPDATE_INTERVAL_MS,
  WAVEFORM_POINT_COUNT,
} from 'renderer/graph/liveSpectrumFrames';
import WaveformVisualizer from 'renderer/WaveformVisualizer';

const mockAudio = {
  frame: {
    isClipping: false,
    points: [] as IChartPointData[],
    waveform: [] as number[],
  },
  isPaused: false,
};

jest.mock('renderer/audio/LiveAudioContext', () => ({
  useLiveAudioFrame: () => mockAudio.frame,
  useLiveAudioControl: () => ({
    isActive: true,
    isPaused: mockAudio.isPaused,
    readFrame: () => undefined,
  }),
  useLiveAudioCapture: () => undefined,
}));

/** A canvas that takes every call and draws nothing. */
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

/** A path the canvas above is handed, which nothing reads back. */
const FakePath2D = jest.fn(() => ({ addPath: () => undefined }));

/** Reports a pane of titlebar size the moment it is asked to watch one. */
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

const flatAt = (db: number) =>
  Array.from({ length: WAVEFORM_POINT_COUNT }, () => 10 ** (db / 20));

const publish = (waveform: number[]) => {
  mockAudio.frame = { ...mockAudio.frame, waveform };
};

const readout = (container: HTMLElement) =>
  container.querySelector('.waveform-visualizer__peak .live-figure__text')
    ?.textContent;

let realResizeObserver: unknown;

beforeEach(() => {
  jest.useFakeTimers();
  mockAudio.isPaused = false;
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

describe("the titlebar's held peak once the capture rests", () => {
  it('counts down to the dash at the pump’s cadence', () => {
    publish(flatAt(-62));
    const { container, rerender } = render(<WaveformVisualizer />);
    expect(readout(container)).toBe('-62.0 dB');

    publish(SILENT_WAVEFORM);
    rerender(<WaveformVisualizer />);
    // The resting frame is a step of its own, as every frame was.
    expect(readout(container)).toBe('-63.1 dB');

    // Stepping, not jumping: a few frames' worth of time is a few steps.
    act(() => {
      jest.advanceTimersByTime(UPDATE_INTERVAL_MS * 3);
    });
    const partWay = Number.parseFloat(readout(container) ?? '');
    expect(partWay).toBeLessThan(-63.1);
    expect(partWay).toBeGreaterThan(-70);

    act(() => {
      jest.advanceTimersByTime(1_000);
    });
    expect(readout(container)).toBe('—');
  });

  it('leaves the counting to the frames while a stream is still publishing', () => {
    publish(flatAt(-62));
    const { container, rerender } = render(<WaveformVisualizer />);

    // Flat, but a frame of a capture that will send the next one itself.
    publish(flatAt(-200));
    rerender(<WaveformVisualizer />);
    expect(readout(container)).toBe('-63.1 dB');

    act(() => {
      jest.advanceTimersByTime(1_000);
    });
    expect(readout(container)).toBe('-63.1 dB');
  });

  it('holds still while the capture is paused, as a paused capture sends nothing', () => {
    publish(flatAt(-62));
    const { container, rerender } = render(<WaveformVisualizer />);

    mockAudio.isPaused = true;
    publish(SILENT_WAVEFORM);
    rerender(<WaveformVisualizer />);
    act(() => {
      jest.advanceTimersByTime(1_000);
    });
    expect(readout(container)).toBe('-63.1 dB');

    // And carries on from there once it is not.
    mockAudio.isPaused = false;
    rerender(<WaveformVisualizer />);
    act(() => {
      jest.advanceTimersByTime(1_000);
    });
    expect(readout(container)).toBe('—');
  });
});
