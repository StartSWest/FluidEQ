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

import { app, ipcMain } from 'electron';
import { sendMediaTransportKey } from '../mediaKeys';
import {
  getSystemMediaCover,
  ISystemMediaSnapshot,
  pauseOtherSystemPlayers,
  sendSystemMediaCommand,
  stopWatchingSystemMedia,
  watchSystemMedia,
} from '../systemMedia';

export interface ISystemMediaIpcDeps {
  /**
   * Every reading of what the machine plays, before the window hears of it:
   * the FluidEQ Engine's live leveling names the song from it
   * (`songProgramme.ts`).
   */
  onMedia: (snapshot: ISystemMediaSnapshot | undefined) => Promise<void>;
}

/** What the rest of the machine is playing, and its transport. */
const registerSystemMediaIpc = ({ onMedia }: ISystemMediaIpcDeps) => {
  /**
   * The titlebar's transport buttons, pressed on behalf of the whole machine.
   *
   * Takes a name and nothing else. The renderer never says which key to press
   * — see `mediaKeys`, where the three names are turned into the only three
   * codes this app will send, and an unrecognised name is dropped without a
   * word.
   *
   * Returns nothing on purpose. Windows gives no answer to a media key, so
   * there is nothing honest to hand back and nothing for the window to wait
   * on.
   */
  ipcMain.handle('media-transport', async (_event, action: unknown) => {
    await sendMediaTransportKey(action);
  });

  /**
   * The picture for the cover id a reading carried, or nothing once the song
   * has moved on. The id is checked by shape before it is used as a key, since
   * it came back from the window.
   */
  ipcMain.handle('system-media-cover', (_event, id: unknown) =>
    typeof id === 'string' && /^[0-9a-f]{16}$/.test(id)
      ? getSystemMediaCover(id)
      : undefined,
  );

  /**
   * Watch what the rest of the machine is playing, or stop watching.
   *
   * Asked for by the window and only while it has nothing of its own on the
   * bar: this app equalises whatever the device outputs, so "nothing is
   * playing" was wrong every time the sound was coming from a browser tab. The
   * watcher is a PowerShell child — see `systemMedia` for why — and one that
   * is not needed is one that should not be running.
   */
  ipcMain.handle('system-media-watch', (event, enabled: unknown) => {
    if (enabled !== true) {
      stopWatchingSystemMedia();
      return;
    }
    watchSystemMedia((snapshot) => {
      onMedia(snapshot).catch(() => undefined);
      if (!event.sender.isDestroyed()) {
        event.sender.send('system-media-changed', snapshot);
      }
    });
  });

  /**
   * Skip, seek, stop, or pause whatever the machine is playing.
   *
   * The renderer names a command and, for a seek, where to go. The
   * name is checked here rather than trusted: everything else on this path
   * ends up inside a PowerShell script, and a name from a window that reached
   * it would be a window writing PowerShell.
   */
  ipcMain.handle(
    'system-media-command',
    async (_event, command: unknown, positionMs: unknown) => {
      if (
        command !== 'next' &&
        command !== 'previous' &&
        command !== 'seek' &&
        command !== 'stop' &&
        command !== 'pause'
      ) {
        return;
      }
      await sendSystemMediaCommand(
        command,
        typeof positionMs === 'number' && Number.isFinite(positionMs)
          ? positionMs
          : undefined,
      );
    },
  );

  /**
   * Quieten every program that is playing, sparing the one named.
   *
   * One player at a time, whoever the players are: two of somebody else's —
   * Spotify and a Netflix tab — with the one that just started spared, or all
   * of them when this app has taken the sound itself. The window decides,
   * because whether the rule is on at all is its switch ("Plays in two
   * places"); this only carries it out.
   *
   * A name is bounded here and never put inside a script: it is an app id that
   * came from Windows, went to a window, and came back, and text from a window
   * that reached a PowerShell script would be a window writing PowerShell.
   */
  ipcMain.handle(
    'system-media-pause-others',
    async (_event, exceptApp: unknown) => {
      if (
        exceptApp !== undefined &&
        (typeof exceptApp !== 'string' || exceptApp.length > 256)
      ) {
        return;
      }
      await pauseOtherSystemPlayers(exceptApp ?? '');
    },
  );

  // The child outlives nothing. A window that has gone cannot be told what is
  // playing, and a PowerShell left running after the app closed is a process
  // somebody finds in Task Manager with this app's name on it.
  app.on('will-quit', stopWatchingSystemMedia);
};

export default registerSystemMediaIpc;
