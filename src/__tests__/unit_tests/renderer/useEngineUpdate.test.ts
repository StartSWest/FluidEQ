/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * When the window offers the engine update. The status it hangs on is read
 * again after every engine action, so an offer made on every read that said
 * "ready" would bring back a notice somebody had just put off.
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import type { IAudioRestartOutcome } from 'common/audioEngine';
import { useEngineUpdate } from 'renderer/utils/useEngineUpdate';

const outcome = (ok: boolean, declined = false): IAudioRestartOutcome => ({
  ok,
  declined,
});

const mount = (
  isReady: boolean,
  perform = jest.fn(async () => outcome(true)),
) =>
  renderHook(({ ready }) => useEngineUpdate(ready, perform), {
    initialProps: { ready: isReady },
  });

describe('useEngineUpdate', () => {
  it('offers nothing while there is nothing to install', () => {
    const { result } = mount(false);
    expect(result.current.isOpen).toBe(false);
  });

  it('offers the update as soon as there is one', () => {
    const { result } = mount(true);
    expect(result.current.isOpen).toBe(true);
    expect(result.current.phase).toBe('ask');
  });

  it('does not bring back an offer that was put off while the answer stays yes', () => {
    const { result, rerender } = mount(true);
    act(() => result.current.close());

    rerender({ ready: true });
    expect(result.current.isOpen).toBe(false);
  });

  it('offers it again when the answer turns to yes again', () => {
    const { result, rerender } = mount(true);
    act(() => result.current.close());

    rerender({ ready: false });
    rerender({ ready: true });
    expect(result.current.isOpen).toBe(true);
  });

  it('runs the update and says it is done', async () => {
    const perform = jest.fn(async () => outcome(true));
    const { result } = mount(true, perform);

    await act(() => result.current.run());

    expect(perform).toHaveBeenCalledTimes(1);
    expect(result.current.phase).toBe('done');
  });

  it('brings the notice back by itself when the update fails while put away', async () => {
    const perform = jest.fn(async () => outcome(false, true));
    const { result } = mount(true, perform);
    act(() => result.current.close());

    await act(() => result.current.run());

    await waitFor(() => expect(result.current.isOpen).toBe(true));
    expect(result.current.phase).toBe('failed');
    expect(result.current.outcome).toEqual(outcome(false, true));
  });
});
