/** @jest-environment node */
import { generateKeyPairSync, sign } from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import type { IAccountConfig } from '../../../common/accountConfig';
import { FLUIDEQ_CREATOR_ID } from '../../../common/plusGallery';
import { registerPlusGalleryIpc } from '../../../main/ipc/plusGallery';
import { createMemberSceneStore } from '../../../main/memberScenes/store';
import { createScenePackStore } from '../../../main/scenePackStore';
import { trustScenePackKeyForTesting } from '../../../main/scenePackVerify';
import {
  fakeResponse,
  ME,
  memberPack,
  signedEnvelope,
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
trustScenePackKeyForTesting('test-official-gallery', key.publicKey);
const officialEnvelope = () => {
  const bytes = Buffer.from(JSON.stringify(memberPack()));
  return {
    schema: 1,
    keyId: 'test-official-gallery',
    algorithm: 'ed25519',
    payload: bytes.toString('base64'),
    signature: sign(null, bytes, key.privateKey).toString('base64'),
  };
};
const config = {
  supabaseUrl: 'https://project.supabase.co',
  supabaseAnonKey: 'anon',
} as IAccountConfig;
const invoke = (channel: string, ...args: unknown[]) =>
  handlers.get(channel)?.({}, ...args);
let root: string;
let paid: boolean;
let account: string | undefined;
let body: unknown;
let fetchImpl: jest.Mock;
let announce: jest.Mock;
let store: ReturnType<typeof createScenePackStore>;

beforeEach(() => {
  handlers.clear();
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-official-gallery-'));
  paid = true;
  account = ME;
  body = officialEnvelope();
  fetchImpl = jest.fn(async () => fakeResponse(200, body));
  announce = jest.fn();
  store = createScenePackStore({ userDataDir: root });
  registerPlusGalleryIpc({
    access: {
      accountId: () => account,
      entitled: () => paid,
      auth: async () => ({ config, accessToken: 'token', fetchImpl }),
    },
    store: createMemberSceneStore({ userDataDir: root }),
    officialStore: store,
    announceOfficial: announce,
    announce: jest.fn(),
    refreshBlocked: async () => undefined,
    onEntitlementChange: () => () => undefined,
  });
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

it('previews a genuine official pack for a signed-in free account without installing it', async () => {
  paid = false;
  expect(
    await invoke('plus-gallery-preview', FLUIDEQ_CREATOR_ID, 'neon-city', 1),
  ).toMatchObject({ ok: true, own: false, pack: { id: 'neon-city' } });
  expect(store.list()).toEqual([]);
  expect(
    await invoke('plus-gallery-add', FLUIDEQ_CREATOR_ID, 'neon-city', 1),
  ).toEqual({ ok: false, reason: 'not-entitled' });
  expect(fetchImpl).toHaveBeenCalledTimes(1);
});

it('installs into the verified official store and returns the actual graph look id', async () => {
  expect(
    await invoke('plus-gallery-add', FLUIDEQ_CREATOR_ID, 'neon-city', 1),
  ).toEqual({ ok: true, lookId: 'premium:neon-city' });
  expect(store.load('neon-city')).toMatchObject({ id: 'neon-city' });
  expect(announce).toHaveBeenCalledTimes(1);
});

it('rejects member-signed content pretending to be official', async () => {
  body = signedEnvelope(JSON.stringify(memberPack()));
  expect(
    await invoke('plus-gallery-preview', FLUIDEQ_CREATOR_ID, 'neon-city', 1),
  ).toEqual({ ok: false, reason: 'unavailable' });
  expect(
    await invoke('plus-gallery-add', FLUIDEQ_CREATOR_ID, 'neon-city', 1),
  ).toEqual({ ok: false, reason: 'unavailable' });
  expect(store.list()).toEqual([]);
});

it('rejects a valid official file returned for a different scene', async () => {
  expect(
    await invoke(
      'plus-gallery-preview',
      FLUIDEQ_CREATOR_ID,
      'different-scene',
      1,
    ),
  ).toEqual({ ok: false, reason: 'unavailable' });
});

it('does not download anything for a signed-out visitor', async () => {
  account = undefined;
  expect(
    await invoke('plus-gallery-preview', FLUIDEQ_CREATOR_ID, 'neon-city', 1),
  ).toEqual({ ok: false, reason: 'not-entitled' });
  expect(fetchImpl).not.toHaveBeenCalled();
});

it('does not install if Plus lapses while the download is in flight', async () => {
  fetchImpl.mockImplementation(async () => {
    paid = false;
    return fakeResponse(200, body);
  });
  expect(
    await invoke('plus-gallery-add', FLUIDEQ_CREATOR_ID, 'neon-city', 1),
  ).toEqual({ ok: false, reason: 'not-entitled' });
  expect(store.list()).toEqual([]);
  expect(announce).not.toHaveBeenCalled();
});
