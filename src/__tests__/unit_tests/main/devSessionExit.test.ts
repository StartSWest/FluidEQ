/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { EventEmitter } from 'events';
import {
  IDevSessionHostProcess,
  IDevSessionQuitApp,
  exitDevSessionOnAppQuit,
} from '../../../../.erb/scripts/exit-dev-session-on-app-quit';

const setup = (enabled = true) => {
  const appEvents = new EventEmitter();
  const processEvents = new EventEmitter();
  const kill = jest.fn(() => true);
  const app = {
    once: appEvents.once.bind(appEvents),
  } as IDevSessionQuitApp;
  const hostProcess = {
    env: enabled ? { FLUIDEQ_EXIT_DEV_SESSION_ON_QUIT: '1' } : {},
    ppid: 42_424,
    prependListener: processEvents.prependListener.bind(processEvents),
    removeListener: processEvents.removeListener.bind(processEvents),
    kill,
  } as IDevSessionHostProcess;

  exitDevSessionOnAppQuit(app, hostProcess);
  return { appEvents, processEvents, kill };
};

describe('the integrated development session exit', () => {
  it('stops electronmon when FluidEQ deliberately quits', () => {
    const { appEvents, kill } = setup();

    appEvents.emit('quit');

    expect(kill).toHaveBeenCalledWith(42_424, 'SIGTERM');
  });

  it('keeps electronmon alive for a main-file hot restart', () => {
    const { appEvents, processEvents, kill } = setup();

    processEvents.emit('message', 'reset');
    appEvents.emit('quit');

    expect(kill).not.toHaveBeenCalled();
  });

  it('does nothing outside the explicitly managed dev launcher', () => {
    const { appEvents, kill } = setup(false);

    appEvents.emit('quit');

    expect(kill).not.toHaveBeenCalled();
  });
});
