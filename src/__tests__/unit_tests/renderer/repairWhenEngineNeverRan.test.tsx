/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The engine's installation put back by the app, once, when sound has gone
 * past an engine Windows has never once created.
 *
 * The evidence is what makes this safe to do unasked: main can see that the
 * engine has never run, but not whether anything has played yet, so repairing
 * from there would prompt somebody seconds after installing. This runs only
 * once the live capture has heard sound on an output the engine is on.
 */

import { renderHook } from '@testing-library/react';
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

interface IProps {
  trouble: TEngineTrouble | undefined;
  isSuppressed: boolean;
}

const setup = (initial: IProps) => {
  const repair = jest.fn(async () => undefined);
  const render = (props: IProps) =>
    renderHook(
      ({ trouble, isSuppressed }: IProps) =>
        useRepairWhenEngineNeverRan(trouble, isSuppressed, repair),
      { initialProps: props },
    );
  const view = render(initial);
  return { ...view, repair, render };
};

describe('useRepairWhenEngineNeverRan', () => {
  // The once-per-run memory lives in session storage.
  beforeEach(() => window.sessionStorage.clear());

  it('repairs when Windows has never created the engine', () => {
    const { repair } = setup({ trouble: neverRan, isSuppressed: false });
    expect(repair).toHaveBeenCalledTimes(1);
  });

  it('leaves an engine that merely stopped to the restart', () => {
    const { repair, rerender } = setup({
      trouble: stopped,
      isSuppressed: false,
    });
    expect(repair).not.toHaveBeenCalled();
    // Positive control: the same hook repairs the other kind.
    rerender({ trouble: neverRan, isSuppressed: false });
    expect(repair).toHaveBeenCalledTimes(1);
  });

  it('asks once, however often the trouble comes back', () => {
    const { repair, rerender } = setup({
      trouble: neverRan,
      isSuppressed: false,
    });
    rerender({ trouble: undefined, isSuppressed: false });
    rerender({ trouble: neverRan, isSuppressed: false });
    expect(repair).toHaveBeenCalledTimes(1);
  });

  it('does not come back when the shell itself is rebuilt', () => {
    const { repair, unmount, render } = setup({
      trouble: neverRan,
      isSuppressed: false,
    });
    unmount();
    render({ trouble: neverRan, isSuppressed: false });
    expect(repair).toHaveBeenCalledTimes(1);
  });

  it('waits while the engine update owns the machine', () => {
    const { repair, rerender } = setup({
      trouble: neverRan,
      isSuppressed: true,
    });
    expect(repair).not.toHaveBeenCalled();
    rerender({ trouble: neverRan, isSuppressed: false });
    expect(repair).toHaveBeenCalledTimes(1);
  });

  it('survives a repair that rejects', async () => {
    const repair = jest.fn(async () => {
      throw new Error('the helper is missing');
    });
    expect(() =>
      renderHook(() => useRepairWhenEngineNeverRan(neverRan, false, repair)),
    ).not.toThrow();
    await Promise.resolve();
  });
});
