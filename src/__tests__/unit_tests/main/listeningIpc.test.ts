/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * How long people listen (premium 0068), and above all what is NOT kept:
 * nothing for an account the server has no answer for, nothing once it
 * switched off — here or on another computer — and never one account's
 * minutes as another's.
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
import fs from 'fs';
import os from 'os';
import path from 'path';
import type { IAccountConfig } from '../../../common/accountConfig';
import type {
  IListeningStatus,
  TListeningOutcome,
} from '../../../common/listening';
import {
  LISTENING_SEND_AFTER_MS,
  registerListeningIpc,
} from '../../../main/ipc/listening';
import type { IGalleryAccess } from '../../../main/plus/galleryAccess';
import { fakeResponse, ME, SOMEONE } from '../../utils/memberSceneFixtures';
/* eslint-enable import/first */

const config = {
  supabaseUrl: 'https://project.supabase.co',
  supabaseAnonKey: 'anon',
  apiUrl: 'https://project.supabase.co/functions/v1',
} as IAccountConfig;

interface ISent {
  user_id: string;
  device: string;
  day: string;
  minutes: number;
}

let dir: string;
let now: number;
let accountId: string | undefined;
let online: boolean;
/** The server's `listening_choices`, by account. */
let choices: Map<string, boolean>;
let sent: ISent[][];
let registration: ReturnType<typeof registerListeningIpc>;
let window: { webContents: { send: jest.Mock } };

const fetchImpl = (async (input: string | URL, init?: RequestInit) => {
  if (!online) {
    throw new TypeError('fetch failed');
  }
  const url = String(input);
  const who = accountId ?? '';
  if (url.includes('/listening_choices')) {
    const choice = choices.get(who);
    return fakeResponse(200, choice === undefined ? [] : [{ sharing: choice }]);
  }
  if (url.includes('/rpc/set_listening_sharing')) {
    const { p_sharing: sharing } = JSON.parse(String(init?.body));
    choices.set(who, sharing);
    return fakeResponse(200, sharing);
  }
  if (url.includes('/usage_device_days')) {
    sent.push(JSON.parse(String(init?.body)));
    return fakeResponse(201, '');
  }
  return fakeResponse(404, '');
}) as unknown as typeof fetch;

const access: IGalleryAccess = {
  accountId: () => accountId,
  entitled: () => false,
  owns: () => false,
  auth: async () =>
    accountId ? { config, accessToken: 'token', fetchImpl } : undefined,
};

const call = (channel: string, ...args: unknown[]) => {
  const handler = handlers.get(channel);
  if (!handler) {
    throw new Error(`${channel} not registered`);
  }
  return handler({}, ...args);
};
const status = () => call('listening-status') as IListeningStatus;
const accrue = (seconds: number) => call('listening-accrue', seconds);
const answer = (sharing: boolean) =>
  call('listening-set-sharing', sharing) as Promise<TListeningOutcome>;

const register = () => {
  registration?.dispose();
  registration = registerListeningIpc({
    getMainWindow: () => window as never,
    userDataDir: dir,
    access,
    entitlement: { subscribe: () => () => undefined },
    now: () => now,
  });
};

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-listening-ipc-'));
  now = new Date(2026, 9, 21, 12).getTime();
  accountId = ME;
  online = true;
  choices = new Map();
  sent = [];
  window = { webContents: { send: jest.fn() } };
  register();
});

