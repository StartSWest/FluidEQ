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

/**
 * Apply a downloaded update without anybody being asked to do anything.
 *
 * The installer already runs silently — no language dialog, no licence page,
 * no progress window with a button on it. What was left was the click that
 * starts it: an update sat there advertising itself from the tray until
 * somebody chose "restart now", which for an app that lives in the
 * notification area for weeks means it sat there for weeks.
 *
 * So the update installs itself instead. The only thing that holds it back is
 * whether the restart would be felt:
 *
 *   - The window is on screen. Making a window the user is looking at
 *     disappear and come back is not an improvement on a wizard.
 *   - FluidEQ is playing something. The host keeps playing with the window
 *     hidden into the tray, so "hidden" is not "idle" — the audio state has to
 *     be asked about separately or the update cuts a song off mid-bar.
 *
 * Neither is a permanent refusal. `applyIfUnattended` is called again from
 * every event that means one of those just stopped being true, so the update
 * lands the moment the app is out of the way rather than at some arbitrary
 * moment chosen by a clock. THERE IS NO TIMER HERE ON PURPOSE — a deferred
 * install that fires on a countdown is the same interruption, just later and
 * with worse aim.
 */

import fs from 'fs';

/**
 * The file that survives the restart.
 *
 * An unattended install quits the process, so nothing in memory reaches the
 * copy that comes back — and that copy has to know it was not started by a
 * person, or it opens a window (and the What's New dialog on top of it) in
 * front of somebody who put FluidEQ away thirty seconds earlier. Hiding the
 * window is the entire difference between an update that goes unnoticed and
 * one that interrupts twice.
 */
interface IUnattendedRestartMarker {
  /**
   * The version being LEFT, written before the installer runs.
   *
   * Compared against the running version on the way back, and only a real
   * change is honoured. This is what makes the marker safe: an install that
   * failed, or a marker orphaned by a crash, reads as "same version" and the
   * window opens normally. Without the test, one failed install would leave
   * FluidEQ starting with no window forever — which from the outside is
   * indistinguishable from it not starting at all.
   */
  replacedVersion: string;
}

export const rememberUnattendedRestart = (
  markerPath: string,
  versionBeingReplaced: string,
): void => {
  const marker: IUnattendedRestartMarker = {
    replacedVersion: versionBeingReplaced,
  };
  try {
    fs.writeFileSync(markerPath, JSON.stringify(marker), 'utf8');
  } catch {
    // A marker that could not be written costs a visible window, not an
    // update. Never worth failing the install for.
  }
};

/**
 * Did this launch come from an update the app applied to itself? Answering
 * also clears the marker, so the next ordinary start is an ordinary start.
 */
export const consumeUnattendedRestart = (
  markerPath: string,
  runningVersion: string,
): boolean => {
  let raw: string;
  try {
    raw = fs.readFileSync(markerPath, 'utf8');
  } catch {
    return false;
  }
  try {
    fs.rmSync(markerPath, { force: true });
  } catch {
    // Cleared on the next attempt, or never — the version test below is what
    // stops a stale marker from mattering.
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      typeof (parsed as IUnattendedRestartMarker).replacedVersion !== 'string'
    ) {
      return false;
    }
    return (
      (parsed as IUnattendedRestartMarker).replacedVersion !== runningVersion
    );
  } catch {
    return false;
  }
};

export interface IUnattendedUpdateDeps {
  /**
   * Run the verified installer and quit. The same call the tray item, the
   * toast and the in-window banner make, so a restart started by nobody and a
   * restart started by a click go through one path.
   */
  install: () => void;
  /**
   * Write the marker that tells the copy coming back to stay in the tray.
   * Only this path sets it: a restart somebody asked for should put the window
   * where they can see it finished.
   */
  rememberRestart: () => void;
  /** Is there a downloaded installer that passed release-channel verification? */
  isInstallerReady: () => boolean;
  /** Is the host pushing audio at a device right now? */
  isPlayingAudio: () => boolean;
  /** Is the main window actually in front of the user? */
  isWindowOnScreen: () => boolean;
  logger?: { info(message: string, ...args: unknown[]): void };
}

export interface IUnattendedUpdate {
  /**
   * Install now if nothing would be interrupted by it. Answers whether the
   * install was started, so a caller can stop offering what has just happened.
   *
   * `reason` names the event that prompted the attempt and goes to the log —
   * an app that restarted itself owes an explanation of when and why.
   */
  applyIfUnattended(reason: string): boolean;
}

export const createUnattendedUpdate = (
  deps: IUnattendedUpdateDeps,
): IUnattendedUpdate => {
  const {
    install,
    isInstallerReady,
    isPlayingAudio,
    isWindowOnScreen,
    logger,
    rememberRestart,
  } = deps;

  /**
   * One attempt, ever.
   *
   * A successful install ends the process, so a second call can only mean the
   * first one failed to start — and nothing about hiding a window again makes
   * a refused installer launch. Without the latch, every hide, minimise and
   * screen lock after a failure would retry it and raise another "could not
   * install" toast, which is a notification storm caused entirely by trying to
   * be helpful. The tray item, the toast and the banner all still work; a
   * person asking for it by hand is a different question from the app deciding
   * on its own.
   *
   * It also makes the double-fire harmless: hiding a window can emit `hide`
   * and `minimize` together, and both would otherwise write the restart marker
   * and call install.
   */
  let hasAttempted = false;

  return {
    applyIfUnattended(reason: string) {
      if (hasAttempted || !isInstallerReady()) {
        return false;
      }
      if (isWindowOnScreen()) {
        // Not logged. The window being open is the ordinary state of an app
        // somebody is using, and every focus and hide event would write a
        // line about it.
        return false;
      }
      if (isPlayingAudio()) {
        logger?.info(
          `Update install held back on ${reason}: FluidEQ is playing.`,
        );
        return false;
      }
      logger?.info(`Installing the downloaded update on ${reason}.`);
      hasAttempted = true;
      // Before the install, because the install ends this process.
      rememberRestart();
      install();
      return true;
    },
  };
};
