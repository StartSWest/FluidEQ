/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The guide vocal stopping without a click, on the clock its fade runs on.
 *
 * The fade to silence is scheduled on the AudioContext; the stop after it was
 * a 30 ms `setTimeout` on the window's thread, a different clock. The source
 * is now told to stop 30 ms on in the context's own time and let go of on its
 * `ended`.
 */

import { act, renderHook } from '@testing-library/react';
import { useKaraokeVocalMix } from '../../../renderer/karaoke/useKaraokeVocalMix';

/** An audio node as far as connections go, and an EventTarget for `ended`. */
const fakeNode = () =>
  Object.assign(new EventTarget(), {
    connect: jest.fn(),
    disconnect: jest.fn(),
  });

const fakeSource = () => {
  const source = Object.assign(fakeNode(), {
    buffer: undefined as unknown,
    playbackRate: { value: 1 },
    isStarted: false,
    start: jest.fn(() => {
      source.isStarted = true;
    }),
    stop: jest.fn(() => {
      if (!source.isStarted) {
        throw new DOMException('stop before start', 'InvalidStateError');
      }
    }),
  });
  return source;
};

const fakeVocalContext = () => {
  const context = {
    currentTime: 2,
    baseLatency: 0,
    outputLatency: 0,
    state: 'running',
    destination: {},
    sources: [] as ReturnType<typeof fakeSource>[],
    gainRamps: [] as (readonly [number, number, number])[],
    createGain: () =>
      Object.assign(fakeNode(), {
        context,
        gain: {
          value: 1,
          setTargetAtTime: jest.fn(
            (value: number, when: number, constant: number) => {
              context.gainRamps.push([value, when, constant]);
            },
          ),
        },
      }),
    createBufferSource: () => {
      const source = fakeSource();
      context.sources.push(source);
      return source;
    },
    decodeAudioData: () => Promise.resolve({ duration: 60 }),
    resume: () => Promise.resolve(),
    close: () => Promise.resolve(),
  };
  return context;
};

