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
 * The titlebar's transport, for whatever is playing on the machine.
 *
 * Not a remote control for the Video tab. Windows has no API that asks "the
 * thing currently making sound" to skip a track, but every player that has ever
 * shipped on the platform — Spotify, a browser tab, VLC, and the app's own
 * embedded player — listens for the three virtual keys a keyboard's media row
 * sends. Pressing one of those is therefore the only transport command that
 * reaches all of them at once, and it works on players that were not running
 * when FluidEQ started.
 *
 * The other half of that trade is that nothing comes back. There is no way to
 * ask who acted on the key, or whether anything is playing at all, short of the
 * WinRT session manager — which is a native module this app does not have. So
 * this file only ever sends, and the button it belongs to is a command rather
 * than a state.
 */

import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { POWERSHELL_PATH } from './powershell';

const execFileAsync = promisify(execFile);

/** The three commands the titlebar can send, and the only three. */
export const MEDIA_TRANSPORT_ACTIONS = [
  'previous',
  'playPause',
  'next',
] as const;

export type TMediaTransportAction = (typeof MEDIA_TRANSPORT_ACTIONS)[number];

/**
 * Action name to Windows virtual key, and the only place the codes appear.
 *
 * A `Map` rather than an object literal, because the lookup below is fed a
 * string that arrived from a window. An object would answer `'constructor'`
 * with a function and `'toString'` with a method — inherited members are
 * reachable through a plain index — and the caller would then be holding
 * something that is not a key code at all. A `Map` has no prototype to fall
 * through to, so a name that is not one of these three has no answer.
 */
const MEDIA_VIRTUAL_KEYS = new Map<string, number>([
  ['previous', 0xb1], // VK_MEDIA_PREV_TRACK
  ['playPause', 0xb3], // VK_MEDIA_PLAY_PAUSE
  ['next', 0xb0], // VK_MEDIA_NEXT_TRACK
]);

/**
 * The key code for an action name, or nothing at all.
 *
 * The whole boundary in one function. What crosses IPC is a name, never a code,
 * so the renderer cannot ask for a keystroke this file does not already know
 * how to send — a compromised window gets to choose between three buttons, not
 * to synthesise input into whatever has focus. Anything unrecognised comes back
 * undefined and the caller sends nothing.
 */
export const getMediaVirtualKey = (action: unknown): number | undefined =>
  typeof action === 'string' ? MEDIA_VIRTUAL_KEYS.get(action) : undefined;

/**
 * The script, in the packaged app or in the checkout.
 *
 * Same two candidates in the same order as the audio device script beside it:
 * `extraResources` copies `assets/**` into `resources/assets`, and a
 * development run has no `resourcesPath` worth reading.
 */
const getMediaKeyScriptPath = () => {
  const scriptPath = path.join(
    process.resourcesPath,
    'assets',
    'windows-media-keys.ps1',
  );
  const developmentScriptPath = path.join(
    __dirname,
    '../../assets/windows-media-keys.ps1',
  );
  return fs.existsSync(scriptPath) ? scriptPath : developmentScriptPath;
};

/**
 * Press one media key, system-wide.
 *
 * Silent about everything. A transport button has nothing useful to report —
 * "no player responded" is indistinguishable from "the player responded and
 * there was nothing queued" — and the answer to a press that did nothing is to
 * press it again, not to read a dialog. Failing loudly here would also mean a
 * modal over the equalizer because PowerShell was slow.
 *
 * The wait is real, though: `Add-Type` compiles the P/Invoke wrapper on every
 * run, so a press costs the better part of a second before the key lands. That
 * is the price of not shipping a native module for three buttons.
 */
export const sendMediaTransportKey = async (action: unknown): Promise<void> => {
  // Windows only, and quietly so. The renderer does not draw these buttons
  // anywhere else — see App.tsx — and this is the same rule enforced where it
  // cannot be got round: the key codes are Windows' and nothing else has an
  // equivalent to fall back on.
  if (process.platform !== 'win32') {
    return;
  }

  const virtualKey = getMediaVirtualKey(action);
  if (virtualKey === undefined) {
    return;
  }

  try {
    await execFileAsync(
      // By absolute path, never `'powershell.exe'` — see the comment on the
      // constant for what a bare name resolves to.
      POWERSHELL_PATH,
      [
        '-NoLogo',
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        getMediaKeyScriptPath(),
        // The code is one of the three literals in the table above, chosen by
        // name. Nothing from the renderer is interpolated into the script or
        // into this argument list, and `execFile` passes arguments to the
        // process rather than through a shell, so there is no command line for
        // anything to be smuggled into either.
        '-VirtualKey',
        String(virtualKey),
      ],
      { windowsHide: true, timeout: 10000 },
    );
  } catch {
    // See above: a key that did not land is not worth interrupting anybody for.
  }
};
