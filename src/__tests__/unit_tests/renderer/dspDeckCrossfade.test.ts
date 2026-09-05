/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import log from 'electron-log/renderer';
import {
  crossfadeGain,
  readDspCrossfadeMeter,
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
    jest.restoreAllMocks();
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

  /**
   * Custom is deliberately NOT in the check above.
   *
   * The other three sum to one at every point by construction; a dragged shape
   * does not, and must not be forced to — the hold and the dip are shapes
   * people want. What it still owes is the guarantee that matters: it stays
   * inside the plot, and it starts and ends where a fade has to.
   */
  it('lets a dragged shape leave unity but never the rails', () => {
    const held = {
      outgoing: [
        { at: 0.2, gain: 0.98 },
        { at: 0.4, gain: 0.95 },
        { at: 0.6, gain: 0.9 },
        { at: 0.8, gain: 0.6 },
      ],
      incoming: [
        { at: 0.2, gain: 0.6 },
        { at: 0.4, gain: 0.9 },
        { at: 0.6, gain: 0.95 },
        { at: 0.8, gain: 0.98 },
      ],
    };
    let bulged = false;
    for (let at = 0; at <= 100; at += 1) {
      const progress = at / 100;
      const outgoing = crossfadeGain('custom', progress, false, held);
      const incoming = crossfadeGain('custom', progress, true, held);
      expect(outgoing).toBeGreaterThanOrEqual(0);
      expect(outgoing).toBeLessThanOrEqual(1);
      expect(incoming).toBeGreaterThanOrEqual(0);
      expect(incoming).toBeLessThanOrEqual(1);
      bulged = bulged || outgoing + incoming > 1.2;
    }
    // The positive control: a shape drawn to bulge must actually bulge, or
    // the check above is passing on a curve that was silently normalised.
    expect(bulged).toBe(true);
    expect(crossfadeGain('custom', 0, false, held)).toBeCloseTo(1, 6);
    expect(crossfadeGain('custom', 1, false, held)).toBeCloseTo(0, 6);
  });

  /** A custom fade with no shape given is the default one, not silence. */
  it('falls back to the default shape rather than to nothing', () => {
    expect(crossfadeGain('custom', 0.5, false)).toBeCloseTo(0.5, 2);
    expect(crossfadeGain('custom', 0.5, true)).toBeCloseTo(0.5, 2);
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
    const warning = jest.spyOn(log, 'warn').mockImplementation(() => undefined);
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
    expect(warning).toHaveBeenCalledTimes(1);
    expect(warning).toHaveBeenCalledWith('[dsp:renderer] code=2003', {
      durationMs: 2000,
      curve: 'smooth',
    });

    unregister();
  });

  it('crossfades element volumes when the DSP mixer is not registered yet', () => {
    const warning = jest.spyOn(log, 'warn').mockImplementation(() => undefined);
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
    expect(warning).toHaveBeenCalledTimes(1);
    expect(warning).toHaveBeenCalledWith('[dsp:renderer] code=2001', {
      durationMs: 2000,
      curve: 'linear',
    });

    clock.mockRestore();
  });

  /**
   * The meter carries the curve the fade is RUNNING, not the one the panel is
   * showing.
   *
   * A fade is committed to the audio clock at its first sample and nothing
   * re-reads the setting, so picking a different curve mid-fade changes the
   * next one. Without this the preview drew the new choice while the markers
   * reported the old — dots sitting off their own line for the rest of the
   * overlap, which is the defect this whole card was fixed for once already.
   */
  it('reports the curve the audible fade was started with', () => {
    const clock = { currentTime: 2 };
    const context = clock as unknown as AudioContext;
    const outgoing = {} as HTMLAudioElement;
    const incoming = {} as HTMLAudioElement;
    const first = parameter();
    const second = parameter();
    const unregister = registerDspDeckMixer(
      context,
      [outgoing, incoming],
      [
        { context, gain: first.parameter } as unknown as GainNode,
        { context, gain: second.parameter } as unknown as GainNode,
      ],
    );

    scheduleDspDeckCrossfade(outgoing, incoming, 2_000, 'linear');
    // Half way through the two-second fade, on the audio clock the meter reads.
    clock.currentTime = 3.005;
    frame.callback?.(0);

    const meter = readDspCrossfadeMeter();
    expect(meter.active).toBe(true);
    expect(meter.curve).toBe('linear');
    expect(meter.progress).toBeCloseTo(0.5, 3);
    // The gains come from that same curve, which is what keeps the markers on
    // the line the card draws from `meter.curve`.
    expect(meter.outgoingGain).toBeCloseTo(0.5, 3);

    unregister();
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
