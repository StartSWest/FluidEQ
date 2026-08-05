/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>

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

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { app } from 'electron';

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

export const hasBundledEqualizerApo = (): boolean => {
  try {
    return fs.existsSync(getEqualizerApoSetupPath());
  } catch {
    return false;
  }
};

/**
 * Launch it, and do not wait.
 *
 * Detached and unwaited on purpose. APO's installer wants to be talked to —
 * it asks which audio devices to attach to, and then asks to restart the
 * machine — so it takes minutes, and holding the main process on it would
 * freeze FluidEQ behind a window it does not own. The app stays usable, and
 * the health check picks up the result whenever the user comes back to it.
 *
 * Windows will raise its own elevation prompt: APO installs into the audio
 * stack and its installer is marked as requiring administrator. Nothing here
 * needs to ask for that, and nothing here should try.
 */
export const runEqualizerApoSetup = (): void => {
  const setup = getEqualizerApoSetupPath();
  if (!fs.existsSync(setup)) {
    throw new Error(
      'The bundled Equalizer APO installer is missing from this build.',
    );
  }
  const child = spawn(setup, [], {
    detached: true,
    stdio: 'ignore',
    // Through the shell so Windows applies the installer's own manifest and
    // shows the elevation prompt, rather than failing with a bare EACCES.
    shell: true,
  });
  child.unref();
};
