/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  crossfadeGain,
  registerDspDeckMixer,
  scheduleDspDeckCrossfade,
  selectDspDeck,
} from '../../../renderer/dsp/deckCrossfade';

interface IParameterHarness {
  parameter: AudioParam;
  cancelScheduledValues: jest.Mock;
  setValueAtTime: jest.Mock;
  setValueCurveAtTime: jest.Mock;
}

interface IAnimationFrameHarness {
  callback: FrameRequestCallback | undefined;
}

const parameter = (): IParameterHarness => {
  const cancelScheduledValues = jest.fn();
  const setValueAtTime = jest.fn();
  const setValueCurveAtTime = jest.fn();
  return {
    parameter: {
      value: 1,
      cancelScheduledValues,
      setValueAtTime,
      setValueCurveAtTime,
    } as unknown as AudioParam,
    cancelScheduledValues,
    setValueAtTime,
    setValueCurveAtTime,
  };
};

describe('DSP deck crossfade', () => {
  let animationFrame: jest.SpyInstance;
  let cancelFrame: jest.SpyInstance;
  let frame: IAnimationFrameHarness;

  beforeEach(() => {
    frame = { callback: undefined };
    animationFrame = jest
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((callback: FrameRequestCallback) => {
        frame.callback = callback;
        return 1;
      });
    cancelFrame = jest
      .spyOn(window, 'cancelAnimationFrame')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    animationFrame.mockRestore();
    cancelFrame.mockRestore();
  });

  it('keeps the combined gain at unity through every curve', () => {
    (['equalPower', 'smooth', 'linear'] as const).forEach((curve) => {
      [0, 0.25, 0.5, 0.75, 1].forEach((progress) => {
        const outgoing = crossfadeGain(curve, progress, false);
        const incoming = crossfadeGain(curve, progress, true);
        expect(outgoing + incoming).toBeCloseTo(1, 6);
        expect(outgoing).toBeLessThanOrEqual(1);
        expect(incoming).toBeLessThanOrEqual(1);
      });
    });
  });

  it('schedules both deck curves on the audio clock', () => {
    const context = { currentTime: 4 } as AudioContext;
    const outgoing = {} as HTMLAudioElement;
    const incoming = {} as HTMLAudioElement;
    const first = parameter();
    const second = parameter();
    const gains = [
      { context, gain: first.parameter },
      { context, gain: second.parameter },
    ] as unknown as GainNode[];
    const unregister = registerDspDeckMixer(
      context,
      [outgoing, incoming],
      gains,
    );

    expect(scheduleDspDeckCrossfade(outgoing, incoming, 2_000, 'smooth')).toBe(
      true,
    );
    expect(first.setValueCurveAtTime).toHaveBeenCalledWith(
      expect.any(Float32Array),
      4.005,
      2,
    );
    expect(second.setValueCurveAtTime).toHaveBeenCalledWith(
      expect.any(Float32Array),
      4.005,
      2,
    );
    const outgoingCurve = first.setValueCurveAtTime.mock
      .calls[0][0] as Float32Array;
    const incomingCurve = second.setValueCurveAtTime.mock
      .calls[0][0] as Float32Array;
    expect(outgoingCurve[0]).toBeCloseTo(1, 6);
    expect(outgoingCurve[outgoingCurve.length - 1]).toBeCloseTo(0, 6);
    expect(incomingCurve[0]).toBeCloseTo(0, 6);
    expect(incomingCurve[incomingCurve.length - 1]).toBeCloseTo(1, 6);

    unregister();
  });

  it('keeps fading on the registered gain nodes when Chromium rejects automation', () => {
    const context = { currentTime: 6 } as AudioContext;
    const outgoing = {} as HTMLAudioElement;
    const incoming = {} as HTMLAudioElement;
    const first = parameter();
    const second = parameter();
    first.setValueCurveAtTime.mockImplementationOnce(() => {
      throw new DOMException('Overlapping automation', 'NotSupportedError');
    });
    const unregister = registerDspDeckMixer(
      context,
      [outgoing, incoming],
      [
        { context, gain: first.parameter } as unknown as GainNode,
        { context, gain: second.parameter } as unknown as GainNode,
      ],
    );

    expect(scheduleDspDeckCrossfade(outgoing, incoming, 2_000, 'smooth')).toBe(
      true,
    );
    const firstLast = first.setValueAtTime.mock.calls.length - 1;
    const secondLast = second.setValueAtTime.mock.calls.length - 1;
    expect(first.setValueAtTime.mock.calls[firstLast]?.[0]).toBeCloseTo(1, 6);
    expect(second.setValueAtTime.mock.calls[secondLast]?.[0]).toBeCloseTo(0, 6);
    expect(frame.callback).toBeDefined();

    unregister();
  });

  it('crossfades element volumes when the DSP mixer is not registered yet', () => {
    const outgoing = { volume: 0.8 } as HTMLAudioElement;
    const incoming = { volume: 0.8 } as HTMLAudioElement;
    let now = 100;
    const clock = jest.spyOn(performance, 'now').mockImplementation(() => now);

    expect(scheduleDspDeckCrossfade(outgoing, incoming, 2_000, 'linear')).toBe(
      true,
    );
    expect(outgoing.volume).toBeCloseTo(0.8, 6);
    expect(incoming.volume).toBeCloseTo(0, 6);

    now = 1_100;
    frame.callback?.(now);
    expect(outgoing.volume).toBeCloseTo(0.4, 6);
    expect(incoming.volume).toBeCloseTo(0.4, 6);

    now = 2_100;
    frame.callback?.(now);
    expect(outgoing.volume).toBeCloseTo(0, 6);
    expect(incoming.volume).toBeCloseTo(0.8, 6);

    clock.mockRestore();
  });

  it('returns to exactly one audible deck after a transition', () => {
    const context = { currentTime: 8 } as AudioContext;
    const firstElement = {} as HTMLAudioElement;
    const secondElement = {} as HTMLAudioElement;
    const first = parameter();
    const second = parameter();
    const unregister = registerDspDeckMixer(
      context,
      [firstElement, secondElement],
      [
        { context, gain: first.parameter } as unknown as GainNode,
        { context, gain: second.parameter } as unknown as GainNode,
      ],
    );

    selectDspDeck(secondElement);
    expect(first.setValueAtTime).toHaveBeenLastCalledWith(0, 8);
    expect(second.setValueAtTime).toHaveBeenLastCalledWith(1, 8);

    unregister();
  });
});
