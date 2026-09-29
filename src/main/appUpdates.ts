/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>
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

import { app, BrowserWindow, Notification } from 'electron';
import log from 'electron-log';
import type { NsisUpdater } from 'electron-updater';
import { APP_UPDATE_EVENT } from '../common/constants';
import { translate } from '../common/i18n';
import { appVersion } from './appVersion';
import { isDspHostPlaying } from './ipc/dspHost';
import {
  createNativeUpdatePrompt,
  INativeUpdatePrompt,
  isWindowOnScreen,
} from './nativeUpdatePrompt';
import {
  IAuthorizedAutoUpdater,
  setUpReleaseAutoUpdates,
} from './signedAutoUpdates';
import {
  beginQuit,
  getTrayLocale,
  revealMainWindow,
  setTrayUpdateReady,
  setTrayUpdatesEnabled,
} from './tray';
import {
  createUnattendedUpdate,
  IUnattendedUpdate,
  rememberUnattendedRestart,
} from './unattendedUpdate';

export interface IAppUpdatesDeps {
  getMainWindow: () => BrowserWindow | null;
  /** Where the "I restarted myself" note lives; see unattendedUpdate.ts. */
  unattendedRestartMarkerPath: string;
}

export interface IAppUpdates {
  /**
   * Late-bound everywhere it is read: it is built asynchronously at startup
   * and stays unset when its signature or feed checks fail, so a reference
   * captured early would be undefined forever.
   */
  getActiveAutoUpdater: () => IAuthorizedAutoUpdater | undefined;
  /** The window factory's, which replaces the updater with its window. */
  setActiveAutoUpdater: (next: IAuthorizedAutoUpdater | undefined) => void;
  installActiveUpdate: () => void;
  applyUpdateIfUnattended: (reason: string) => void;
  setUpAutoUpdates: () => Promise<void>;
}

/**
 * The app's own updates: the updater, the tray badge and toast that offer an
 * installer, and the unattended install.
 */