afterEach(() => {
  registration.dispose();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('an account never asked', () => {
  it('is asked, and nothing is counted or sent until it answers', async () => {
    await registration.refreshIfDue('launch');
    expect(status()).toEqual({
      signedIn: true,
      choice: 'unasked',
      todayMinutes: 0,
    });
    accrue(600);
    now += LISTENING_SEND_AFTER_MS;
    await registration.refreshIfDue('wake');
    expect(status().todayMinutes).toBe(0);
    expect(sent).toEqual([]);

    // The control: the same listening once it said yes is counted and sent.
    expect((await answer(true)).ok).toBe(true);
    accrue(600);
    now += LISTENING_SEND_AFTER_MS;
    await registration.refreshIfDue('wake');
    expect(status()).toMatchObject({ choice: 'sharing', todayMinutes: 10 });
    expect(sent).toHaveLength(1);
    expect(sent[0]).toEqual([
      expect.objectContaining({ user_id: ME, day: '2026-10-21', minutes: 10 }),
    ]);
  });

  it('is not asked while the server cannot be reached', async () => {
    online = false;
    await registration.refreshIfDue('launch');
    expect(status().choice).toBe('unknown');
    accrue(600);
    expect(status().todayMinutes).toBe(0);
  });
});

describe('an account that said yes', () => {
  beforeEach(async () => {
    choices.set(ME, true);
    await registration.refreshIfDue('launch');
  });

  it('sends each day once, and again only once it grew, from one computer id', async () => {
    accrue(180);
    now += LISTENING_SEND_AFTER_MS;
    await registration.refreshIfDue('wake');
    now += LISTENING_SEND_AFTER_MS;
    await registration.refreshIfDue('wake');
    expect(sent).toHaveLength(1);
    accrue(120);
    now += LISTENING_SEND_AFTER_MS;
    await registration.refreshIfDue('wake');
    expect(sent.map((batch) => batch[0].minutes)).toEqual([3, 5]);
    expect(sent[1][0].device).toBe(sent[0][0].device);
  });

  it('counts after a launch with no connection, on the answer it kept', async () => {
    online = false;
    register();
    await registration.refreshIfDue('launch');
    expect(status().choice).toBe('sharing');
    accrue(120);
    expect(status().todayMinutes).toBe(2);
  });

  it('switched off: forgets what it counted here, and counts nothing more', async () => {
    accrue(600);
    const outcome = await answer(false);
    expect(outcome).toEqual({
      ok: true,
      status: { signedIn: true, choice: 'off', todayMinutes: 0 },
    });
    expect(choices.get(ME)).toBe(false);
    accrue(600);
    now += LISTENING_SEND_AFTER_MS;
    await registration.refreshIfDue('wake');
    expect(sent).toEqual([]);
    expect(window.webContents.send).toHaveBeenCalledWith(
      'listening-status-changed',
      expect.objectContaining({ choice: 'off' }),
    );
  });

  it('switched off on another computer: sends nothing it counted under the old yes', async () => {
    accrue(600);
    choices.set(ME, false);
    register();
    now += LISTENING_SEND_AFTER_MS;
    await registration.refreshIfDue('launch');
    expect(status()).toMatchObject({ choice: 'off', todayMinutes: 0 });
    expect(sent).toEqual([]);
  });

  it('keeps the switch where it was when the answer could not be written', async () => {
    online = false;
    const outcome = await answer(false);
    expect(outcome).toMatchObject({ ok: false, reason: 'offline' });
    expect(status().choice).toBe('sharing');
  });
});

describe('two accounts on one computer', () => {
  it('never sends one’s minutes as the other’s', async () => {
    choices.set(ME, true);
    await registration.refreshIfDue('launch');
    accrue(600);

    accountId = SOMEONE;
    choices.set(SOMEONE, true);
    // Not known for this account until it is asked: nothing counted meanwhile.
    expect(status().choice).toBe('unknown');
    now += LISTENING_SEND_AFTER_MS;
    await registration.refreshIfDue('account changed');
    expect(status()).toMatchObject({ choice: 'sharing', todayMinutes: 0 });
    expect(sent).toEqual([]);
  });

  it('sends nothing for nobody signed in', async () => {
    accountId = undefined;
    await registration.refreshIfDue('launch');
    accrue(600);
    expect(status()).toEqual({
      signedIn: false,
      choice: 'unknown',
      todayMinutes: 0,
    });
    expect(await answer(true)).toMatchObject({
      ok: false,
      reason: 'signed-out',
    });
  });
});
