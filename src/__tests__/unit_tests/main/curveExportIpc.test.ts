/** @jest-environment node */
/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import fs from 'fs';
import os from 'os';
import path from 'path';
import ChannelEnum from 'common/channels';
import { ErrorCode } from 'common/errors';
import { toCurveListFile, type IMyCurve } from 'common/myCurves';
import { registerCurveExportIpc } from 'main/ipc/curveExport';
import onWindowMessage from 'main/ipc/windowMessages';

const mockShowSaveDialog = jest.fn();
const mockShowOpenDialog = jest.fn();

jest.mock('main/ipc/windowMessages', () => ({
  __esModule: true,
  default: jest.fn(),
}));
jest.mock('main/mainText', () => ({
  __esModule: true,
  default: (key: string) => key,
}));
jest.mock('electron', () => ({
  app: { on: jest.fn() },
  ipcMain: { handle: jest.fn() },
  shell: {},
  dialog: {
    showSaveDialog: (...args: unknown[]) => mockShowSaveDialog(...args),
    showOpenDialog: (...args: unknown[]) => mockShowOpenDialog(...args),
  },
}));

type THandler = (
  event: { reply: jest.Mock },
  arg: unknown[] | undefined,
) => Promise<void>;

const TEXT = 'Preamp: -4 dB\nFilter 1: ON LSC Fc 100 Hz Gain 4 dB Q 0.8';
const curve: IMyCurve = {
  id: 'a',
  name: 'Warm',
  text: TEXT,
  source: 'file',
  ears: 'both',
  addedAt: 1_790_000_000_000,
};

const handleError = jest.fn();
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
  registerCurveExportIpc({ getMainWindow: () => null, handleError });
  folder = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-curves-'));
});

afterEach(() => {
  fs.rmSync(folder, { recursive: true, force: true });
});

const send = async (channel: ChannelEnum, arg: unknown[] | undefined) => {
  const handler = handlers.get(channel);
  if (!handler) {
    throw new Error(`nothing listens on ${channel}`);
  }
  const event = { reply: jest.fn() };
  await handler(event, arg);
  return event;
};

describe('the curve list', () => {
  it('writes the list where the person chose, under a .fqcurves name', async () => {
    const target = path.join(folder, 'mine.fqcurves');
    mockShowSaveDialog.mockResolvedValue({ canceled: false, filePath: target });
    const contents = toCurveListFile([curve]);
    const event = await send(ChannelEnum.EXPORT_CURVE_LIST, [
      'My curves',
      contents,
    ]);
    expect(mockShowSaveDialog.mock.calls[0][0]).toMatchObject({
      defaultPath: 'My curves.fqcurves',
    });
    expect(fs.readFileSync(target, 'utf8')).toBe(contents);
    expect(event.reply).toHaveBeenCalledWith(ChannelEnum.EXPORT_CURVE_LIST, {
      result: true,
    });
  });

  it('writes nothing, and says so, when the save is cancelled', async () => {
    mockShowSaveDialog.mockResolvedValue({ canceled: true, filePath: '' });
    const event = await send(ChannelEnum.EXPORT_CURVE_LIST, [
      'My curves',
      toCurveListFile([curve]),
    ]);
    expect(fs.readdirSync(folder)).toEqual([]);
    expect(event.reply).toHaveBeenCalledWith(ChannelEnum.EXPORT_CURVE_LIST, {
      result: false,
    });
  });

  it.each([
    ['contents that are not a curve list', ['My curves', '{"format":"other"}']],
    ['no contents', ['My curves']],
    ['nothing at all', undefined],
  ])('refuses %s before asking where', async (_what, arg) => {
    await send(ChannelEnum.EXPORT_CURVE_LIST, arg);
    expect(mockShowSaveDialog).not.toHaveBeenCalled();
    expect(handleError).toHaveBeenCalledWith(
      expect.anything(),
      ChannelEnum.EXPORT_CURVE_LIST,
      ErrorCode.INVALID_PARAMETER,
    );
  });
});

describe('the folder of .txt files', () => {
  it('writes one file a curve, and numbers a name the folder already holds', async () => {
    fs.writeFileSync(path.join(folder, 'Warm.txt'), 'kept from before');
    mockShowOpenDialog.mockResolvedValue({
      canceled: false,
      filePaths: [folder],
    });
    const event = await send(ChannelEnum.EXPORT_CURVE_FOLDER, [
      [
        { name: 'Warm.txt', text: TEXT },
        { name: 'Bright.txt', text: TEXT },
      ],
    ]);
    expect(fs.readdirSync(folder).sort()).toEqual([
      'Bright.txt',
      'Warm (2).txt',
      'Warm.txt',
    ]);
    expect(fs.readFileSync(path.join(folder, 'Warm.txt'), 'utf8')).toBe(
      'kept from before',
    );
    expect(fs.readFileSync(path.join(folder, 'Warm (2).txt'), 'utf8')).toBe(
      TEXT,
    );
    expect(event.reply).toHaveBeenCalledWith(ChannelEnum.EXPORT_CURVE_FOLDER, {
      result: true,
    });
  });

  it.each([
    ['a name that climbs out of the folder', '..\\..\\escape.txt'],
    ['a name with a folder in it', 'sub/escape.txt'],
    ['a name that is not a .txt', 'Warm.bat'],
    ['an empty name', '.txt'],
  ])('refuses %s before asking where', async (_what, name) => {
    await send(ChannelEnum.EXPORT_CURVE_FOLDER, [[{ name, text: TEXT }]]);
    expect(mockShowOpenDialog).not.toHaveBeenCalled();
    expect(handleError).toHaveBeenCalledWith(
      expect.anything(),
      ChannelEnum.EXPORT_CURVE_FOLDER,
      ErrorCode.INVALID_PARAMETER,
    );
  });

  it('refuses a file whose text is no curve, and an empty batch', async () => {
    await send(ChannelEnum.EXPORT_CURVE_FOLDER, [
      [{ name: 'Warm.txt', text: 'rm -rf' }],
    ]);
    await send(ChannelEnum.EXPORT_CURVE_FOLDER, [[]]);
    expect(mockShowOpenDialog).not.toHaveBeenCalled();
    expect(handleError).toHaveBeenCalledTimes(2);
  });
});
