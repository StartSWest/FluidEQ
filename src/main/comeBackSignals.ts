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

import type { IAuthorizedAutoUpdater } from './signedAutoUpdates';

/**
 * The events that stand in for a timer, and what each of them runs.
 *
 * See UPDATE_CHECK_STALE_AFTER_MS in signedAutoUpdates for why there is no
 * interval. The computer waking, the screen unlocking, the window being shown
 * or focused: each means "somebody is, or is about to be, at this machine",
 * which is both when an answer from a server is worth fetching and the only
 * time a change in it can be seen. `resume` and `unlock-screen` usually arrive
 * together and the window is often shown right after; each refresh collapses
 * the burst with its own staleness test or in-flight request.
 *
 * Two things ride them, on different conditions:
 *
 *   - The account and Plus (`accountComeBackSteps`): always.
 *   - Updates — a check when somebody comes back, an unattended install when
 *     the app gets out of the way: only while an updater is active, asked at
 *     the moment of the event.
 *
 * THEY USED TO BE WIRED TOGETHER, by the updater's setup and only once it had
 * a controller. Development, an unpackaged run, macOS and Linux, and every
 * packaged build whose updater failed its signature or feed check therefore
 * never refreshed the membership, the installed scenes, the block list, the
 * terms notice or the leaderboard again after launch — while the Plus terms
 * tell a member that both the membership check and the leaderboard upload
 * happen "when you come back to the computer".
 */

type TPowerEvent = 'resume' | 'unlock-screen' | 'lock-screen';
type TWindowEvent = 'show' | 'focus' | 'hide' | 'minimize';

/** The part of Electron's emitters this needs; a test passes an EventEmitter. */
export interface IEventSource<TEvent extends string> {
  on(event: TEvent, listener: () => void): unknown;
}

export interface IComeBackStep {
  /** Named in the log when the step fails. */
  name: string;
  run: (reason: string) => Promise<void>;
}

export interface IAccountRefreshers {
  entitlement: { checkIfDue(reason: string): Promise<void> };
  scenePacks: { refreshIfDue(reason: string): Promise<void> };
  memberSharing: { refreshIfDue(reason: string): Promise<void> };
  plusGallery: { refreshIfDue(): Promise<void> };
  sceneReviews: { refreshIfDue(reason: string): Promise<void> };
  plusTermsNotice: { checkIfDue(reason: string): Promise<void> };
  leaderboard: { uploadIfDue(reason: string): Promise<void> };
}

/**
 * The account and Plus refreshes, in the order they have to run.
 *
 * The membership first, because every step after it reads the answer: the
 * installed FluidEQ scenes are asked about only while it is live, the gallery
 * scenes are kept against the block list fetched just before them, and the
 * terms notice and the leaderboard upload are for members. Each step keeps its
 * own staleness test, so running the list on every event costs nothing.
 */
export const accountComeBackSteps = ({
  entitlement,
  leaderboard,
  memberSharing,
  plusGallery,
  plusTermsNotice,
  sceneReviews,
  scenePacks,
}: IAccountRefreshers): IComeBackStep[] => [
  { name: 'membership', run: (reason) => entitlement.checkIfDue(reason) },
  {
    name: 'FluidEQ scenes',
    run: (reason) => scenePacks.refreshIfDue(reason),
  },
  { name: 'block list', run: (reason) => memberSharing.refreshIfDue(reason) },
  { name: 'gallery scenes', run: () => plusGallery.refreshIfDue() },
  // The admin told a scene waits for review, a maker told it was answered.
  { name: 'scene reviews', run: (reason) => sceneReviews.refreshIfDue(reason) },
  {
    name: 'Plus terms notice',
    run: (reason) => plusTermsNotice.checkIfDue(reason),
  },
  {
    name: 'leaderboard upload',
    run: (reason) => leaderboard.uploadIfDue(reason),
  },
];

