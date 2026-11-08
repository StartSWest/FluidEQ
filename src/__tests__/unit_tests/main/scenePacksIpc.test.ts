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
import type { IScenePackStore } from '../../../main/scenePackStore';
/* eslint-enable import/first */

/**
 * The store's newest held version follows the listing these tests mock: what
 * an update is measured against is the newest held (`newestVersion`), which
 * a pinned earlier version never stands in for.
 */
const newestFromList = (store: IScenePackStore) =>
  jest
    .spyOn(store, 'newestVersion')
    .mockImplementation(
      (id) => store.list().find((pack) => pack.id === id)?.version,
    );

describe('bringing installed scenes up to date', () => {
  const envelope = {
    schema: 1,
    keyId: 'test',
    algorithm: 'ed25519',
    payload: 'e30=',
    signature: 'e30=',
  };
  const installed = (version: number) => ({
    id: 'installed',
    version,
    names: { en: 'Installed' },
    fallbackStyle: 'skyline' as const,
    swatch: ['#ffffff', '#000000'],
  });

  /**
   * The server as the packs table answers: the versions question for
   * `select=id,version,published_at`, and only the ids asked for when the
   * envelopes are.
   */
  const serve = (
    rows: { id: string; version: number; published_at: string }[],
  ) => {
    const urls: string[] = [];
    const fetchImpl = (async (input: string) => {
      urls.push(input);
      const url = new URL(input);
      const select = url.searchParams.get('select') ?? '';
      if (select === 'id,version,published_at') {
        return fakeResponse(200, rows);
      }
      const ids = (url.searchParams.get('id') ?? '')
        .replace(/^in\.\(|\)$/g, '')
        .split(',');
      return fakeResponse(
        200,
        rows
          .filter((row) => ids.includes(row.id))
          .map(({ id, version }) => ({ id, version, envelope })),
      );
    }) as unknown as typeof fetch;
    return { urls, fetchImpl };
  };

  const register = (root: string, fetchImpl: typeof fetch) =>
    registerScenePacksIpc({
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
      // Every scene this account's, as while Plus lasts.
      ownership: { owns: () => true, subscribe: () => () => undefined },
      fetchImpl,
    });

  const envelopeRequests = (urls: readonly string[]) =>
    urls.filter((url) =>
      new URL(url).searchParams.get('select')?.includes('envelope'),
    );

  let root: string;
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'scene-install-'));
  });
  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('asks only versions, and never preloads a scene nobody added', async () => {
    const server = serve([
      { id: 'installed', version: 1, published_at: '2026-09-13T02:00:00Z' },
      { id: 'new-scene', version: 1, published_at: '2026-09-13T02:00:00Z' },
    ]);
    const registration = register(root, server.fetchImpl);
    const adopt = jest.spyOn(registration.store, 'adopt').mockReturnValue(0);
    const held = jest.spyOn(registration.store, 'list').mockReturnValue([]);
    newestFromList(registration.store);
    try {
      await handlers.get('scene-packs-refresh')?.({});
      expect(server.urls).toHaveLength(1);
      expect(adopt).not.toHaveBeenCalled();

      held.mockReturnValue([installed(1)]);
      await handlers.get('scene-packs-refresh')?.({});
      const [download] = envelopeRequests(server.urls);
      expect(new URL(download).searchParams.get('id')).toBe('in.(installed)');
      expect(adopt).toHaveBeenLastCalledWith([
        { id: 'installed', version: 1, envelope },
      ]);
      expect(handlers.has('scene-packs-remove')).toBe(true);
    } finally {
      registration.dispose();
    }
  });

  // What made the four-hour wait unnecessary: asking again downloads nothing
  // until the server has something this computer has not taken — and that
  // is remembered across a restart.
  it('downloads a scene once per publication, a restart included', async () => {
    const rows = [
      { id: 'installed', version: 1, published_at: '2026-09-13T02:00:00Z' },
    ];
    const server = serve(rows);
    const first = register(root, server.fetchImpl);
    jest.spyOn(first.store, 'adopt').mockReturnValue(1);
    jest.spyOn(first.store, 'list').mockReturnValue([installed(1)]);
    newestFromList(first.store);
    try {
      await handlers.get('scene-packs-refresh')?.({});
      await first.refreshIfDue('window focused');
      await handlers.get('scene-packs-refresh')?.({});
      expect(envelopeRequests(server.urls)).toHaveLength(1);
    } finally {
      first.dispose();
    }

    const second = register(root, server.fetchImpl);
    const adopt = jest.spyOn(second.store, 'adopt').mockReturnValue(1);
    const held = jest
      .spyOn(second.store, 'list')
      .mockReturnValue([installed(1)]);
    newestFromList(second.store);
    try {
      await handlers.get('scene-packs-refresh')?.({});
      expect(envelopeRequests(server.urls)).toHaveLength(1);

      // Republished at the version it already had.
      rows[0] = { ...rows[0], published_at: '2026-09-14T01:00:00Z' };
      await handlers.get('scene-packs-refresh')?.({});
      expect(envelopeRequests(server.urls)).toHaveLength(2);

      // A newer version.
      rows[0] = {
        ...rows[0],
        version: 2,
        published_at: '2026-09-14T02:00:00Z',
      };
      await handlers.get('scene-packs-refresh')?.({});
      expect(envelopeRequests(server.urls)).toHaveLength(3);
      expect(adopt).toHaveBeenLastCalledWith([
        { id: 'installed', version: 2, envelope },
      ]);

      // An older version than the one held is never asked for.
      held.mockReturnValue([installed(3)]);
      await handlers.get('scene-packs-refresh')?.({});
      expect(envelopeRequests(server.urls)).toHaveLength(3);
    } finally {
      second.dispose();
    }
  });

  // Its maker's own copy of Alpine v69 arrived 82 s after it went out, at
  // the next check (Ivan, 2026-11-08: "it takes a while").
  it('fetches a version just published at once, even behind a check that asked before it existed', async () => {
    const rows = [
      { id: 'installed', version: 1, published_at: '2026-09-13T02:00:00Z' },
    ];
    const server = serve(rows);
    // The publication lands just after the server sent the check under way
    // its scenes: that check downloaded version 1, and only a later one can
    // see 2.
    let landed = false;
    const fetchImpl = (async (input: string) => {
      const answer = await server.fetchImpl(input);
      const select = new URL(input).searchParams.get('select') ?? '';
      if (!landed && select.includes('envelope')) {
        landed = true;
        rows[0] = {
          id: 'installed',
          version: 2,
          published_at: '2026-11-08T05:52:17Z',
        };
      }
      return answer;
    }) as unknown as typeof fetch;
    const registration = register(root, fetchImpl);
    const held = jest
      .spyOn(registration.store, 'list')
      .mockReturnValue([installed(1)]);
    jest.spyOn(registration.store, 'adopt').mockImplementation((listings) => {
      const newest = listings.find((listing) => listing.id === 'installed');
      if (newest) {
        held.mockReturnValue([installed(newest.version)]);
      }
      return listings.length;
    });
    newestFromList(registration.store);
    try {
      // A check under way when the publication lands, asked of version 1.
      const underWay = handlers.get('scene-packs-refresh')?.({});
      expect(await registration.refreshFor('installed', 2)).toBe(true);
      await underWay;
      expect(registration.store.newestVersion('installed')).toBe(2);
      // The control: a version nobody published is not claimed as held.
      expect(await registration.refreshFor('installed', 3)).toBe(false);
    } finally {
      registration.dispose();
    }
  });

  it('asks about the scenes added from the gallery when the looks are opened', async () => {
    const server = serve([]);
    const refreshGalleryScenes = jest.fn(async () => {});
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
      // Every scene this account's, as while Plus lasts.
      ownership: { owns: () => true, subscribe: () => () => undefined },
      fetchImpl: server.fetchImpl,
      refreshGalleryScenes,
    });
    try {
      await handlers.get('scene-packs-refresh')?.({});
      expect(refreshGalleryScenes).toHaveBeenCalledTimes(1);
    } finally {
      registration.dispose();
    }
  });
});

