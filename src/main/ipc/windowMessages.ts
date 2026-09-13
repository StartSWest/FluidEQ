/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { ipcMain, type IpcMainEvent } from 'electron';
import isRequestId from '../../common/ipcRequestId';

type TWindowMessageListener = Parameters<typeof ipcMain.on>[1];

/** Events whose replies already hand their request's id back. */
const answering = new WeakSet<IpcMainEvent>();

/**
 * Listen for a message from a window, so that every reply to it reaches the
 * request that sent it.
 *
 * A window waiting on a reply sends a request id as the argument after the
 * message's own, and each `event.reply` made while handling it hands that id
 * back after the payload. Handlers never see the id: they reply exactly as
 * before, often from shared helpers several calls deep, and sometimes on a
 * channel of their own choosing — a band's writes are answered on a channel
 * named after the band. Correlating the event once, here, keeps every one of
 * those replies right without any of them knowing.
 *
 * Replies used to be matched by channel alone, so the first reply on a channel
 * answered every request waiting on it: two overlapping writes were both told
 * whichever outcome main finished first, and a request that had timed out left
 * its late reply to be taken by the next one.
 *
 * Every `ipcMain.on` in the main process goes through this, and ESLint refuses
 * the direct call. A handler registered around it would reply with no id, and
 * the window, which only accepts the reply its own request is waiting for,
 * would drop the answer and time out.
 *
 * Stop listening through the function this returns. What Electron holds is the
 * wrapper, not `listener`, so `ipcMain.removeListener(channel, listener)`
 * matches nothing and silently removes nothing — ESLint refuses that too.
 */
const onWindowMessage = (
  channel: string,
  listener: TWindowMessageListener,
): (() => void) => {
  const correlated: TWindowMessageListener = (event, ...args: unknown[]) => {
    const requestId = args[1];
    // Once per event: listeners on the same channel share one event, and a
    // second wrap would hand the id back twice.
    if (isRequestId(requestId) && !answering.has(event)) {
      answering.add(event);
      const { reply } = event;
      event.reply = (replyChannel: string, payload?: unknown) =>
        reply.call(event, replyChannel, payload, requestId);
    }
    // Returned unchanged, so a handler's promise is still there for whoever
    // calls the registered function directly to wait on.
    return listener(event, ...args);
  };
  // eslint-disable-next-line no-restricted-properties -- the one registration every handler goes through
  ipcMain.on(channel, correlated);
  // eslint-disable-next-line no-restricted-properties -- removes the wrapper registered just above, which only this closure holds
  return () => ipcMain.removeListener(channel, correlated);
};

export default onWindowMessage;
