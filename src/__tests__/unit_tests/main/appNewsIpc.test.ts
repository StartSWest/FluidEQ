/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */
import fs from 'fs';
import os from 'os';
import path from 'path';
import type { IAppNewsState } from '../../../common/appNews';
import type { IAccountConfig } from '../../../common/accountConfig';
import { registerAppNewsIpc } from '../../../main/ipc/appNews';
import { registerSceneAnnouncementsIpc } from '../../../main/ipc/sceneAnnouncements';
import { fakeResponse } from '../../utils/memberSceneFixtures';

const handlers = new Map<string, (...args: unknown[]) => unknown>();
jest.mock('electron', () => ({
  ipcMain: {
    handle: (name: string, handler: (...args: unknown[]) => unknown) =>
      handlers.set(name, handler),
    removeHandler: (name: string) => handlers.delete(name),
  },
  app: {
    whenReady: () =>
      new Promise<void>(() => {
        /* The launch event is held for this fixture. */
      }),
  },
}));

const config: IAccountConfig = {
  supabaseUrl: 'https://news.example.invalid',
  supabaseAnonKey: 'sb_publishable_fixture',
  apiUrl: 'https://news.example.invalid/functions/v1',
};
const now = Date.parse('2026-10-28T15:00:00Z');
const row = (
  id: number,
  audience = 'everyone',
  start = now - 1000,
  expiry = now + 10000,
) => ({
  kind: 'news',
  id,
  title: `News ${id}`,
  body: `Synthetic body ${id}`,
  audience,
  starts_at: new Date(start).toISOString(),
  expires_at: new Date(expiry).toISOString(),
  action_label: null,
  action_url: null,
});
const network = jest.fn(
  async (_input: Parameters<typeof fetch>[0], _init?: RequestInit) =>
    fakeResponse(200, []),
);
let account: string | undefined;
let directory: string;
let dispose = () => {};
const access = {
  accountId: () => account,
  entitled: () => false,
  owns: () => false,
  auth: async () =>
    account
      ? { config, accessToken: `fixture-${account}`, fetchImpl: network }
      : undefined,
};
const call = async <T>(channel: string, ...args: unknown[]): Promise<T> => {
  const handler = handlers.get(channel);
  if (!handler) {
    throw new Error(`Missing handler ${channel}`);
  }
  return handler({}, ...args) as T;
};
const read = () => call<IAppNewsState>('app-news');
const start = () => {
  const service = registerAppNewsIpc({
    getMainWindow: () => null,
    userDataDir: directory,
    access,
    config,
  });
  dispose = service.dispose;
  return service;
};
const originalFetch = globalThis.fetch;
beforeEach(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-news-'));
  jest.spyOn(Date, 'now').mockReturnValue(now);
  network.mockReset();
  network.mockResolvedValue(fakeResponse(200, []));
  Object.defineProperty(globalThis, 'fetch', {
    configurable: true,
    writable: true,
    value: network,
  });
  account = undefined;
});
afterEach(() => {
  dispose();
  handlers.clear();
  jest.restoreAllMocks();
  Object.defineProperty(globalThis, 'fetch', {
    configurable: true,
    writable: true,
    value: originalFetch,
  });
  if (
    !path.resolve(directory).startsWith(path.join(os.tmpdir(), 'fluideq-news-'))
  ) {
    throw new Error('Unexpected fixture directory');
  }
  fs.rmSync(directory, { recursive: true, force: true });
});

it('delivers public news signed out without putting the publishable key in Authorization', async () => {
  network.mockResolvedValue(fakeResponse(200, [row(1)]));
  await start().refresh();
  expect((await read()).unread).toEqual([1]);
  expect(network.mock.calls[0]?.[1]?.headers).toEqual(
    expect.objectContaining({ apikey: config.supabaseAnonKey }),
  );
  expect(network.mock.calls[0]?.[1]?.headers).not.toHaveProperty(
    'Authorization',
  );
});

it('remembers the backlog beyond an ID cap and across restart and sign-in', async () => {
  const backlog = Array.from({ length: 250 }, (_, i) =>
    row(i + 1, 'everyone', now - 10000 + i),
  );
  network.mockResolvedValue(fakeResponse(200, backlog));
  await start().refresh();
  await call('app-news-seen', 250);
  dispose();
  account = 'A';
  network.mockResolvedValue(fakeResponse(200, backlog.slice(0, 2)));
  await start().refresh();
  expect((await read()).unread).toEqual([]);
  network.mockResolvedValue(
    fakeResponse(200, [row(251, 'everyone', now - 10)]),
  );
  await call('app-news', true);
  expect((await read()).unread).toEqual([251]);
});