describe('the guide vocal stopping', () => {
  const originalAudioContext = window.AudioContext;
  let context: ReturnType<typeof fakeVocalContext>;

  beforeEach(() => {
    context = fakeVocalContext();
    Object.defineProperty(window, 'AudioContext', {
      configurable: true,
      writable: true,
      value: jest.fn(() => context),
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'AudioContext', {
      configurable: true,
      writable: true,
      value: originalAudioContext,
    });
  });

  const vocals = {
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
  } as unknown as File;

  const mount = async (paused: boolean, rate = 1) => {
    const element = document.createElement('audio');
    element.playbackRate = rate;
    Object.defineProperty(element, 'paused', {
      configurable: true,
      get: () => paused,
    });
    const audioRef = { current: element };
    const hook = renderHook(
      ({ stem }: { stem: File | undefined }) =>
        useKaraokeVocalMix({ audioRef, vocals: stem }),
      { initialProps: { stem: vocals as File | undefined } },
    );
    await act(async () => undefined);
    act(() => hook.result.current.setVocalLevel(0.5));
    return { element, hook };
  };

  it('stops on the context clock after the fade, and lets go on ended', async () => {
    const timers = jest.spyOn(window, 'setTimeout');
    try {
      const { element } = await mount(false);
      const [source] = context.sources;
      expect(source.start).toHaveBeenCalled();

      act(() => {
        element.dispatchEvent(new Event('pause'));
      });
      // 30 ms past now on the context's own clock, when the fade has landed.
      expect(source.stop).toHaveBeenCalledWith(2.03);
      expect(source.disconnect).not.toHaveBeenCalled();
      source.dispatchEvent(new Event('ended'));
      expect(source.disconnect).toHaveBeenCalled();
      expect(timers).not.toHaveBeenCalled();
    } finally {
      timers.mockRestore();
    }
  });

  it('lets go at once of a source that never started, which will never end', async () => {
    const { element, hook } = await mount(true);
    // A seek while paused makes the next source and leaves it unstarted.
    act(() => {
      element.dispatchEvent(new Event('seeked'));
    });
    const [source] = context.sources;
    expect(source.start).not.toHaveBeenCalled();

    hook.unmount();
    expect(source.disconnect).toHaveBeenCalled();
  });

  it('keeps a compensated vocal running when both clocks advance together', async () => {
    context.baseLatency = 0.05;
    context.outputLatency = 0.15;
    const { element } = await mount(false);
    const [source] = context.sources;
    expect(source.start).toHaveBeenCalledWith(0, 0.2);

    const advanceBothClocks = () => {
      context.currentTime += 0.5;
      element.currentTime += 0.5;
      element.dispatchEvent(new Event('timeupdate'));
    };
    for (let tick = 0; tick < 4; tick += 1) {
      act(advanceBothClocks);
    }
    expect(context.sources).toHaveLength(1);
    expect(source.stop).not.toHaveBeenCalled();
  });

  it.each([-0.3, 0.3])(
    'still corrects real relative clock drift of %s seconds',
    async (drift) => {
      context.baseLatency = 0.05;
      context.outputLatency = 0.15;
      const { element } = await mount(false);
      const [first] = context.sources;
      act(() => {
        context.currentTime += 1;
        element.currentTime += 1 + drift;
        element.dispatchEvent(new Event('timeupdate'));
      });
      expect(context.sources).toHaveLength(2);
      expect(first.stop).toHaveBeenCalled();
      const resumed = context.sources[1];
      expect(resumed.start).toHaveBeenCalledWith(0, element.currentTime + 0.2);

      act(() => {
        context.currentTime += 1;
        element.currentTime += 1;
        element.dispatchEvent(new Event('timeupdate'));
      });
      expect(context.sources).toHaveLength(2);
      expect(resumed.stop).not.toHaveBeenCalled();
    },
  );

  it.each([0.5, 2])(
    'keeps latency compensation and drift in media seconds at %sx',
    async (rate) => {
      context.baseLatency = 0.05;
      context.outputLatency = 0.15;
      const { element } = await mount(false, rate);
      const [source] = context.sources;
      expect(source.start).toHaveBeenCalledWith(0, 0.2 * rate);
      act(() => {
        context.currentTime += 1;
        element.currentTime += rate;
        element.dispatchEvent(new Event('timeupdate'));
      });
      expect(context.sources).toHaveLength(1);
      expect(source.stop).not.toHaveBeenCalled();
    },
  );

  it('anchors drift to the new element position after a seek', async () => {
    context.baseLatency = 0.05;
    context.outputLatency = 0.15;
    const { element } = await mount(false);
    act(() => {
      element.currentTime = 20;
      element.dispatchEvent(new Event('seeked'));
    });
    expect(context.sources).toHaveLength(2);
    const resumed = context.sources[1];
    expect(resumed.start).toHaveBeenCalledWith(0, 20.2);
    act(() => {
      context.currentTime += 1;
      element.currentTime += 1;
      element.dispatchEvent(new Event('timeupdate'));
    });
    expect(context.sources).toHaveLength(2);
    expect(resumed.stop).not.toHaveBeenCalled();
  });

  it('ramps a nonzero fader change without replacing the playing vocal', async () => {
    const { hook } = await mount(false);
    const [source] = context.sources;
    act(() => hook.result.current.setVocalLevel(0.75));
    expect(context.sources).toHaveLength(1);
    expect(source.stop).not.toHaveBeenCalled();
    expect(context.gainRamps).toContainEqual([
      0.75,
      context.currentTime,
      0.015,
    ]);
    act(() => hook.result.current.setVocalLevel(0));
    expect(source.stop).toHaveBeenCalled();
    act(() => hook.result.current.setVocalLevel(0.5));
    expect(context.sources).toHaveLength(2);
    expect(context.sources[1].start).toHaveBeenCalled();
  });

  it('removes the old stem while its replacement decodes, then joins at the current position', async () => {
    const { element, hook } = await mount(false);
    const [oldSource] = context.sources;
    let finishDecode: ((buffer: { duration: number }) => void) | undefined;
    jest.spyOn(context, 'decodeAudioData').mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishDecode = resolve;
        }),
    );
    const replacement = {
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(16)),
    } as unknown as File;
    await act(async () => hook.rerender({ stem: replacement }));
    expect(hook.result.current.canMixVocals).toBe(false);
    expect(oldSource.stop).toHaveBeenCalled();
    act(() => hook.result.current.setVocalLevel(0.8));
    expect(context.sources).toHaveLength(1);
    element.currentTime = 12;
    const replacementBuffer = { duration: 70 };
    await act(async () => {
      if (!finishDecode) {
        throw new Error('Replacement decode never began');
      }
      finishDecode(replacementBuffer);
    });
    expect(hook.result.current.canMixVocals).toBe(true);
    expect(hook.result.current.vocalLevel).toBe(0.8);
    expect(context.sources).toHaveLength(2);
    expect(context.sources[1].buffer).toBe(replacementBuffer);
    expect(context.sources[1].start).toHaveBeenCalledWith(0, 12);
  });

  it('keeps a failed replacement unavailable instead of replaying the old voice', async () => {
    const { hook } = await mount(false);
    const [oldSource] = context.sources;
    jest
      .spyOn(context, 'decodeAudioData')
      .mockRejectedValueOnce(new Error('Unreadable stem'));
    const replacement = {
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(16)),
    } as unknown as File;
    await act(async () => hook.rerender({ stem: replacement }));
    expect(hook.result.current.canMixVocals).toBe(false);
    expect(oldSource.stop).toHaveBeenCalled();
    expect(context.sources).toHaveLength(1);
  });

  it('ignores an old decode that finishes after the current stem', async () => {
    let finishOld: ((buffer: { duration: number }) => void) | undefined;
    jest.spyOn(context, 'decodeAudioData').mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishOld = resolve;
        }),
    );
    const { hook } = await mount(false);
    const replacementBuffer = { duration: 70 };
    jest
      .spyOn(context, 'decodeAudioData')
      .mockResolvedValueOnce(replacementBuffer);
    const replacement = {
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(16)),
    } as unknown as File;
    await act(async () => hook.rerender({ stem: replacement }));
    expect(context.sources).toHaveLength(1);
    expect(context.sources[0].buffer).toBe(replacementBuffer);
    await act(async () => {
      if (!finishOld) {
        throw new Error('Original decode never began');
      }
      finishOld({ duration: 60 });
    });
    expect(context.sources).toHaveLength(1);
    expect(context.sources[0].buffer).toBe(replacementBuffer);
  });

  it('resynchronizes the source and compensated anchor on a playback-rate change', async () => {
    context.outputLatency = 0.2;
    const { element } = await mount(false);
    act(() => {
      element.currentTime = 10;
      Object.defineProperty(element, 'playbackRate', {
        configurable: true,
        value: 2,
      });
      element.dispatchEvent(new Event('ratechange'));
    });
    expect(context.sources).toHaveLength(2);
    const resumed = context.sources[1];
    expect(resumed.playbackRate.value).toBe(2);
    expect(resumed.start).toHaveBeenCalledWith(0, 10.4);
    act(() => {
      context.currentTime += 1;
      element.currentTime += 2;
      element.dispatchEvent(new Event('timeupdate'));
    });
    expect(context.sources).toHaveLength(2);
    expect(resumed.stop).not.toHaveBeenCalled();
  });
});
