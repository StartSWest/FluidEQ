/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { DSP_DEFAULTS, IDspSettings } from '../../../common/dsp/chain';
import { buildDspGraph } from '../../../renderer/dsp/graph';

const fakeNode = () => ({
  connect: jest.fn(),
  disconnect: jest.fn(),
});

const fakeWorklet = () => ({
  ...fakeNode(),
  port: { postMessage: jest.fn() },
});

const fakeContext = () => ({
  sampleRate: 48_000,
  createGain: jest.fn(() => ({ ...fakeNode(), gain: { value: 1 } })),
  createWaveShaper: jest.fn(() => ({
    oversample: 'none',
    ...fakeNode(),
    curve: null as Float32Array | null,
  })),
  createBiquadFilter: jest.fn(() => ({
    ...fakeNode(),
    type: 'allpass',
    frequency: { value: 0 },
  })),
  createAnalyser: jest.fn(() => ({
    ...fakeNode(),
    fftSize: 0,
    smoothingTimeConstant: 0,
    frequencyBinCount: 1_024,
    getFloatFrequencyData: jest.fn(),
  })),
});

const excited = (
  over: Partial<IDspSettings['exciter']> = {},
): IDspSettings => ({
  ...DSP_DEFAULTS,
  exciter: { ...DSP_DEFAULTS.exciter, enabled: true, ...over },
});

describe('dsp graph', () => {
  it('always routes the worklet to the destination', () => {
    const worklet = fakeWorklet();
    const destination = fakeNode();
    buildDspGraph(
      fakeContext(),
      fakeNode(),
      worklet,
      destination,
      DSP_DEFAULTS,
    );
    expect(worklet.connect).toHaveBeenCalledWith(destination);
  });

  it('sends the settings to the worklet on build', () => {
    const worklet = fakeWorklet();
    buildDspGraph(fakeContext(), fakeNode(), worklet, fakeNode(), DSP_DEFAULTS);
    expect(worklet.port.postMessage).toHaveBeenCalledWith(DSP_DEFAULTS);
  });

  /**
   * The exciter left this graph, and these assert that it stayed gone.
   *
   * It was a parallel subgraph of native nodes — a gain, a highpass, a shaper
   * and a wet gain — and it moved into the worklet when it grew three bands,
   * a level-dependent gate and a drive that wanders, none of which a
   * `WaveShaperNode` can express. `exciterStage.ts` holds it now, and
   * `dspExciterStage.test.ts` measures what it does.
   *
   * Asserting that NO shaper and NO filter is ever built is the sharp version
   * of that claim. A stray one would mean the signal was being excited twice —
   * once here and once in the worklet — which is a doubling nobody would find
   * by listening, because it would simply sound like a stage that was too
   * strong.
   */
  it('builds no shaper, whether the exciter is on or off', () => {
    const off = fakeContext();
    buildDspGraph(off, fakeNode(), fakeWorklet(), fakeNode(), DSP_DEFAULTS);
    expect(off.createWaveShaper).not.toHaveBeenCalled();

    const on = fakeContext();
    buildDspGraph(on, fakeNode(), fakeWorklet(), fakeNode(), excited());
    expect(on.createWaveShaper).not.toHaveBeenCalled();
    expect(on.createBiquadFilter).not.toHaveBeenCalled();
  });

  it('connects the source straight to the worklet', () => {
    const source = fakeNode();
    const worklet = fakeWorklet();
    buildDspGraph(fakeContext(), source, worklet, fakeNode(), excited());
    expect(source.connect).toHaveBeenCalledWith(worklet);
  });

  /**
   * One message, and nothing to keep in step with it.
   *
   * While the exciter was native, a settings change had to update the worklet
   * AND write onto three nodes, and a change to its enabled flag had to tear
   * the subgraph down and build another. Every stage lives behind the port
   * now, so there is one path for a setting to travel and no second copy of
   * the truth to drift.
   */
  it('forwards a settings change as a single message, with no rebuild', () => {
    const context = fakeContext();
    const worklet = fakeWorklet();
    const graph = buildDspGraph(
      context,
      fakeNode(),
      worklet,
      fakeNode(),
      excited(),
    );
    const next = excited({
      organic: { enabled: true, amount: 0.5, focusHz: 800 },
    });
    graph.update(next);
    expect(worklet.port.postMessage).toHaveBeenLastCalledWith(next);
    expect(context.createWaveShaper).not.toHaveBeenCalled();
  });

  /**
   * Switching the exciter on used to rebuild the graph, which is exactly when
   * a click happens. There is nothing left to rebuild, so there is nothing
   * left to click.
   */
  it('does not rebuild when the exciter is switched on', () => {
    const context = fakeContext();
    const source = fakeNode();
    const graph = buildDspGraph(
      context,
      source,
      fakeWorklet(),
      fakeNode(),
      DSP_DEFAULTS,
    );
    const connectsBefore = source.connect.mock.calls.length;
    graph.update(excited());
    expect(source.connect.mock.calls).toHaveLength(connectsBefore);
    expect(source.disconnect).not.toHaveBeenCalled();
  });

  it('disconnects the source and the worklet when disposed', () => {
    const source = fakeNode();
    const worklet = fakeWorklet();
    const graph = buildDspGraph(
      fakeContext(),
      source,
      worklet,
      fakeNode(),
      excited(),
    );
    graph.dispose();
    expect(source.disconnect).toHaveBeenCalled();
    expect(worklet.disconnect).toHaveBeenCalled();
  });
});
