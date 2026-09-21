/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Game profiles' two questions and one answer.
 *
 * The window keeps the profiles and decides what to play — it is the only
 * sender of the rack, and a decision made anywhere else would race it — so
 * main does the two things the window cannot: it reads what the launchers
 * have installed, and it says which program Windows has put in front.
 *
 * The watcher runs only while the window asks for it, and the window asks
 * only while it has a profile to match or the page is open. FluidEQ's own
 * window is never reported as a change: alt-tabbing to it to move a dial is
 * not leaving the game.
 */

import {
  BrowserWindow,
  OpenDialogOptions,
  app,
  dialog,
  ipcMain,
} from 'electron';
import path from 'path';
import log from 'electron-log';
import { IGameProgram } from '../../common/games';
import { gameIconSource, isGameFolder, scanGameLibraries } from '../gameScan';
import { createGameToasts, IGameToast } from '../gameToast';
import { createGameWatch, IGameWatch } from '../gameWatch';
import onWindowMessage from './windowMessages';

export const GAME_FOREGROUND_CHANNEL = 'game-foreground';
export const GAME_PROGRAMS_CHANNEL = 'game-programs';
export const GAME_WATCH_CHANNEL = 'game-watch';
export const GAME_CHOOSE_CHANNEL = 'game-choose';
export const GAME_TOAST_CHANNEL = 'game-toast';
export const GAME_PLAYING_CHANNEL = 'game-playing';
export const GAME_HOLD_CHANNEL = 'game-hold';
export const GAME_ENDED_CHANNEL = 'game-ended';

/** "Overwatch" from "Overwatch.exe": the name a player would have typed. */
const programName = (file: string): string =>
  path.basename(file, path.extname(file));

/**
 * Every program's own icon, as Windows draws it.
 *
 * Windows keeps these in the executable and Electron can read them, so the
 * list shows the picture a player already knows from their desktop instead of
 * forty identical gamepads. A failure is silent: the row draws a glyph.
 *
 * Bounded at the width a list is worth showing, because each one is a file
 * read and a machine with a hundred games would spend a second of them.
 */
const withIcons = async (
  programs: readonly IGameProgram[],
): Promise<IGameProgram[]> => {
  const drawn = programs.slice(0, 80);
  const icons = await Promise.all(
    drawn.map(async (one) => {
      const file = gameIconSource(one.path);
      if (!file || !app?.getFileIcon) {
        return undefined;
      }
      try {
        const image = await app.getFileIcon(file, { size: 'normal' });
        return image.isEmpty() ? undefined : image.toDataURL();
      } catch {
        return undefined;
      }
    }),
  );
  return programs.map((one, at) => {
    const icon = at < icons.length ? icons[at] : undefined;
    return icon ? { ...one, icon } : one;
  });
};

export interface IGameProgramsAnswer {
  /** What the launchers say is installed, whether or not it is running. */
  installed: IGameProgram[];
  /** What has a window right now, for anything no launcher knows about. */
  running: IGameProgram[];
}

export interface IGamesIpcDeps {
  getMainWindow: () => BrowserWindow | null;
  scan?: () => Promise<IGameProgram[]>;
  makeWatch?: (
    onFront: (program: IGameProgram) => void,
    onGone: (pid: number) => void,
  ) => IGameWatch;
  toasts?: { show: (toast: IGameToast) => void; close: () => void };
  /** Told whenever one of this listener's own games comes to the front. */
  onPlaying?: (playing: boolean) => void;
}

