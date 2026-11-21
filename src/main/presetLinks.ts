/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { app, ipcMain, type BrowserWindow } from 'electron';
import {
  PRESET_LINK_ARRIVED,
  PRESET_LINK_TAKE,
} from '../common/presetLinkChannels';
import { APP_LINK_SCHEME } from './appLinks';

/**
 * `fluideq://preset/<code>`: a shared preset, opened from fluideq.com's page
 * for it (`common/presetShare/presetShareCode.ts`).
 *
 * All a page can do with one is put the window's "Add this preset?" question
 * up: nothing is saved or played until the listener presses Add there, so a
 * page that opens one on its own costs a dialog, nothing more. Main does not
 * unpack the code; it only checks that it is shaped like one and no longer
 * than the window will read, and hands it on.
 *
 * A link can arrive before the window is there to ask — FluidEQ started by
 * the link itself — so the last one waits here until the window takes it.
 */

const PRESET_LINK = /^FQP\d{1,3}\.[A-Za-z0-9_-]{8,4000}$/;

/** The share code a `fluideq://preset/…` address carries, if it is one. */
export const presetLinkCodeOf = (value: string): string | undefined => {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return undefined;
  }
  if (url.protocol !== `${APP_LINK_SCHEME}:` || url.host !== 'preset') {
    return undefined;
  }
  const code = url.pathname.replace(/^\/+/, '').replace(/\/+$/, '');
  return PRESET_LINK.test(code) ? code : undefined;
};

/** The preset link among a launch's arguments, as Windows passes it. */
export const presetLinkInArgs = (argv: readonly string[]): string | undefined =>
  argv.map(presetLinkCodeOf).find((code): code is string => code !== undefined);

type TWindowOf = () => BrowserWindow | null | undefined;

let waiting: string | undefined;
let windowOf: TWindowOf = () => undefined;

/**
 * A preset link arrived: kept for the window, and told to it if it is up.
 * The window takes it from here either way, so a link told to a window
 * still loading is not lost.
 */
export const receivePresetLink = (code: string): void => {
  waiting = code;
  const target = windowOf();
  if (target && !target.isDestroyed()) {
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
    const code = presetLinkCodeOf(url);
    if (code) {
      event.preventDefault();
      receivePresetLink(code);
    }
  });
  const launched = presetLinkInArgs(process.argv);
  if (launched) {
    receivePresetLink(launched);
  }
  ipcMain.handle(PRESET_LINK_TAKE, () => {
    const code = waiting;
    waiting = undefined;
    return code;
  });
};
