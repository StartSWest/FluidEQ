/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The live displays of the DSP page and of Share Audio, drawn without laying
 * the window out and without turning when there is nothing to draw.
 *
 * None of this is visible in a query. A loop asking for sixty frames a second
 * over a stopped engine, a box measured after the frame's own text had made
 * the layout dirty, a bar sized with a width, a meter re-rendered with every
 * host frame: each draws exactly the picture it should, and each cost the
 * window its idle or a layout per frame. So the frames asked for, the layout
 * reads made in them and the properties written are what is held here.
 *
 * Frames are run by hand, as in `dspGraphLoop.test.ts`: a loop under test
 * advances because the test said so.
 */

import '@testing-library/jest-dom';
import { act, render, screen } from '@testing-library/react';
import { DSP_DEFAULTS } from 'common/dsp/chain';
import DspBassPunchGraph from 'renderer/dsp/DspBassPunchGraph';
import DspDimensionCard from 'renderer/dsp/DspDimensionCard';
import DspMaximizerGraph from 'renderer/dsp/DspMaximizerGraph';
import { DspNormalizerLiveMeter } from 'renderer/dsp/DspNormalizerReadouts';
import DspPhaseMeter from 'renderer/dsp/DspPhaseMeter';
import {
  IDspAnalyser,
  clearDspAnalysers,
  setDspAnalyser,
  setDspBassPunchActivity,
  setDspDimensionGuard,
  setDspMaximizerReduction,
  setDspNormalizerMeter,
  setDspPeak,
} from 'renderer/dsp/store';
import RemoteAudioMonitor from 'renderer/remoteAudio/RemoteAudioMonitor';
import type { TRemoteAudioMeterListener } from 'renderer/remoteAudio/meter';

const ignore = () => undefined;

/** Stands in for the engine's output tap: only its being there matters. */
const engineTap: IDspAnalyser = {
  frequencyBinCount: 1_024,
  getFloatFrequencyData: (target: Float32Array) => target.fill(-90),
};
const engineStarts = () => act(() => setDspAnalyser('master', engineTap));

const pending = new Map<number, FrameRequestCallback>();
let nextHandle = 1;

/** One animation frame: what was asked for before it, and nothing after. */
const runFrame = () => {
  const due = [...pending.values()];
  pending.clear();
  act(() => {
    due.forEach((callback) => callback(performance.now()));
  });
};

/** A canvas that takes every call, counting the frames it is cleared for. */
const gradient = { addColorStop: () => undefined };
const cleared = jest.fn();
const drawing: Record<string | symbol, unknown> = { clearRect: cleared };
const context = new Proxy(drawing, {
  get: (target, property) =>
    property in target ? target[property] : () => gradient,
  set: (target, property, value) => {
    Reflect.set(target, property, value);
    return true;
  },
});

/** Reports a box the moment it is asked to watch one. */
const SizedResizeObserver = jest.fn(
  (
    report: (
      entries: { contentRect: { width: number; height: number } }[],
    ) => void,
  ) => ({
    observe: () => report([{ contentRect: { width: 640, height: 240 } }]),
    unobserve: () => undefined,
    disconnect: () => undefined,
  }),
);

let realRequest: typeof window.requestAnimationFrame;
let realCancel: typeof window.cancelAnimationFrame;
let realResizeObserver: unknown;

beforeEach(() => {
  clearDspAnalysers();
  pending.clear();
  nextHandle = 1;
  cleared.mockClear();
  realRequest = window.requestAnimationFrame;
  realCancel = window.cancelAnimationFrame;
  window.requestAnimationFrame = ((callback: FrameRequestCallback) => {
    const handle = nextHandle;
    nextHandle += 1;
    pending.set(handle, callback);
    return handle;
  }) as typeof window.requestAnimationFrame;
  window.cancelAnimationFrame = ((handle: number) => {
    pending.delete(handle);
  }) as typeof window.cancelAnimationFrame;
  jest
    .spyOn(HTMLCanvasElement.prototype, 'getContext')
    .mockReturnValue(context as unknown as CanvasRenderingContext2D);
  realResizeObserver = globalThis.ResizeObserver;
  Object.assign(globalThis, { ResizeObserver: SizedResizeObserver });
});

