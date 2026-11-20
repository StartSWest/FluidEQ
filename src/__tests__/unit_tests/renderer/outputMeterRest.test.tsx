/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The output meter coming to rest on its own clock.
 *
 * The meter draws from its own followers at draw time, and its loop used to be
 * kept alive through any silence by the capture publishing thirty frames a
 * second. The capture now goes quiet once its own meter is at rest, so the
 * loop has to keep itself drawing for as long as there is anything left to
 * move: a quiet passage stopping dead drops the level to the floor in a
 * quarter of a second while its peak still has most of a second to hold, and
 * a loop that stopped there would hang the mark in the air until the music
 * came back. Nothing in a query can see a mark hanging, so the frames are
 * counted: still drawing through the hold, stopped once the peak is down.
 */

import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { METER_STYLE_KEY, METER_STYLE_LIGHT_KEY } from 'common/meterStyles';
import OutputLevelMeter from 'renderer/graph/OutputLevelMeter';
import { LEVEL_FLOOR_DB } from 'renderer/graph/outputLevel';
import { setLightWindow } from 'renderer/utils/windowSide';

const mockCapture = { channelPeaks: [0, 0] };

// The published frame through the store's hooks too (`liveFrameHooks`): the
// meter listens to the store since 2026-11-16 rather than rendering it.
jest.mock('renderer/audio/LiveAudioContext', () => {
  const frame = {
    isClipping: false,
    outputLevels: [
      { levelDb: -60, peakDb: -60, isClipping: false },
      { levelDb: -60, peakDb: -60, isClipping: false },
    ],
  };
  return {
    ...jest
      .requireActual<typeof import('../../utils/liveFrameHooks')>(
        '../../utils/liveFrameHooks',
      )
      .liveFrameHooks(() => frame),
    useLiveAudioFrame: () => frame,
    useLiveAudioControl: () => ({
      readFrame: () => ({
        points: [],
        graphPoints: [],
        waveform: [],
        channelPeaks: mockCapture.channelPeaks,
      }),
    }),
    useLiveAudioCapture: () => undefined,
  };
});

/**
 * A canvas that takes every call, counting the frames it is cleared for.
 *
 * It paints nothing, so reading it back (the meter samples its unlit lamp's
 * luminance off a one-pixel canvas, `unlitLuminance`) gives what an untouched
 * canvas gives: transparent black, four bytes per pixel of the region asked.
 */
const gradient = { addColorStop: () => undefined };
const cleared = jest.fn();
const readBack = (_x: number, _y: number, width: number, height: number) => ({
  data: new Uint8ClampedArray(Math.abs(width * height) * 4),
  width: Math.abs(width),
  height: Math.abs(height),
  colorSpace: 'srgb' as const,
});
const drawing: Record<string | symbol, unknown> = {
  clearRect: cleared,
  getImageData: readBack,
};
const context = new Proxy(drawing, {
  get: (target, property) =>
    property in target ? target[property] : () => gradient,
  set: (target, property, value) => {
    Reflect.set(target, property, value);
    return true;
  },
});

/** Reports the meter's box the moment it is asked to watch one. */
const SizedResizeObserver = jest.fn(
  (
    report: (
      entries: { contentRect: { width: number; height: number } }[],
    ) => void,
  ) => ({
    observe: () => report([{ contentRect: { width: 60, height: 180 } }]),
    unobserve: () => undefined,
    disconnect: () => undefined,
  }),
);

const framesDrawnIn = (ms: number) => {
  const before = cleared.mock.calls.length;
  act(() => {
    jest.advanceTimersByTime(ms);
  });
  return cleared.mock.calls.length - before;
};

let realResizeObserver: unknown;

beforeEach(() => {
  jest.useFakeTimers();
  cleared.mockClear();
  // A style drawn from the reading alone: the fluid column and its kin keep
  // their loop turning for their own motion, whatever the level does.
  window.localStorage.setItem(METER_STYLE_KEY, 'bar');
  jest
    .spyOn(HTMLCanvasElement.prototype, 'getContext')
    .mockReturnValue(context as unknown as CanvasRenderingContext2D);
  realResizeObserver = globalThis.ResizeObserver;
  Object.assign(globalThis, { ResizeObserver: SizedResizeObserver });
});

afterEach(() => {
  Object.assign(globalThis, { ResizeObserver: realResizeObserver });
  window.localStorage.removeItem(METER_STYLE_KEY);
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe('the output meter after a quiet passage stops dead', () => {
  it('keeps drawing while its peak holds and falls, and stops once it is down', () => {
    // Two decibels over the floor: the level is down in 50 ms and its drawn
    // bar has eased onto the floor by about half a second, while the peak
    // still has half a second of its hold to sit out.
    const quiet = 10 ** (-58 / 20);
    expect(20 * Math.log10(quiet)).toBeGreaterThan(LEVEL_FLOOR_DB);
    mockCapture.channelPeaks = [quiet, quiet];
    render(<OutputLevelMeter />);
    expect(framesDrawnIn(300)).toBeGreaterThan(0);

    mockCapture.channelPeaks = [0, 0];
    act(() => {
      jest.advanceTimersByTime(650);
    });
    // Nothing is moving on screen here but a hold running out, and a loop
    // that stopped now would never see it run out.
    expect(framesDrawnIn(300)).toBeGreaterThan(0);

    // The peak has fallen and its mark eased onto the floor well before
    // this: nothing left to move, so nothing drawn.
    act(() => {
      jest.advanceTimersByTime(8_000);
    });
    expect(framesDrawnIn(1_000)).toBe(0);
  });
});

/**
 * A light window keeps a meter style of its own (2026-11-18, the "Consola"
 * light window): it opens on Segments, lit and unlit lamps showing, and a
 * walk across the Brightness gives each side back the style chosen there.
 */
describe('the meter’s style on each side of the Brightness', () => {
  const meter = () =>
    screen.getByRole('button', { name: /^Live output level/ });

  afterEach(() => {
    act(() => setLightWindow(false));
    window.localStorage.removeItem(METER_STYLE_LIGHT_KEY);
  });

  it('opens a light window on Segments and keeps the dark side’s style apart', () => {
    render(<OutputLevelMeter />);
    // The dark side: the style stored for it (Bar, from `beforeEach`).
    expect(meter()).toHaveAccessibleName(/Bar$/);
    act(() => setLightWindow(true));
    expect(meter()).toHaveAccessibleName(/Segments$/);

    // Cycled on the light side, it is written under the light side's key.
    fireEvent.click(meter());
    const lightChoice = window.localStorage.getItem(METER_STYLE_LIGHT_KEY);
    expect(lightChoice).not.toBeNull();
    expect(lightChoice).not.toBe('segments');
    expect(window.localStorage.getItem(METER_STYLE_KEY)).toBe('bar');

    // CONTROL: back on the dark side, the dark side's own style.
    act(() => setLightWindow(false));
    expect(meter()).toHaveAccessibleName(/Bar$/);
  });
});
