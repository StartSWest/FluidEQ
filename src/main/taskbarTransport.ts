/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import path from 'path';
import { BrowserWindow, ipcMain, nativeImage, nativeTheme } from 'electron';
import log from 'electron-log';
import allowTaskbarMessages from './taskbarMessages';
import { resolveLocale, translate } from '../common/i18n';
import {
  ITaskbarTransportState,
  isTaskbarTransportState,
  TASKBAR_TRANSPORT_ACTION,
  TASKBAR_TRANSPORT_STATE,
  TTaskbarTransportAction,
} from '../common/taskbarTransport';

const EMPTY: ITaskbarTransportState = {
  canToggle: false,
  canPrevious: false,
  canNext: false,
  isPlaying: false,
  locale: 'en',
  navigation: 'tracks',
};

/** The main window owns its toolbar and IPC for exactly its own lifetime. */
const installTaskbarTransport = (window: BrowserWindow, assetsPath: string) => {
  if (process.platform !== 'win32') {
    return;
  }
  try {
    allowTaskbarMessages(window.getNativeWindowHandle());
    log.info('Taskbar command delivery ready');
  } catch (error) {
    log.error('Could not enable taskbar command delivery', error);
  }
  let state = EMPTY;
  let applied: string | undefined;
  const icons = new Map<string, Electron.NativeImage>();
  const iconFor = (name: string, dark: boolean) => {
    const key = `${name}-${dark ? 'light' : 'dark'}`;
    let icon = icons.get(key);
    if (!icon) {
      icon = nativeImage.createFromPath(
        path.join(assetsPath, 'taskbar', `${key}.png`),
      );
      if (icon.isEmpty()) {
        throw new Error(`Missing taskbar icon: ${key}`);
      }
      icons.set(key, icon);
    }
    return icon;
  };
  const enabled = (action: TTaskbarTransportAction) => {
    if (action === 'toggle') {
      return state.canToggle;
    }
    return action === 'next' ? state.canNext : state.canPrevious;
  };
  const send = (action: TTaskbarTransportAction) => {
    if (
      !window.isDestroyed() &&
      !window.webContents.isDestroyed() &&
      enabled(action)
    ) {
      log.info('Taskbar playback command', action);
      window.webContents.send(TASKBAR_TRANSPORT_ACTION, action);
    }
  };
  const update = () => {
    if (
      window.isDestroyed() ||
      (!window.isVisible() && !window.isMinimized())
    ) {
      return;
    }
    const dark = nativeTheme.shouldUseDarkColorsForSystemIntegratedUI;
    const signature = JSON.stringify([state, dark]);
    if (applied === signature) {
      return;
    }
    const locale = resolveLocale(state.locale);
    const toggleIcon = state.isPlaying ? 'pause' : 'play';
    const buttons: Electron.ThumbarButton[] = [
      {
        action: 'previous' as const,
        icon: 'previous',
        tooltip: translate(
          locale,
          state.navigation === 'boundaries'
            ? 'karaoke.maker.jumpToStart'
            : 'library.previous',
        ),
      },
      {
        action: 'toggle' as const,
        icon: toggleIcon,
        tooltip: translate(
          locale,
          state.isPlaying ? 'library.pause' : 'library.play',
        ),
      },
      {
        action: 'next' as const,
        icon: 'next',
        tooltip: translate(
          locale,
          state.navigation === 'boundaries'
            ? 'karaoke.maker.jumpToEnd'
            : 'library.next',
        ),
      },
    ].map(({ action, icon, tooltip }) => ({
      icon: iconFor(icon, dark),
      tooltip,
      // Electron 43's native parser rejects "enabled" despite its typings.
      // No flags is the native enabled state (THBF_ENABLED = 0).
      flags: enabled(action) ? [] : ['disabled'],
      click: () => send(action),
    }));
    // Electron can refuse before the shell has created this window's taskbar
    // entry. Only cache successful writes; ready-to-show/show retry by event.
    if (window.setThumbarButtons(buttons)) {
      if (!applied) {
        log.info('Taskbar playback controls registered');
      }
      applied = signature;
    } else {
      log.warn('Windows did not accept the taskbar playback controls');
    }
  };
  const clear = () => {
    state = { ...EMPTY, locale: state.locale };
    update();
  };
  ipcMain.handle(TASKBAR_TRANSPORT_STATE, (event, value: unknown) => {
    if (
      event.sender !== window.webContents ||
      event.senderFrame !== window.webContents.mainFrame
    ) {
      return;
    }
    if (!isTaskbarTransportState(value)) {
      return;
    }
    state = {
      canToggle: value.canToggle,
      canPrevious: value.canPrevious,
      canNext: value.canNext,
      isPlaying: value.isPlaying,
      locale: resolveLocale(value.locale),
      navigation: value.navigation,
    };
    update();
  });
  window.on('ready-to-show', update);
  window.on('show', () => {
    // hide() removes the shell toolbar; unchanged playback state still needs
    // to be registered again when the window comes back from the tray.
    applied = undefined;
    update();
  });
  window.on('minimize', update);
  nativeTheme.on('updated', update);
  window.webContents.on('render-process-gone', clear);
  window.webContents.on('did-start-navigation', (event) => {
    if (event.isMainFrame && !event.isSameDocument) {
      clear();
    }
  });
  window.once('closed', () => {
    ipcMain.removeHandler(TASKBAR_TRANSPORT_STATE);
    nativeTheme.removeListener('updated', update);
  });
};

export default installTaskbarTransport;
