/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What the pet hears decides when she stops listening, never a clock
 * (`SupportPet.tsx`): she let go of a song 1.2 s after a timer started. Now
 * the meters' held peak lets her go.
 */

import { act, render } from '@testing-library/react';
import SupportPet from '../../../renderer/SupportPet';

interface IFrame {
  waveform: number[];
  outputLevels: { levelDb: number; peakDb: number; isClipping: boolean }[];
}

const mockListeners = new Set<() => void>();
let mockFrame: IFrame = { waveform: [], outputLevels: [] };

// The capture as the real context publishes it, a store: since 2026-11-16 the
// pet hears each frame through a listener on it rather than by rendering.
jest.mock('renderer/audio/LiveAudioContext', () => {
  const { useSyncExternalStore } = jest.requireActual('react');
  const { useStoreListener, useStoreSelector } = jest.requireActual<
    typeof import('../../../renderer/utils/useStoreSelector')
  >('../../../renderer/utils/useStoreSelector');
  const subscribe = (listener: () => void) => {
    mockListeners.add(listener);
    return () => {
      mockListeners.delete(listener);
    };
  };
  const frames = { read: () => mockFrame, subscribe };
  return {
    useLiveAudioControl: () => ({
      isActive: true,
      isPaused: false,
      readFrame: () => undefined,
    }),
    useLiveAudioFrames: () => frames,
    useLiveAudioFrame: () => useSyncExternalStore(subscribe, frames.read),
    useLiveAudioFrameSelector: <S,>(select: (frame: IFrame) => S) =>
      useStoreSelector(frames, select),
    useLiveAudioFrameListener: (listener: (frame: IFrame) => void) =>
      useStoreListener(frames, listener),
  };
});

/** One frame of the capture: a waveform at `level` and each meter's reading. */
const publish = (level: number, peakDb: number) =>
  act(() => {
    mockFrame = {
      waveform: Array.from({ length: 96 }, () => level),
      outputLevels: [
        { levelDb: peakDb, peakDb, isClipping: false },
        { levelDb: peakDb, peakDb, isClipping: false },
      ],
    };
    mockListeners.forEach((listener) => listener());
  });

const LOUD = 0.5;
const pet = (container: HTMLElement) => {
  const button = container.querySelector('.support-pet');
  if (!(button instanceof HTMLElement)) {
    throw new Error('no pet');
  }
  return button;
};

beforeEach(() => {
  jest.useFakeTimers();
  mockFrame = { waveform: [], outputLevels: [] };
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe('listening', () => {
  it('holds on through a quiet moment and lets go when the meters do', () => {
    const { container } = render(
      <SupportPet hasContributed onOpen={() => undefined} />,
    );
    expect(pet(container).classList.contains('is-listening')).toBe(false);

    publish(LOUD, -3);
    // The control: a loud frame is heard at once.
    expect(pet(container).classList.contains('is-listening')).toBe(true);

    // A rest in the music: nothing in the window, the held peak still up.
    publish(0, -12);
    expect(pet(container).classList.contains('is-listening')).toBe(true);
    // Nothing waiting on a clock to let her go.
    expect(jest.getTimerCount()).toBe(0);

    // The held peak has fallen under what she hears.
    publish(0, -40);
    expect(pet(container).classList.contains('is-listening')).toBe(false);
  });

  it('lets go at the capture’s resting frame, the last one it sends', () => {
    const { container } = render(
      <SupportPet hasContributed onOpen={() => undefined} />,
    );
    publish(LOUD, -3);
    expect(pet(container).classList.contains('is-listening')).toBe(true);

    publish(0, -60);
    expect(pet(container).classList.contains('is-listening')).toBe(false);
    expect(jest.getTimerCount()).toBe(0);
  });
});