/** A registration whose store holds Aurora. */
const withAuroraHeld = () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'scene-failure-'));
  const warn = jest.fn();
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
    ownership: { owns: () => true, subscribe: () => () => undefined },
    logger: { info: jest.fn(), warn },
  });
  const source = 'vec4 sceneColour(vec2 uv) { return vec4(1.0); }';
  jest
    .spyOn(registration.store, 'load')
    .mockReturnValue({ id: 'aurora', source } as ReturnType<
      typeof registration.store.load
    >);
  return { root, registration, warn };
};

// A desktop background's page has no channel of its own to report on, so
// main hands its scene's failure to the same handler the graph's goes into.
// Nothing about it is written to disk any more: it is logged for an
// operator to see, and the scene still loads on the very next attempt.
it('logs a failure main reports, without gating a later load of the same pack', () => {
  const { root, registration, warn } = withAuroraHeld();
  try {
    registration.reportFailure('aurora', 'context-lost');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('aurora'));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('context-lost'));
    expect(registration.store.load('aurora')).toBeDefined();
  } finally {
    registration.dispose();
    fs.rmSync(root, { recursive: true, force: true });
  }
});

it('logs whatever reason is reported, over the IPC channel too', () => {
  const { root, registration, warn } = withAuroraHeld();
  try {
    handlers.get('scene-packs-report-failure')?.({}, 'aurora', 'gpu-reset');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('gpu-reset'));
    handlers.get('scene-packs-report-failure')?.({}, 'aurora', 'everything');
    // A reason that is not one of the three real ones is not taken at all.
    expect(warn).toHaveBeenCalledTimes(1);
    expect(registration.store.load('aurora')).toBeDefined();
  } finally {
    registration.dispose();
    fs.rmSync(root, { recursive: true, force: true });
  }
});
