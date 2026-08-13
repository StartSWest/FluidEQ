/* FluidEQ Karaoke Maker note-audition tests. GPL-3.0-or-later. */

import { act, renderHook } from '@testing-library/react';
import useKaraokeNoteAudition from '../../renderer/karaoke/useKaraokeNoteAudition';

describe('Karaoke Maker note audition', () => {
  it('sounds the exact MIDI pitch and releases the old voice when retriggered', () => {
    const oscillators: Array<{
      frequency: { setValueAtTime: jest.Mock };
      stop: jest.Mock;
    }> = [];
    const createOscillator = jest.fn(() => {
      const oscillator = {
        type: 'sine' as OscillatorType,
        frequency: { setValueAtTime: jest.fn() },
        connect: jest.fn(),
        disconnect: jest.fn(),
        start: jest.fn(),
        stop: jest.fn(),
        onended: null as (() => void) | null,
      };
      oscillators.push(oscillator);
      return oscillator;
    });
    const createGain = jest.fn(() => ({
      gain: {
        value: 0,
        cancelScheduledValues: jest.fn(),
        setTargetAtTime: jest.fn(),
        setValueAtTime: jest.fn(),
        exponentialRampToValueAtTime: jest.fn(),
      },
      connect: jest.fn(),
      disconnect: jest.fn(),
    }));
    const context = {
      state: 'running' as AudioContextState,
      currentTime: 2,
      destination: {},
      createOscillator,
      createGain,
      resume: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
    };
    const FakeAudioContext = jest.fn(() => context);
    const originalAudioContext = window.AudioContext;
    Object.defineProperty(window, 'AudioContext', {
      configurable: true,
      value: FakeAudioContext,
    });

    const { result, unmount } = renderHook(useKaraokeNoteAudition);
    act(() => result.current.play(69));
    expect(oscillators[0].frequency.setValueAtTime).toHaveBeenCalledWith(
      440,
      2,
    );
    expect(oscillators[1].frequency.setValueAtTime).toHaveBeenCalledWith(
      880,
      2,
    );

    act(() => result.current.play(72));
    expect(oscillators[0].stop).toHaveBeenCalledTimes(2);
    expect(oscillators[2].frequency.setValueAtTime).toHaveBeenCalledWith(
      523.2511306011972,
      2,
    );

    unmount();
    expect(context.close).toHaveBeenCalledTimes(1);
    Object.defineProperty(window, 'AudioContext', {
      configurable: true,
      value: originalAudioContext,
    });
  });
});
