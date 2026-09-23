/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Treble choice's two files: where they are, what counts as Classic —
 * the engine's own rule, or the menu shows one thing while another plays —
 * and that nothing is written, and no engine folder made, for an engine that
 * is not the one chosen.
 */

import fs from 'fs/promises';
import path from 'path';
import ChannelEnum from 'common/channels';
import { ErrorCode } from 'common/errors';
import type { TAudioEngine } from 'common/audioEngine';
import { TREBLE_DESIGN_FILENAMES } from 'common/filterDesign';
import {
  ITrebleDesignDeps,
  registerTrebleDesignIpc,
} from 'main/ipc/trebleDesign';
import { scheduleWrite } from 'main/asyncWriter';

type Handler = (event: { reply: jest.Mock }, args?: unknown) => Promise<void>;
const handlers = new Map<string, Handler>();
jest.mock('electron', () => ({
  ipcMain: {
    on: (channel: string, handler: Handler) => handlers.set(channel, handler),
  },
}));
jest.mock('fs/promises', () => ({ readFile: jest.fn() }));
jest.mock('main/asyncWriter', () => ({ scheduleWrite: jest.fn() }));

const config = path.join('C:', 'fluid-config');
const eqFile = path.join(config, 'fluideq-eq-treble.txt');
const curveFile = path.join(config, 'fluideq-curve-treble.txt');
let engine: TAudioEngine | null;
let files: Map<string, string>;
let deps: ITrebleDesignDeps;

const fire = async (channel: ChannelEnum, args?: unknown) => {
  const handler = handlers.get(channel);
  if (!handler) {
    throw new Error(`Missing handler: ${channel}`);
  }
  const reply = jest.fn();
  await handler({ reply }, args);
  expect(reply).toHaveBeenCalledTimes(1);
  expect(reply.mock.calls[0][0]).toBe(channel);
  return reply.mock.calls[0][1];
};

beforeEach(() => {
  jest.resetAllMocks();
  engine = 'fluid';
  files = new Map();
  deps = {
    getConfigPath: jest.fn(async () => config),
    getEngine: jest.fn(() => engine),
  };
  jest.mocked(fs.readFile).mockImplementation((async (file: unknown) => {
    const text = files.get(String(file));
    if (text === undefined) {
      throw Object.assign(new Error('absent'), { code: 'ENOENT' });
    }
    return text;
  }) as unknown as typeof fs.readFile);
  jest.mocked(scheduleWrite).mockImplementation(async (file, contents) => {
    files.set(file, contents);
  });
  registerTrebleDesignIpc(deps);
});

it('keeps each group in a file of its own beside the phase files', () => {
  expect(TREBLE_DESIGN_FILENAMES).toEqual({
    eq: 'fluideq-eq-treble.txt',
    curves: 'fluideq-curve-treble.txt',
  });
});

it('reads a group with no file as Precise, which is what the engine plays', async () => {
  expect((await fire(ChannelEnum.GET_TREBLE_DESIGN)).result).toEqual({
    eq: 'precise',
    curves: 'precise',
  });
});

it('counts only the exact word as Classic, as the engine does', async () => {
  files.set(eqFile, ' classic\r\n');
  // The engine compares the trimmed text exactly (`config.cpp`), so this
  // plays Precise there and has to read as Precise here.
  files.set(curveFile, 'Classic');
  expect((await fire(ChannelEnum.GET_TREBLE_DESIGN)).result).toEqual({
    eq: 'classic',
    curves: 'precise',
  });
});

it.each(['eq', 'curves'] as const)(
  'writes %s alone and answers with the files as they landed',
  async (scope) => {
    const reply = await fire(ChannelEnum.SET_TREBLE_DESIGN, ['classic', scope]);
    expect(scheduleWrite).toHaveBeenCalledTimes(1);
    expect(scheduleWrite).toHaveBeenCalledWith(
      scope === 'eq' ? eqFile : curveFile,
      'classic\r\n',
    );
    expect(reply.result).toEqual({
      eq: scope === 'eq' ? 'classic' : 'precise',
      curves: scope === 'curves' ? 'classic' : 'precise',
    });
    await fire(ChannelEnum.SET_TREBLE_DESIGN, ['precise', scope]);
    expect((await fire(ChannelEnum.GET_TREBLE_DESIGN)).result).toEqual({
      eq: 'precise',
      curves: 'precise',
    });
  },
);

it('never shows a choice the folder did not take', async () => {
  // A sealed folder — the app quitting — settles without writing.
  jest.mocked(scheduleWrite).mockResolvedValue(undefined);
  const reply = await fire(ChannelEnum.SET_TREBLE_DESIGN, ['classic', 'eq']);
  expect(reply.result).toEqual({ eq: 'precise', curves: 'precise' });
});

it.each([null, 'apo'] as const)(
  'makes no folder and writes nothing when the engine is %s',
  async (other) => {
    files.set(eqFile, 'classic');
    engine = other;
    expect((await fire(ChannelEnum.GET_TREBLE_DESIGN)).result).toEqual({
      eq: 'precise',
      curves: 'precise',
    });
    await fire(ChannelEnum.SET_TREBLE_DESIGN, ['classic', 'curves']);
    expect(deps.getConfigPath).not.toHaveBeenCalled();
    expect(scheduleWrite).not.toHaveBeenCalled();

    // POSITIVE CONTROL: the same folder read once the FluidEQ Engine is the
    // one chosen, so the defaults above were the gate, not a broken read.
    engine = 'fluid';
    expect((await fire(ChannelEnum.GET_TREBLE_DESIGN)).result).toEqual({
      eq: 'classic',
      curves: 'precise',
    });
  },
);

it.each([
  [['loud', 'eq']],
  [['classic', 'dsp']],
  [['classic']],
  [[]],
  ['classic'],
  [undefined],
])('refuses %j', async (args) => {
  expect(await fire(ChannelEnum.SET_TREBLE_DESIGN, args)).toEqual({
    errorCode: ErrorCode.INVALID_PARAMETER,
  });
  expect(scheduleWrite).not.toHaveBeenCalled();
});

it('says so when the write fails', async () => {
  jest.mocked(scheduleWrite).mockRejectedValue(new Error('disk full'));
  expect(await fire(ChannelEnum.SET_TREBLE_DESIGN, ['classic', 'eq'])).toEqual({
    errorCode: ErrorCode.FAILURE,
  });
});

it('says so when a file cannot be read', async () => {
  jest
    .mocked(fs.readFile)
    .mockRejectedValue(Object.assign(new Error('denied'), { code: 'EACCES' }));
  expect(await fire(ChannelEnum.GET_TREBLE_DESIGN)).toEqual({
    errorCode: ErrorCode.FAILURE,
  });
});
