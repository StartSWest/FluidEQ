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

  it('builds no shaper while the exciter is off', () => {
    const context = fakeContext();
    buildDspGraph(context, fakeNode(), fakeWorklet(), fakeNode(), DSP_DEFAULTS);
    expect(context.createWaveShaper).not.toHaveBeenCalled();
  });

  it('POSITIVE CONTROL: builds exactly one shaper once the exciter is on', () => {
    const context = fakeContext();
    buildDspGraph(context, fakeNode(), fakeWorklet(), fakeNode(), excited());
    expect(context.createWaveShaper).toHaveBeenCalledTimes(1);
    expect(context.createBiquadFilter).toHaveBeenCalledTimes(1);
  });

  /**
   * The shaper must never see a low frequency.
   *
   * A non-linearity is most audible and least wanted on bass; putting the
   * shaper in series rather than behind a highpass is the difference between
   * added air and a muddy, buzzing low end.
   */
  it('puts a highpass at the corner in front of the shaper', () => {
    const context = fakeContext();
    buildDspGraph(
      context,
      fakeNode(),
      fakeWorklet(),
      fakeNode(),
      excited({ crossoverHz: 7_000 }),
    );
    const filter = context.createBiquadFilter.mock.results[0].value;
    expect(filter.type).toBe('highpass');
    expect(filter.frequency.value).toBe(7_000);
  });

  /**
   * Without this the exciter aliases, and the default is the broken value.
   *
   * `WaveShaperNode.oversample` defaults to `'none'`, so a shaper left alone
   * folds its own harmonics back down as inharmonic tones — exactly where the
   * stage is meant to be adding air. `dspExciter.test.ts` measures the folding
   * itself; this asserts the graph asks Chromium to prevent it.
   */
  it('runs the shaper at 4x so its harmonics cannot fold back', () => {
    const context = fakeContext();
    buildDspGraph(context, fakeNode(), fakeWorklet(), fakeNode(), excited());
    expect(context.createWaveShaper.mock.results[0].value.oversample).toBe(
      '4x',
    );
  });

  it('gives the shaper a curve rather than leaving it linear', () => {
    const context = fakeContext();
    buildDspGraph(context, fakeNode(), fakeWorklet(), fakeNode(), excited());
    const { curve } = context.createWaveShaper.mock.results[0].value;
    expect(curve).toBeInstanceOf(Float32Array);
  });

  it('forwards a settings change to the worklet without rebuilding', () => {
    const context = fakeContext();
    const worklet = fakeWorklet();
    const graph = buildDspGraph(
      context,
      fakeNode(),
      worklet,
      fakeNode(),
      excited(),
    );
    const next = excited({ drive: 9 });
    graph.update(next);
    expect(worklet.port.postMessage).toHaveBeenLastCalledWith(next);
    // Still one shaper: a rebuild on every knob turn would click.
    expect(context.createWaveShaper).toHaveBeenCalledTimes(1);
  });

  it('rebuilds only when the exciter is switched on or off', () => {
    const context = fakeContext();
    const graph = buildDspGraph(
      context,
      fakeNode(),
      fakeWorklet(),
      fakeNode(),
      DSP_DEFAULTS,
    );
    expect(context.createWaveShaper).not.toHaveBeenCalled();
    graph.update(excited());
    expect(context.createWaveShaper).toHaveBeenCalledTimes(1);
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

  it('disconnects every exciter node it created when disposed', () => {
    const context = fakeContext();
    const graph = buildDspGraph(
      context,
      fakeNode(),
      fakeWorklet(),
      fakeNode(),
      excited(),
    );
    graph.dispose();
    const made = [
      ...context.createGain.mock.results,
      ...context.createWaveShaper.mock.results,
      ...context.createBiquadFilter.mock.results,
    ];
    expect(made).toHaveLength(4);
    made.forEach(({ value }) => {
      expect(value.disconnect).toHaveBeenCalled();
    });
  });
});