afterEach(() => {
  window.requestAnimationFrame = realRequest;
  window.cancelAnimationFrame = realCancel;
  Object.assign(globalThis, { ResizeObserver: realResizeObserver });
  jest.restoreAllMocks();
  clearDspAnalysers();
});

describe('the phase meter', () => {
  it('asks for no frames over a stopped engine, and turns when it registers', () => {
    const measured = jest.spyOn(Element.prototype, 'getBoundingClientRect');
    render(<DspPhaseMeter />);
    runFrame();
    expect(pending.size).toBe(0);

    engineStarts();
    runFrame();
    runFrame();
    runFrame();
    // Live, the next frame is always owed, and each one draws.
    expect(pending.size).toBe(1);
    expect(cleared).toHaveBeenCalled();
    // Its box is the observer's, never measured in a frame.
    expect(measured).not.toHaveBeenCalled();
  });
});

describe("the Dimension card's guard", () => {
  const draw = () =>
    render(
      <DspDimensionCard
        dimension={{ ...DSP_DEFAULTS.dimension, enabled: true }}
        onPatch={ignore}
        onCommit={ignore}
      />,
    );

  it('slides its fill rather than sizing it, with its figure in a box of its own', () => {
    act(() => setDspDimensionGuard(0.5));
    const { container } = draw();
    runFrame();

    const fill = container.querySelector<HTMLElement>(
      '.dsp-dimension-guard-fill',
    );
    expect(fill?.style.transform).toBe('translateX(-50.0%)');
    expect(fill?.style.width).toBe('');
    expect(
      container.querySelector('.dsp-dimension-guard-value .live-figure__text'),
    ).toHaveTextContent('50%');
  });

  it('draws nothing over a stopped engine, and follows it once it runs', () => {
    act(() => setDspDimensionGuard(0.5));
    const { container } = draw();
    runFrame();
    const fill = container.querySelector<HTMLElement>(
      '.dsp-dimension-guard-fill',
    );

    act(() => setDspDimensionGuard(0.25));
    runFrame();
    runFrame();
    expect(fill?.style.transform).toBe('translateX(-50.0%)');

    engineStarts();
    runFrame();
    expect(fill?.style.transform).toBe('translateX(-75.0%)');
  });
});

describe('the Maximizer and Bass Punch strips', () => {
  it('draw the Maximizer without reading its box in the frame', () => {
    const widthRead = jest.spyOn(Element.prototype, 'clientWidth', 'get');
    const heightRead = jest.spyOn(Element.prototype, 'clientHeight', 'get');
    engineStarts();
    act(() => {
      setDspPeak(0.5);
      setDspMaximizerReduction(-3.2);
    });
    const { container } = render(
      <DspMaximizerGraph
        maximizer={{ ...DSP_DEFAULTS.maximizer, enabled: true }}
      />,
    );
    runFrame();
    runFrame();

    expect(cleared).toHaveBeenCalled();
    expect(widthRead).not.toHaveBeenCalled();
    expect(heightRead).not.toHaveBeenCalled();

    const figures = container.querySelectorAll(
      '.dsp-maximizer-status .live-figure__text',
    );
    expect(figures).toHaveLength(3);
    expect(figures[0]).toHaveTextContent('-3.2 dB');
    expect(figures[2]).toHaveTextContent('-6.0 dBFS');
    expect(figures[2].closest('[hidden]')).toBeNull();
  });

  it("show the Maximizer's output as a lone dash while nothing plays", () => {
    engineStarts();
    act(() => setDspPeak(0));
    const { container } = render(
      <DspMaximizerGraph
        maximizer={{ ...DSP_DEFAULTS.maximizer, enabled: true }}
      />,
    );
    runFrame();

    // The figure keeps the width of -119.5 dBFS; the dash is not put in it.
    const reading = container.querySelectorAll(
      '.dsp-maximizer-status .live-figure',
    )[2];
    expect(reading.closest('[hidden]')).not.toBeNull();

    act(() => setDspPeak(0.25));
    runFrame();
    expect(reading.closest('[hidden]')).toBeNull();
    expect(reading).toHaveTextContent('-12.0 dBFS');
  });

  it('draw Bass Punch without reading its box, and print the off dash plainly', () => {
    const off = render(
      <DspBassPunchGraph
        bassPunch={{ ...DSP_DEFAULTS.bassPunch, enabled: false }}
      />,
    );
    expect(
      off.container.querySelectorAll('.dsp-bass-punch-status .live-figure'),
    ).toHaveLength(0);
    off.unmount();

    const widthRead = jest.spyOn(Element.prototype, 'clientWidth', 'get');
    engineStarts();
    act(() => setDspBassPunchActivity(4.5, -2, -3));
    const on = render(
      <DspBassPunchGraph
        bassPunch={{ ...DSP_DEFAULTS.bassPunch, enabled: true }}
      />,
    );
    runFrame();

    const figures = on.container.querySelectorAll(
      '.dsp-bass-punch-status .live-figure__text',
    );
    expect(figures).toHaveLength(3);
    expect(figures[1]).toHaveTextContent('-2.0 dB');
    expect(figures[2]).toHaveTextContent('-3.0 dB');
    expect(cleared).toHaveBeenCalled();
    expect(widthRead).not.toHaveBeenCalled();
  });
});

