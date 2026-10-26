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

/**
 * The first thing every PowerShell this app runs does: answer in UTF-8.
 *
 * Every reader here decodes PowerShell's output as UTF-8, and Windows
 * PowerShell 5.1 writes it in the console's code page instead — GBK (936) on
 * a Chinese system, 437 on an American one. So an output Windows names in
 * Chinese reached the window as ������ (GitHub issue 39), and the same name
 * came back as ??? here: Japanese, Korean and Cyrillic names did too, an
 * accent became �, and so did a game folder's name or the path the update
 * check is handed back. Without a byte-order mark, because Node does not
 * strip one: the first line would start with an invisible character and the
 * JSON on it would no longer parse.
 *
 * Shipped scripts carry it as their first statement after `param`
 * (`assets/*.ps1`), an inline `-Command` gets it from `utf8Command`, and
 * `powershellUtf8.test.ts` fails on any that does not.
 */
export const UTF8_OUTPUT_STATEMENT =
  '[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)';

/** An inline `-Command` script that answers in UTF-8 (`UTF8_OUTPUT_STATEMENT`). */
export const utf8Command = (script: string): string =>
  `${UTF8_OUTPUT_STATEMENT}\n${script}`;
