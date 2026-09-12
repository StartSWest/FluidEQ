/** @jest-environment node */
import fs from 'fs';
import os from 'os';
import path from 'path';

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

/* eslint-disable import/first -- install the Electron mock first */
import {
  registerScenePacksIpc,
  type IScenePacksIpcDeps,
} from '../../../main/ipc/scenePacks';
import { fakeResponse } from '../../utils/memberSceneFixtures';
/* eslint-enable import/first */

it('refreshes only explicitly installed scenes and never preloads a new server scene', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'scene-install-'));
  const envelope = {
    schema: 1,
    keyId: 'test',
    algorithm: 'ed25519',
    payload: 'e30=',
    signature: 'e30=',
  };
  const rows = ['installed', 'new-scene'].map((id) => ({
    id,
    version: 1,
    envelope,
  }));
  const registration = registerScenePacksIpc({
    getMainWindow: () => null,
    userDataDir: root,
    config: {
      supabaseUrl: 'https://project.supabase.co',
      supabaseAnonKey: 'anon',
    } as IScenePacksIpcDeps['config'],
    session: {
      accessToken: async () => 'token',
    } as IScenePacksIpcDeps['session'],
    entitlement: {
      status: () => ({ state: 'active' }),
      subscribe: () => () => {},
    } as unknown as IScenePacksIpcDeps['entitlement'],
    fetchImpl: (async () => fakeResponse(200, rows)) as typeof fetch,
  });
  const adopt = jest.spyOn(registration.store, 'adopt').mockReturnValue(0);
  const held = jest.spyOn(registration.store, 'list').mockReturnValue([]);
  try {
    await handlers.get('scene-packs-refresh')?.({});
    expect(adopt).toHaveBeenLastCalledWith([]);
    held.mockReturnValue([
      {
        id: 'installed',
        version: 1,
        names: { en: 'Installed' },
        fallbackStyle: 'skyline',
        swatch: ['#ffffff', '#000000'],
      },
    ]);
    await handlers.get('scene-packs-refresh')?.({});
    expect(adopt).toHaveBeenLastCalledWith([rows[0]]);
    expect(handlers.has('scene-packs-remove')).toBe(true);
  } finally {
    registration.dispose();
    fs.rmSync(root, { recursive: true, force: true });
  }
});
