/** @jest-environment node */
import fs from 'fs';
import os from 'os';
import path from 'path';

// FluidEQ's own packs from R2 (server 0117): asked for together, and only
// what the server answers `fallback` for read from the packs table, which is
// what FluidEQ 2.5 reads. Not owned, or the allowance used up: nothing.

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
const outcomes = new Map<string, unknown>();
const asked: string[] = [];
jest.mock('../../../main/plus/sceneMediaApi', () => ({
  ...jest.requireActual('../../../main/plus/sceneMediaApi'),
  fetchSceneMedia: jest.fn(async (_auth: unknown, item: { pack: string }) => {
    asked.push(item.pack);
    return outcomes.get(item.pack) ?? { kind: 'fallback' };
  }),
}));
/* eslint-disable import/first -- install the mocks first */
import {
  registerScenePacksIpc,
  type IScenePacksIpcDeps,
} from '../../../main/ipc/scenePacks';
import { fakeResponse } from '../../utils/memberSceneFixtures';
/* eslint-enable import/first */

const envelope = {
  schema: 1,
  keyId: 'test',
  algorithm: 'ed25519',
  payload: 'e30=',
  signature: 'e30=',
};
const summary = (id: string) => ({
  id,
  version: 1,
  names: { en: id },
  fallbackStyle: 'skyline' as const,
  swatch: ['#ffffff', '#000000'],
});

let root: string;
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'scene-media-packs-'));
  outcomes.clear();
  asked.length = 0;
});
afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

it('takes R2 packs as they come, reads only the fallback ones from the table, and nothing else', async () => {
  const ids = ['from-r2', 'old-way', 'not-owned', 'paused', 'not-json'];
  outcomes.set('from-r2', {
    kind: 'bytes',
    bytes: new TextEncoder().encode(JSON.stringify(envelope)),
    version: 2,
  });
  outcomes.set('not-owned', { kind: 'refused' });
  outcomes.set('paused', {
    kind: 'paused',
    paused: { reason: 'daily_allowance', resetsAt: '2026-11-25T00:00:00Z' },
  });
  outcomes.set('not-json', {
    kind: 'bytes',
    bytes: new TextEncoder().encode('not json'),
    version: 2,
  });
  const urls: string[] = [];
  const fetchImpl = (async (input: string) => {
    urls.push(input);
    const url = new URL(input);
    if (url.searchParams.get('select') === 'id,version,published_at') {
      return fakeResponse(
        200,
        ids.map((id) => ({
          id,
          version: 2,
          published_at: '2026-11-24T00:00:00Z',
        })),
      );
    }
    const wanted = (url.searchParams.get('id') ?? '')
      .replace(/^in\.\(|\)$/g, '')
      .split(',');
    return fakeResponse(
      200,
      wanted.map((id) => ({ id, version: 2, envelope })),
    );
  }) as unknown as typeof fetch;
  const registration = registerScenePacksIpc({
    getMainWindow: () => null,
    userDataDir: root,
    config: {
      supabaseUrl: 'https://project.supabase.co',
      supabaseAnonKey: 'anon',
      apiUrl: 'https://project.supabase.co/functions/v1',
    } as IScenePacksIpcDeps['config'],
    session: {
      accessToken: async () => 'token',
    } as IScenePacksIpcDeps['session'],
    entitlement: {
      status: () => ({ state: 'active' }),
      subscribe: () => () => {},
    } as unknown as IScenePacksIpcDeps['entitlement'],
    ownership: { owns: () => true, subscribe: () => () => undefined },
    fetchImpl,
  });
  const adopt = jest.spyOn(registration.store, 'adopt').mockReturnValue(0);
  jest.spyOn(registration.store, 'list').mockReturnValue(ids.map(summary));
  jest.spyOn(registration.store, 'newestVersion').mockReturnValue(1);
  try {
    await handlers.get('scene-packs-refresh')?.({});
    expect(asked).toEqual(ids);
    const tableReads = urls.filter((url) =>
      new URL(url).searchParams.get('select')?.includes('envelope'),
    );
    expect(
      tableReads.map((url) => new URL(url).searchParams.get('id')),
    ).toEqual(['in.(old-way)']);
    expect(adopt).toHaveBeenCalledWith([
      { id: 'from-r2', version: 2, envelope },
      { id: 'old-way', version: 2, envelope },
    ]);
  } finally {
    registration.dispose();
  }
});

it('asks the table nothing when R2 had every pack', async () => {
  outcomes.set('only', {
    kind: 'bytes',
    bytes: new TextEncoder().encode(JSON.stringify(envelope)),
    version: 3,
  });
  const urls: string[] = [];
  const fetchImpl = (async (input: string) => {
    urls.push(input);
    return fakeResponse(200, [
      { id: 'only', version: 3, published_at: '2026-11-24T00:00:00Z' },
    ]);
  }) as unknown as typeof fetch;
  const registration = registerScenePacksIpc({
    getMainWindow: () => null,
    userDataDir: root,
    config: {
      supabaseUrl: 'https://project.supabase.co',
      supabaseAnonKey: 'anon',
      apiUrl: 'https://project.supabase.co/functions/v1',
    } as IScenePacksIpcDeps['config'],
    session: {
      accessToken: async () => 'token',
    } as IScenePacksIpcDeps['session'],
    entitlement: {
      status: () => ({ state: 'active' }),
      subscribe: () => () => {},
    } as unknown as IScenePacksIpcDeps['entitlement'],
    ownership: { owns: () => true, subscribe: () => () => undefined },
    fetchImpl,
  });
  const adopt = jest.spyOn(registration.store, 'adopt').mockReturnValue(1);
  jest.spyOn(registration.store, 'list').mockReturnValue([summary('only')]);
  jest.spyOn(registration.store, 'newestVersion').mockReturnValue(1);
  try {
    await handlers.get('scene-packs-refresh')?.({});
    expect(urls).toHaveLength(1);
    expect(adopt).toHaveBeenCalledWith([{ id: 'only', version: 3, envelope }]);
  } finally {
    registration.dispose();
  }
});
