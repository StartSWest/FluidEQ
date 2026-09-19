/** @jest-environment node */
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

import { EventEmitter, once } from 'events';
import {
  accountComeBackSteps,
  createComeBackWatch,
  IAccountRefreshers,
  IComeBackStep,
  IComeBackWatchDeps,
} from '../../../main/comeBackSignals';

type TUpdater = ReturnType<IComeBackWatchDeps['getActiveAutoUpdater']>;

const COME_BACK_EVENTS = [
  ['power', 'resume', 'wake from sleep'],
  ['power', 'unlock-screen', 'screen unlock'],
  ['window', 'show', 'window shown'],
  ['window', 'focus', 'window focused'],
] as const;

const AWAY_EVENTS = [
  ['power', 'lock-screen', 'the screen locking'],
  ['window', 'hide', 'the window hiding'],
  ['window', 'minimize', 'the window being minimised'],
] as const;

/**
 * A watch over a stand-in power monitor, with one account step that announces
 * every run on `refreshed` so a test can wait for it rather than for a clock.
 */
const makeWatch = (
  getActiveAutoUpdater: () => TUpdater,
  accountSteps?: readonly IComeBackStep[],
) => {
  const powerMonitor = new EventEmitter();
  const refreshed = new EventEmitter();
  const applyUpdateIfUnattended = jest.fn();
  const logger = { info: jest.fn(), warn: jest.fn() };
  const watch = createComeBackWatch({
    powerMonitor,
    accountSteps: accountSteps ?? [
      {
        name: 'account',
        run: async (reason) => {
          refreshed.emit('ran', reason);
        },
      },
    ],
    getActiveAutoUpdater,
    applyUpdateIfUnattended,
    logger,
  });
  return { applyUpdateIfUnattended, logger, powerMonitor, refreshed, watch };
};

const makeUpdater = () => ({
  checkIfDue: jest.fn(() => Promise.resolve(false)),
});

describe('createComeBackWatch', () => {
  it('refreshes the account on every come-back event with no updater at all', async () => {
    // Development, an unpackaged run, macOS, Linux and a packaged build whose
    // updater failed its checks: the case that never refreshed after launch.
    const harness = makeWatch(() => undefined);
    const window = new EventEmitter();
    harness.watch.watchWindow(window);

    const sources = { power: harness.powerMonitor, window };
    await COME_BACK_EVENTS.reduce(async (previous, [source, event, reason]) => {
      await previous;
      const ran = once(harness.refreshed, 'ran');
      sources[source].emit(event);
      expect(await ran).toEqual([reason]);
    }, Promise.resolve());

    AWAY_EVENTS.forEach(([source, event]) => sources[source].emit(event));
    expect(harness.applyUpdateIfUnattended).not.toHaveBeenCalled();
  });

  it('checks for updates and installs unattended while an updater is active', () => {
    // The positive control for the test above: the same events, with an
    // updater, do reach it.
    const updater = makeUpdater();
    const harness = makeWatch(() => updater);
    const window = new EventEmitter();
    harness.watch.watchWindow(window);
    const sources = { power: harness.powerMonitor, window };

    COME_BACK_EVENTS.forEach(([source, event]) => sources[source].emit(event));
    expect(updater.checkIfDue).toHaveBeenCalledTimes(COME_BACK_EVENTS.length);

    AWAY_EVENTS.forEach(([source, event]) => sources[source].emit(event));
    expect(harness.applyUpdateIfUnattended.mock.calls).toEqual(
      AWAY_EVENTS.map(([, , reason]) => [reason]),
    );
  });

  it('asks for the updater when an event fires, not when the window is wired', () => {
    // The updater comes up after the window exists, and a setup that fails
    // closed takes it away again.
    const updater = makeUpdater();
    let active: TUpdater;
    const harness = makeWatch(() => active);
    const window = new EventEmitter();
    harness.watch.watchWindow(window);

    window.emit('focus');
    expect(updater.checkIfDue).not.toHaveBeenCalled();

    active = updater;
    window.emit('focus');
    window.emit('hide');
    expect(updater.checkIfDue).toHaveBeenCalledTimes(1);
    expect(harness.applyUpdateIfUnattended).toHaveBeenCalledTimes(1);

    active = undefined;
    window.emit('focus');
    window.emit('hide');
    expect(updater.checkIfDue).toHaveBeenCalledTimes(1);
    expect(harness.applyUpdateIfUnattended).toHaveBeenCalledTimes(1);
  });

  it('wires the power monitor once and each window once, and a new window too', () => {
    const updater = makeUpdater();
    const harness = makeWatch(() => updater);
    const first = new EventEmitter();
    const second = new EventEmitter();

    // Not before a window: the power monitor cannot be used before `ready`.
    expect(harness.powerMonitor.eventNames()).toEqual([]);

    harness.watch.watchWindow(first);
    harness.watch.watchWindow(first);
    // The window built again, as macOS's dock does.
    harness.watch.watchWindow(second);

    ['resume', 'unlock-screen', 'lock-screen'].forEach((event) => {
      expect(harness.powerMonitor.listenerCount(event)).toBe(1);
    });
    [first, second].forEach((window) => {
      ['show', 'focus', 'hide', 'minimize'].forEach((event) => {
        expect(window.listenerCount(event)).toBe(1);
      });
    });

    harness.powerMonitor.emit('resume');
    expect(updater.checkIfDue).toHaveBeenCalledTimes(1);
    second.emit('show');
    expect(updater.checkIfDue).toHaveBeenCalledTimes(2);
  });

  it('logs an update check that cannot start instead of throwing it', async () => {
    const failure = new Error('offline');
    const updater = { checkIfDue: jest.fn(() => Promise.reject(failure)) };
    const harness = makeWatch(() => updater);
    const logged = new Promise<unknown[]>((resolve) => {
      harness.logger.info.mockImplementation((...args: unknown[]) =>
        resolve(args),
      );
    });
    harness.watch.watchWindow(new EventEmitter());

    harness.powerMonitor.emit('unlock-screen');

    expect(await logged).toEqual([
      'Update check on screen unlock could not start',
      failure,
    ]);
  });
});

