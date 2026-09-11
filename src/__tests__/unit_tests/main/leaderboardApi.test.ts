/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later

@jest-environment node
*/

import {
  createLeaderboardApi,
  readMyRank,
  readRow,
} from '../../../main/usage/leaderboardApi';

const CONFIG = {
  supabaseUrl: 'https://project.supabase.co',
  supabaseAnonKey: `sb_publishable_${'a'.repeat(40)}`,
  apiUrl: 'https://project.supabase.co/functions/v1',
  plusPrice: '',
  plusYearlyPrice: '',
};

const token = `h.${Buffer.from(JSON.stringify({ sub: 'me' })).toString('base64url')}.s`;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

describe('reading the board', () => {
  /** PostgREST hands `bigint` back as a string; the row must still read. */
  it('reads a row whether the numbers arrive as numbers or strings', () => {
    expect(
      readRow({
        rank: '1',
        handle: 'ada',
        display_name: 'Ada',
        role: 'admin',
        points: '2310',
        minutes: '540',
        active_days: '9',
        likes: '7',
      }),
    ).toEqual({
      rank: 1,
      handle: 'ada',
      displayName: 'Ada',
      role: 'admin',
      points: 2310,
      minutes: 540,
      activeDays: 9,
      likes: 7,
    });
    expect(readRow({ rank: 2, handle: 'bob', minutes: 10 })).toMatchObject({
      displayName: 'bob',
      role: 'member',
    });
  });

  /**
   * A server that has not run migration 0014 yet still sends the channels'
   * two parts and the contributor role. Neither reaches the board: the parts
   * are not read, and a contributor is a member.
   */
  it('reads a row from a server that still has the channels', () => {
    const row = readRow({
      rank: 3,
      handle: 'lena',
      role: 'contributor',
      points: 900,
      minutes: 3_000,
      active_days: 12,
      messages: 40,
      mentions: 9,
      likes: 0,
    });
    expect(row).toEqual({
      rank: 3,
      handle: 'lena',
      displayName: 'lena',
      role: 'member',
      points: 900,
      minutes: 3_000,
      activeDays: 12,
      likes: 0,
    });
  });

  /** A server still on the hours-only board scores by hours; the row must read. */
  it('scores an old server’s hours-only row by its hours', () => {
    expect(readRow({ rank: 1, handle: 'ada', minutes: 600 })).toEqual({
      rank: 1,
      handle: 'ada',
      displayName: 'ada',
      role: 'member',
      points: 100,
      minutes: 600,
      activeDays: 0,
      likes: 0,
    });
  });

  it('refuses a row with no handle or a negative count', () => {
    expect(readRow({ rank: 1, minutes: 5 })).toBeUndefined();
    expect(readRow({ rank: 1, handle: 'x', minutes: -1 })).toBeUndefined();
  });

  it('reads my rank from the function’s single-row answer', () => {
    expect(
      readMyRank([{ rank: '7', points: '260', minutes: '120', players: '42' }]),
    ).toEqual({
      rank: 7,
      points: 260,
      minutes: 120,
      activeDays: 0,
      likes: 0,
      players: 42,
    });
    expect(readMyRank([])).toBeUndefined();
  });
});

describe('the leaderboard API', () => {
  let fetchImpl: jest.Mock;
  const COMPUTER = '0b6e3f2a-3c1d-4e5f-8a9b-1c2d3e4f5a6b';
  const build = () =>
    createLeaderboardApi({
      config: CONFIG,
      accessToken: () => Promise.resolve(token),
      computerId: () => COMPUTER,
      fetchImpl,
    });

  beforeEach(() => {
    fetchImpl = jest.fn();
  });

  /**
   * Exactly the date and the minutes, this computer's random id, and the
   * account's own id for the conflict target. The app version and the
   * language were sent once and read by nothing; `toEqual` fails the day a
   * field comes back.
   */
  it('uploads one row per day for this computer, replacing on conflict, with the date and minutes only', async () => {
    fetchImpl.mockResolvedValue(new Response(null, { status: 204 }));
    await build().uploadDays([{ day: '2026-09-07', minutes: 95 }]);
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('usage_device_days?on_conflict=user_id,device,day');
    expect((init.headers as Record<string, string>).Prefer).toContain(
      'resolution=merge-duplicates',
    );
    const body = JSON.parse(String(init.body)) as Record<string, unknown>[];
    expect(body).toEqual([
      { user_id: 'me', device: COMPUTER, day: '2026-09-07', minutes: 95 },
    ]);
  });

  it('sends nothing when there is nothing pending', async () => {
    await build().uploadDays([]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('asks the board function for the period', async () => {
    fetchImpl.mockResolvedValue(json([{ rank: 1, handle: 'ada', minutes: 9 }]));
    const rows = await build().fetchBoard('month');
    expect(rows).toHaveLength(1);
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('rpc/leaderboard');
    expect(JSON.parse(String(init.body))).toEqual({ period: 'month' });
  });

  it('maps the server’s refusal of a non-paying account', async () => {
    fetchImpl.mockResolvedValue(json({ message: 'P0001: plus_required' }, 400));
    await expect(
      build().uploadDays([{ day: '2026-09-07', minutes: 1 }]),
    ).rejects.toMatchObject({ failure: 'plus_required' });
  });

  it('deletes only my own rows: every computer’s reports, then the days', async () => {
    fetchImpl.mockImplementation(() =>
      Promise.resolve(new Response(null, { status: 204 })),
    );
    await build().deleteMine();
    const calls = fetchImpl.mock.calls as [string, RequestInit][];
    expect(calls.map(([, init]) => init.method)).toEqual(['DELETE', 'DELETE']);
    expect(calls[0][0]).toContain('usage_device_days?user_id=eq.me');
    expect(calls[1][0]).toContain('usage_days?user_id=eq.me');
  });
});
