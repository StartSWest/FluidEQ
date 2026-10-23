/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { getDefaultState } from '../../../common/constants';
import { flushPendingWrites } from '../../../main/asyncWriter';
import type { IMainSession } from '../../../main/mainSession';
import { createUpdatePath } from '../../../main/updatePath';

/**
 * Ivan, 2026-10-15: "the EQ changes needs to be instant". The window sends
 * a band's next position only once the last one is answered, and the answer
 * used to wait for every output's engine files to land — 60 to 400 ms on
 * his 24 outputs, twice per drag step. It is answered once the write is
 * queued now; an engine switch, which must know the files landed, still
 * waits for them and hears when they did not.
 */
let releaseFlush: () => void = () => undefined;
let failFlush: (error: Error) => void = () => undefined;
// Settles the moment the update path asks for its flush.
let flushAsked: Promise<void> = Promise.resolve();
let markAsked: () => void = () => undefined;
const mockFlush = jest.fn(() => {
  markAsked();
  return new Promise<void>((resolve, reject) => {
    releaseFlush = resolve;
    failFlush = reject;
  });
});
jest.mock('electron', () => ({ app: { getPath: () => '' } }));
jest.mock('../../../main/registry', () => ({
  isEngineInstalled: async () => true,
  getConfigPath: async () => 'C:/engine/config',
}));
jest.mock('../../../main/deviceProfileFlush', () => ({
  flushDeviceProfiles: () => mockFlush(),
}));

let root: string;
const pathFor = () => {
  const session = {
    audioEngine: 'fluid',
    configPath: 'C:/engine/config',
    activeAudioDeviceId: '',
    engineSwitching: false,
  } as unknown as IMainSession;
  return createUpdatePath({
    state: getDefaultState(),
    session,
    deviceProfileSettings: { version: 1, assignments: {} },
    userDataDir: root,
    diskSync: {
      configInclude: { ensure: async () => undefined, forget: () => undefined },
      startApoConfigWatcher: () => undefined,
      whileAppWrites: async (work) => work(),
      stop: () => undefined,
    },
    presetDirForDevice: () => root,
    getCurrentPreset: () => ({ preAmp: 0, filters: {} }),
    sessionHeadroom: () => ({ reserveDb: 0 }) as never,
    attachPresetToActiveDevice: () => false,
  });
};

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'update-reply-'));
  mockFlush.mockClear();
  flushAsked = new Promise<void>((resolve) => {
    markAsked = resolve;
  });
});
afterEach(async () => {
  releaseFlush();
  await flushPendingWrites();
  fs.rmSync(root, { recursive: true, force: true });
});

it('answers an edit while its engine files are still being written', async () => {
  const reply = jest.fn();
  await pathFor().handleUpdate({ reply }, 'setFilterGain1');
  expect(mockFlush).toHaveBeenCalledTimes(1);
  // The flush has not landed, and the window already has its answer.
  expect(reply).toHaveBeenCalledWith('setFilterGain1', { result: undefined });
});

it('makes an engine switch wait for the files, and tells it when they failed', async () => {
  const update = pathFor();
  let settled = false;
  const switching = update.reflushCurrentState().finally(() => {
    settled = true;
  });
  await flushAsked;
  expect(settled).toBe(false);
  failFlush(new Error('disk full'));
  const result = await switching;
  expect(result.ok).toBe(false);
});

it('reports a switch whose files landed as working', async () => {
  const update = pathFor();
  const switching = update.reflushCurrentState();
  await flushAsked;
  releaseFlush();
  expect((await switching).ok).toBe(true);
});
