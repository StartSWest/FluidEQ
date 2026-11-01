/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The core's ear on the Mac (`core/platform/macos/monitorTapSource.ts`): the
 * Mac helper's tap as a source — ready once the tap is open, its blocks
 * passed on, a tap that stops by itself ended once, and nothing at all after
 * the core said stop, the tap included.
 */
import {
  createMacMonitorSource,
  type TStartMacMonitor,
} from 'core/platform/macos/monitorTapSource';
import type {
  ISystemSoundBlock,
  ISystemSoundHandlers,
} from 'core/systemSound/systemSound';

const BLOCK: ISystemSoundBlock = {
  sampleRate: 48_000,
  channels: 2,
  frames: 480,
  sequence: 7,
  pcm: new Float32Array(960).buffer,
};

/** A tap that opens when the test says, and the hands it was given. */
const fakeTap = () => {
  let opened: (tap: { close(): Promise<void> }) => void = () => undefined;
  let refused: (error: Error) => void = () => undefined;
  const close = jest.fn(async () => undefined);
  let audio: (block: ISystemSoundBlock) => void = () => undefined;
  let failure: () => void = () => undefined;
  const start: TStartMacMonitor = (onAudio, onFailure) => {
    audio = onAudio;
    failure = onFailure;
    return new Promise((resolve, reject) => {
      opened = resolve;
      refused = reject;
    });
  };
  return {
    start: jest.fn(start),
    close,
    open: async () => {
      opened({ close });
      await Promise.resolve();
      await Promise.resolve();
    },
    refuse: async (reason: Error) => {
      refused(reason);
      await Promise.resolve();
      await Promise.resolve();
    },
    hear: (block: ISystemSoundBlock) => audio(block),
    fail: () => failure(),
  };
};

const handlers = () => ({
  ready: jest.fn(),
  audio: jest.fn(),
  ended: jest.fn(),
});

const log = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };

const started = () => {
  const tap = fakeTap();
  const told = handlers();
  const run = createMacMonitorSource(tap.start, log).start(
    told as ISystemSoundHandlers,
  );
  return { tap, told, run };
};

beforeEach(() => jest.clearAllMocks());

it('is ready once the tap is open, and passes its blocks on', async () => {
  const { tap, told } = started();
  expect(told.ready).not.toHaveBeenCalled();
  await tap.open();
  expect(told.ready).toHaveBeenCalledTimes(1);
  tap.hear({ ...BLOCK, peerId: 'mac-loopback' } as ISystemSoundBlock);
  expect(told.audio).toHaveBeenCalledWith(BLOCK);
});

it('closes the tap when the core stops, and says nothing after', async () => {
  const { tap, told, run } = started();
  await tap.open();
  run.stop();
  expect(tap.close).toHaveBeenCalledTimes(1);
  tap.hear(BLOCK);
  tap.fail();
  expect(told.audio).not.toHaveBeenCalled();
  expect(told.ended).not.toHaveBeenCalled();
});

it('closes a tap that opens after the core stopped, and is never ready', async () => {
  const { tap, told, run } = started();
  run.stop();
  await tap.open();
  expect(tap.close).toHaveBeenCalledTimes(1);
  expect(told.ready).not.toHaveBeenCalled();
});

it('ends once, as failed, when the tap stops by itself', async () => {
  const { tap, told } = started();
  await tap.open();
  tap.fail();
  tap.fail();
  expect(told.ended).toHaveBeenCalledTimes(1);
  expect(told.ended).toHaveBeenCalledWith('failed');
});

it('ends as failed, and says why, when the tap cannot open', async () => {
  const { tap, told } = started();
  await tap.refuse(new Error('no permission'));
  expect(told.ended).toHaveBeenCalledWith('failed');
  expect(told.ready).not.toHaveBeenCalled();
  expect(log.warn).toHaveBeenCalledWith(
    expect.stringContaining('no permission'),
  );
});