it('scopes account read state and never writes private copy into the public cache', async () => {
  account = 'A';
  network.mockResolvedValue(fakeResponse(200, [row(2, 'accounts'), row(1)]));
  const service = start();
  await service.refresh();
  await call('app-news-seen', 2);
  const saved = fs.readFileSync(path.join(directory, 'app-news.json'), 'utf8');
  expect(saved).not.toContain('Synthetic body 2');
  expect(saved).toContain('Synthetic body 1');
  account = undefined;
  await service.refresh();
  expect((await read()).items.map((item) => item.id)).toEqual([1]);
  account = 'B';
  await service.refresh();
  expect((await read()).unread).toEqual([2]);
  account = 'A';
  await service.refresh();
  expect((await read()).unread).toEqual([]);
});

it('aborts a displaced account request and rejects its late response', async () => {
  account = 'A';
  let started = () => {};
  const ready = new Promise<void>((resolve) => {
    started = resolve;
  });
  let signal: AbortSignal | null | undefined;
  network.mockImplementationOnce(
    async (_input, init) =>
      new Promise<Response>((_resolve, reject) => {
        signal = init?.signal;
        started();
        signal?.addEventListener(
          'abort',
          () => reject(new Error('Aborted fixture')),
          { once: true },
        );
      }),
  );
  const service = start();
  const first = service.refresh();
  await ready;
  account = 'B';
  network.mockResolvedValue(fakeResponse(200, [row(3, 'accounts')]));
  const second = service.refresh();
  expect((await read()).items).toEqual([]);
  await Promise.all([first, second]);
  expect(signal?.aborted).toBe(true);
  expect((await read()).items.map((item) => item.id)).toEqual([3]);
});

it('keeps unexpired public copy offline, removes expired content, and clears a missing feed', async () => {
  network.mockResolvedValue(fakeResponse(200, [row(1)]));
  await start().refresh();
  dispose();
  network.mockRejectedValue(new TypeError('Offline fixture'));
  const service = start();
  await service.refresh();
  expect((await read()).offline).toBe(true);
  expect((await read()).items).toHaveLength(1);
  jest.spyOn(Date, 'now').mockReturnValue(now + 20000);
  expect((await read()).items).toEqual([]);
  network.mockResolvedValue(fakeResponse(404, {}));
  await service.refresh();
  expect((await read()).offline).toBe(false);
  expect(
    JSON.parse(fs.readFileSync(path.join(directory, 'app-news.json'), 'utf8'))
      .items,
  ).toEqual([]);
});

it('does not let the displaced account’s pending token refresh block the next identity', async () => {
  account = 'A';
  let entered = () => {};
  const ready = new Promise<void>((resolve) => {
    entered = resolve;
  });
  let finish = (_value: Awaited<ReturnType<typeof access.auth>>) => {};
  jest.spyOn(access, 'auth').mockImplementationOnce(() => {
    entered();
    return new Promise((resolve) => {
      finish = resolve;
    });
  });
  const service = start();
  const first = service.refresh();
  await ready;
  account = 'B';
  network.mockResolvedValue(fakeResponse(200, [row(8, 'accounts')]));
  await Promise.all([first, service.refresh()]);
  expect((await read()).items.map((item) => item.id)).toEqual([8]);
  expect(network).toHaveBeenCalledTimes(1);
  expect(network.mock.calls[0]?.[1]?.headers).toEqual(
    expect.objectContaining({ Authorization: 'Bearer fixture-B' }),
  );
  finish({ config, accessToken: 'fixture-A', fetchImpl: network });
  await Promise.resolve();
  expect(network).toHaveBeenCalledTimes(1);
});

it('does not let a pending general feed hold up existing scene announcements', async () => {
  account = 'A';
  network.mockImplementation(async (input, init) => {
    if (String(input).endsWith('/current_app_news')) {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener(
          'abort',
          () => reject(new Error('Aborted fixture')),
          { once: true },
        );
      });
    }
    return fakeResponse(200, [
      {
        id: 7,
        title: 'Scene news',
        body: '',
        starts_at: new Date(now - 10).toISOString(),
        scenes: [{ scene: 'alpine', version: 1, names: { en: 'Alpine' } }],
      },
    ]);
  });
  const service = registerSceneAnnouncementsIpc({
    getMainWindow: () => null,
    userDataDir: directory,
    access,
    onAccountChange: () => () => undefined,
  });
  dispose = service.dispose;
  await service.refreshIfDue('fixture');
  expect(await call('scene-announcement')).toEqual(
    expect.objectContaining({ id: 7 }),
  );
  await call('scene-announcement-seen', 7);
  expect(await call('scene-announcement')).toBeNull();
});
