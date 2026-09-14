/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The admin's account deletion over IPC: what reaches the server, what is
 * refused before it does, and how each of the server's answers reads. Who is
 * the admin, and which accounts may go, is the server's rule (premium 0031),
 * so a refusal is only ever read here.
 */

const handlers = new Map<string, (...args: unknown[]) => unknown>();
jest.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, fn: (...args: unknown[]) => unknown) =>
      handlers.set(channel, fn),
    removeHandler: (channel: string) => handlers.delete(channel),
  },
}));

/* eslint-disable import/first -- the electron mock must be installed first */
import type { IAccountConfig } from '../../../common/accountConfig';
import {
  registerAccountDeletionIpc,
  type TDeleteAccountOutcome,
  type TFindAccountsOutcome,
} from '../../../main/ipc/accountDeletion';
import type { IGalleryAccess } from '../../../main/plus/galleryAccess';
import { fakeResponse, ME, SOMEONE } from '../../utils/memberSceneFixtures';
/* eslint-enable import/first */

const config = {
  supabaseUrl: 'https://project.supabase.co',
  supabaseAnonKey: 'anon',
  apiUrl: 'https://project.supabase.co/functions/v1',
} as IAccountConfig;

interface ICall {
  url: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
}

let answer: () => Promise<Response>;
let calls: ICall[];
let account: string | undefined;

const fetchImpl = (async (input: string | URL, init?: RequestInit) => {
  calls.push({
    url: String(input),
    headers: (init?.headers ?? {}) as Record<string, string>,
    body: JSON.parse(String(init?.body ?? '{}')),
  });
  return answer();
}) as unknown as typeof fetch;

const access = (): IGalleryAccess => ({
  accountId: () => account,
  entitled: () => account !== undefined,
  auth: async () =>
    account ? { config, accessToken: 'token', fetchImpl } : undefined,
});

const invoke = <T>(channel: string, ...args: unknown[]) => {
  const handler = handlers.get(channel);
  if (!handler) {
    throw new Error(`no handler for ${channel}`);
  }
  return handler({}, ...args) as Promise<T>;
};

const reply = (status: number, body: unknown) => {
  answer = async () => fakeResponse(status, body);
};

const row = {
  user_id: SOMEONE,
  email: 'Leaving@Example.com',
  created_at: '2026-03-01T12:00:00Z',
  confirmed: true,
  admin: false,
  handle: 'leaving_one',
  display_name: 'Leaving',
  plan: null,
  plus_until: null,
  published: 2,
  board_days: 9,
  likes: 4,
  adds: 1,
  reports: 0,
  gifted: false,
  deleting: false,
};

beforeEach(() => {
  handlers.clear();
  calls = [];
  account = ME;
  reply(200, []);
  registerAccountDeletionIpc({ access: access() });
});

