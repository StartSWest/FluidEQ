/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The window's door to what the core hears: main checks who sent the port —
 * the window's own top frame, one port — and hands it to the core whole.
 * Anything else that reaches the channel — a frame inside the window, another
 * window, a message carrying more than one port — is closed and reaches no
 * core. What the core then does with the port is the core's own test
 * (`core/coreServices.test.ts`).
 */
import { EventEmitter } from 'events';
import type { BrowserWindow, IpcMainEvent } from 'electron';
import { SYSTEM_SOUND_PORT_CHANNEL } from 'common/systemSound';
import registerSystemSoundPort from 'main/ipc/systemSoundPort';
import onWindowMessage from 'main/ipc/windowMessages';

jest.mock('main/ipc/windowMessages', () => ({
  __esModule: true,
  default: jest.fn(() => () => undefined),
}));

class FakePort extends EventEmitter {
  postMessage = jest.fn();

  start = jest.fn();

  close = jest.fn();
}

const mainFrame = {};
const webContents = { mainFrame };
const window = { webContents } as unknown as BrowserWindow;

const setUp = () => {
  (onWindowMessage as jest.Mock).mockClear();
  const attach = jest.fn();
  registerSystemSoundPort(() => window, attach);
  const [[channel, receive]] = (onWindowMessage as jest.Mock).mock.calls;
  expect(channel).toBe(SYSTEM_SOUND_PORT_CHANNEL);
  const send = (event: Partial<IpcMainEvent>) =>
    (receive as (event: IpcMainEvent) => void)(event as IpcMainEvent);
  return { attach, send };
};

const fromWindow = (ports: FakePort[]) => ({
  sender: webContents as unknown as IpcMainEvent['sender'],
  senderFrame: mainFrame as unknown as IpcMainEvent['senderFrame'],
  ports: ports as unknown as IpcMainEvent['ports'],
});

describe('the window’s port to the core’s sound', () => {
  it('turns away any port not sent by the window’s own top frame', () => {
    const { attach, send } = setUp();
    const fromSubFrame = new FakePort();
    const fromElsewhere = new FakePort();
    const twoAtOnce = [new FakePort(), new FakePort()];

    send({ ...fromWindow([fromSubFrame]), senderFrame: {} as never });
    send({ ...fromWindow([fromElsewhere]), sender: {} as never });
    send(fromWindow(twoAtOnce));

    expect(attach).not.toHaveBeenCalled();
    [fromSubFrame, fromElsewhere, ...twoAtOnce].forEach((port) =>
      expect(port.close).toHaveBeenCalled(),
    );
  });

  it('hands the window’s own port to the core, unopened', () => {
    const { attach, send } = setUp();
    const port = new FakePort();
    send(fromWindow([port]));
    expect(attach).toHaveBeenCalledWith(port);
    expect(port.close).not.toHaveBeenCalled();
  });
});
