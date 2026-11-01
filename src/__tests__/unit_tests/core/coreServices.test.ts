/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The core's sound services (`core/process/coreServices.ts`), whichever
 * process hosts them: the window's port gets every block once the sound is
 * heard, failed or lost when it cannot be, and lets go when the window does;
 * one hearing feeds the port, the clocks and the desktop together, and stops
 * when the last of them stops listening.
 */
import { EventEmitter } from 'events';
import { createCoreServices, type ICorePort } from 'core/process/coreServices';
import type {
  ISystemSoundBlock,
  ISystemSoundHandlers,
  ISystemSoundSource,
} from 'core/systemSound/systemSound';

class FakePort extends EventEmitter {
  postMessage = jest.fn();

  start = jest.fn();

  close = jest.fn();
}

const BLOCK: ISystemSoundBlock = {
  sampleRate: 48_000,
  channels: 2,
  frames: 480,
  sequence: 5,
  pcm: new Float32Array(960).buffer,
};

/** A source the test drives: its handlers, and whether its run was stopped. */
const fakeSource = () => {
  let handlers: ISystemSoundHandlers | undefined;
  const stop = jest.fn();
  const source: ISystemSoundSource = {
    start: jest.fn((given: ISystemSoundHandlers) => {
      handlers = given;
      return { stop };
    }),
  };
  return {
    source,
    stop,
    heard: () => {
      if (!handlers) {
        throw new Error('nothing is listening');
      }
      return handlers;
    },
  };
};

const log = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };

const servicesWith = (source: ISystemSoundSource | undefined) =>
  createCoreServices({
    source,
    log,
    applyTrim: jest.fn(async () => true),
  });

const attach = (
  services: ReturnType<typeof servicesWith>,
  port = new FakePort(),
) => {
  const gone = jest.fn();
  services.attachWindowPort(port as unknown as ICorePort, gone);
  return { port, gone };
};

beforeEach(() => jest.clearAllMocks());

describe('the window’s port', () => {
  it('passes on the sound once it is heard, block by block', () => {
    const sound = fakeSource();
    const { port } = attach(servicesWith(sound.source));
    expect(port.start).toHaveBeenCalled();
    sound.heard().ready();
    sound.heard().audio(BLOCK);
    expect(port.postMessage.mock.calls).toEqual([
      [{ kind: 'ready' }],
      [{ kind: 'push', ...BLOCK }],
    ]);
  });

  it('says failed when the sound was never heard, lost once it was', () => {
    const never = fakeSource();
    const first = attach(servicesWith(never.source));
    never.heard().ended('failed');
    expect(first.port.postMessage).toHaveBeenLastCalledWith({ kind: 'failed' });
    expect(first.port.close).toHaveBeenCalled();
    expect(first.gone).toHaveBeenCalledTimes(1);

    const heard = fakeSource();
    const second = attach(servicesWith(heard.source));
    heard.heard().ready();
    heard.heard().ended('failed');
    expect(second.port.postMessage).toHaveBeenLastCalledWith({ kind: 'lost' });
  });

  it('stops hearing when the window closes its end, and is gone once', () => {
    const sound = fakeSource();
    const { port, gone } = attach(servicesWith(sound.source));
    port.emit('close');
    port.emit('close');
    expect(sound.stop).toHaveBeenCalledTimes(1);
    expect(gone).toHaveBeenCalledTimes(1);
  });

  it('fails at once where nothing can hear the output', () => {
    const { port, gone } = attach(servicesWith(undefined));
    expect(port.postMessage).toHaveBeenCalledWith({ kind: 'failed' });
    expect(port.close).toHaveBeenCalled();
    expect(gone).toHaveBeenCalledTimes(1);
  });

  it('lets go of the sound when a delivery throws', () => {
    const sound = fakeSource();
    const { port, gone } = attach(servicesWith(sound.source));
    port.postMessage.mockImplementation(() => {
      throw new Error('port closed');
    });
    sound.heard().ready();
    expect(sound.stop).toHaveBeenCalledTimes(1);
    expect(port.close).toHaveBeenCalled();
    expect(gone).toHaveBeenCalledTimes(1);
    expect(log.error).toHaveBeenCalled();
  });
});

describe('one hearing for everybody', () => {
  it('feeds the port, a clock and the desktop from one run, and stops with the last', () => {
    const sound = fakeSource();
    const services = servicesWith(sound.source);
    const onStep = jest.fn();
    const clock = services.clock({
      secondsPerStep: 0.01,
      onStep,
      onLost: jest.fn(),
    });
    const { port } = attach(services);
    clock.follow(true);
    services.desktop.want(true);
    expect(sound.source.start).toHaveBeenCalledTimes(1);

    sound.heard().ready();
    sound.heard().audio(BLOCK);
    expect(onStep).toHaveBeenCalledTimes(1);
    expect(port.postMessage).toHaveBeenLastCalledWith({
      kind: 'push',
      ...BLOCK,
    });

    port.emit('close');
    clock.follow(false);
    expect(sound.stop).not.toHaveBeenCalled();
    services.desktop.want(false);
    expect(sound.stop).toHaveBeenCalledTimes(1);
  });
});
