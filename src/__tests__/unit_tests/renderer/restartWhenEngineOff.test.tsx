/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Windows audio restarted by itself, once for the life of the window, when
 * the FluidEQ Engine is on the output being listened to and Windows is not
 * running it.
 *
 * Twice in these cases matters more than once: a restart stops every stream
 * on the machine, so it must not be reachable again by a shell that was
 * rebuilt, nor on a machine where it provably cannot help.
 */

import { renderHook } from '@testing-library/react';
import type { IAudioDevice } from 'common/constants';
import type { TEngineTrouble } from 'renderer/audio/engineTrouble';
import useRestartWhenEngineOff from 'renderer/utils/useRestartWhenEngineOff';

const device = {
  id: 'speakers',
  name: 'Speakers',
  guid: '{SPEAKERS}',
  isDefault: true,
  isActive: true,
} as IAudioDevice;

const off: TEngineTrouble = { kind: 'off', device, key: 'off:speakers' };
const problems: TEngineTrouble = {
  kind: 'problems',
  device,
  problems: ['convolution'],
  canRestartHelp: true,
  canApoHelp: true,
  key: 'problems:speakers',
};

interface IProps {
  trouble: TEngineTrouble | undefined;
  isSuppressed: boolean;
  hasEverRun?: boolean;
}

const setup = (initial: IProps) => {
  const audioRestart = {
    open: jest.fn(),
    run: jest.fn(async () => undefined),
  };
  const render = (props: IProps) =>
    renderHook(
      ({ trouble, isSuppressed, hasEverRun }: IProps) =>
        useRestartWhenEngineOff(
          trouble,
          isSuppressed,
          audioRestart,
          hasEverRun,
        ),
      { initialProps: props },
    );
  const view = render(initial);
  return { ...view, audioRestart, render };
};

describe('useRestartWhenEngineOff', () => {
  // The once-per-run memory lives in session storage, so each case starts
  // from a FluidEQ that has not restarted anything yet.
  beforeEach(() => window.sessionStorage.clear());

  it('runs the restart without putting a dialog in the way', () => {
    const { audioRestart } = setup({ trouble: off, isSuppressed: false });
    expect(audioRestart.run).toHaveBeenCalledTimes(1);
    // The card is for a restart that failed, or one somebody asked for.
    expect(audioRestart.open).not.toHaveBeenCalled();
  });

  it('does it once, however often the engine is off again', () => {
    const { audioRestart, rerender } = setup({
      trouble: off,
      isSuppressed: false,
    });
    rerender({ trouble: undefined, isSuppressed: false });
    rerender({ trouble: off, isSuppressed: false });
    expect(audioRestart.run).toHaveBeenCalledTimes(1);
  });

  it('does not come back when the shell itself is rebuilt', () => {
    const { audioRestart, unmount, render } = setup({
      trouble: off,
      isSuppressed: false,
    });
    expect(audioRestart.run).toHaveBeenCalledTimes(1);
    // What a crash recovery reload does: the component and its refs are new.
    unmount();
    render({ trouble: off, isSuppressed: false });
    expect(audioRestart.run).toHaveBeenCalledTimes(1);
  });

  it('never restarts on a machine the engine has never run on', () => {
    const { audioRestart, rerender } = setup({
      trouble: off,
      isSuppressed: false,
      hasEverRun: false,
    });
    expect(audioRestart.run).not.toHaveBeenCalled();
    // Positive control: the same hook restarts where it can help.
    rerender({ trouble: off, isSuppressed: false, hasEverRun: true });
    expect(audioRestart.run).toHaveBeenCalledTimes(1);
  });

  it('never restarts an output the engine was never created on', () => {
    // The engine ran elsewhere on the machine and wrote no status for this
    // output: the slot ladder's case, and a restart beside it would be a
    // second elevated run for one silence.
    const { audioRestart, rerender } = setup({
      trouble: { ...off, key: 'off:never:{SPEAKERS}', neverRan: true },
      isSuppressed: false,
      hasEverRun: true,
    });
    expect(audioRestart.run).not.toHaveBeenCalled();
    rerender({ trouble: off, isSuppressed: false, hasEverRun: true });
    expect(audioRestart.run).toHaveBeenCalledTimes(1);
  });

  it('leaves everything else to the notice', () => {
    const { audioRestart, rerender } = setup({
      trouble: undefined,
      isSuppressed: false,
    });
    rerender({ trouble: problems, isSuppressed: false });
    expect(audioRestart.run).not.toHaveBeenCalled();
    // Positive control: the same hook does restart for an engine that is off.
    rerender({ trouble: off, isSuppressed: false });
    expect(audioRestart.run).toHaveBeenCalledTimes(1);
  });

  it('waits while the engine update owns the restart', () => {
    const { audioRestart, rerender } = setup({
      trouble: off,
      isSuppressed: true,
    });
    expect(audioRestart.run).not.toHaveBeenCalled();
    rerender({ trouble: off, isSuppressed: false });
    expect(audioRestart.run).toHaveBeenCalledTimes(1);
  });
});
