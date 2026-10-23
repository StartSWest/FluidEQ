/** @jest-environment node */
/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import fs from 'fs';
import os from 'os';
import path from 'path';
import ChannelEnum from 'common/channels';
import { ErrorCode } from 'common/errors';
import type { IMyCurve } from 'common/myCurves';
import { registerMyCurvesIpc } from 'main/ipc/myCurves';
import { loadMyCurves, saveMyCurves } from 'main/myCurvesFile';
import onWindowMessage from 'main/ipc/windowMessages';

jest.mock('main/ipc/windowMessages', () => ({
  __esModule: true,
  default: jest.fn(),
}));
jest.mock('electron', () => ({
  app: { on: jest.fn() },
  ipcMain: { handle: jest.fn() },
  shell: {},
}));

type THandler = (
  event: { reply: jest.Mock },
  arg: unknown[] | undefined,
) => unknown;

const TEXT = 'Preamp: -3 dB\nFilter 1: ON PK Fc 100 Hz Gain 3 dB Q 1';
const curve = (id: string, name: string): IMyCurve => ({
  id,
  name,
  text: TEXT,
  source: 'file',
  ears: 'both',
  addedAt: 1_790_000_000_000,
});

const handleError = jest.fn();
const logger = { error: jest.fn() };
let handlers: Map<string, THandler>;
let folder: string;

beforeEach(() => {
  jest.clearAllMocks();
  handlers = new Map();
  jest
    .mocked(onWindowMessage)
    .mockImplementation((channel: string, handler: unknown) => {
      handlers.set(channel, handler as THandler);
      return () => handlers.delete(channel);
    });
  folder = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-my-curves-'));
  registerMyCurvesIpc({ userDataDir: folder, handleError, logger });
});

afterEach(() => {
  fs.rmSync(folder, { recursive: true, force: true });
});

const send = (channel: ChannelEnum, arg?: unknown[]) => {
  const handler = handlers.get(channel);
  if (!handler) {
    throw new Error(`nothing listens on ${channel}`);
  }
  const event = { reply: jest.fn() };
  handler(event, arg);
  return event;
};

describe('the file', () => {
  it('is an empty list before anything was kept', () => {
    expect(loadMyCurves(folder, logger)).toEqual([]);
  });

  it('reads back what was saved, written whole with no temp file left', () => {
    const list = [curve('a', 'One'), curve('b', 'Two')];
    saveMyCurves(folder, list);
    expect(loadMyCurves(folder, logger)).toEqual(list);
    expect(fs.readdirSync(folder)).toEqual(['my-curves.json']);
  });

  it('sets a damaged file aside instead of saving over it, and says where', () => {
    fs.writeFileSync(
      path.join(folder, 'my-curves.json'),
      '{"version": 1, "cur',
    );
    expect(loadMyCurves(folder, logger, () => 42)).toEqual([]);
    expect(fs.readdirSync(folder)).toEqual(['my-curves.damaged-42.json']);
    expect(
      fs.readFileSync(path.join(folder, 'my-curves.damaged-42.json'), 'utf8'),
    ).toBe('{"version": 1, "cur');
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('my-curves.damaged-42.json'),
    );
  });
});

describe('the window asking', () => {
  it('is answered with the kept list', () => {
    saveMyCurves(folder, [curve('a', 'One')]);
    const event = send(ChannelEnum.GET_MY_CURVES);
    expect(event.reply).toHaveBeenCalledWith(ChannelEnum.GET_MY_CURVES, {
      result: [curve('a', 'One')],
    });
  });

  it('keeps the list it sends', () => {
    const list = [curve('a', 'One'), curve('b', 'Two')];
    const event = send(ChannelEnum.SET_MY_CURVES, [list]);
    expect(event.reply).toHaveBeenCalledWith(ChannelEnum.SET_MY_CURVES, {
      result: true,
    });
    expect(loadMyCurves(folder, logger)).toEqual(list);
  });

  it.each([
    ['nothing', undefined],
    [
      'a list with something that is no curve',
      [[{ ...curve('a', 'x'), text: 'no' }]],
    ],
    ['two curves under one id', [[curve('a', 'One'), curve('a', 'Two')]]],
  ])('refuses %s before writing a byte', (_what, arg) => {
    saveMyCurves(folder, [curve('k', 'Kept')]);
    send(ChannelEnum.SET_MY_CURVES, arg);
    expect(handleError).toHaveBeenCalledWith(
      expect.anything(),
      ChannelEnum.SET_MY_CURVES,
      ErrorCode.INVALID_PARAMETER,
    );
    expect(loadMyCurves(folder, logger)).toEqual([curve('k', 'Kept')]);
  });

  it('says so when the list cannot be written', () => {
    // A folder where the file goes: the rename over it fails.
    fs.mkdirSync(path.join(folder, 'my-curves.json'));
    const event = send(ChannelEnum.SET_MY_CURVES, [[curve('a', 'One')]]);
    expect(event.reply).not.toHaveBeenCalled();
    // Answered as a failure, which the window shows in its own words.
    expect(handleError.mock.calls[0].slice(1, 3)).toEqual([
      ChannelEnum.SET_MY_CURVES,
      ErrorCode.FAILURE,
    ]);
  });
});