describe('finding the account behind an address', () => {
  it('asks with the address trimmed and lowercased, as the account itself', async () => {
    reply(200, [row]);
    const found = await invoke<TFindAccountsOutcome>(
      'account-deletion-find',
      '  Leaving@Example.COM ',
    );
    expect(calls).toEqual([
      {
        url: 'https://project.supabase.co/rest/v1/rpc/admin_find_account',
        headers: expect.objectContaining({ Authorization: 'Bearer token' }),
        body: { p_email: 'leaving@example.com' },
      },
    ]);
    expect(found).toEqual({
      ok: true,
      accounts: [
        expect.objectContaining({
          userId: SOMEONE,
          email: 'Leaving@Example.com',
          published: 2,
          boardDays: 9,
        }),
      ],
    });
  });

  it('answers nothing found only when the server found nothing', async () => {
    reply(200, []);
    expect(await invoke('account-deletion-find', 'nobody@example.com')).toEqual(
      { ok: true, accounts: [] },
    );

    // A row that does not read is a failure, never one account fewer.
    reply(200, [row, { ...row, user_id: 'not-an-id' }]);
    expect(
      await invoke('account-deletion-find', 'leaving@example.com'),
    ).toEqual({ ok: false, reason: 'server' });
  });

  it.each([
    [403, { code: '42501', message: 'admin_required' }, 'forbidden'],
    [400, { code: '22023', message: 'invalid_email' }, 'invalid'],
    [401, { message: 'JWT expired' }, 'signed-out'],
    [500, { message: 'boom' }, 'server'],
  ])('reads %s from the server as %s', async (status, body, reason) => {
    reply(status, body);
    expect(
      await invoke('account-deletion-find', 'leaving@example.com'),
    ).toEqual({ ok: false, reason });
  });

  it('refuses a malformed address without asking, and a signed-out window never asks', async () => {
    expect(await invoke('account-deletion-find', 'leaving')).toEqual({
      ok: false,
      reason: 'invalid',
    });
    expect(await invoke('account-deletion-find', 42)).toEqual({
      ok: false,
      reason: 'invalid',
    });
    account = undefined;
    expect(
      await invoke('account-deletion-find', 'leaving@example.com'),
    ).toEqual({ ok: false, reason: 'signed-out' });
    expect(calls).toEqual([]);
  });

  it('drops an answer that arrives after a different account signed in', async () => {
    answer = async () => {
      account = SOMEONE;
      return fakeResponse(200, [row]);
    };
    expect(
      await invoke('account-deletion-find', 'leaving@example.com'),
    ).toEqual({ ok: false, reason: 'signed-out' });
  });
});

describe('deleting it', () => {
  it('sends the address to the delete-account function with the account token', async () => {
    reply(200, { deleted: true, files: 12 });
    const outcome = await invoke<TDeleteAccountOutcome>(
      'account-deletion-delete',
      ' Leaving@Example.com',
    );
    expect(outcome).toEqual({ ok: true, files: 12 });
    expect(calls).toEqual([
      {
        url: 'https://project.supabase.co/functions/v1/delete-account',
        headers: expect.objectContaining({
          apikey: 'anon',
          Authorization: 'Bearer token',
        }),
        body: { email: 'leaving@example.com' },
      },
    ]);
  });

  it.each([
    [404, { error: 'no_account' }, 'no-account'],
    [422, { error: 'refused', reason: 'admin_account' }, 'admin-account'],
    [422, { error: 'refused', reason: 'something_new' }, 'server'],
    [502, { error: 'unfinished' }, 'unfinished'],
    [403, { error: 'forbidden' }, 'forbidden'],
    [401, { error: 'unauthorized' }, 'signed-out'],
    [400, { error: 'invalid' }, 'invalid'],
    [500, { error: 'server' }, 'server'],
    [200, { deleted: false }, 'server'],
    [200, { deleted: true, files: -1 }, 'server'],
    [200, 'not json', 'server'],
  ])('reads %s %j as %s', async (status, body, reason) => {
    reply(status, body);
    expect(
      await invoke('account-deletion-delete', 'leaving@example.com'),
    ).toEqual({ ok: false, reason });
  });

  it('says offline when the request never came back', async () => {
    answer = async () => {
      throw new TypeError('fetch failed');
    };
    expect(
      await invoke('account-deletion-delete', 'leaving@example.com'),
    ).toEqual({ ok: false, reason: 'offline' });
  });

  it('refuses a malformed address or no account without calling the function', async () => {
    expect(await invoke('account-deletion-delete', 'leaving@')).toEqual({
      ok: false,
      reason: 'invalid',
    });
    account = undefined;
    expect(
      await invoke('account-deletion-delete', 'leaving@example.com'),
    ).toEqual({ ok: false, reason: 'signed-out' });
    expect(calls).toEqual([]);
  });

  it('takes its channels away when disposed', () => {
    handlers.clear();
    const registered = registerAccountDeletionIpc({ access: access() });
    expect([...handlers.keys()].sort()).toEqual([
      'account-deletion-delete',
      'account-deletion-find',
    ]);
    registered.dispose();
    expect(handlers.size).toBe(0);
  });
});
