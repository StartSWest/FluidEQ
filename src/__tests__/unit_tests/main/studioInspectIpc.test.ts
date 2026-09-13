/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/** @jest-environment node */

/**
 * "Open in Studio" for FluidEQ's scenes. The page sends a scene id; the scene
 * that is opened is FluidEQ's by its signature, from the official store or
 * fetched and verified, and nothing a member made ever passes for one —
 * which is what keeps members' scenes out of the Studio.
 */

import { generateKeyPairSync, sign } from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import type { IAccountConfig } from '../../../common/accountConfig';
import type { IScenePack } from '../../../common/scenePacks';
import type { TInspection } from '../../../main/ipc/memberScenes';
import { registerStudioInspectIpc } from '../../../main/ipc/studioInspect';
import { createScenePackStore } from '../../../main/scenePackStore';
import { trustScenePackKeyForTesting } from '../../../main/scenePackVerify';
import {
  fakeResponse,
  ME,
  memberPack,
  memberPayload,
  signedEnvelope,
  SOMEONE,
} from '../../utils/memberSceneFixtures';

const handlers = new Map<string, (...args: unknown[]) => unknown>();
jest.mock('electron', () => ({
  safeStorage: jest.requireActual('../../utils/sceneStorageCipher')
    .sceneStorageCipher,
  ipcMain: {
    handle: (channel: string, fn: (...args: unknown[]) => unknown) =>
      handlers.set(channel, fn),
    removeHandler: (channel: string) => handlers.delete(channel),
  },
}));

const key = generateKeyPairSync('ed25519');
trustScenePackKeyForTesting('test-official-inspect', key.publicKey);

const officialEnvelope = (pack: IScenePack) => {
  const bytes = Buffer.from(JSON.stringify(pack));
  return {
    schema: 1 as const,
    keyId: 'test-official-inspect',
    algorithm: 'ed25519' as const,
    payload: bytes.toString('base64'),
    signature: sign(null, bytes, key.privateKey).toString('base64'),
  };
};

const config = {
  supabaseUrl: 'https://project.supabase.co',
  supabaseAnonKey: 'anon',
} as IAccountConfig;

const invoke = (sceneId: unknown) =>
  handlers.get('studio-inspect-official')?.({}, sceneId);

const AURORA = memberPack({ id: 'aurora', names: { en: 'Aurora' } });

let root: string;
let paid: boolean;
let account: string | undefined;
let answer: unknown;
let duringFetch: (() => void) | undefined;
let fetchImpl: jest.Mock;
let opened: jest.Mock<Promise<TInspection>, [IScenePack]>;
let store: ReturnType<typeof createScenePackStore>;
let dispose: () => void;

beforeEach(() => {
  handlers.clear();
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-inspect-'));
  paid = true;
  account = ME;
  answer = officialEnvelope(AURORA);
  duringFetch = undefined;
  fetchImpl = jest.fn(async () => {
    duringFetch?.();
    return fakeResponse(200, answer);
  });
  opened = jest
    .fn<Promise<TInspection>, [IScenePack]>()
    .mockResolvedValue('opened');
  store = createScenePackStore({ userDataDir: root });
  dispose = registerStudioInspectIpc({
    access: {
      accountId: () => account,
      entitled: () => paid,
      auth: async () => ({ config, accessToken: 'token', fetchImpl }),
    },
    officialStore: store,
    openInspection: opened,
  });
});

afterEach(() => {
  dispose();
  fs.rmSync(root, { recursive: true, force: true });
});

it('opens a FluidEQ scene fetched and verified as FluidEQ’s', async () => {
  expect(await invoke('aurora')).toBe('opened');
  expect(opened).toHaveBeenCalledWith(
    expect.objectContaining({ id: 'aurora' }),
  );
});

it('opens the official store’s copy without downloading it again', async () => {
  store.adopt(
    [
      {
        id: 'aurora',
        version: AURORA.version,
        envelope: officialEnvelope(AURORA),
      },
    ],
    true,
  );
  expect(await invoke('aurora')).toBe('opened');
  expect(fetchImpl).not.toHaveBeenCalled();
});

it('never opens a member’s scene, even one signed and sent as that id', async () => {
  answer = signedEnvelope(memberPayload({ author: SOMEONE, pack: AURORA }));
  expect(await invoke('aurora')).toBe('unavailable');
  // A look id of a member's scene is not a FluidEQ scene id at all.
  expect(await invoke(`member:${SOMEONE}:aurora`)).toBe('unavailable');
  expect(await invoke({ id: 'aurora' })).toBe('unavailable');
  expect(opened).not.toHaveBeenCalled();
});

it('refuses without Plus, and asks the server nothing', async () => {
  paid = false;
  expect(await invoke('aurora')).toBe('not-entitled');
  expect(fetchImpl).not.toHaveBeenCalled();
  expect(opened).not.toHaveBeenCalled();
});

it('opens nothing when another account signs in while it downloads', async () => {
  duringFetch = () => {
    account = SOMEONE;
  };
  expect(await invoke('aurora')).toBe('not-entitled');
  expect(opened).not.toHaveBeenCalled();
});

it('says the project could not be made when the disk refuses it', async () => {
  opened.mockRejectedValueOnce(new Error('EACCES'));
  expect(await invoke('aurora')).toBe('failed');
});
