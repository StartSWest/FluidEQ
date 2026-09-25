/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import fs from 'fs';
import os from 'os';
import path from 'path';

const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-stems-'));
const handlers = new Map<string, (...args: unknown[]) => unknown>();
jest.mock('electron', () => ({
  app: { getPath: () => userData },
  ipcMain: {
    handle: (channel: string, fn: (...args: unknown[]) => unknown) =>
      handlers.set(channel, fn),
    on: (channel: string, fn: (...args: unknown[]) => unknown) =>
      handlers.set(channel, fn),
  },
}));
// Inference is not what this file is about, and loading the runtime is not
// something a unit test should do.
jest.mock('../../../main/nativeInference', () => ({
  __esModule: true,
  default: {},
  onInferenceInvalidated: () => undefined,
}));

// eslint-disable-next-line import/first -- the mocks above must be installed first
import { registerKaraokeSeparation } from '../../../main/karaokeSeparation';

const invoke = (channel: string, ...args: unknown[]): Promise<unknown> => {
  const handler = handlers.get(channel);
  if (!handler) {
    throw new Error(`no handler for ${channel}`);
  }
  return Promise.resolve(handler({}, ...args));
};

const bytes = (fill: number, length: number): ArrayBuffer =>
  new Uint8Array(length).fill(fill).buffer;

const stemsDir = path.join(userData, 'karaoke-stems');

describe('the stems a split leaves on disk', () => {
  beforeAll(() => {
    registerKaraokeSeparation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('keeps both and hands them back, without writing on main’s time or leaving a partial file', async () => {
    const syncWrites = jest.spyOn(fs, 'writeFileSync');
    await invoke('karaoke-stems-save', {
      key: 'song:1',
      vocals: bytes(1, 4096),
      instrumental: bytes(2, 8192),
    });
    expect(syncWrites).not.toHaveBeenCalled();
    expect(fs.readdirSync(stemsDir).sort()).toEqual([
      'song_1-instrumental.wav',
      'song_1-vocals.wav',
    ]);

    const loaded = (await invoke('karaoke-stems-load', 'song:1')) as {
      vocals: Uint8Array;
      instrumental: Uint8Array;
    };
    expect(Buffer.from(loaded.vocals)).toEqual(Buffer.alloc(4096, 1));
    expect(Buffer.from(loaded.instrumental)).toEqual(Buffer.alloc(8192, 2));
  });

  it('answers nothing for a song never split, or one missing a stem', async () => {
    await expect(invoke('karaoke-stems-load', 'never')).resolves.toBeNull();
    await invoke('karaoke-stems-save', {
      key: 'half',
      vocals: bytes(3, 16),
      instrumental: bytes(4, 16),
    });
    fs.rmSync(path.join(stemsDir, 'half-instrumental.wav'));
    await expect(invoke('karaoke-stems-load', 'half')).resolves.toBeNull();
  });
});
