/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  app,
  ipcMain,
  shell,
  type BrowserWindow,
  type WebContents,
} from 'electron';
import { existsSync } from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import {
  LIGHTING_FRAME_CHANNEL,
  LIGHTING_OPEN_RAZER_CHROMA_CHANNEL,
  LIGHTING_OPEN_WINDOWS_SETTINGS_CHANNEL,
  LIGHTING_RELEASE_CHANNEL,
  LIGHTING_SETTINGS_CHANNEL,
  LIGHTING_STATE_CHANGED_CHANNEL,
  LIGHTING_STATE_CHANNEL,
  LIGHTING_WATCH_CHANNEL,
} from '../../common/lighting/lightingModel';
import {
  createLightingService,
  type ILightingService,
} from '../lighting/lightingService';
import onWindowMessage from './windowMessages';

export interface ILightingIpcDeps {
  userDataDir: string;
  appVersion: string;
  getMainWindow: () => BrowserWindow | null;
  /** Asked on every frame, never remembered. */
  entitled: () => boolean;
}

/**
 * Razer Chroma's own launcher, where Razer installs it. The Start menu entry
 * runs this same command; there is no documented protocol for Synapse.
 */
export const razerAppEngine = (): string | undefined => {
  const programFiles = process.env.ProgramFiles;
  if (!programFiles) {
    return undefined;
  }
  const candidate = path.join(
    programFiles,
    'Razer',
    'RazerAppEngine',
    'RazerAppEngine.exe',
  );
  return existsSync(candidate) ? candidate : undefined;
};

/**
 * Dynamic lighting's channels. Frames and releases arrive fire-and-forget:
 * thirty a second, with nothing to answer. The window's state is pushed on
 * change, and read once when the page mounts.
 */
export const registerLightingIpc = (
  deps: ILightingIpcDeps,
): ILightingService => {
  const service = createLightingService({
    userDataDir: deps.userDataDir,
    appVersion: deps.appVersion,
    supported: process.platform === 'win32',
    entitled: deps.entitled,
    canOpenRazerChroma: () => razerAppEngine() !== undefined,
    push: (state) => {
      const window = deps.getMainWindow();
      // Renderer teardown can publish release before its window is destroyed.
      if (
        window &&
        !window.isDestroyed() &&
        !window.webContents.isDestroyed()
      ) {
        window.webContents.send(LIGHTING_STATE_CHANGED_CHANNEL, state);
      }
    },
  });

  // The window whose frames and open page the service is counting. A reload,
  // a crashed renderer or a closed window ends both without a word from the
  // page — nothing unmounts to send "page closed" or "release" — so the
  // lamps and the helper would stay held by a window that no longer exists.
  // Its own events say so instead. Hooked once per window, so a window
  // reloaded many times does not collect a listener per reload.
  let owner: WebContents | undefined;
  const hooked = new WeakSet<WebContents>();
  const leave = (sender: WebContents) => {
    if (owner !== sender) {
      return;
    }
    owner = undefined;
    service.windowGone();
  };
  const fromOwner = (sender: WebContents): boolean => {
    const window = deps.getMainWindow();
    if (!window || window.isDestroyed() || sender !== window.webContents) {
      return false;
    }
    owner = sender;
    if (!hooked.has(sender)) {
      hooked.add(sender);
      sender.on('render-process-gone', () => leave(sender));
      sender.on('did-start-navigation', (_event, _url, inPlace, mainFrame) => {
        if (mainFrame && !inPlace) {
          leave(sender);
        }
      });
      sender.once('destroyed', () => leave(sender));
    }
    return true;
  };

  onWindowMessage(LIGHTING_FRAME_CHANNEL, (event, frame: unknown) => {
    if (fromOwner(event.sender)) {
      service.frame(frame);
    }
  });
  onWindowMessage(LIGHTING_RELEASE_CHANNEL, (event) => {
    if (fromOwner(event.sender)) {
      service.release();
    }
  });
  onWindowMessage(LIGHTING_WATCH_CHANNEL, (event, open: unknown) => {
    if (typeof open === 'boolean' && fromOwner(event.sender)) {
      service.watch(open);
    }
  });
  // Razer Chroma started or stopped, or Developer Mode turned on, while FluidEQ
  // was behind: the member coming back to the window is when the notice about
  // it should be right.
  app.on('browser-window-focus', (_event, window) => {
    if (window === deps.getMainWindow()) {
      service.windowFocused();
    }
  });
  ipcMain.handle(LIGHTING_STATE_CHANNEL, () => service.state());
  ipcMain.handle(LIGHTING_SETTINGS_CHANNEL, (_event, raw: unknown) =>
    service.setSettings(raw),
  );
  // Fixed addresses, never one the window sends: Windows' own Dynamic
  // Lighting page, where FluidEQ is listed under background light control, or
  // its developer page, where Developer Mode lets an unsigned copy be listed.
  // Anything else the window names opens the lighting page.
  ipcMain.handle(
    LIGHTING_OPEN_WINDOWS_SETTINGS_CHANNEL,
    (_event, page: unknown) =>
      shell.openExternal(
        page === 'developers'
          ? 'ms-settings:developers'
          : 'ms-settings:personalization-lighting',
      ),
  );
  ipcMain.handle(LIGHTING_OPEN_RAZER_CHROMA_CHANNEL, () => {
    const launcher = razerAppEngine();
    if (!launcher) {
      return false;
    }
    const child = spawn(launcher, ['--url-params=apps=chroma-app'], {
      detached: true,
      stdio: 'ignore',
    });
    child.on('error', (error) =>
      console.error(
        `Razer Chroma could not be opened from ${launcher}:`,
        error,
      ),
    );
    child.unref();
    return true;
  });

  return service;
};
