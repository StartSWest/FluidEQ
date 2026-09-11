/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The restart outlives its card.
 *
 * When the card owned the restart, closing it abandoned the answer, so it
 * could not be closed while Windows worked at all. These pin the three
 * things that replaced that: the restart keeps going when the card closes,
 * a failure opens the card again by itself, and there is only ever one
 * restart at a time.
 */

import { act, renderHook } from '@testing-library/react';
import type { IAudioRestartOutcome } from 'common/audioEngine';
import { useAudioRestart } from 'renderer/utils/useAudioRestart';

jest.mock('renderer/utils/logger', () => ({ reportError: jest.fn() }));

const pending = () => {
  let settle: (outcome: IAudioRestartOutcome) => void = () => undefined;
  const promise = new Promise<IAudioRestartOutcome>((resolve) => {
    settle = resolve;
  });
  return { promise, settle };
};

describe('useAudioRestart', () => {
  it('runs the restart and lands on done', async () => {
    const restart = jest.fn().mockResolvedValue({ ok: true, declined: false });
    const { result } = renderHook(() => useAudioRestart(restart));

    act(() => result.current.open());
    expect(result.current.phase).toBe('ask');
    await act(async () => {
      await result.current.run();
    });
    expect(result.current.phase).toBe('done');
    expect(result.current.isOpen).toBe(true);
  });

  it('keeps going when the card closes, and reopens it for a failure', async () => {
    const running = pending();
    const restart = jest.fn(() => running.promise);
    const { result } = renderHook(() => useAudioRestart(restart));

    act(() => result.current.open());
    let finished: Promise<void> = Promise.resolve();
    act(() => {
      finished = result.current.run();
    });
    expect(result.current.phase).toBe('running');

    act(() => result.current.close());
    expect(result.current.isOpen).toBe(false);

    await act(async () => {
      running.settle({ ok: false, declined: false, detail: 'why' });
      await finished;
    });
    expect(result.current.isOpen).toBe(true);
    expect(result.current.phase).toBe('failed');
    expect(result.current.outcome?.detail).toBe('why');
  });

  it('leaves the card closed when a background restart works', async () => {
    const running = pending();
    const { result } = renderHook(() => useAudioRestart(() => running.promise));

    act(() => result.current.open());
    let finished: Promise<void> = Promise.resolve();
    act(() => {
      finished = result.current.run();
    });
    act(() => result.current.close());
    await act(async () => {
      running.settle({ ok: true, declined: false });
      await finished;
    });
    expect(result.current.isOpen).toBe(false);
  });

  it('shows the restart still running when opened again, and never runs two', async () => {
    const running = pending();
    const restart = jest.fn(() => running.promise);
    const { result } = renderHook(() => useAudioRestart(restart));

    act(() => result.current.open());
    let finished: Promise<void> = Promise.resolve();
    act(() => {
      finished = result.current.run();
    });
    act(() => {
      result.current.close();
      result.current.open();
    });
    expect(result.current.phase).toBe('running');
    act(() => {
      result.current.run();
    });
    expect(restart).toHaveBeenCalledTimes(1);

    await act(async () => {
      running.settle({ ok: true, declined: false });
      await finished;
    });
    // Once it has finished, opening asks afresh.
    act(() => result.current.open());
    expect(result.current.phase).toBe('ask');
  });

  it('turns a restart that threw into a failure with its reason', async () => {
    const restart = jest.fn().mockRejectedValue(new Error('ipc gone'));
    const { result } = renderHook(() => useAudioRestart(restart));

    await act(async () => {
      await result.current.run();
    });
    expect(result.current.phase).toBe('failed');
    expect(result.current.outcome).toEqual({
      ok: false,
      declined: false,
      detail: 'ipc gone',
    });
  });
});
