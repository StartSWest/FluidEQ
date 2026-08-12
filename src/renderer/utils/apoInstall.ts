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

import {
  APO_BUNDLE_MISSING,
  EQUALIZER_APO_OFFICIAL_DOWNLOAD,
} from 'common/constants';
import { installEqualizerApo } from './equalizerApi';
import { reportError } from './logger';

/**
 * Start Equalizer APO's installer, and know which way it failed.
 *
 * One place, because there are two buttons that run it — the prerequisite
 * notice and Reinstall Equalizer APO — and they have to treat the two failures
 * differently in the same way:
 *
 *  - The bundle is genuinely missing. A broken build, nothing the user did, and
 *    the only case where sending them to the project's own download is right.
 *  - Anything else, which in practice means the permission prompt was declined.
 *    The installer is sitting in their install directory; the answer is to
 *    press the button again, not to go and fetch a copy they already have.
 *
 * The reinstall menu item only had the second half. It handed the sentinel to
 * the generic error banner, so what a user saw when the bundle was absent was
 * the literal string `apo-bundle-missing` over "Please restart the application"
 * — no download, no explanation, and nothing to act on.
 */
export type TApoInstallOutcome = 'started' | 'bundle-missing' | 'not-started';

export const startEqualizerApoInstall =
  async (): Promise<TApoInstallOutcome> => {
    try {
      await installEqualizerApo();
      return 'started';
    } catch (e) {
      // Rejections from the IPC layer are real `Error`s carrying the sentinel
      // as their message — `toError` in equalizerApi builds them that way — so
      // this reads the same for both routes.
      const isMissing = String((e as Error)?.message ?? '').includes(
        APO_BUNDLE_MISSING,
      );
      if (isMissing) {
        // The user's own click, showing the address it opens. Not a page
        // choosing where to send them.
        window.open(EQUALIZER_APO_OFFICIAL_DOWNLOAD, '_blank', 'noopener');
        reportError('Equalizer APO is not bundled in this build', e);
        return 'bundle-missing';
      }
      reportError('Equalizer APO installer did not start', e);
      return 'not-started';
    }
  };
