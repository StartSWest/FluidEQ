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
import type { IAppUpdateStatus } from '../common/constants';
import type { TranslateVars, TranslationKey } from '../common/i18n';
import type { ManualCheckResult } from './signedAutoUpdates';

/**
 * What tells a user, without a window on screen, that a download is ready.
 *
 * The renderer's own update banner covers the case where the window is
 * visible. FluidEQ now sits in the notification area for weeks between
 * sessions, though, so a `phase: 'ready'` that only reaches a hidden
 * `webContents` is a prompt nobody ever sees. This module owns the two things
 * that catch a hidden user: a Windows notification with the version in it, and
 * a tray marker that keeps advertising the ready state until they install.
 *
 * DELIBERATELY DOES NOT INSTALL. Handing an installer trigger to whoever
 * wires this up keeps the release-channel verification in one place — the
 * `IAuthorizedAutoUpdater` returned by signedAutoUpdates — and lets the two
 * click paths (the notification, the tray item) reuse it without duplicating
 * the "arm the quit flag, then run" sequence.
 */

/** The two Notification fields this module needs; everything else is Electron's. */
export interface INativeNotificationHandle {
  on(event: 'click', listener: () => void): void;
  show(): void;
}

export interface INativeNotificationInput {
  title: string;
  body: string;
}

export type NativeNotificationFactory = (
  input: INativeNotificationInput,
) => INativeNotificationHandle;

export interface INativeUpdatePromptDeps {
  /**
   * The main window, or null if it has been destroyed. Read on every status
   * event: a window is created, closed and re-created across a session, and
   * whether it is on screen is only meaningful the moment somebody asks.
   */
  getMainWindow: () => BrowserWindow | null;
  /**
   * Fire the same install path the tray item runs. See the module doc above
   * for why this is not built here.
   */
  installNow: () => void;
  /**
   * Push the tray's update-ready state. Called on every terminal status so
   * the tray reflects reality, not just the last "ready" it happened to see.
   */
  setTrayUpdateReady: (isReady: boolean) => void;
  /**
   * Bring the window back onto the screen.
   *
   * Used by the install-failure toast: when the tray's own install route has
   * just failed, the window is where the remaining options live — the update
   * banner, and for a mandatory release the modal with its manual-download
   * link. Sending the user somewhere they can act beats a dead-end toast.
   */
  revealWindow: () => void;
  translate: (key: TranslationKey, params?: TranslateVars) => string;
  /**
   * How to build a Windows notification. Injected so a test can observe the
   * title, the body and the click wiring without touching Electron's own
   * Notification constructor.
   */
  createNotification?: NativeNotificationFactory;
  logger?: { info(message: string, ...args: unknown[]): void };
}

export interface INativeUpdatePrompt {
  handleStatus(status: IAppUpdateStatus): void;
  /**
   * Answer a check the user started from the tray.
   *
   * Every outcome gets a toast, including "nothing to do" — the click was a
   * question and silence is not an answer to it.
   */
  notifyManualCheckResult(result: ManualCheckResult, version?: string): void;
  /**
   * Say that starting the installer failed.
   *
   * The tray badge is deliberately left up by the caller so the action can be
   * retried; this only makes the failure visible, because the alternative is
   * the primary button of the whole feature doing nothing at all.
   */
  notifyInstallFailed(): void;
}

/**
 * Whether the window is actually in front of the user.
 *
 * Not just isVisible: a minimised window on Windows still reports visible, and
 * a download that finishes while the user is looking at their browser wants to
 * be surfaced by the same notification as one that finishes while the window
 * is hidden into the tray. Anything that is not on-screen counts as
 * off-screen for this decision.
 */
const isWindowOnScreen = (window: BrowserWindow | null): boolean => {
  if (!window || window.isDestroyed()) {
    return false;
  }
  if (!window.isVisible()) {
    return false;
  }
  if (window.isMinimized()) {
    return false;
  }
  return true;
};

export const createNativeUpdatePrompt = (
  deps: INativeUpdatePromptDeps,
): INativeUpdatePrompt => {
  const {
    createNotification,
    getMainWindow,
    installNow,
    logger,
    revealWindow,
    setTrayUpdateReady,
    translate,
  } = deps;

  /**
   * Put one toast on screen, and never let it take the caller down.
   *
   * Windows refuses notifications outright under some group policies and in
   * some session types, and `new Notification` is what throws when it does.
   * A failed toast must not propagate into the updater event that raised it,
   * because that event is also what sets the tray badge — losing the badge
   * as well would remove the last visible trace of a ready update.
   */
  const raise = (
    titleKey: TranslationKey,
    body: string,
    onClick?: () => void,
  ) => {
    if (!createNotification) {
      return;
    }
    try {
      const notification = createNotification({
        title: translate(titleKey),
        body,
      });
      if (onClick) {
        notification.on('click', onClick);
      }
      notification.show();
    } catch (error) {
      logger?.info('Native update notification could not be shown', error);
    }
  };

  // Only fire the notification once per "ready" transition. Otherwise a
  // spurious re-emit from electron-updater would raise it again, and Windows
  // treats each of those as a fresh toast — a user with a hidden window would
  // get the same nudge twice in a row for no new reason.
  let hasNotifiedThisReady = false;

  const notifyReady = (version: string | undefined) => {
    raise(
      'app.notification.updateReady.title',
      version
        ? translate('app.notification.updateReady.body', { version })
        : translate('app.notification.updateReady.bodyNoVersion'),
      // Same path as the tray item; see installNow's contract above.
      () => installNow(),
    );
  };

  return {
    handleStatus(status: IAppUpdateStatus) {
      if (status.phase === 'ready') {
        setTrayUpdateReady(true);
        if (!hasNotifiedThisReady && !isWindowOnScreen(getMainWindow())) {
          hasNotifiedThisReady = true;
          notifyReady(status.version);
        }
        return;
      }
      // Any non-ready phase — a fresh available/downloading cycle, or a
      // failure — clears the tray badge so it never advertises an install
      // that no longer applies. The next "ready" is a real transition and
      // gets its own notification.
      setTrayUpdateReady(false);
      hasNotifiedThisReady = false;
    },

    notifyManualCheckResult(result: ManualCheckResult, version?: string) {
      if (result === 'up-to-date') {
        raise(
          'app.notification.upToDate.title',
          translate('app.notification.upToDate.body'),
        );
        return;
      }
      if (result === 'failed') {
        raise(
          'app.notification.checkFailed.title',
          translate('app.notification.checkFailed.body'),
        );
        return;
      }
      // 'downloading'. The only outcome with an in-window equivalent: the
      // update banner already says a version is on its way, so a toast on top
      // of a visible window would be the same sentence twice. The other two
      // outcomes have no in-window surface at all and are always announced.
      if (isWindowOnScreen(getMainWindow())) {
        return;
      }
      if (!version) {
        // electron-updater types UpdateInfo.version as a required string, so
        // this cannot happen; the guard exists because the alternative was a
        // fallback that reused the "ready, click to restart" copy for an
        // update that is neither ready nor clickable. Nothing is lost: the
        // banner and the eventual ready toast both still fire.
        return;
      }
      raise(
        'app.notification.updateFound.title',
        translate('app.notification.updateFound.body', { version }),
      );
    },

    notifyInstallFailed() {
      raise(
        'app.notification.installFailed.title',
        translate('app.notification.installFailed.body'),
        // Somewhere they can act, rather than a toast that only reports.
        () => revealWindow(),
      );
    },
  };
};
