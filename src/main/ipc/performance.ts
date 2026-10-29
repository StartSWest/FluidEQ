/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { app, type BrowserWindow } from 'electron';
import log from 'electron-log';
import ChannelEnum from '../../common/channels';
import { createPerformanceLog, type TProcessReading } from '../performanceLog';
import onWindowMessage from './windowMessages';

/**
 * What the window says is on screen: the page and the look on the graph, in
 * the app's own ids. Checked word by word, because it is written into a log
 * that goes into public bug reports.
 */
const SCREEN = /^[A-Za-z0-9 ._:-]{1,80}$/;

type TWindowState = 'shown' | 'minimized' | 'hidden';

let writeReport: (() => void) | undefined;

/**
 * Writes what each thing on screen has cost since the last report into the
 * app log, which the bug report about to be gathered collects from. Nothing
 * before the log is registered.
 */
export const writePerformanceReport = () => writeReport?.();

export const registerPerformanceLog = ({
  getMainWindow,
  listProcesses,
}: {
  getMainWindow: () => BrowserWindow | null;
  listProcesses: () => readonly TProcessReading[];
}) => {
  const performanceLog = createPerformanceLog(() => performance.now());
  let page = 'starting';
  let windowState: TWindowState = 'shown';
  const screen = () =>
    windowState === 'shown' ? page : `${page}, window ${windowState}`;
  const show = () => performanceLog.show(listProcesses(), screen());

  // Put away, the window should cost next to nothing; a line saying it did
  // not is the line a slow machine's report needs most.
  const watched = new WeakSet<BrowserWindow>();
  const watchWindow = () => {
    const window = getMainWindow();
    if (!window || window.isDestroyed() || watched.has(window)) {
      return;
    }
    watched.add(window);
    const becomes = (state: TWindowState) => () => {
      if (windowState !== state) {
        windowState = state;
        show();
      }
    };
    window.on('minimize', becomes('minimized'));
    window.on('restore', becomes('shown'));
    window.on('hide', becomes('hidden'));
    window.on('show', becomes('shown'));
  };

  onWindowMessage(ChannelEnum.PERFORMANCE_CONTEXT, (_event, args) => {
    const [next] = Array.isArray(args) ? args : [];
    watchWindow();
    if (typeof next === 'string' && SCREEN.test(next) && next !== page) {
      page = next;
      show();
    }
  });

  writeReport = () => {
    performanceLog.report(listProcesses()).forEach((line) => log.info(line));
  };
  // A slow session's numbers outlive it: a report sent after a restart
  // collects them from the log like any other line since the last report.
  app.on('before-quit', writePerformanceReport);
};
