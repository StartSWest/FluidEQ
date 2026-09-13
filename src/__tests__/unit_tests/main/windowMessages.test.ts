/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { ipcMain, type IpcMainEvent } from 'electron';
import { ErrorCode } from 'common/errors';
import onWindowMessage from 'main/ipc/windowMessages';
import {
  sendRequest,
  setterResponseHandler,
  simpleResponseHandler,
} from 'renderer/utils/ipcRequest';

// Electron's own emitter class stands in for ipcMain: listeners registered on
// it are what every message is delivered to.
jest.mock('electron', () => {
  const { EventEmitter } =
    jest.requireActual<typeof import('events')>('events');
  return { ipcMain: new EventEmitter() };
});

type TReply = [channel: string, ...args: unknown[]];

/** An event as Electron builds one per message: `reply` answers the sender. */
const windowEvent = () => {
  const replies: TReply[] = [];
  const event = {
    reply: (channel: string, ...args: unknown[]) => {
      replies.push([channel, ...args]);
    },
  } as unknown as IpcMainEvent;
  return { event, replies };
};

afterEach(() => {
  ipcMain.removeAllListeners();
});

describe('a message from a window', () => {
  it('hands the request id back after the payload of every reply to it', () => {
    onWindowMessage('set-thing', (event: IpcMainEvent, args: unknown[]) => {
      event.reply('set-thing', { result: args[0] });
      // A reply channel of the handler's own choosing is still that request's.
      event.reply(`set-thing${String(args[0])}`, { result: undefined });
    });
    const { event, replies } = windowEvent();

    ipcMain.emit('set-thing', event, ['band'], 41);

    expect(replies).toEqual([
      ['set-thing', { result: 'band' }, 41],
      ['set-thingband', { result: undefined }, 41],
    ]);
  });

  it('leaves the replies to a message that carries no request id as they were', () => {
    onWindowMessage('get-thing', (event: IpcMainEvent) => {
      event.reply('get-thing', { result: 3 });
    });
    const { event, replies } = windowEvent();

    ipcMain.emit('get-thing', event, []);

    expect(replies).toEqual([['get-thing', { result: 3 }]]);
  });

  // Positive and negative together: only a positive safe integer is an id, so
  // whatever else a message happens to carry in that position is left alone.
  it.each([['a string'], [0], [-4], [1.5], [Number.MAX_SAFE_INTEGER + 2]])(
    'does not take %p for a request id',
    (notAnId) => {
      onWindowMessage('odd-thing', (event: IpcMainEvent) => {
        event.reply('odd-thing', { result: true });
      });
      const { event, replies } = windowEvent();

      ipcMain.emit('odd-thing', event, [], notAnId);

      expect(replies).toEqual([['odd-thing', { result: true }]]);
    },
  );

  it('hands the handler every argument the window sent', () => {
    const received: unknown[][] = [];
    onWindowMessage(
      'port-thing',
      (_event: IpcMainEvent, ...args: unknown[]) => {
        received.push(args);
      },
    );

    ipcMain.emit('port-thing', windowEvent().event, ['a'], 7, 'extra');

    expect(received).toEqual([[['a'], 7, 'extra']]);
  });

  it('stops listening through the function it returns, and only through it', () => {
    const handler = jest.fn();
    const stop = onWindowMessage('closing-thing', handler);

    // What Electron holds is the wrapper, so removing the handler by itself
    // removes nothing — the reason the returned function exists.
    ipcMain.removeListener('closing-thing', handler);
    expect(ipcMain.listenerCount('closing-thing')).toBe(1);

    stop();
    ipcMain.emit('closing-thing', windowEvent().event, [], 3);
    expect(ipcMain.listenerCount('closing-thing')).toBe(0);
    expect(handler).not.toHaveBeenCalled();
  });

  it('gives back whatever the handler returns, so its work can be waited on', async () => {
    let finished = false;
    onWindowMessage('slow-thing', async () => {
      await Promise.resolve();
      finished = true;
    });
    const [registered] = ipcMain.listeners('slow-thing');

    await registered(windowEvent().event, [], 5);

    expect(finished).toBe(true);
  });

  it('hands the id back once when two handlers listen on the same channel', () => {
    onWindowMessage('shared-thing', () => undefined);
    onWindowMessage('shared-thing', (event: IpcMainEvent) => {
      event.reply('shared-thing', { result: 1 });
    });
    const { event, replies } = windowEvent();

    ipcMain.emit('shared-thing', event, [], 9);

    expect(replies).toEqual([['shared-thing', { result: 1 }, 9]]);
  });
});

/**
 * Both halves of the wire together: the window's requests over a bridge that
 * delivers like Electron — asynchronously, to every listener on the channel —
 * into handlers registered the way every main-process handler is.
 */
describe('requests and replies end to end', () => {
  const rendererListeners = new Map<
    string,
    Set<(...args: unknown[]) => void>
  >();

  beforeEach(() => {
    rendererListeners.clear();
    Object.defineProperty(window, 'electron', {
      configurable: true,
      writable: true,
      value: {
        ipcRenderer: {
          sendMessage: (
            channel: string,
            args: unknown[],
            requestId?: number,
          ) => {
            const event = {
              reply: (replyChannel: string, ...replyArgs: unknown[]) => {
                queueMicrotask(() =>
                  [...(rendererListeners.get(replyChannel) ?? [])].forEach(
                    (listener) => listener(...replyArgs),
                  ),
                );
              },
            };
            const sent: unknown[] =
              requestId === undefined ? [args] : [args, requestId];
            queueMicrotask(() => ipcMain.emit(channel, event, ...sent));
          },
          on: (channel: string, listener: (...args: unknown[]) => void) => {
            const onChannel = rendererListeners.get(channel) ?? new Set();
            onChannel.add(listener);
            rendererListeners.set(channel, onChannel);
            return () => onChannel.delete(listener);
          },
        },
      },
    });
  });

  it('gives overlapping requests on one channel each their own outcome, whichever main finishes first', async () => {
    const finish = new Map<number, () => void>();
    onWindowMessage('write-gain', (event: IpcMainEvent, args: unknown[]) => {
      const gain = Number(args[0]);
      finish.set(gain, () =>
        event.reply(
          'write-gain',
          gain < 0
            ? { errorCode: ErrorCode.INVALID_PARAMETER }
            : { result: undefined },
        ),
      );
    });

    const refused = sendRequest('write-gain', [-1], setterResponseHandler).then(
      () => 'resolved',
      (error: { code?: unknown }) => error.code,
    );
    const accepted = sendRequest('write-gain', [1], setterResponseHandler).then(
      () => 'resolved',
      (error: { code?: unknown }) => error.code,
    );
    // Wait on both requests having reached main, not on any duration.
    await new Promise<void>((resolve) => {
      queueMicrotask(resolve);
    });
    expect([...finish.keys()].sort()).toEqual([-1, 1]);

    finish.get(1)?.();
    finish.get(-1)?.();

    expect(await accepted).toBe('resolved');
    expect(await refused).toBe(ErrorCode.INVALID_PARAMETER);
    expect(rendererListeners.get('write-gain')?.size ?? 0).toBe(0);
  });

  it('still answers a request whose handler replies on a channel of its own', async () => {
    onWindowMessage('read-band', (event: IpcMainEvent, args: unknown[]) => {
      event.reply(`read-band${String(args[0])}`, { result: 'peak' });
    });

    await expect(
      sendRequest('read-band', ['low'], simpleResponseHandler<string>(), {
        replyChannel: 'read-bandlow',
      }),
    ).resolves.toBe('peak');
  });
});
