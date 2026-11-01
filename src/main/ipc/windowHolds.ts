/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The page's side of letting a window go in the tray (`windowUnload.ts`):
 * what it says it holds, and every way it goes without a word — a reload, a
 * crash, or its window destroyed.
 */
import type { BrowserWindow, WebContents } from 'electron';
import { parseWindowHolds, WINDOW_HOLD_CHANNEL } from '../../common/windowHold';
import type { IWindowUnload } from '../windowUnload';
import onWindowMessage from './windowMessages';

/** The app's window's page only; a webview or any other page says nothing. */
export const registerWindowHoldsIpc = (
  getMainWindow: () => BrowserWindow | null,
  windowUnload: Pick<IWindowUnload, 'pageSaid'>,
): (() => void) =>
  onWindowMessage(WINDOW_HOLD_CHANNEL, (event, raw: unknown) => {
    const window = getMainWindow();
    if (
      !window ||
      window.isDestroyed() ||
      event.sender !== window.webContents
    ) {
      return;
    }
    const [said] = Array.isArray(raw) ? raw : [];
    const holds = parseWindowHolds(said);
    if (holds) {
      windowUnload.pageSaid(holds);
    }
  });

/**
 * The page leaving, for a window's whole life. Only while it is still the
 * app's window, or nothing has replaced it: an old page's last event must not
 * erase what a new window's page has already said.
 */
export const followWindowPage = (
  window: BrowserWindow,
  page: Pick<WebContents, 'on' | 'once'>,
  getMainWindow: () => BrowserWindow | null,
  windowUnload: Pick<IWindowUnload, 'pageLeft'>,
): void => {
  const left = () => {
    const current = getMainWindow();
    if (current === null || current === window) {
      windowUnload.pageLeft();
    }
  };
  page.on('render-process-gone', left);
  page.on('did-start-navigation', (_event, _url, inPlace, mainFrame) => {
    if (mainFrame && !inPlace) {
      left();
    }
  });
  page.once('destroyed', left);
};
