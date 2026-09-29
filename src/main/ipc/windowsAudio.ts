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

import { ipcMain } from 'electron';
import { execFile } from 'child_process';
import fs from 'fs';
import type { IAudioRestartOutcome } from '../../common/audioEngine';
import { getEngineSetupPath, runEngineSetup } from '../engineSetup';
import { POWERSHELL_PATH } from '../powershell';

/** Restarting Windows audio, which the trouble cards offer. */
const registerWindowsAudioIpc = () => {
  ipcMain.handle(
    'restart-windows-audio',
    async (): Promise<IAudioRestartOutcome> => {
      if (process.platform !== 'win32') {
        return { ok: false, declined: false };
      }

      // The engine helper when it is there: it restarts AudioEndpointBuilder as
      // well as Audiosrv, which a changed effect list needs before Windows
      // reads it again, and it stops a vendor service that depends on Audiosrv
      // first (Realtek's blocked the plain stop with error 1051 on the first
      // machine). The PowerShell restart below restarts Audiosrv alone and
      // remains only for a build with no helper beside it — a source checkout
      // without a native build.
      if (fs.existsSync(getEngineSetupPath())) {
        const result = await runEngineSetup('restart-audio', []);
        return {
          ok: result.ok,
          declined: result.declined,
          ...(!result.ok && !result.declined && result.error
            ? { detail: result.error }
            : {}),
        };
      }

      const restartCommand = Buffer.from(
        'Restart-Service -Name Audiosrv -Force',
        'utf16le',
      ).toString('base64');
      const elevateCommand = [
        // `$PSHOME` and not `'powershell.exe'`, for the reason the constant
        // below is used instead of a bare name: `Start-Process -Verb RunAs`
        // goes through ShellExecute, which searches the working directory
        // first — and the working directory here is inherited from the app,
        // which a shortcut sets to the install directory. A `powershell.exe`
        // dropped there would be the one the user is asked to approve for
        // administrator rights.
        //
        // `Join-Path` and not a quoted `"$PSHOME\powershell.exe"`: this whole
        // string is one `-Command` argument, and a double quote inside one has
        // to survive libuv escaping it and then PowerShell re-reading the raw
        // command line. That round trip is the classic way an elevation prompt
        // starts failing for no visible reason, so there are no double quotes
        // here at all.
        "$process = Start-Process -FilePath (Join-Path $PSHOME 'powershell.exe')",
        '-Verb RunAs -WindowStyle Hidden',
        `-ArgumentList '-NoProfile','-EncodedCommand','${restartCommand}'`,
        '-Wait -PassThru;',
        'exit $process.ExitCode',
      ].join(' ');

      return new Promise<IAudioRestartOutcome>((resolve) => {
        execFile(
          // Absolute, because a bare `'powershell.exe'` is resolved by libuv
          // against the CURRENT DIRECTORY before PATH — and a shortcut-launched
          // Electron app has its install directory as the current directory.
          // This particular call then asks Windows to elevate whatever it
          // found.
          POWERSHELL_PATH,
          [
            '-NoProfile',
            '-ExecutionPolicy',
            'Bypass',
            '-Command',
            elevateCommand,
          ],
          { windowsHide: true },
          (error) => {
            // PowerShell exits the same way for a declined prompt and a failed
            // restart, so there is no telling them apart here; the card says
            // only that it did not work.
            resolve({ ok: !error, declined: false });
          },
        );
      });
    },
  );
};

export default registerWindowsAudioIpc;
