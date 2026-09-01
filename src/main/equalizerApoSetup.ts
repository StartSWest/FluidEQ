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
 * Running the Equalizer APO installer that ships inside ours.
 *
 * FluidEQ writes Equalizer APO's configuration; APO is what processes the
 * audio. Without it the app opens onto an equaliser that cannot equalise
 * anything, so a copy of its installer travels with ours and this is what runs
 * it.
 *
 * It used to open SourceForge in a browser. That is a download page, a mirror
 * list and a file somebody then has to find again — three chances to give up,
 * at the exact moment the app is least able to explain itself.
 *
 * Equalizer APO is GPL-2.0-or-later, copyright Jonas Thedering; the bundled
 * installer is unmodified and its licence sits in resources/licenses. See
 * .erb/scripts/fetch-equalizer-apo.ts for how it gets here and README.md for
 * the source-availability obligation that comes with shipping it.
 */

import fs from 'fs';
import path from 'path';
import { app, shell } from 'electron';
import { APO_BUNDLE_MISSING } from '../common/constants';

/** Where the bundled installer lands, next to the app's other resources. */
export const getEqualizerApoSetupPath = (): string =>
  path.join(
    // Packaged, electron-builder puts it under resources/; in development it
    // is wherever the fetch script left it.
    app.isPackaged ? process.resourcesPath : path.join(__dirname, '../../..'),
    app.isPackaged ? '' : 'vendor',
    'equalizer-apo',
    'equalizer-apo-setup.exe',
  );

/**
 * Launch it, and do not wait.
 *
 * Unwaited on purpose. APO's installer wants to be talked to — it asks which
 * audio devices to attach to, and then asks to restart the machine — so it
 * takes minutes, and holding the main process on it would freeze FluidEQ
 * behind a window it does not own. The app stays usable, and the health check
 * picks up the result whenever the user comes back to it.
 *
 * `shell.openPath`, NOT `spawn`.
 *
 * This is the same mistake the installer made, in a second place, and it fails
 * the same way. APO's installer is manifested `requireAdministrator`, and
 * FluidEQ runs unelevated. `spawn` goes through CreateProcess — even with
 * `shell: true`, which only inserts a `cmd.exe /c` that calls CreateProcess
 * itself — and CreateProcess cannot elevate. It fails immediately with
 * ERROR_ELEVATION_REQUIRED (740), which surfaces as a bare EACCES if anything
 * is listening and as nothing at all if not: the button appears to work and
 * no installer ever opens.
 *
 * `shell.openPath` goes through ShellExecute, which reads the manifest and
 * raises the UAC prompt. It is the only route from here that can.
 */
export const runEqualizerApoSetup = async (): Promise<void> => {
  const setup = getEqualizerApoSetupPath();
  if (!fs.existsSync(setup)) {
    throw new Error(APO_BUNDLE_MISSING);
  }
  // Resolves to '' on success, or to a message describing why not. Declining
  // the elevation prompt lands here too, which is correct: from FluidEQ's side
  // "you said no" and "it would not start" have the same consequence.
  const failure = await shell.openPath(setup);
  if (failure) {
    throw new Error(failure);
  }
};
