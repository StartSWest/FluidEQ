/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Windows audio restarted by itself, once a session, when the FluidEQ Engine
 * is on the output being listened to and Windows is not running it.
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
  key: 'problems:speakers',
};

interface IProps {
  trouble: TEngineTrouble | undefined;
  isSuppressed: boolean;
}

const setup = (initial: IProps) => {
  const audioRestart = {
    open: jest.fn(),
    run: jest.fn(async () => undefined),
  };
  const view = renderHook(
    ({ trouble, isSuppressed }: IProps) =>
      useRestartWhenEngineOff(trouble, isSuppressed, audioRestart),
    { initialProps: initial },
  );
  return { ...view, audioRestart };
};

describe('useRestartWhenEngineOff', () => {
  it('shows the restart and runs it when the engine is off', () => {
    const { audioRestart } = setup({ trouble: off, isSuppressed: false });
    expect(audioRestart.open).toHaveBeenCalledTimes(1);
    expect(audioRestart.run).toHaveBeenCalledTimes(1);
  });

  it('does it once a session, however often the engine is off again', () => {
    const { audioRestart, rerender } = setup({
      trouble: off,
      isSuppressed: false,
    });
    rerender({ trouble: undefined, isSuppressed: false });
    rerender({ trouble: off, isSuppressed: false });
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