export const registerGamesIpc = (deps: IGamesIpcDeps): { stop: () => void } => {
  const scan = deps.scan ?? scanGameLibraries;
  const ours = app?.getPath ? app.getPath('exe').toLowerCase() : '';
  const toasts = deps.toasts ?? createGameToasts();
  // Where the last program in front was drawn, so the card lands on the
  // screen the game is on rather than on whichever one FluidEQ sits on.
  let lastRect: string | undefined;

  const toWindow = (channel: string, said: unknown) => {
    const window = deps.getMainWindow();
    if (window && !window.isDestroyed()) {
      window.webContents.send(channel, said);
    }
  };

  const watch = (deps.makeWatch ?? createGameWatch)(
    (program) => {
      // Our own window coming forward says nothing about the game behind it.
      if (ours !== '' && program.path.toLowerCase() === ours) {
        return;
      }
      lastRect = program.rect;
      toWindow(GAME_FOREGROUND_CHANNEL, program);
    },
    // The game the window was holding has ended, which is the only thing that
    // puts the sound back: losing the front is somebody alt-tabbing, not
    // somebody finishing.
    (pid) => toWindow(GAME_ENDED_CHANNEL, pid),
  );

  ipcMain.handle(
    GAME_PROGRAMS_CHANNEL,
    async (): Promise<IGameProgramsAnswer> => {
      const [installed, running] = await Promise.all([
        scan().catch((error) => {
          log.info('Game profiles: the libraries could not be read', error);
          return [] as IGameProgram[];
        }),
        watch.running(),
      ]);
      const [withInstalled, withRunning] = await Promise.all([
        withIcons(installed),
        withIcons(running),
      ]);
      return { installed: withInstalled, running: withRunning };
    },
  );

  onWindowMessage(GAME_WATCH_CHANNEL, (event, arg: unknown) => {
    if (event.sender !== deps.getMainWindow()?.webContents) {
      return;
    }
    if (Array.isArray(arg) && arg[0] === true) {
      watch.start();
    } else {
      watch.stop();
    }
  });

  /**
   * A program no launcher knows and nothing has open: the player points at
   * it. A folder counts too — a game is a folder of programs, and pointing at
   * the folder catches whichever of them the game actually runs under.
   */
  ipcMain.handle(
    GAME_CHOOSE_CHANNEL,
    async (): Promise<IGameProgram | undefined> => {
      const window = deps.getMainWindow();
      const options: OpenDialogOptions = {
        properties: ['openFile'],
        filters: [{ name: 'Programs', extensions: ['exe'] }],
      };
      const result = window
        ? await dialog.showOpenDialog(window, options)
        : await dialog.showOpenDialog(options);
      const [chosen] = result.canceled ? [] : result.filePaths;
      if (!chosen) {
        return undefined;
      }
      const folder = isGameFolder(chosen);
      return {
        name: folder ? path.basename(chosen) : programName(chosen),
        path: chosen,
        source: 'file',
      };
    },
  );

  /**
   * The window has the profiles and the chains' names, so it says what the
   * card reads; main knows where the game is, so it says where it goes.
   */
  onWindowMessage(GAME_TOAST_CHANNEL, (event, arg: unknown) => {
    if (event.sender !== deps.getMainWindow()?.webContents) {
      return;
    }
    const [said] = Array.isArray(arg) ? arg : [];
    if (
      typeof said !== 'object' ||
      said === null ||
      typeof (said as IGameToast).what !== 'string'
    ) {
      return;
    }
    const card = said as IGameToast;
    // The window's own colours travel as they were read; which of them the
    // card admits, and what counts as a colour at all, is `gameToast`'s.
    const colors =
      typeof card.colors === 'object' && card.colors !== null
        ? Object.fromEntries(
            Object.entries(card.colors).filter(
              ([, value]) => typeof value === 'string',
            ),
          )
        : undefined;
    toasts.show({
      what: card.what,
      game: typeof card.game === 'string' ? card.game : '',
      ...(typeof card.icon === 'string' ? { icon: card.icon } : {}),
      ...(colors ? { colors } : {}),
      ...(lastRect ? { rect: lastRect } : {}),
    });
  });

  /**
   * A game of this listener's own is in front, or has left it.
   *
   * Only the window can say: the profiles that decide what counts as a game
   * are the window's. Main passes it to the desktop backgrounds, which hold
   * every screen still while somebody is playing.
   */
  onWindowMessage(GAME_PLAYING_CHANNEL, (event, arg: unknown) => {
    if (event.sender !== deps.getMainWindow()?.webContents) {
      return;
    }
    deps.onPlaying?.(Array.isArray(arg) && arg[0] === true);
  });

  /**
   * The game whose sound is on, to be told the end of; 0 for none.
   *
   * Only the window can name it: which program counts as a game is the
   * profiles' answer, and those are the window's. Main passes it to the
   * watcher, which waits on that process rather than on anything timed.
   */
  onWindowMessage(GAME_HOLD_CHANNEL, (event, arg: unknown) => {
    if (event.sender !== deps.getMainWindow()?.webContents) {
      return;
    }
    const [pid] = Array.isArray(arg) ? arg : [];
    if (typeof pid === 'number' && Number.isInteger(pid) && pid >= 0) {
      watch.hold(pid);
    }
  });

  const stop = () => {
    watch.stop();
    toasts.close();
    deps.onPlaying?.(false);
  };
  app?.on?.('will-quit', stop);
  return { stop };
};

export default registerGamesIpc;
