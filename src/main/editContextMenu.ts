/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { app, BrowserWindow, Menu, type WebContents } from 'electron';
import { inspectDetached } from './devTools';
import { editMenuTemplate } from './editMenuTemplate';
import mainText from './mainText';

/**
 * The window a page's menu opens over. A Media page is a webview guest,
 * whose own contents belong to no window; its embedder's does.
 */
const windowOf = (contents: WebContents): BrowserWindow | undefined => {
  const own = BrowserWindow.fromWebContents(contents);
  if (own) {
    return own;
  }
  const host = contents.hostWebContents;
  return host ? (BrowserWindow.fromWebContents(host) ?? undefined) : undefined;
};

/**
 * The right-click menu every text field has everywhere else (Ivan,
 * 2026-11-22: "the right-click paste and cut normal context menu for that
 * input"). Electron opens none by default, so a field could only be pasted
 * into from the keyboard.
 *
 * On a page's own `context-menu` report, which Chromium sends only when the
 * page did not draw a menu of its own: the band, curve and Library menus call
 * `preventDefault` and are never reported here. The DevTools' pages draw
 * every menu of theirs themselves and are left alone.
 */
const attach = (contents: WebContents, canInspect: boolean) => {
  contents.on('context-menu', (_event, params) => {
    if (contents.getURL().startsWith('devtools://')) {
      return;
    }
    const template = editMenuTemplate(
      params,
      {
        undo: () => contents.undo(),
        redo: () => contents.redo(),
        cut: () => contents.cut(),
        copy: () => contents.copy(),
        paste: () => contents.paste(),
        pasteAndMatchStyle: () => contents.pasteAndMatchStyle(),
        selectAll: () => contents.selectAll(),
        replaceMisspelling: (word) => contents.replaceMisspelling(word),
        inspect: canInspect
          ? () => inspectDetached(contents, params.x, params.y)
          : undefined,
      },
      mainText,
      process.platform,
    );
    if (template.length === 0) {
      return;
    }
    Menu.buildFromTemplate(template).popup({
      window: windowOf(contents),
      frame: params.frame ?? undefined,
    });
  });
};

/**
 * Every page the app opens gets the menu: the window, the Media tab's pages
 * and their sign-in popups, and whatever window comes later. Call once,
 * before the first window exists.
 *
 * `canInspect` adds the development build's Inspect element to the same
 * menu: two listeners would put two menus up for one click.
 */
const installEditContextMenus = ({
  canInspect,
}: {
  canInspect: boolean;
}): void => {
  app.on('web-contents-created', (_event, contents) => {
    attach(contents, canInspect);
  });
};

export default installEditContextMenus;
