/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What the pet hears decides when she stops listening and when she dances,
 * never a clock (`SupportPet.tsx`). She let go of a song 1.2 s after a timer
 * started, considered a dance on a one-minute interval that ran through
 * silence, and stopped dancing on a 7 s timer. Now the meters' held peak lets
 * her go, the frames she hears loud count towards a dance, and the dance's
 * own last sway ends it.
 */

import { act, render } from '@testing-library/react';
import SupportPet, {
  DANCE_ANIMATION,
  DANCE_LOUD_FRAMES,
} from '../../../renderer/SupportPet';

interface IFrame {
  waveform: number[];
  outputLevels: { levelDb: number; peakDb: number; isClipping: boolean }[];
}

const mockListeners = new Set<() => void>();
let mockFrame: IFrame = { waveform: [], outputLevels: [] };

jest.mock('renderer/audio/LiveAudioContext', () => {
  const { useSyncExternalStore } = jest.requireActual('react');
  const subscribe = (listener: () => void) => {
    mockListeners.add(listener);
    return () => mockListeners.delete(listener);
  };
  return {
    useLiveAudioControl: () => ({ isActive: true, isPaused: false }),
    useLiveAudioFrame: () => useSyncExternalStore(subscribe, () => mockFrame),
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

const endAnimation = (target: Element, animationName: string) =>
  act(() => {
    const event = new Event('animationend', { bubbles: true });
    Object.defineProperty(event, 'animationName', { value: animationName });
    target.dispatchEvent(event);
  });

beforeEach(() => {
  jest.useFakeTimers();
  mockFrame = { waveform: [], outputLevels: [] };
  document.documentElement.removeAttribute('data-motion');
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

describe('the dance', () => {
  const hearLoud = (frames: number) => {
    for (let frame = 0; frame < frames; frame += 1) {
      publish(LOUD, -3);
    }
  };
  // The frame she starts listening on is heard before she is listening, so
  // it is not one she counts.
  const startListening = () => publish(LOUD, -3);

  it('is considered after a minute of loud frames, not of clock', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);
    const { container } = render(
      <SupportPet hasContributed onOpen={() => undefined} />,
    );
    startListening();

    hearLoud(DANCE_LOUD_FRAMES - 1);
    // A minute of wall clock with no music counts for nothing.
    act(() => {
      jest.advanceTimersByTime(120000);
    });
    expect(pet(container).classList.contains('is-dancing')).toBe(false);

    // The control: the next loud frame completes the minute.
    hearLoud(1);
    expect(pet(container).classList.contains('is-dancing')).toBe(true);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('counts only frames loud enough to dance to', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);
    const { container } = render(
      <SupportPet hasContributed onOpen={() => undefined} />,
    );
    startListening();
    hearLoud(DANCE_LOUD_FRAMES - 1);
    // Heard, but quiet: listening, and not a step nearer the dance.
    publish(0.1, -10);
    expect(pet(container).classList.contains('is-listening')).toBe(true);
    expect(pet(container).classList.contains('is-dancing')).toBe(false);
    hearLoud(1);
    expect(pet(container).classList.contains('is-dancing')).toBe(true);
  });

  it('ends with its own last sway, and nothing else’s', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);
    const { container } = render(
      <SupportPet hasContributed onOpen={() => undefined} />,
    );
    startListening();
    hearLoud(DANCE_LOUD_FRAMES);
    expect(pet(container).classList.contains('is-dancing')).toBe(true);

    const art = container.querySelector('.support-pet__art');
    if (!art) {
      throw new Error('no drawing');
    }
    // The control: the eyes' blink or the star's twinkle ending is not it.
    endAnimation(art, 'pet-twinkle');
    expect(pet(container).classList.contains('is-dancing')).toBe(true);

    endAnimation(art, DANCE_ANIMATION);
    expect(pet(container).classList.contains('is-dancing')).toBe(false);
  });

  it('never starts for somebody who asked for less motion', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);
    document.documentElement.setAttribute('data-motion', 'reduced');
    const { container } = render(
      <SupportPet hasContributed onOpen={() => undefined} />,
    );
    startListening();
    hearLoud(DANCE_LOUD_FRAMES);
    expect(pet(container).classList.contains('is-listening')).toBe(true);
    expect(pet(container).classList.contains('is-dancing')).toBe(false);
  });

  it('is only ever a supporter’s', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);
    const { container } = render(
      <SupportPet hasContributed={false} onOpen={() => undefined} />,
    );
    startListening();
    hearLoud(DANCE_LOUD_FRAMES);
    expect(pet(container).classList.contains('is-dancing')).toBe(false);
  });
});
