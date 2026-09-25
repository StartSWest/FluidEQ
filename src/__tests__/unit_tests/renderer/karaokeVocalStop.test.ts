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
    state: 'running',
    destination: {},
    sources: [] as ReturnType<typeof fakeSource>[],
    createGain: () =>
      Object.assign(fakeNode(), {
        context,
        gain: { value: 1, setTargetAtTime: jest.fn() },
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

  const mount = async (paused: boolean) => {
    const element = document.createElement('audio');
    Object.defineProperty(element, 'paused', {
      configurable: true,
      get: () => paused,
    });
    const hook = renderHook(() =>
      useKaraokeVocalMix({ audioRef: { current: element }, vocals }),
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
});
