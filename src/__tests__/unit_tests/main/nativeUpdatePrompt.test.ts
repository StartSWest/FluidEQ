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

import type { BrowserWindow } from 'electron';
import {
  createNativeUpdatePrompt,
  INativeNotificationHandle,
  INativeNotificationInput,
  INativeUpdatePromptDeps,
} from '../../../main/nativeUpdatePrompt';

type WindowState = 'onScreen' | 'hidden' | 'minimised' | 'destroyed' | 'absent';

const buildWindow = (state: WindowState): BrowserWindow | null => {
  if (state === 'absent') {
    return null;
  }
  return {
    isDestroyed: () => state === 'destroyed',
    isVisible: () => state !== 'hidden',
    isMinimized: () => state === 'minimised',
  } as unknown as BrowserWindow;
};

const makeHarness = (state: WindowState = 'hidden') => {
  const installNow = jest.fn();
  const revealWindow = jest.fn();
  const setTrayUpdateReady = jest.fn();
  // Wider parameter types than the real translate so the mock stays a jest.fn
  // — the module never inspects the returned string beyond includes()/equals.
  const translate = jest.fn(
    (key: string, params?: Record<string, string | number>) =>
      params ? `${key}(${JSON.stringify(params)})` : key,
  );
  const notification: INativeNotificationHandle & {
    listeners: Map<string, () => void>;
    show: jest.Mock;
  } = {
    listeners: new Map(),
    on: jest.fn((event: string, listener: () => void) => {
      notification.listeners.set(event, listener);
    }),
    show: jest.fn(),
  };
  // The input is typed rather than ignored so a test can assert which of the
  // several notification kinds was raised, not merely that one was.
  const createNotification = jest.fn(
    (_input: INativeNotificationInput) => notification,
  );
  const logger = { info: jest.fn() };

  let windowState: WindowState = state;
  const getMainWindow = jest.fn(() => buildWindow(windowState));
  const setWindowState = (next: WindowState) => {
    windowState = next;
  };

  const deps: INativeUpdatePromptDeps = {
    createNotification,
    getMainWindow,
    installNow,
    logger,
    revealWindow,
    setTrayUpdateReady,
    translate,
  };

  return {
    createNotification,
    deps,
    installNow,
    logger,
    notification,
    prompt: createNativeUpdatePrompt(deps),
    revealWindow,
    setTrayUpdateReady,
    setWindowState,
    translate,
  };
};

/** The title key the last raised notification used. */
const lastTitle = (harness: ReturnType<typeof makeHarness>) => {
  const { calls } = harness.createNotification.mock;
  return calls.length ? calls[calls.length - 1][0].title : undefined;
};

