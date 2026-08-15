/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { act, renderHook } from '@testing-library/react';
import {
  karaokeMelodyToneFrequencyAtTime,
  karaokeMelodyToneMidiAtTime,
  useKaraokeMelodyTone,
} from '../../renderer/karaoke/useKaraokeMelodyTone';
import { karaokeLeadNoteArticulation } from '../../common/karaoke/melodyArticulation';

describe('karaoke melody guide tone', () => {
  const notes = [
    { text: 'one', startMs: 0, endMs: 500, targetMidi: 69 },
    { text: 'two', startMs: 500, endMs: 900, targetMidi: 72 },
    { text: 'three', startMs: 1_100, endMs: 1_400, targetMidi: 67 },
  ];

  it('follows normalized provider notes and remains silent in phrase gaps', () => {
    expect(karaokeMelodyToneMidiAtTime(notes, 250)).toBe(69);
    expect(karaokeMelodyToneMidiAtTime(notes, 500)).toBe(72);
    expect(karaokeMelodyToneMidiAtTime(notes, 1_000)).toBeUndefined();
    expect(karaokeMelodyToneMidiAtTime(notes, 1_200)).toBe(67);
  });

  it('articulates a lead cue without changing the authored lyric range', () => {
    const authored = {
      text: 'long',
      startMs: 2_000,
      endMs: 4_400,
      targetMidi: 69,
      kind: 'normal' as const,
    };
    const articulated = karaokeLeadNoteArticulation(authored);

    expect(articulated.startMs).toBe(authored.startMs);
    expect(articulated.endMs).toBeLessThan(authored.endMs);
    expect(articulated.durationMs).toBeLessThanOrEqual(1_450);
    expect(karaokeMelodyToneMidiAtTime([authored], 2_100)).toBe(69);
    expect(karaokeMelodyToneMidiAtTime([authored], 4_300)).toBeUndefined();
  });

  it('uses deterministic rhythmic variation for equal authored durations', () => {
    const first = karaokeLeadNoteArticulation({
      startMs: 0,
      endMs: 500,
      targetMidi: 60,
    });
    const second = karaokeLeadNoteArticulation({
      startMs: 500,
      endMs: 1_000,
      targetMidi: 64,
    });

    expect(first.durationMs).not.toBe(second.durationMs);
  });

  it('converts canonical MIDI notes to the audible guide frequency', () => {
    expect(karaokeMelodyToneFrequencyAtTime(notes, 250)).toBeCloseTo(440, 6);
    expect(karaokeMelodyToneFrequencyAtTime(notes, 1_000)).toBeUndefined();
  });

  it('drives a local oscillator from the synchronized song clock', async () => {
    const gainParams: Array<{
      value: number;
      cancelScheduledValues: jest.Mock;
      setTargetAtTime: jest.Mock;
    }> = [];
    const oscillators: Array<{
      type: OscillatorType;
      frequency: { setTargetAtTime: jest.Mock };
      connect: jest.Mock;
      start: jest.Mock;
      stop: jest.Mock;
    }> = [];
    const context = {
      state: 'running' as AudioContextState,
      currentTime: 2,
      destination: {},
      createOscillator: jest.fn(() => {
        const oscillator = {
          type: 'sine' as OscillatorType,
          frequency: { setTargetAtTime: jest.fn() },
          connect: jest.fn(),
          start: jest.fn(),
          stop: jest.fn(),
        };
        oscillators.push(oscillator);
        return oscillator;
      }),
      createGain: jest.fn(() => {
        const gain = {
          value: 0,
          cancelScheduledValues: jest.fn(),
          setTargetAtTime: jest.fn(),
        };
        gainParams.push(gain);
        return { gain, connect: jest.fn() };
      }),
      resume: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
    };
    const FakeAudioContext = jest.fn(() => context);
    const originalAudioContext = window.AudioContext;
    let nextFrame: FrameRequestCallback | undefined;
    const requestFrame = jest
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((callback) => {
        nextFrame = callback;
        return 1;
      });
    const cancelFrame = jest
      .spyOn(window, 'cancelAnimationFrame')
      .mockImplementation(() => undefined);
    Object.defineProperty(window, 'AudioContext', {
      configurable: true,
      value: FakeAudioContext,
    });

    const target = {
      kind: 'notes' as const,
      source: 'provider-neutral',
      coordinateSystem: 'midi-semitones' as const,
      octavePolicy: 'absolute' as const,
      notes,
    };
    const { result, rerender, unmount } = renderHook(
      ({
        isPlaying,
        currentTarget,
      }: {
        isPlaying: boolean;
        currentTarget: typeof target;
      }) =>
        useKaraokeMelodyTone({
          isActive: true,
          isPlaying,
          target: currentTarget,
          playheadMs: 250,
          readPlayheadMs: () => 250,
        }),
      { initialProps: { isPlaying: true, currentTarget: target } },
    );

    await act(async () => result.current.toggle());
    expect(result.current.enabled).toBe(true);
    act(() => nextFrame?.(0));

    expect(oscillators[0].frequency.setTargetAtTime).toHaveBeenCalledWith(
      440,
      2,
      0.012,
    );
    expect(oscillators[1].frequency.setTargetAtTime).toHaveBeenCalledWith(
      880,
      2,
      0.012,
    );
    expect(gainParams[2].setTargetAtTime).toHaveBeenCalledWith(
      0.34 * 0.18,
      2,
      0.012,
    );

    rerender({ isPlaying: false, currentTarget: target });
    act(() => nextFrame?.(16));
    expect(gainParams[2].setTargetAtTime).toHaveBeenLastCalledWith(0, 2, 0.018);

    // Returning focus is not permission to make a standalone tone: playback
    // remains paused, so the gain must stay closed.
    act(() => {
      window.dispatchEvent(new Event('blur'));
      window.dispatchEvent(new Event('focus'));
      nextFrame?.(24);
    });
    expect(gainParams[2].setTargetAtTime).toHaveBeenLastCalledWith(0, 2, 0.018);

    // A new song keeps the user's guide setting and wakes a context Chromium
    // suspended during the media swap.
    const nextTarget = {
      ...target,
      notes: [{ text: 'new', startMs: 0, endMs: 500, targetMidi: 60 }],
    };
    context.state = 'suspended';
    context.resume.mockImplementationOnce(async () => {
      context.state = 'running';
    });
    rerender({ isPlaying: true, currentTarget: nextTarget });
    await act(async () => Promise.resolve());
    expect(context.resume).toHaveBeenCalledTimes(1);
    act(() => nextFrame?.(32));
    expect(oscillators[0].frequency.setTargetAtTime).toHaveBeenLastCalledWith(
      261.6255653005986,
      2,
      0.012,
    );

    // Backgrounding the app closes the output immediately even though the
    // media status has not changed.
    act(() => window.dispatchEvent(new Event('blur')));
    expect(gainParams[2].setTargetAtTime).toHaveBeenLastCalledWith(0, 2, 0.018);

    unmount();
    expect(context.close).toHaveBeenCalledTimes(1);
    requestFrame.mockRestore();
    cancelFrame.mockRestore();
    Object.defineProperty(window, 'AudioContext', {
      configurable: true,
      value: originalAudioContext,
    });
  });
});