describe("the Normalizer's live meter", () => {
  it('moves its bars on the frame, never with a render per host frame', () => {
    act(() =>
      setDspNormalizerMeter({
        inputPeaks: [0.5, 0.5],
        outputPeaks: [0.25, 0.25],
        appliedGainDb: -6,
      }),
    );
    const { container } = render(<DspNormalizerLiveMeter />);
    const fills = container.querySelectorAll<HTMLElement>(
      '.dsp-normalizer-meter-fill',
    );
    const before = () =>
      container.querySelector('.dsp-normalizer-meter-value .live-figure__text');
    // Where it opened, placed by the render itself so nothing slides in.
    expect(fills).toHaveLength(4);
    expect(fills[0].style.width).toBe('');
    expect(fills[0].style.transform).toMatch(/^translateX\(-18\.2\d*%\)$/);
    expect(before()).toHaveTextContent('-6.0 dBFS');

    // A host frame renders nothing here, and moves nothing until a frame.
    act(() =>
      setDspNormalizerMeter({
        inputPeaks: [1.2, 1.2],
        outputPeaks: [0.1, 0.1],
        appliedGainDb: -5,
      }),
    );
    expect(before()).toHaveTextContent('-6.0 dBFS');

    engineStarts();
    runFrame();
    expect(before()).toHaveTextContent('1.6 dBFS');
    // The track runs to +6 dBFS, so +1.6 stands at 61.6 / 66 of it.
    expect(fills[0].style.transform).toMatch(/^translateX\(-6\.69\d*%\)$/);
    expect(fills[0]).toHaveClass('is-over');
    expect(fills[1]).not.toHaveClass('is-over');
    // POSITIVE CONTROL: the gain beside the title still follows the host.
    expect(container.querySelector('.dsp-band-spec')).toHaveTextContent(
      '-5.0 dB',
    );
  });
});

describe('the Share Audio monitor', () => {
  it('draws when a block of audio arrives, and asks for nothing between', () => {
    const measured = jest.spyOn(Element.prototype, 'getBoundingClientRect');
    const styled = jest.spyOn(window, 'getComputedStyle');
    const listen: { current?: TRemoteAudioMeterListener } = {};
    render(
      <RemoteAudioMonitor
        active
        connectedComputers={[
          { address: '192.168.1.21', id: 'alpha', name: 'STUDIO-PC' },
        ]}
        mode="listener"
        networkStats={[]}
        status="1 computer connected"
        subscribe={(listener) => {
          listen.current = listener;
          return ignore;
        }}
      />,
    );
    runFrame();
    expect(pending.size).toBe(0);

    act(() =>
      listen.current?.({
        bufferedMs: 120,
        peak: 0.5,
        rms: 0.3,
        sourceId: 'alpha',
        waveform: new Float32Array(64),
      }),
    );
    expect(pending.size).toBe(1);
    runFrame();

    expect(screen.getByText('Peak -6.0 dB')).toBeInTheDocument();
    expect(screen.getByText('Playback 120 ms')).toBeInTheDocument();
    expect(cleared).toHaveBeenCalled();
    expect(pending.size).toBe(0);
    expect(measured).not.toHaveBeenCalled();
    expect(
      styled.mock.calls.some(
        ([element]) => element instanceof HTMLCanvasElement,
      ),
    ).toBe(false);
  });
});
