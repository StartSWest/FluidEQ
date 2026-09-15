/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The window's side of the slot ladder: main is asked to put the engine
 * right on an output once per slot, each time sound has gone past an engine
 * Windows never created there, and the notice stays away until main has
 * said there is nothing left to try.
 *
 * The evidence is what makes this safe to do unasked: main can see that the
 * engine has never run, but not whether anything has played yet, so repairing
 * from there would prompt somebody seconds after installing. This runs only
 * once the live capture has heard sound on an output the engine is on.
 */

import { act, renderHook } from '@testing-library/react';
import type { IAudioRestartOutcome } from 'common/audioEngine';
import type { IAudioDevice } from 'common/constants';
import type { TEngineTrouble } from 'renderer/audio/engineTrouble';
import useRepairWhenEngineNeverRan from 'renderer/utils/useRepairWhenEngineNeverRan';

const device = {
  id: 'speakers',
  name: 'Speakers',
  guid: '{SPEAKERS}',
  isDefault: true,
  isActive: true,
} as IAudioDevice;

const neverRan: TEngineTrouble = {
  kind: 'off',
  device,
  key: 'off:never:{SPEAKERS}',
  neverRan: true,
};
const stopped: TEngineTrouble = { kind: 'off', device, key: 'off:{SPEAKERS}' };

const changed: IAudioRestartOutcome = { ok: true, declined: false };
const nothingLeft: IAudioRestartOutcome = {
  ok: false,
  declined: false,
  detail: 'every slot has been tried on this output',
};

interface IProps {
  trouble: TEngineTrouble | undefined;
  isSuppressed: boolean;
  slot: string | undefined;
}

const flush = () =>
  act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });

const setup = (
  initial: IProps,
  // `'not-started'` stands for the ask that could not even begin (the
  // maintenance lock was held), which the hook receives as undefined — an
  // explicit undefined here would only pick the default.
  outcome: IAudioRestartOutcome | 'not-started' = changed,
) => {
  const repair = jest.fn(async () =>
    outcome === 'not-started' ? undefined : outcome,
  );
  const render = (props: IProps) =>
    renderHook(
      ({ trouble, isSuppressed, slot }: IProps) =>
        useRepairWhenEngineNeverRan(trouble, isSuppressed, repair, slot),
      { initialProps: props },
    );
  const view = render(initial);
  return { ...view, repair, render };
};

