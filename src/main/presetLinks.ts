/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { app, ipcMain, type BrowserWindow } from 'electron';
import log from 'electron-log';
import {
  PRESET_LINK_ARRIVED,
  PRESET_LINK_TAKE,
} from '../common/presetLinkChannels';
import { sharedPresetIdOfAppLink } from '../common/presetShare/sharedPresetLink';

/**
 * `fluideq://preset/<id>`: a shared preset, opened from its page on
 * fluideq.com (`https://fluideq.com/p/<id>`).
 *
 * The link carries the preset's eight-character id and nothing else (Ivan,
 * 2026-11-20: "no hacker or virus can hack this or inject things"). The whole
 * address must be exactly `fluideq://preset/` and eight letters or digits: no
 * other host, no more path, no query, no fragment, nothing percent-encoded,
 * no unicode look-alike. Anything else that names `fluideq://preset` is
 * dropped with a line in the log, before a URL parser has had a chance to
 * normalise it into something that would pass.
 *
 * The window then asks main for that id's preset (`ipc/sharedPresetLinks.ts`),
 * which fetches it from FluidEQ's server over HTTPS — never from the page —
 * and reads it with the strict decoder a pasted code goes through. All it
 * can do is put up "Add this preset?": nothing is saved or played until the
 * listener presses Add there, so a page that opens a link on its own costs a
 * card, nothing more.
 *
 * A link can arrive before the window is there to ask — FluidEQ started by
 * the link itself — so the last one waits here until the window takes it.
 */

const NAMES_PRESET_LINK = /^fluideq:\/*preset/i;

/** The id a whole `fluideq://preset/<id>` address carries; undefined otherwise. */
export const presetLinkIdOf = (value: string): string | undefined =>
  sharedPresetIdOfAppLink(value);

/**
 * The preset link among a launch's arguments, as Windows passes it. Another
 * argument that names a preset link but is not exactly one is logged and
 * left alone.
 */
export const presetLinkInArgs = (
  argv: readonly string[],
): string | undefined => {
  let found: string | undefined;
  argv.forEach((arg) => {
    const id = presetLinkIdOf(arg);
    if (id) {
      found ??= id;
    } else if (NAMES_PRESET_LINK.test(arg)) {
      log.warn(
        `A preset link that is not exactly fluideq://preset/<id> was dropped: ${JSON.stringify(
          arg.slice(0, 80),
        )}`,
      );
    }
  });
  return found;
};

type TWindowOf = () => BrowserWindow | null | undefined;

let waiting: string | undefined;
let windowOf: TWindowOf = () => undefined;

/**
 * A preset link arrived: kept for the window, the window brought forward and
 * told, if it is up. The window takes it from here either way, so a link
 * told to a window still loading is not lost, and a second link replaces the
 * first rather than queueing behind it.
 */
export const receivePresetLink = (id: string): void => {
  waiting = id;
  const target = windowOf();
  if (target && !target.isDestroyed()) {
    if (target.isMinimized()) {
      target.restore();
    }
    target.show();
    target.focus();
    target.webContents.send(PRESET_LINK_ARRIVED);
  }
};

/**
 * Before `ready`, beside `registerAppLinks`: macOS hands a link that starts
 * FluidEQ to it as an event, and Windows as an argument of this launch. Then
 * answers the window's ask for the link that waits, once.
 */
export const registerPresetLinks = (getMainWindow: TWindowOf): void => {
  windowOf = getMainWindow;
  app.on('open-url', (event, url) => {
    if (!NAMES_PRESET_LINK.test(url)) {
      return;
    }
    event.preventDefault();
    const id = presetLinkInArgs([url]);
    if (id) {
      receivePresetLink(id);
    }
  });
  const launched = presetLinkInArgs(process.argv);
  if (launched) {
    receivePresetLink(launched);
  }
  ipcMain.handle(PRESET_LINK_TAKE, () => {
    const id = waiting;
    waiting = undefined;
    return id;
  });
};
