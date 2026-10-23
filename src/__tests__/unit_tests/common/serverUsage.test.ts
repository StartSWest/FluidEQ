/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The admin's Server page reads two answers: how full the server is
 * (`admin_server_usage`, premium 0053) and the week's requests (the
 * `admin-server-usage` function). Anything that does not read is the
 * server's fault, never a number made up on the page.
 */

import {
  parseRequestUsage,
  parseServerUsage,
  requestTotal,
  shareOf,
} from '../../../common/serverUsage';

const usage = {
  database_bytes: 66_480_128,
  tables: [{ name: 'public.scene_packs', bytes: 40_000_000 }],
  buckets: [{ bucket: 'member-scenes', files: 212, bytes: 155_189_248 }],
  accounts: 1384,
  active_accounts: 611,
  measured_at: '2026-10-12T23:24:00Z',
};

describe('how full the server is', () => {
  it('reads the server’s answer', () => {
    expect(parseServerUsage(usage)).toEqual({
      databaseBytes: 66_480_128,
      tables: [{ name: 'public.scene_packs', bytes: 40_000_000 }],
      buckets: [{ bucket: 'member-scenes', files: 212, bytes: 155_189_248 }],
      accounts: 1384,
      activeAccounts: 611,
      measuredAt: Date.parse('2026-10-12T23:24:00Z'),
    });
  });

  it('refuses an answer with a number missing, negative or out of shape', () => {
    expect(parseServerUsage({ ...usage, database_bytes: -1 })).toBeUndefined();
    expect(
      parseServerUsage({ ...usage, active_accounts: '611' }),
    ).toBeUndefined();
    expect(parseServerUsage({ ...usage, measured_at: 'soon' })).toBeUndefined();
    expect(
      parseServerUsage({ ...usage, buckets: [{ bucket: 'x', files: 1 }] }),
    ).toBeUndefined();
    expect(parseServerUsage({ ...usage, tables: {} })).toBeUndefined();
    expect(parseServerUsage(null)).toBeUndefined();
  });

  it('says how full a limit is, past full once it is exceeded', () => {
    expect(shareOf(250, 500)).toBe(0.5);
    expect(shareOf(600, 500)).toBe(1.2);
    expect(shareOf(5, 0)).toBe(0);
  });
});

describe('the week’s requests', () => {
  const points = [
    { at: 1, rest: 900, auth: 40, storage: 71, realtime: 0 },
    { at: 2, rest: 800, auth: 30, storage: 0, realtime: 5 },
  ];

  it('reads the counts, and adds them up by kind or in all', () => {
    const read = parseRequestUsage({ configured: true, points });
    expect(read).toEqual({ state: 'ready', points });
    expect(requestTotal(points)).toBe(1846);
    expect(requestTotal(points, 'auth')).toBe(70);
  });

  it('tells a server with no usage key from one whose key was refused', () => {
    expect(parseRequestUsage({ configured: false })).toEqual({
      state: 'unconfigured',
    });
    expect(parseRequestUsage({ configured: true, error: 'token' })).toEqual({
      state: 'token',
    });
  });

  it('refuses any other failure or a point out of shape', () => {
    expect(
      parseRequestUsage({ configured: true, error: 'usage' }),
    ).toBeUndefined();
    expect(
      parseRequestUsage({ configured: true, points: [{ at: 1, rest: 2 }] }),
    ).toBeUndefined();
    expect(parseRequestUsage('nonsense')).toBeUndefined();
  });
});
