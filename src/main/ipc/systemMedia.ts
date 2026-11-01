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

import { app, ipcMain, type BrowserWindow } from 'electron';
import {
  parseSinglePlayer,
  SINGLE_PLAYER_CHANNEL,
} from '../../common/singlePlayer';
import { sendMediaTransportKey } from '../mediaKeys';
import { createExternalPlayerRule } from '../systemMediaRule';
import onWindowMessage from './windowMessages';
import { forwardGroupMediaCommand } from '../groupMediaKeys';
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
  /** The app's window, the one whose "one player at a time" switch counts. */
  getMainWindow: () => BrowserWindow | null;
}

/** What the rest of the machine is playing, and its transport. */
const registerSystemMediaIpc = ({
  onMedia,
  getMainWindow,
}: ISystemMediaIpcDeps) => {
  const rule = createExternalPlayerRule(pauseOtherSystemPlayers);
  onWindowMessage(SINGLE_PLAYER_CHANNEL, (event, raw: unknown) => {
    const window = getMainWindow();
    const isOn = parseSinglePlayer(raw);
    if (
      isOn !== undefined &&
      window &&
      !window.isDestroyed() &&
      event.sender === window.webContents
    ) {
      rule.setSinglePlayer(isOn);
    }
  });

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
    if (
      (action === 'playPause' || action === 'next' || action === 'previous') &&
      forwardGroupMediaCommand({
        command: action === 'playPause' ? 'toggle' : action,
      })
    ) {
      return;
    }
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
   *
   * Asked off, it stops; the window going away does not stop it. A window
   * let go in the tray (`windowUnload.ts`) says nothing as it goes, and the
   * engine's song names and the rule between two other programs read this
   * watcher whether a window is there to show it or not.
   */
  ipcMain.handle('system-media-watch', (event, enabled: unknown) => {
    if (enabled !== true) {
      stopWatchingSystemMedia();
      return;
    }
    watchSystemMedia((snapshot) => {
      rule.heard(snapshot);
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
        command !== 'play' &&
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
   * Quieten every program that is playing: this app has taken the sound
   * itself. The window decides, because whether the rule is on at all is its
   * switch ("Plays in two places"), and which of its players started is its
   * to know; this only carries it out. Two programs that are both somebody
   * else's are separated above, by `rule`.
   */
  ipcMain.handle('system-media-pause-others', () =>
    pauseOtherSystemPlayers(''),
  );

  // The child outlives nothing. A window that has gone cannot be told what is
  // playing, and a PowerShell left running after the app closed is a process
  // somebody finds in Task Manager with this app's name on it.
  app.on('will-quit', stopWatchingSystemMedia);
};

export default registerSystemMediaIpc;
