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

/* eslint import/prefer-default-export: off */
import path from 'path';

/**
 * Windows PowerShell, named by where it actually is.
 *
 * NEVER `'powershell.exe'`. libuv resolves a bare program name by searching the
 * CURRENT DIRECTORY before it looks at PATH, and an Electron app started from a
 * shortcut inherits that shortcut's working directory — which for a normal
 * install is the app's own program directory. Anything that can write a file
 * called `powershell.exe` next to FluidEQ.exe therefore gets every one of these
 * calls, running as whoever launched the app, with arguments this app chose and
 * a name in the log that says PowerShell.
 *
 * `%SystemRoot%` and not a literal `C:\Windows`: Windows is not always on C:,
 * and a hard-coded drive would break the feature on the machines that moved it
 * rather than protect them.
 *
 * The 32-bit path is the right one under WOW64 too — `v1.0` is the folder name
 * for every version of Windows PowerShell, 5.1 included; it is not a version to
 * bump.
 */
export const POWERSHELL_PATH = path.join(
  process.env.SystemRoot || 'C:\\Windows',
  'System32',
  'WindowsPowerShell',
  'v1.0',
  'powershell.exe',
);