describe('useRepairWhenEngineNeverRan', () => {
  // The per-slot memory lives in session storage.
  beforeEach(() => window.sessionStorage.clear());

  it('asks for the output when Windows has never created the engine on it', async () => {
    const { repair, result } = setup({
      trouble: neverRan,
      isSuppressed: false,
      slot: 'efx',
    });
    expect(repair).toHaveBeenCalledWith('{SPEAKERS}');
    // Silent while it runs.
    expect(result.current.isTryingSlots).toBe(true);
    await flush();
    expect(result.current.isTryingSlots).toBe(true);
  });

  it('leaves an engine that merely stopped to the restart', async () => {
    const { repair, rerender } = setup({
      trouble: stopped,
      isSuppressed: false,
      slot: 'efx',
    });
    expect(repair).not.toHaveBeenCalled();
    // Positive control: the same hook repairs the other kind.
    rerender({ trouble: neverRan, isSuppressed: false, slot: 'efx' });
    expect(repair).toHaveBeenCalledTimes(1);
    await flush();
  });

  it('asks again for each new slot, and once per slot', async () => {
    // The ladder: main moves the engine one slot down, the sound is heard
    // again past a silent engine, and the helper now reports the new slot.
    const { repair, rerender } = setup({
      trouble: neverRan,
      isSuppressed: false,
      slot: 'efx',
    });
    await flush();
    rerender({ trouble: undefined, isSuppressed: false, slot: 'efx' });
    rerender({ trouble: neverRan, isSuppressed: false, slot: 'mfx' });
    await flush();
    rerender({ trouble: undefined, isSuppressed: false, slot: 'mfx' });
    rerender({ trouble: neverRan, isSuppressed: false, slot: 'mfx' });
    await flush();
    expect(repair).toHaveBeenCalledTimes(2);
  });

  it('waits for the trouble to go away before asking for a new slot', async () => {
    // The status carrying the new slot can reach the window while the
    // trouble from before the restart is still on screen. Asking on that
    // would walk the whole ladder without listening once.
    const { repair, rerender, result } = setup({
      trouble: neverRan,
      isSuppressed: false,
      slot: 'efx',
    });
    await flush();
    rerender({ trouble: neverRan, isSuppressed: false, slot: 'mfx' });
    await flush();
    expect(repair).toHaveBeenCalledTimes(1);
    // Still silent: nothing has been judged.
    expect(result.current.isTryingSlots).toBe(true);
    rerender({ trouble: undefined, isSuppressed: false, slot: 'mfx' });
    rerender({ trouble: neverRan, isSuppressed: false, slot: 'mfx' });
    await flush();
    expect(repair).toHaveBeenCalledTimes(2);
  });

  it('shows the notice once a change did not help and the same slot failed again', async () => {
    const { result, rerender } = setup({
      trouble: neverRan,
      isSuppressed: false,
      slot: 'efx',
    });
    await flush();
    // The change is applied, the audio restarts, the sound is heard again —
    // and the helper still reports the same slot: the change is judged.
    rerender({ trouble: undefined, isSuppressed: false, slot: 'efx' });
    expect(result.current.isTryingSlots).toBe(false);
    rerender({ trouble: neverRan, isSuppressed: false, slot: 'efx' });
    expect(result.current.isTryingSlots).toBe(false);
  });

  it('shows the notice once main says there is nothing left to try', async () => {
    const { result, repair } = setup(
      { trouble: neverRan, isSuppressed: false, slot: 'lfx' },
      nothingLeft,
    );
    expect(result.current.isTryingSlots).toBe(true);
    await flush();
    expect(result.current.isTryingSlots).toBe(false);
    expect(repair).toHaveBeenCalledTimes(1);
  });

  it('asks again later when the ask could not even start', async () => {
    // The maintenance lock was held (an update running): not tried, so the
    // next sound past the same slot asks again.
    const { repair, rerender } = setup(
      { trouble: neverRan, isSuppressed: false, slot: 'efx' },
      'not-started',
    );
    await flush();
    rerender({ trouble: undefined, isSuppressed: false, slot: 'efx' });
    rerender({ trouble: neverRan, isSuppressed: false, slot: 'efx' });
    await flush();
    expect(repair).toHaveBeenCalledTimes(2);
  });

  it('does not come back when the shell itself is rebuilt', async () => {
    const { repair, unmount, render } = setup({
      trouble: neverRan,
      isSuppressed: false,
      slot: 'efx',
    });
    await flush();
    unmount();
    render({ trouble: neverRan, isSuppressed: false, slot: 'efx' });
    await flush();
    expect(repair).toHaveBeenCalledTimes(1);
  });

  it('waits while the engine update owns the machine', async () => {
    const { repair, rerender } = setup({
      trouble: neverRan,
      isSuppressed: true,
      slot: 'efx',
    });
    expect(repair).not.toHaveBeenCalled();
    rerender({ trouble: neverRan, isSuppressed: false, slot: 'efx' });
    expect(repair).toHaveBeenCalledTimes(1);
    await flush();
  });

  it('settles, and shows the notice, when the ask rejects', async () => {
    const repair = jest.fn(async () => {
      throw new Error('the helper is missing');
    });
    const { result } = renderHook(() =>
      useRepairWhenEngineNeverRan(neverRan, false, repair, 'efx'),
    );
    await flush();
    expect(result.current.isTryingSlots).toBe(false);
  });
});