export interface IComeBackWatchDeps {
  /**
   * Electron's `powerMonitor`. Subscribed to by the first `watchWindow`, not
   * at construction: the module cannot be used before the app is ready, and a
   * main window only exists after that.
   */
  powerMonitor: IEventSource<TPowerEvent>;
  accountSteps: readonly IComeBackStep[];
  /**
   * Late-bound: the updater comes up after the window is built, and a setup
   * that fails closed takes it away again.
   */
  getActiveAutoUpdater: () =>
    Pick<IAuthorizedAutoUpdater, 'checkIfDue'> | undefined;
  /** Install a downloaded update if nobody would notice the restart. */
  applyUpdateIfUnattended: (reason: string) => void;
  logger: {
    info(message: string, ...args: unknown[]): void;
    warn(message: string, ...args: unknown[]): void;
  };
}

export interface IComeBackWatch {
  /**
   * Wire a main window's show, focus, hide and minimise; the first call also
   * wires the power monitor. A window already wired is left alone and the
   * power monitor is wired once for the life of the process, so a window
   * built again — macOS's dock re-creates one — adds only its own listeners.
   */
  watchWindow(window: IEventSource<TWindowEvent>): void;
}

export const createComeBackWatch = ({
  accountSteps,
  applyUpdateIfUnattended,
  getActiveAutoUpdater,
  logger,
  powerMonitor,
}: IComeBackWatchDeps): IComeBackWatch => {
  // One step after another, each once the last has settled. A step that
  // fails is logged and the next one still runs: the chain used to stop at
  // the first rejection with nothing said, so a block list that could not be
  // written also cost the terms notice and the upload queued behind it.
  const refreshAccount = (reason: string) =>
    accountSteps.reduce(
      (previous, step) =>
        previous
          .then(() => step.run(reason))
          .catch((error: unknown) => {
            logger.warn(
              `Refreshing the ${step.name} after ${reason} failed.`,
              error,
            );
          }),
      Promise.resolve(),
    );

  const checkForUpdatesIfDue = (reason: string) => {
    const updater = getActiveAutoUpdater();
    if (!updater) {
      return;
    }
    // Fire-and-forget: the staleness test inside the controller decides
    // whether anything actually happens.
    updater
      .checkIfDue()
      .then((ran) => {
        if (ran) {
          logger.info(`Update check ran on ${reason}`);
        }
        return ran;
      })
      .catch((error: unknown) => {
        logger.info(`Update check on ${reason} could not start`, error);
      });
  };

  const cameBack = (reason: string) => {
    checkForUpdatesIfDue(reason);
    refreshAccount(reason);
  };

  // The other half: the app getting out of the way is the moment a pending
  // update stops being in anybody's way.
  const wentAway = (reason: string) => {
    if (getActiveAutoUpdater()) {
      applyUpdateIfUnattended(reason);
    }
  };

  let isPowerMonitorWired = false;
  const watchedWindows = new WeakSet<IEventSource<TWindowEvent>>();

  return {
    watchWindow: (window) => {
      if (!isPowerMonitorWired) {
        isPowerMonitorWired = true;
        powerMonitor.on('resume', () => cameBack('wake from sleep'));
        powerMonitor.on('unlock-screen', () => cameBack('screen unlock'));
        // The screen locking means the machine has been left. Nothing there
        // is watching a restart happen, and it is the longest uninterrupted
        // stretch this app ever gets.
        powerMonitor.on('lock-screen', () => wentAway('the screen locking'));
      }
      if (watchedWindows.has(window)) {
        return;
      }
      watchedWindows.add(window);
      window.on('show', () => cameBack('window shown'));
      window.on('focus', () => cameBack('window focused'));
      // Both, because closing to the tray and minimising to the taskbar are
      // different signals for the same thing and only one of them fires.
      window.on('hide', () => wentAway('the window hiding'));
      window.on('minimize', () => wentAway('the window being minimised'));
    },
  };
};