describe('nativeUpdatePrompt.handleStatus', () => {
  it('raises a Windows notification when the window is hidden into the tray', () => {
    const harness = makeHarness('hidden');

    harness.prompt.handleStatus({ phase: 'ready', version: '1.3.2' });

    expect(harness.setTrayUpdateReady).toHaveBeenCalledWith(true);
    expect(harness.createNotification).toHaveBeenCalledTimes(1);
    expect(harness.createNotification).toHaveBeenCalledWith({
      title: 'app.notification.updateReady.title',
      body: expect.stringContaining('1.3.2'),
    });
    expect(harness.notification.show).toHaveBeenCalledTimes(1);
  });

  it('raises a notification for a minimised window too — Windows still counts it as visible', () => {
    const harness = makeHarness('minimised');

    harness.prompt.handleStatus({ phase: 'ready', version: '1.3.2' });

    expect(harness.createNotification).toHaveBeenCalledTimes(1);
    expect(harness.notification.show).toHaveBeenCalledTimes(1);
  });

  it('raises a notification when the window has already been destroyed', () => {
    const harness = makeHarness('destroyed');

    harness.prompt.handleStatus({ phase: 'ready', version: '1.3.2' });

    expect(harness.createNotification).toHaveBeenCalledTimes(1);
    expect(harness.notification.show).toHaveBeenCalledTimes(1);
  });

  it('raises a notification even when no window exists yet', () => {
    const harness = makeHarness('absent');

    harness.prompt.handleStatus({ phase: 'ready', version: '1.3.2' });

    expect(harness.createNotification).toHaveBeenCalledTimes(1);
    expect(harness.notification.show).toHaveBeenCalledTimes(1);
  });

  it('leaves the notification alone when the window is on screen', () => {
    const harness = makeHarness('onScreen');

    harness.prompt.handleStatus({ phase: 'ready', version: '1.3.2' });

    // The in-window banner already speaks for a visible window; a Windows
    // toast on top of it would be duplicate noise about the same event.
    expect(harness.createNotification).not.toHaveBeenCalled();
    expect(harness.notification.show).not.toHaveBeenCalled();
    // But the tray marker still goes up — someone who then hides the window
    // must still see "an update is ready" without waiting for another event.
    expect(harness.setTrayUpdateReady).toHaveBeenCalledWith(true);
  });

  it('installs when the notification is clicked, via the shared install path', () => {
    const harness = makeHarness('hidden');

    harness.prompt.handleStatus({ phase: 'ready', version: '1.3.2' });
    const click = harness.notification.listeners.get('click');
    expect(click).toBeDefined();
    click?.();

    expect(harness.installNow).toHaveBeenCalledTimes(1);
  });

  it('never fires a second toast for a duplicate ready event', () => {
    const harness = makeHarness('hidden');

    harness.prompt.handleStatus({ phase: 'ready', version: '1.3.2' });
    harness.prompt.handleStatus({ phase: 'ready', version: '1.3.2' });

    // electron-updater can re-emit — the user must not hear the sound twice
    // for the same download.
    expect(harness.createNotification).toHaveBeenCalledTimes(1);
    expect(harness.notification.show).toHaveBeenCalledTimes(1);
  });

  it('rearms after a fresh available/downloading cycle so the next ready notifies again', () => {
    const harness = makeHarness('hidden');

    harness.prompt.handleStatus({ phase: 'ready', version: '1.3.2' });
    // A new cycle: the previous "ready" is no longer the current answer.
    harness.prompt.handleStatus({ phase: 'available', version: '1.3.3' });
    harness.prompt.handleStatus({ phase: 'downloading', percent: 50 });
    harness.prompt.handleStatus({ phase: 'ready', version: '1.3.3' });

    expect(harness.createNotification).toHaveBeenCalledTimes(2);
    expect(harness.setTrayUpdateReady.mock.calls).toEqual([
      [true],
      [false],
      [false],
      [true],
    ]);
  });

  it('clears the tray marker on a failure so it does not advertise a stale ready', () => {
    const harness = makeHarness('hidden');

    harness.prompt.handleStatus({ phase: 'ready', version: '1.3.2' });
    harness.prompt.handleStatus({
      phase: 'failed',
      isMandatory: true,
      failure: 'install',
    });

    expect(harness.setTrayUpdateReady).toHaveBeenLastCalledWith(false);
  });

  it('answers an up-to-date manual check even though nothing is happening', () => {
    const harness = makeHarness('hidden');

    harness.prompt.notifyManualCheckResult('up-to-date');

    // The whole point: "no update" is the common outcome and used to be
    // reported by nothing at all, so the tray click looked broken.
    expect(lastTitle(harness)).toBe('app.notification.upToDate.title');
    expect(harness.notification.show).toHaveBeenCalledTimes(1);
  });

  it('answers an up-to-date manual check even when the window is on screen', () => {
    const harness = makeHarness('onScreen');

    harness.prompt.notifyManualCheckResult('up-to-date');

    // No in-window surface says "you are up to date", so unlike the
    // downloading case this one is not suppressed by a visible window.
    expect(lastTitle(harness)).toBe('app.notification.upToDate.title');
  });

  it('reports a failed manual check rather than staying silent', () => {
    const harness = makeHarness('onScreen');

    harness.prompt.notifyManualCheckResult('failed');

    expect(lastTitle(harness)).toBe('app.notification.checkFailed.title');
  });

  it('announces a manual check that started a download, with the version', () => {
    const harness = makeHarness('hidden');

    harness.prompt.notifyManualCheckResult('downloading', '1.3.3');

    expect(lastTitle(harness)).toBe('app.notification.updateFound.title');
    expect(harness.createNotification).toHaveBeenLastCalledWith({
      title: 'app.notification.updateFound.title',
      body: expect.stringContaining('1.3.3'),
    });
  });

  it('stays quiet about a started download when the banner is already visible', () => {
    const harness = makeHarness('onScreen');

    harness.prompt.notifyManualCheckResult('downloading', '1.3.3');

    // The in-window update banner already says this. Two surfaces saying the
    // same sentence is the duplicate-noise case.
    expect(harness.createNotification).not.toHaveBeenCalled();
  });

  it('makes a failed install visible and offers a way to act on it', () => {
    const harness = makeHarness('hidden');

    harness.prompt.notifyInstallFailed();

    expect(lastTitle(harness)).toBe('app.notification.installFailed.title');
    const click = harness.notification.listeners.get('click');
    expect(click).toBeDefined();
    click?.();
    // Somewhere to retry from, rather than a toast that only reports.
    expect(harness.revealWindow).toHaveBeenCalledTimes(1);
    expect(harness.installNow).not.toHaveBeenCalled();
  });

  it('does not swallow the caller when the Notification constructor throws', () => {
    const harness = makeHarness('hidden');
    (harness.createNotification as jest.Mock).mockImplementationOnce(() => {
      throw new Error('Notifications disabled by group policy');
    });

    expect(() =>
      harness.prompt.handleStatus({ phase: 'ready', version: '1.3.2' }),
    ).not.toThrow();
    // Tray marker still goes up — a missing notification is not a reason to
    // hide the fact that an update is ready.
    expect(harness.setTrayUpdateReady).toHaveBeenCalledWith(true);
    expect(harness.logger.info).toHaveBeenCalledWith(
      expect.stringContaining('notification'),
      expect.any(Error),
    );
  });
});
