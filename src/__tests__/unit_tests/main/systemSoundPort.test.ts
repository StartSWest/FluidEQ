/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The window's door to what the core hears: one port per capture it opens,
 * from its own top frame only, and the port's end is the window letting go.
 * Anything else that reaches the channel — a frame inside the window, another
 * window, a message carrying more than one port — gets nothing and keeps the
 * output asleep.
 */
import { EventEmitter } from 'events';
import type { BrowserWindow, IpcMainEvent } from 'electron';
import { SYSTEM_SOUND_PORT_CHANNEL } from 'common/systemSound';
import type {
  ISystemSound,
  ISystemSoundListener,
} from 'core/systemSound/systemSound';
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

const setUp = (listen: ISystemSound['listen'] = jest.fn(() => jest.fn())) => {
  const systemSound = { listen: jest.fn(listen) };
  registerSystemSoundPort(() => window, systemSound);
  const [[channel, receive]] = (onWindowMessage as jest.Mock).mock.calls;
  expect(channel).toBe(SYSTEM_SOUND_PORT_CHANNEL);
  const send = (event: Partial<IpcMainEvent>) =>
    (receive as (event: IpcMainEvent) => void)(event as IpcMainEvent);
  return { systemSound, send };
};

const fromWindow = (ports: FakePort[]) => ({
  sender: webContents as unknown as IpcMainEvent['sender'],
  senderFrame: mainFrame as unknown as IpcMainEvent['senderFrame'],
  ports: ports as unknown as IpcMainEvent['ports'],
});

/** The listener main handed the core for the port it was just sent. */
const heldListener = (systemSound: { listen: jest.Mock }) =>
  systemSound.listen.mock.calls[0][0] as ISystemSoundListener;

beforeEach(() => {
  (onWindowMessage as jest.Mock).mockClear();
});

describe('the window’s port to the core’s sound', () => {
  it('turns away any port not sent by the window’s own top frame', () => {
    const { systemSound, send } = setUp();
    const fromSubFrame = new FakePort();
    const fromElsewhere = new FakePort();
    const twoAtOnce = [new FakePort(), new FakePort()];

    send({ ...fromWindow([fromSubFrame]), senderFrame: {} as never });
    send({ ...fromWindow([fromElsewhere]), sender: {} as never });
    send(fromWindow(twoAtOnce));

    expect(systemSound.listen).not.toHaveBeenCalled();
    [fromSubFrame, fromElsewhere, ...twoAtOnce].forEach((port) =>
      expect(port.close).toHaveBeenCalled(),
    );
  });

  it('passes on the sound once it is heard, block by block', () => {
    const { systemSound, send } = setUp();
    const port = new FakePort();
    send(fromWindow([port]));
    expect(port.start).toHaveBeenCalled();

    const listener = heldListener(systemSound);
    listener.ready();
    const pcm = new Float32Array(4).buffer;
    listener.audio({
      sampleRate: 48_000,
      channels: 2,
      frames: 2,
      sequence: 5,
      pcm,
    });

    expect(port.postMessage.mock.calls).toEqual([
      [{ kind: 'ready' }],
      [
        {
          kind: 'push',
          sampleRate: 48_000,
          channels: 2,
          frames: 2,
          sequence: 5,
          pcm,
        },
      ],
    ]);
  });

  it('says failed when the sound was never heard, lost once it was', () => {
    const neverHeard = setUp();
    const first = new FakePort();
    neverHeard.send(fromWindow([first]));
    heldListener(neverHeard.systemSound).lost();
    expect(first.postMessage).toHaveBeenLastCalledWith({ kind: 'failed' });
    expect(first.close).toHaveBeenCalled();

    (onWindowMessage as jest.Mock).mockClear();
    const heard = setUp();
    const second = new FakePort();
    heard.send(fromWindow([second]));
    const listener = heldListener(heard.systemSound);
    listener.ready();
    listener.lost();
    expect(second.postMessage).toHaveBeenLastCalledWith({ kind: 'lost' });
    expect(second.close).toHaveBeenCalled();
  });

  it('stops listening when the window closes its end', () => {
    const stop = jest.fn();
    const { send } = setUp(() => stop);
    const port = new FakePort();
    send(fromWindow([port]));

    port.emit('close');
    expect(stop).toHaveBeenCalledTimes(1);
    port.emit('close');
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it('stops what it asked for when the core answers lost inside the ask', () => {
    const stop = jest.fn();
    const { send } = setUp((listener) => {
      listener.lost();
      return stop;
    });
    const port = new FakePort();
    send(fromWindow([port]));

    expect(port.postMessage).toHaveBeenCalledWith({ kind: 'failed' });
    expect(port.close).toHaveBeenCalled();
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it('lets go of the sound when a delivery throws', () => {
    const stop = jest.fn();
    const { systemSound, send } = setUp(() => stop);
    const port = new FakePort();
    send(fromWindow([port]));
    port.postMessage.mockImplementation(() => {
      throw new Error('port closed');
    });

    heldListener(systemSound).ready();
    expect(stop).toHaveBeenCalledTimes(1);
    expect(port.close).toHaveBeenCalled();
  });
});
