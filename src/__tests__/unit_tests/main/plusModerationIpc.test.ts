/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * @jest-environment node
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
import { FLUIDEQ_CREATOR_ID } from '../../../common/plusGallery';
import {
  registerPlusModerationIpc,
  type TModerationActOutcome,
  type TModerationListOutcome,
  type TModerationStatusOutcome,
} from '../../../main/ipc/plusModeration';
import type { IGalleryAccess } from '../../../main/plus/galleryAccess';
import { fakeResponse, ME, SOMEONE } from '../../utils/memberSceneFixtures';
/* eslint-enable import/first */

const config = {
  supabaseUrl: 'https://project.supabase.co',
  supabaseAnonKey: 'anon',
  apiUrl: 'https://project.supabase.co/functions/v1',
} as IAccountConfig;

const invoke = <T>(channel: string, ...args: unknown[]) => {
  const handler = handlers.get(channel);
  if (!handler) {
    throw new Error(`no handler for ${channel}`);
  }
  return handler({}, ...args) as Promise<T>;
};

let signedIn: boolean;
let signedInAs: string;
let switchDuringAuth: boolean;
let answer: Response;
let calls: Array<{ url: string; body: Record<string, unknown> }>;
let onBlockListChanged: jest.Mock;

const fetchImpl = (async (input: string | URL, init?: RequestInit) => {
  calls.push({
    url: String(input),
    body: JSON.parse(String(init?.body ?? '{}')),
  });
  return answer;
}) as unknown as typeof fetch;

const access = (): IGalleryAccess => ({
  accountId: () => (signedIn ? signedInAs : undefined),
  entitled: () => signedIn,
  auth: async () => {
    if (switchDuringAuth) {
      signedInAs = SOMEONE;
    }
    return signedIn ? { config, accessToken: 'token', fetchImpl } : undefined;
  },
});

const reportedRow = {
  author_id: SOMEONE,
  author_name: 'Mei Tanaka',
  author_handle: 'mei',
  scene_id: 'neon-city',
  version: 2,
  category: 'cities',
  names: { en: 'Neon City' },
  swatch: ['#050a1a', '#00e5cf'],
  has_photo: false,
  likes: 0,
  likes_week: 0,
  adds: 0,
  updated_at: '2026-09-10T12:00:00.000Z',
  liked: false,
  added: false,
  author_banned: false,
  taken_down_at: null,
  reports: 3,
  rights: 0,
  flashing: 3,
  offensive: 0,
  broken: 0,
};

beforeEach(() => {
  handlers.clear();
  signedIn = true;
  signedInAs = ME;
  switchDuringAuth = false;
  answer = fakeResponse(200, { admin: true, open: 2 });
  calls = [];
  onBlockListChanged = jest.fn(async () => undefined);
  registerPlusModerationIpc({ access: access(), onBlockListChanged });
});

describe('asking whether this account is the admin', () => {
  it('asks the server, which is where the answer lives', async () => {
    await expect(
      invoke<TModerationStatusOutcome>('plus-moderation-status'),
    ).resolves.toEqual({ ok: true, status: { admin: true, open: 2 } });
    expect(calls[0].url).toBe(
      'https://project.supabase.co/rest/v1/rpc/moderation_status',
    );
  });

  it('asks nothing while signed out', async () => {
    signedIn = false;
    await expect(
      invoke<TModerationStatusOutcome>('plus-moderation-status'),
    ).resolves.toEqual({ ok: false, reason: 'signed-out' });
    expect(calls).toHaveLength(0);
  });

  it('drops an answer for an account that is no longer the one signed in', async () => {
    switchDuringAuth = true;
    await expect(
      invoke<TModerationStatusOutcome>('plus-moderation-status'),
    ).resolves.toEqual({ ok: false, reason: 'signed-out' });
  });
});

describe('the lists', () => {
  it('reads the open list, row by row', async () => {
    answer = fakeResponse(200, [reportedRow, { scene_id: 'broken row' }]);
    const outcome = await invoke<TModerationListOutcome>(
      'plus-moderation-list',
      'open',
    );
    expect(calls[0].body).toEqual({ p_list: 'open' });
    expect(outcome.ok && outcome.scenes.map((entry) => entry.reports)).toEqual([
      3,
    ]);
  });

  it('refuses a list it does not know without asking the server', async () => {
    await expect(
      invoke<TModerationListOutcome>('plus-moderation-list', 'everything'),
    ).resolves.toEqual({ ok: false, reason: 'server' });
    expect(calls).toHaveLength(0);
  });

  it('says so when the server refuses a member', async () => {
    answer = fakeResponse(403, { code: '42501', message: 'admin_required' });
    await expect(
      invoke<TModerationListOutcome>('plus-moderation-list', 'open'),
    ).resolves.toEqual({ ok: false, reason: 'forbidden' });
  });
});

describe('the answers', () => {
  it('takes a scene down by author and scene, then refreshes the block list', async () => {
    answer = fakeResponse(200, null);
    await expect(
      invoke<TModerationActOutcome>(
        'plus-moderation-act',
        'take-down',
        SOMEONE,
        'neon-city',
      ),
    ).resolves.toEqual({ ok: true });
    expect(calls[0].url).toMatch(/rpc\/admin_take_down_scene$/);
    expect(calls[0].body).toEqual({ p_author: SOMEONE, p_scene: 'neon-city' });
    expect(onBlockListChanged).toHaveBeenCalledTimes(1);
  });

  it('dismisses reports without touching the block list', async () => {
    answer = fakeResponse(200, null);
    await invoke('plus-moderation-act', 'dismiss', SOMEONE, 'neon-city');
    expect(calls[0].url).toMatch(/rpc\/admin_dismiss_scene_reports$/);
    expect(onBlockListChanged).not.toHaveBeenCalled();
  });

  it('restores a scene and refreshes the block list', async () => {
    answer = fakeResponse(200, null);
    await invoke('plus-moderation-act', 'restore', SOMEONE, 'neon-city');
    expect(calls[0].url).toMatch(/rpc\/admin_restore_scene$/);
    expect(onBlockListChanged).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['an answer it does not know', ['ban', SOMEONE, 'neon-city']],
    ['a scene id that is a path', ['take-down', SOMEONE, '../../etc']],
    ['an author that is not an id', ['take-down', 'mei', 'neon-city']],
    ['FluidEQ’s own scenes', ['take-down', FLUIDEQ_CREATOR_ID, 'aurora']],
  ])('refuses %s without asking the server', async (_label, args) => {
    await expect(
      invoke<TModerationActOutcome>('plus-moderation-act', ...args),
    ).resolves.toEqual({ ok: false, reason: 'server' });
    expect(calls).toHaveLength(0);
    expect(onBlockListChanged).not.toHaveBeenCalled();
  });

  it('refreshes nothing when the server refuses the answer', async () => {
    answer = fakeResponse(403, { code: '42501' });
    await expect(
      invoke<TModerationActOutcome>(
        'plus-moderation-act',
        'take-down',
        SOMEONE,
        'neon-city',
      ),
    ).resolves.toEqual({ ok: false, reason: 'forbidden' });
    expect(onBlockListChanged).not.toHaveBeenCalled();
  });
});
