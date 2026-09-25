/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import fs from 'fs';
import path from 'path';

/** The two files, by name, in the folder being watched. */
export const TRACE_START_FILE = 'trace.start';
export const TRACE_STOP_FILE = 'trace.stop';

export interface ITraceSentinelActions {
  /** Starts the recording, or stops one already running. */
  start: () => Promise<void>;
  stop: () => Promise<void>;
  /** A start or a stop still in flight, which would refuse another. */
  isBusy: () => boolean;
  log: (line: string) => void;
}

/**
 * The memory trace, started and stopped by dropping a file next to the log.
 * Development only (`main.ts` decides).
 *
 * A keyboard shortcut was the obvious way and it does not survive contact with
 * this app. `before-input-event` never fires while focus is inside the video
 * guest, which is one of the two places worth measuring; and on Windows
 * Ctrl+Alt is AltGr, so the key reported for Ctrl+Alt+M is not `m` on every
 * layout. A global shortcut would work and would take the combination away
 * from every other application on the machine, for a developer diagnostic.
 *
 * A sentinel file has none of those problems, works no matter where focus is,
 * and can be driven from a shell — which matters, because the person timing
 * the recording is usually not the person driving the window.
 *
 * Noticed by watching the folder, never by looking in it on a clock: it used
 * to be checked every second. The folder saying a name in it changed is the
 * event, and a file dropped before the watch began is looked for once as it
 * starts.
 *
 * Returns what stops the watch.
 */
const watchTraceSentinels = (
  folder: string,
  actions: ITraceSentinelActions,
): (() => void) => {
  const startFile = path.join(folder, TRACE_START_FILE);
  const stopFile = path.join(folder, TRACE_STOP_FILE);

  // Consumed rather than merely read, so one file is one recording and a
  // sentinel left behind cannot start the trace again.
  const consume = (file: string) => {
    try {
      fs.rmSync(file);
      return true;
    } catch {
      // Not there, which is the ordinary answer, or not removable; either way
      // no sentinel was taken, and a throw here would be inside a watcher.
      return false;
    }
  };
  // Not while a start or a stop is in flight: it would refuse this one and
  // the file would be gone with nothing done. The one in flight looks again
  // when it lands, which is the event that makes this one possible.
  const check = () => {
    if (actions.isBusy()) {
      return;
    }
    if (consume(startFile)) {
      actions.start().finally(check);
      return;
    }
    if (consume(stopFile)) {
      actions.stop().finally(check);
    }
  };

  let watcher: fs.FSWatcher | undefined;
  try {
    fs.mkdirSync(folder, { recursive: true });
    watcher = fs.watch(folder, { persistent: false }, (_event, fileName) => {
      const name = fileName?.toString();
      // No name is a platform that could not say which; look for both.
      if (!name || name === TRACE_START_FILE || name === TRACE_STOP_FILE) {
        check();
      }
    });
    watcher.on('error', (error) => {
      actions.log(`[trace] stopped watching ${folder}: ${error.message}`);
      watcher?.close();
      watcher = undefined;
    });
  } catch (error) {
    actions.log(
      `[trace] cannot watch ${folder}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  check();
  actions.log(
    `[trace] drop ${TRACE_START_FILE} / ${TRACE_STOP_FILE} in ${folder}`,
  );

  return () => {
    watcher?.close();
    watcher = undefined;
  };
};

export default watchTraceSentinels;
