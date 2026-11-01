/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The core's own process (`core/process/coreProcess.ts`) as its parent port
 * sees it: ready once listening; the window's port, the desktop's frames,
 * the clocks and Auto normalize's trims each answered over the same port;
 * and nothing done for a message of the wrong shape.
 */
import { EventEmitter } from 'events';
import {
  createTrimRequests,
  nativeDirsOf,
  runCoreProcess,
  type ICoreParentPort,
} from 'core/process/coreProcess';
import type {
  ISystemSoundHandlers,
  ISystemSoundSource,
} from 'core/systemSound/systemSound';
import { createPlatformSystemSoundSource } from 'core/platform/systemSoundSource';

jest.mock('core/platform/systemSoundSource', () => ({
  createPlatformSystemSoundSource: jest.fn(),
}));

class FakePort extends EventEmitter {
  postMessage = jest.fn();

  start = jest.fn();

  close = jest.fn();
}

const BLOCK = {
  sampleRate: 48_000,
  channels: 2,
  frames: 48_000,
  sequence: 1,
  pcm: new Float32Array(96_000).buffer,
};

const start = (canHear = true) => {
  let handlers: ISystemSoundHandlers | undefined;
  const source: ISystemSoundSource = {
    start: (given) => {
      handlers = given;
      return { stop: jest.fn() };
    },
  };
  jest
    .mocked(createPlatformSystemSoundSource)
    .mockReturnValue(canHear ? source : undefined);
  const parent = new EventEmitter();
  const posted: unknown[] = [];
  const port: ICoreParentPort = {
    on: (event, listener) => parent.on(event, listener),
    postMessage: (message) => posted.push(message),
  };
  runCoreProcess(port, ['C:/native']);
  const tell = (data: unknown, ports: FakePort[] = []) =>
    parent.emit('message', { data, ports });
  return {
    posted,
    tell,
    heard: () => {
      if (!handlers) {
        throw new Error('nothing is hearing');
      }
      return handlers;
    },
  };
};

beforeEach(() => jest.clearAllMocks());

it('says it is ready once it listens, with the native folders it was given', () => {
  const { posted } = start();
  expect(posted).toEqual([{ kind: 'ready' }]);
  expect(createPlatformSystemSoundSource).toHaveBeenCalledWith(
    expect.objectContaining({ nativeDirs: ['C:/native'] }),
  );
});

it('sends the window’s blocks down the port it was handed, and says when it is gone', () => {
  const { posted, tell, heard } = start();
  const port = new FakePort();
  tell({ kind: 'port', id: 4 }, [port]);
  heard().ready();
  expect(port.postMessage).toHaveBeenCalledWith({ kind: 'ready' });
  port.emit('close');
  expect(posted).toContainEqual({ kind: 'port-gone', id: 4 });
});

it('answers a port message that brought no port as gone', () => {
  const { posted, tell } = start();
  tell({ kind: 'port', id: 2 });
  expect(posted).toContainEqual({ kind: 'port-gone', id: 2 });
});

it('answers a desktop frame by the id it was asked with', () => {
  const { posted, tell } = start();
  tell({ kind: 'desktop-want', wanted: true });
  tell({ kind: 'desktop-read', id: 9 });
  expect(posted).toContainEqual({
    kind: 'desktop-frame',
    id: 9,
    frame: expect.objectContaining({ points: expect.any(Array) }),
  });
});

it('steps a clock by the sound heard, and says when the sound is lost', () => {
  const { posted, tell, heard } = start();
  tell({ kind: 'clock-follow', id: 3, secondsPerStep: 0.5, wanted: true });
  heard().ready();
  heard().audio(BLOCK);
  expect(posted).toContainEqual({ kind: 'clock-step', id: 3 });
  heard().ended('failed');
  expect(posted).toContainEqual({ kind: 'clock-lost', id: 3 });
});

it('keeps one clock per id, so a clock told to stop stops', () => {
  const { posted, tell, heard } = start();
  tell({ kind: 'clock-follow', id: 3, secondsPerStep: 0.5, wanted: true });
  heard().ready();
  tell({ kind: 'clock-follow', id: 3, secondsPerStep: 0.5, wanted: false });
  heard().audio(BLOCK);
  expect(posted).not.toContainEqual({ kind: 'clock-step', id: 3 });
});

it('says when the desktop backgrounds go back to the window', () => {
  const { posted, tell, heard } = start();
  tell({ kind: 'desktop-want', wanted: true });
  heard().ended('failed');
  expect(posted).toContainEqual({ kind: 'desktop-serves', serves: false });
});

it('asks main to write Auto normalize’s trim', () => {
  const { posted, tell } = start();
  // A legacy programme is written back at once, which is a trim to ask for.
  tell({
    kind: 'headroom-follow',
    state: { enabled: true, trimDb: -2, hasLegacyProgramme: true },
  });
  expect(posted).toContainEqual({ kind: 'trim', id: 1, trimDb: -2 });
});

describe('a trim asked of main', () => {
  it('is settled by main’s answer to its own id, and to no other', async () => {
    const sent: unknown[] = [];
    const trims = createTrimRequests((message) => sent.push(message));
    const first = trims.request(-2);
    const second = trims.request(-4);
    expect(sent).toEqual([
      { kind: 'trim', id: 1, trimDb: -2 },
      { kind: 'trim', id: 2, trimDb: -4 },
    ]);
    trims.answer(2, false);
    trims.answer(1, true);
    trims.answer(1, false);
    await expect(first).resolves.toBe(true);
    await expect(second).resolves.toBe(false);
  });
});

it('does nothing for a message of the wrong shape', () => {
  const { posted, tell } = start();
  tell({ kind: 'desktop-read', id: -1 });
  tell({ kind: 'clock-follow', id: 1, secondsPerStep: 0, wanted: true });
  tell('desktop-read');
  expect(posted).toEqual([{ kind: 'ready' }]);
});

it('reads its native folders from the command line', () => {
  expect(
    nativeDirsOf([
      'node',
      'core.js',
      '--native-dir=C:\\app\\native',
      '--native-dir=',
      '--other',
      '--native-dir=D:\\build\\bin',
    ]),
  ).toEqual(['C:\\app\\native', 'D:\\build\\bin']);
});
