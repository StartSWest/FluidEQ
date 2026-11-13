/**
 * @jest-environment node
 */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import fs from 'fs';
import os from 'os';
import path from 'path';
import type { TAudioEngine } from '../../../common/audioEngine';
import {
  createEngineCount,
  ENGINE_COUNT_TERMS,
  localDay,
} from '../../../main/account/engineCount';

// The anonymous daily engine count (Ivan, 2026-11-13: "solo totales";
// premium 0110): one word, at most once a day per computer, only for a
// signed-in account shown the terms that say so. Each refusal beside the
// same call made, so a counter that never sent could not pass.

const ACCOUNT = '4f1c2b9e-8d3a-4e7b-9c11-2a6f0d5e7b30';
const config = {
  supabaseUrl: 'https://example.supabase.co',
  supabaseAnonKey: 'anon-key',
  apiUrl: 'https://example.supabase.co/functions/v1',
};

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'engine-count-'));
});
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

const setup = ({
  engine = 'fluid' as TAudioEngine | null,
  account = ACCOUNT as string | null,
  told = ENGINE_COUNT_TERMS,
  status = 204,
  fails = false,
  day = new Date(2026, 10, 13, 9, 30),
} = {}) => {
  let now = day;
  const fetchImpl = jest.fn(async () => {
    if (fails) {
      throw new Error('offline');
    }
    return new Response(null, { status });
  });
  const counter = createEngineCount({
    config,
    userDataDir: dir,
    getEngine: () => engine,
    accountId: () => account ?? undefined,
    accessToken: async () => 'token-1',
    toldOf: (version) => told >= version,
    logger: { warn: jest.fn() },
    fetchImpl: fetchImpl as unknown as typeof fetch,
    now: () => now,
  });
  return {
    counter,
    fetchImpl,
    setNow: (next: Date) => {
      now = next;
    },
  };
};

const sentBodies = (fetchImpl: jest.Mock) =>
  fetchImpl.mock.calls.map((call) => {
    const init = (call as unknown[])[1] as RequestInit;
    return JSON.parse(String(init.body));
  });

describe('the anonymous daily engine count', () => {
  it('sends the engine once a day, and nothing that names anybody', async () => {
    const { counter, fetchImpl } = setup();
    await counter.countIfDue('launch');
    await counter.countIfDue('wake from sleep');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [
      URL,
      RequestInit,
    ];
    expect(String(url)).toBe(
      'https://example.supabase.co/rest/v1/rpc/count_audio_engine',
    );
    // One word in the body, nothing in the address: no account id, no
    // computer, no time. The token is the call's permission, not data kept.
    expect(sentBodies(fetchImpl)).toEqual([{ p_engine: 'fluid' }]);
    expect(new URL(String(url)).search).toBe('');
    expect(init.headers).toMatchObject({ Authorization: 'Bearer token-1' });
    // What this computer keeps: the date, and nothing else.
    expect(
      JSON.parse(fs.readFileSync(path.join(dir, 'engine-count.json'), 'utf8')),
    ).toEqual({ day: '2026-11-13' });
  });

  it('counts again on the next day', async () => {
    const { counter, fetchImpl, setNow } = setup();
    await counter.countIfDue('launch');
    setNow(new Date(2026, 10, 14, 0, 5));
    await counter.countIfDue('wake from sleep');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('counts a computer with no engine chosen as none', async () => {
    const { counter, fetchImpl } = setup({ engine: null });
    await counter.countIfDue('launch');
    expect(sentBodies(fetchImpl)).toEqual([{ p_engine: 'none' }]);
  });

  it('sends nothing for an account not yet shown the terms that say so', async () => {
    const { counter, fetchImpl } = setup({ told: ENGINE_COUNT_TERMS - 1 });
    await counter.countIfDue('launch');
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(fs.existsSync(path.join(dir, 'engine-count.json'))).toBe(false);
  });

  it('sends nothing for a computer nobody is signed in on', async () => {
    const { counter, fetchImpl } = setup({ account: null });
    await counter.countIfDue('launch');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('tries again at the next event when it could not send', async () => {
    const failing = setup({ fails: true });
    await failing.counter.countIfDue('launch');
    expect(fs.existsSync(path.join(dir, 'engine-count.json'))).toBe(false);
    const refused = setup({ status: 500 });
    await refused.counter.countIfDue('launch');
    await refused.counter.countIfDue('wake from sleep');
    expect(refused.fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('marks the day when the server has nothing to count into yet', async () => {
    const { counter, fetchImpl } = setup({ status: 404 });
    await counter.countIfDue('launch');
    await counter.countIfDue('wake from sleep');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('sends once when two events arrive together', async () => {
    const { counter, fetchImpl } = setup();
    await Promise.all([
      counter.countIfDue('launch'),
      counter.countIfDue('unlock-screen'),
    ]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('waits for terms revision 13, the text that says this count is made', () => {
    expect(ENGINE_COUNT_TERMS).toBe(13);
  });

  it('reads the day on this computer’s own calendar', () => {
    expect(localDay(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });
});
