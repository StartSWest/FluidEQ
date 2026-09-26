/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Normal or Rainbow, from the titlebar's wave (Ivan, 2026-09-26: "put back
 * the rainbow button to toggle on and off in the top wave"). A sibling of the
 * meter's own button rather than inside it, because a button inside a button
 * is unnested by the browser and its click lost.
 */

import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import type { IChartPointData } from 'renderer/graph/ChartController';
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

let realResizeObserver: unknown;

beforeEach(() => {
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
});

describe('the Rainbow switch on the titlebar wave', () => {
  it('turns Rainbow off and on again, and says which it is', () => {
    render(<WaveformVisualizer />);
    const pill = screen.getByRole('button', { name: 'Rainbow' });
    // On from the start (`euphoriaMode.ts`).
    expect(pill).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(pill);
    expect(pill).toHaveAttribute('aria-pressed', 'false');
    expect(pill).toHaveClass('is-dormant');
    expect(window.localStorage.getItem('fluideq-rainbow')).toBe('off');

    fireEvent.click(pill);
    expect(pill).toHaveAttribute('aria-pressed', 'true');
    expect(window.localStorage.getItem('fluideq-rainbow')).toBe('on');
  });

  it('is its own button, not one inside the meter', () => {
    render(<WaveformVisualizer />);
    const pill = screen.getByRole('button', { name: 'Rainbow' });
    expect(pill.parentElement?.closest('button')).toBeNull();
  });
});
