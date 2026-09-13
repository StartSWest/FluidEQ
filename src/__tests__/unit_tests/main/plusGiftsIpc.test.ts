/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The admin's Plus gifts over IPC: what reaches the server, what is refused
 * before it does, and how the server's answers read. Who is the admin is the
 * server's rule (premium 0021), so a refusal is only ever read here.
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
  registerPlusGiftsIpc,
  type TPlusGiftActOutcome,
  type TPlusGiftsListOutcome,
} from '../../../main/ipc/plusGifts';
import type { IGalleryAccess } from '../../../main/plus/galleryAccess';
import { fakeResponse, ME } from '../../utils/memberSceneFixtures';
/* eslint-enable import/first */

const config = {
  supabaseUrl: 'https://project.supabase.co',
  supabaseAnonKey: 'anon',
  apiUrl: 'https://project.supabase.co/functions/v1',
} as IAccountConfig;

const NOW = Date.UTC(2026, 8, 13, 12);

let answer: Response;
let calls: Array<{ url: string; body: Record<string, unknown> }>;
let signedIn: boolean;

const fetchImpl = (async (input: string | URL, init?: RequestInit) => {
  calls.push({
    url: String(input),
    body: JSON.parse(String(init?.body ?? '{}')),
  });
  return answer;
}) as unknown as typeof fetch;

const access = (): IGalleryAccess => ({
  accountId: () => (signedIn ? ME : undefined),
  entitled: () => signedIn,
  auth: async () =>
    signedIn ? { config, accessToken: 'token', fetchImpl } : undefined,
});

const invoke = <T>(channel: string, ...args: unknown[]) => {
  const handler = handlers.get(channel);
  if (!handler) {
    throw new Error(`no handler for ${channel}`);
  }
  return handler({}, ...args) as Promise<T>;
};

beforeEach(() => {
  handlers.clear();
  calls = [];
  signedIn = true;
  answer = fakeResponse(200, null);
  registerPlusGiftsIpc({ access: access(), now: () => NOW });
});

describe('the Plus gifts list', () => {
  it('reads the rows, dropping what is not one, with an open-ended gift having no end', async () => {
    answer = fakeResponse(200, [
      {
        email: 'friend@example.com',
        note: 'tester',
        until: null,
        created_at: '2026-09-01T10:00:00Z',
        has_account: true,
        active: true,
      },
      {
        email: 'later@example.com',
        note: null,
        until: '2026-12-01T00:00:00Z',
        created_at: '2026-09-02T10:00:00Z',
        has_account: false,
        active: true,
      },
      {
        email: 'not an address',
        created_at: '2026-09-02T10:00:00Z',
        has_account: false,
        active: true,
      },
    ]);
    const listed = await invoke<TPlusGiftsListOutcome>('plus-gifts-list');
    expect(calls[0].url).toBe(
      'https://project.supabase.co/rest/v1/rpc/admin_plus_gifts',
    );
    expect(listed).toEqual({
      ok: true,
      gifts: [
        {
          email: 'friend@example.com',
          note: 'tester',
          createdAt: Date.parse('2026-09-01T10:00:00Z'),
          hasAccount: true,
          active: true,
        },
        {
          email: 'later@example.com',
          until: Date.parse('2026-12-01T00:00:00Z'),
          createdAt: Date.parse('2026-09-02T10:00:00Z'),
          hasAccount: false,
          active: true,
        },
      ],
    });
  });

  it('says a member was refused, and a signed-out window never asks', async () => {
    answer = fakeResponse(403, { code: '42501', message: 'admin_required' });
    expect(await invoke('plus-gifts-list')).toEqual({
      ok: false,
      reason: 'forbidden',
    });
    signedIn = false;
    calls = [];
    expect(await invoke('plus-gifts-list')).toEqual({
      ok: false,
      reason: 'signed-out',
    });
    expect(calls).toEqual([]);
  });
});

describe('giving and taking back', () => {
  it('sends the address lowercased, the note trimmed, and the end as a date', async () => {
    const until = NOW + 7 * 86_400_000;
    const outcome = await invoke<TPlusGiftActOutcome>('plus-gifts-give', {
      email: '  Friend@Example.COM ',
      note: '  beta tester ',
      until,
    });
    expect(outcome).toEqual({ ok: true });
    expect(calls).toEqual([
      {
        url: 'https://project.supabase.co/rest/v1/rpc/admin_give_plus',
        body: {
          p_email: 'friend@example.com',
          p_note: 'beta tester',
          p_until: new Date(until).toISOString(),
        },
      },
    ]);
  });

  it('gives with no note and no end as nulls, which the server reads as "until taken back"', async () => {
    await invoke('plus-gifts-give', { email: 'a@b.co' });
    expect(calls[0].body).toEqual({
      p_email: 'a@b.co',
      p_note: null,
      p_until: null,
    });
  });

  it.each([
    ['an address that is not one', { email: 'friend' }],
    [
      'a note longer than the server keeps',
      { email: 'a@b.co', note: 'x'.repeat(201) },
    ],
    ['an end that has passed', { email: 'a@b.co', until: NOW - 1 }],
    ['an end that is not a number', { email: 'a@b.co', until: 'tomorrow' }],
    ['nothing at all', undefined],
  ])('refuses %s without asking the server', async (_label, gift) => {
    expect(await invoke('plus-gifts-give', gift)).toEqual({
      ok: false,
      reason: 'invalid',
    });
    expect(calls).toEqual([]);
  });

  it('reads the server refusing a value as invalid', async () => {
    answer = fakeResponse(400, { code: '22023', message: 'until_in_past' });
    expect(await invoke('plus-gifts-give', { email: 'a@b.co' })).toEqual({
      ok: false,
      reason: 'invalid',
    });
  });

  it('takes back by address, lowercased, and refuses anything else', async () => {
    expect(await invoke('plus-gifts-take-back', 'Friend@Example.com')).toEqual({
      ok: true,
    });
    expect(calls[0]).toEqual({
      url: 'https://project.supabase.co/rest/v1/rpc/admin_take_back_plus',
      body: { p_email: 'friend@example.com' },
    });
    expect(await invoke('plus-gifts-take-back', 42)).toEqual({
      ok: false,
      reason: 'invalid',
    });
    expect(calls).toHaveLength(1);
  });
});