describe('accountComeBackSteps', () => {
  /**
   * Every refresher, recording the order it was called in. The leaderboard
   * upload is the last step, and says so on `done`.
   */
  const makeRefreshers = () => {
    const calls: string[] = [];
    const done = new EventEmitter();
    const record = (name: string) => async () => {
      calls.push(name);
    };
    const refreshers = {
      entitlement: { checkIfDue: jest.fn(record('membership')) },
      scenePacks: { refreshIfDue: jest.fn(record('FluidEQ scenes')) },
      memberSharing: { refreshIfDue: jest.fn(record('block list')) },
      plusGallery: { refreshIfDue: jest.fn(record('gallery scenes')) },
      sceneReviews: { refreshIfDue: jest.fn(record('scene reviews')) },
      plusTermsNotice: { checkIfDue: jest.fn(record('Plus terms notice')) },
      leaderboard: {
        uploadIfDue: jest.fn(async () => {
          calls.push('leaderboard upload');
          done.emit('done');
        }),
      },
    };
    const typed: IAccountRefreshers = refreshers;
    return { calls, done, refreshers, typed };
  };

  it('asks about the membership first, and each refresh after the last settles', async () => {
    const { calls, done, refreshers, typed } = makeRefreshers();
    const membership = new EventEmitter();
    refreshers.entitlement.checkIfDue.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          calls.push('membership');
          membership.emit('asked', resolve);
        }),
    );
    const harness = makeWatch(() => undefined, accountComeBackSteps(typed));
    harness.watch.watchWindow(new EventEmitter());

    const asked = once(membership, 'asked');
    harness.powerMonitor.emit('resume');
    const [settleMembership] = (await asked) as [() => void];
    // Nothing behind the membership can start while it is still being asked.
    expect(calls).toEqual(['membership']);

    const finished = once(done, 'done');
    settleMembership();
    await finished;

    expect(calls).toEqual([
      'membership',
      'FluidEQ scenes',
      'block list',
      'gallery scenes',
      'scene reviews',
      'Plus terms notice',
      'leaderboard upload',
    ]);
    expect(refreshers.entitlement.checkIfDue).toHaveBeenCalledWith(
      'wake from sleep',
    );
    expect(refreshers.scenePacks.refreshIfDue).toHaveBeenCalledWith(
      'wake from sleep',
    );
    expect(refreshers.memberSharing.refreshIfDue).toHaveBeenCalledWith(
      'wake from sleep',
    );
    expect(refreshers.plusGallery.refreshIfDue).toHaveBeenCalledWith();
    expect(refreshers.sceneReviews.refreshIfDue).toHaveBeenCalledWith(
      'wake from sleep',
    );
    expect(refreshers.plusTermsNotice.checkIfDue).toHaveBeenCalledWith(
      'wake from sleep',
    );
    expect(refreshers.leaderboard.uploadIfDue).toHaveBeenCalledWith(
      'wake from sleep',
    );
    expect(harness.logger.warn).not.toHaveBeenCalled();
  });

  it('logs a refresh that fails and still runs the ones after it', async () => {
    const { calls, done, refreshers, typed } = makeRefreshers();
    const rejected = new Error('the scene listing could not be read');
    const thrown = new Error('thrown before any promise existed');
    refreshers.scenePacks.refreshIfDue.mockImplementation(() =>
      Promise.reject(rejected),
    );
    refreshers.plusGallery.refreshIfDue.mockImplementation(() => {
      throw thrown;
    });
    const harness = makeWatch(() => undefined, accountComeBackSteps(typed));
    harness.watch.watchWindow(new EventEmitter());

    const finished = once(done, 'done');
    harness.powerMonitor.emit('unlock-screen');
    await finished;

    expect(calls).toEqual([
      'membership',
      'block list',
      'scene reviews',
      'Plus terms notice',
      'leaderboard upload',
    ]);
    expect(harness.logger.warn.mock.calls).toEqual([
      ['Refreshing the FluidEQ scenes after screen unlock failed.', rejected],
      ['Refreshing the gallery scenes after screen unlock failed.', thrown],
    ]);
  });
});
