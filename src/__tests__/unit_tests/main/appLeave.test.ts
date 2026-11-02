/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Electron leaving FluidEQ to its tray: never while anything holds it, never
 * without a tray, once — and in the order that keeps the sound on.
 */

import {
  createAppLeave,
  leaveToTray,
  relaunchCommand,
} from '../../../main/appLeave';

describe('when main leaves', () => {
  const setUp = (canLeave = () => true) => {
    const leave = jest.fn();
    const log = jest.fn();
    return { leave, log, appLeave: createAppLeave({ canLeave, leave, log }) };
  };

  it('is held by the launch window from the first moment', () => {
    const { leave, appLeave } = setUp();
    expect(appLeave.holding()).toEqual(['window']);
    expect(leave).not.toHaveBeenCalled();
  });

  it('leaves once the last hold goes, and only once', () => {
    const { leave, log, appLeave } = setUp();
    appLeave.hold('job:outputs', true);
    appLeave.hold('window', false);
    expect(leave).not.toHaveBeenCalled();
    // Said as the window goes: why the process stayed.
    expect(log).toHaveBeenCalledWith('This process stays for: job:outputs.');

    appLeave.hold('job:outputs', false);
    expect(leave).toHaveBeenCalledTimes(1);
    appLeave.hold('job:games', true);
    appLeave.hold('job:games', false);
    expect(leave).toHaveBeenCalledTimes(1);
  });

  it('asks a question hold when it would leave, and leaves once it is no', () => {
    const { leave, log, appLeave } = setUp();
    let needed = true;
    appLeave.holdWhile('job:media', () => needed);
    appLeave.hold('window', false);
    expect(leave).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith('This process stays for: job:media.');
    expect(appLeave.holding()).toEqual(['job:media']);
    needed = false;
    // A setting changed in the window: the window goes again after it.
    appLeave.hold('window', true);
    appLeave.hold('window', false);
    expect(leave).toHaveBeenCalledTimes(1);
  });

  it('stays while a window comes back, and leaves again only when it goes', () => {
    const { leave, appLeave } = setUp();
    appLeave.hold('job:library', true);
    appLeave.hold('window', false);
    appLeave.hold('window', true);
    appLeave.hold('job:library', false);
    expect(leave).not.toHaveBeenCalled();
    appLeave.hold('window', false);
    expect(leave).toHaveBeenCalledTimes(1);
  });

  it('never leaves without a tray to leave FluidEQ with', () => {
    let hasTray = false;
    const { leave, appLeave } = setUp(() => hasTray);
    appLeave.hold('window', false);
    expect(leave).not.toHaveBeenCalled();
    // A positive control: the same release with a tray leaves.
    hasTray = true;
    appLeave.hold('job:outputs', true);
    appLeave.hold('job:outputs', false);
    expect(leave).toHaveBeenCalledTimes(1);
  });

  it('does not count a hold released twice', () => {
    const { leave, appLeave } = setUp();
    appLeave.hold('job:share', true);
    appLeave.hold('job:media', true);
    appLeave.hold('window', false);
    appLeave.hold('job:share', false);
    appLeave.hold('job:share', false);
    expect(leave).not.toHaveBeenCalled();
    expect(appLeave.holding()).toEqual(['job:media']);
  });
});

describe('how the tray starts FluidEQ again', () => {
  it('is this program as it was started, less what hid this launch', () => {
    expect(
      relaunchCommand(
        {
          execPath: 'C:\\Program Files\\FluidEQ\\FluidEQ.exe',
          argv: [
            'C:\\Program Files\\FluidEQ\\FluidEQ.exe',
            '--start-in-tray',
            '--updated',
            '--lang=es',
          ],
          cwd: 'C:\\Windows\\System32',
        },
        ['--start-in-tray', '--updated'],
      ),
    ).toEqual({
      file: 'C:\\Program Files\\FluidEQ\\FluidEQ.exe',
      args: ['--lang=es'],
      cwd: 'C:\\Windows\\System32',
    });
  });
});

describe('leaving to the tray', () => {
  const steps = (told: boolean, windDownFails = false) => {
    const order: string[] = [];
    const deps = {
      showTrayForLeaving: () => order.push('tray menu'),
      windDown: () => {
        order.push('wind down');
        return windDownFails
          ? Promise.reject(new Error('a writer failed'))
          : Promise.resolve();
      },
      tellTray: () => {
        order.push('tell tray');
        return Promise.resolve(told);
      },
      exit: () => order.push('exit'),
      restart: () => order.push('restart'),
      log: jest.fn(),
    };
    return { order, deps };
  };

  it('shows the tray its own menu, winds down, tells it, and only then ends', async () => {
    const { order, deps } = steps(true);
    await leaveToTray(deps);
    expect(order).toEqual(['tray menu', 'wind down', 'tell tray', 'exit']);
  });

  it('goes on to the tray when a part of the winding down fails', async () => {
    const { order, deps } = steps(true, true);
    await leaveToTray(deps);
    expect(order).toEqual(['tray menu', 'wind down', 'tell tray', 'exit']);
    expect(deps.log).toHaveBeenCalled();
  });

  it('starts afresh rather than end with nothing holding FluidEQ', async () => {
    const { order, deps } = steps(false);
    await leaveToTray(deps);
    expect(order).toEqual(['tray menu', 'wind down', 'tell tray', 'restart']);
  });
});
