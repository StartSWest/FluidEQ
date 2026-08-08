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

import ChannelEnum from 'common/channels';
import { PRODUCT_NAME } from 'common/branding';

/**
 * Get a renderer failure into the log file.
 *
 * Until this existed, nothing in the window ever wrote to that file. Everything
 * the bug reporter attached came from the main process, so a report about the
 * part of the app the user actually looks at arrived describing everything
 * except it — a failed preset load, a chart that threw, a promise nobody
 * caught, all of it went to a devtools console no user has open.
 *
 * Fire and forget. There is no reply and nothing waits for one: a logger that
 * can fail is a logger that needs its own error handling, and this is the thing
 * error handling calls.
 *
 * The redaction happens in the main process rather than here, on purpose. It is
 * one rule in one place, applied to everything that reaches the file, so a new
 * caller cannot forget it.
 */
export const reportError = (context: string, error: unknown) => {
  const detail =
    error instanceof Error
      ? `${error.name}: ${error.message}\n${error.stack ?? ''}`
      : String(error);

  // eslint-disable-next-line no-console
  console.error(`${PRODUCT_NAME}: ${context}`, error);

  try {
    window.electron.ipcRenderer.sendMessage(ChannelEnum.LOG_ERROR, [
      context,
      detail,
    ]);
  } catch {
    // The preload is missing, which is the one failure this cannot report.
    // The console line above has already happened.
  }
};

/** The same, for something worth recording that is not a failure. */
export const reportInfo = (message: string) => {
  try {
    window.electron.ipcRenderer.sendMessage(ChannelEnum.LOG_INFO, [message]);
  } catch {
    // See above.
  }
};

/**
 * Catch what nobody caught.
 *
 * Two holes that the React error boundary cannot cover, because neither happens
 * during a render:
 *
 *  - `error` — a throw from an event handler, a timer, an animation frame. The
 *    graph redraws on a frame loop and the meter runs on a timer, so this is
 *    the likelier of the two by some distance.
 *  - `unhandledrejection` — an await nobody wrapped. Every IPC call in this app
 *    returns a promise that rejects on failure, so a missing `catch` anywhere
 *    lands here.
 *
 * Neither is prevented — the console keeps its message and devtools keeps its
 * red line. This only makes sure a copy reaches the file, which is the whole
 * difference between a bug report that says what happened and one that says the
 * app "stopped working".
 */
export const installGlobalErrorHandlers = () => {
  window.addEventListener('error', (event) => {
    // A failed <img> or stylesheet fires this too, with no `error` on it, and
    // that is not worth a line in the log.
    if (!event.error && !event.message) {
      return;
    }
    reportError(
      `Uncaught error at ${event.filename ?? 'unknown'}:${event.lineno ?? 0}`,
      event.error ?? event.message,
    );
  });

  window.addEventListener('unhandledrejection', (event) => {
    reportError('Unhandled promise rejection', event.reason);
  });
};