const createAppUpdates = ({
  getMainWindow,
  unattendedRestartMarkerPath,
}: IAppUpdatesDeps): IAppUpdates => {
  /**
   * The updater exists only after Windows verifies which release channel this
   * process belongs to. An unsigned package uses GitHub Releases; an official
   * signed package uses its pinned HTTPS feed. A source build, differently
   * signed fork, incomplete release configuration, or verification failure
   * leaves this unset, which also closes the install IPC path.
   *
   * Type-only import above is deliberate. The runtime module is required
   * inside `loadUpdater`, after verification, because reading
   * electron-updater's singleton export constructs the platform updater.
   */
  let activeAutoUpdater: IAuthorizedAutoUpdater | undefined;
  let hasAttemptedAutoUpdates = false;

  /**
   * Owns the tray badge and the Windows toast that catch a user who is not
   * looking at the window. Built at setUpAutoUpdates so the install callback
   * closes over the controller once it exists — the prompt is what turns a
   * "ready" status into a real chance to install without the app being open.
   */
  let nativeUpdatePrompt: INativeUpdatePrompt | undefined;

  /**
   * Applies a downloaded update by itself, whenever doing so would go
   * unnoticed. Built alongside the prompt above, and deliberately consulted
   * from the same places: a ready download, and every event that means the app
   * has just got out of the user's way. See unattendedUpdate.ts for why there
   * is no timer.
   */
  let unattendedUpdate: IUnattendedUpdate | undefined;

  const applyUpdateIfUnattended = (reason: string) => {
    // `setImmediate` here is about the call stack, not about waiting: there is
    // no duration to tune and nothing is being retried. Every caller is inside
    // an event Electron is still dispatching — the window's own `close` handler
    // is what calls `hide()`, so a `hide` listener runs while that `close` is
    // still on the stack, and this path ends in `app.quit()`, which closes the
    // same window again. Starting the quit from a fresh stack keeps that out of
    // a re-entrant close. It also lets the renderer's status message flush
    // before the process goes.
    setImmediate(() => {
      unattendedUpdate?.applyIfUnattended(reason);
    });
  };

  const installActiveUpdate = () => {
    if (!activeAutoUpdater) {
      // Reachable only if the tray or a toast outlived the updater. Say so
      // rather than returning quietly: this is the button the whole feature
      // exists to offer.
      log.warn('Update install requested with no active updater; ignoring.');
      nativeUpdatePrompt?.notifyInstallFailed();
      return;
    }
    try {
      // `true` for isSilent so the NSIS run puts nothing on screen and asks
      // nothing: no language dialog, no licence page, no progress window with
      // a button on it, and no second pass at the Equalizer APO installer,
      // which installer.nsh skips on a silent run. `true` for isForceRunAfter
      // so FluidEQ opens again once the install finishes. The controller arms
      // the tray's quit flag via beforeQuit; without that the window's close
      // handler would cancel the exit and the installer would fail to replace
      // a still-open executable.
      activeAutoUpdater.quitAndInstall(true, true);
    } catch (error) {
      // NOT LOG-ONLY. This is the primary action of the whole tray update
      // flow, reached from the notification and from the menu item, and both
      // of those are pressed by somebody who cannot see a window. Swallowing
      // the failure into the log would leave the loudest button in the app
      // doing visibly nothing. The tray badge is deliberately left up so the
      // action can be tried again.
      log.error('Update install could not start', error);
      nativeUpdatePrompt?.notifyInstallFailed();
    }
  };

  const setUpAutoUpdates = async () => {
    if (hasAttemptedAutoUpdates) {
      return;
    }
    hasAttemptedAutoUpdates = true;
    log.transports.file.level = 'info';

    // Built up front so `sendStatus` can fan out to it. `handleStatus` is a
    // no-op for anything other than a 'ready' phase, so creating this before
    // the tray or updater exist is harmless.
    nativeUpdatePrompt = createNativeUpdatePrompt({
      getMainWindow,
      installNow: installActiveUpdate,
      setTrayUpdateReady: (isReady) =>
        setTrayUpdateReady(isReady, { getMainWindow }),
      revealWindow: () => revealMainWindow(getMainWindow),
      translate: (key, params) => translate(getTrayLocale(), key, params),
      createNotification: ({ title, body }) =>
        new Notification({ title, body }),
      logger: log,
    });

    unattendedUpdate = createUnattendedUpdate({
      install: installActiveUpdate,
      // Reads the controller through the same late-bound `activeAutoUpdater`
      // the install does, because this is built before it exists.
      isInstallerReady: () => Boolean(activeAutoUpdater?.isReadyToInstall()),
      isPlayingAudio: isDspHostPlaying,
      isWindowOnScreen: () => isWindowOnScreen(getMainWindow()),
      rememberRestart: () =>
        rememberUnattendedRestart(unattendedRestartMarkerPath, appVersion()),
      logger: log,
    });

    activeAutoUpdater = await setUpReleaseAutoUpdates({
      executablePath: process.execPath,
      isPackaged: app.isPackaged,
      platform: process.platform,
      publisherName: process.env.FLUIDEQ_SIGN_PUBLISHER || '',
      updateUrl: process.env.FLUIDEQ_UPDATE_URL || '',
      logger: log,
      beforeQuit: beginQuit,
      // Only fires for checks started from the tray. The periodic ones stay
      // silent when they find nothing, which is most of the time.
      onManualCheckResult: (result, version) =>
        nativeUpdatePrompt?.notifyManualCheckResult(result, version),
      loadUpdater: () =>
        // eslint-disable-next-line global-require -- loaded only once updates are switched on, never on a build that has none
        require('electron-updater').autoUpdater as NsisUpdater,
      sendStatus: (payload) => {
        // The native surfaces first — a user with the window hidden into the
        // tray must see something regardless of whether the renderer is alive.
        nativeUpdatePrompt?.handleStatus(payload);
        const mainWindow = getMainWindow();
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send(APP_UPDATE_EVENT, payload);
        }
        // Last, and only once the badge and the banner are up: if this attempt
        // installs, the app is gone within the call, and the surfaces above
        // are what a user who is looking sees instead.
        if (payload.phase === 'ready') {
          applyUpdateIfUnattended('the download finishing');
        }
      },
    });

    // The tray asks before it offers anything. An updater that failed its
    // Authenticode or feed check leaves this false, and the menu then shows
    // only Open and Quit rather than an item whose click goes nowhere.
    setTrayUpdatesEnabled(Boolean(activeAutoUpdater), { getMainWindow });
    // No events are wired here: the ones that check for updates are wired with
    // the window, and ask for `activeAutoUpdater` when they fire
    // (`comeBackSignals.ts`).
  };

  return {
    getActiveAutoUpdater: () => activeAutoUpdater,
    setActiveAutoUpdater: (next) => {
      activeAutoUpdater = next;
    },
    installActiveUpdate,
    applyUpdateIfUnattended,
    setUpAutoUpdates,
  };
};

export default createAppUpdates;
