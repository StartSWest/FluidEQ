/** @jest-environment node */

/**
 * The question a member whose free trial ended without Plus is asked
 * (premium 0054), over IPC: what main asks the server, what it refuses to
 * send, and how a server answer comes back to the window.
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
import type { IAccountState } from '../../../main/account/session';
import { registerPlusTrialIpc } from '../../../main/ipc/plusTrial';
import { listAccounts } from '../../../main/plus/adminAccountsApi';
/* eslint-enable import/first */

const config = {
  supabaseUrl: 'https://project.supabase.co',
  supabaseAnonKey: 'sb_publishable_public-key',
  apiUrl: 'https://project.supabase.co/functions/v1',
  plusPrice: '',
  plusYearlyPrice: '',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

let account: string | undefined;
let fetchImpl: jest.Mock<Promise<Response>, [string, RequestInit?]>;
let registration: ReturnType<typeof registerPlusTrialIpc>;

const invoke = (channel: string, ...args: unknown[]): Promise<unknown> => {
  const handler = handlers.get(channel);
  if (!handler) {
    throw new Error(`Missing IPC handler: ${channel}`);
  }
  return Promise.resolve(handler({}, ...args));
};

const bodyOf = (call: number) =>
  JSON.parse(String(fetchImpl.mock.calls[call][1]?.body)) as Record<
    string,
    unknown
  >;
const nameOf = (call: number) =>
  new URL(fetchImpl.mock.calls[call][0]).pathname.split('/').pop();

beforeEach(() => {
  handlers.clear();
  account = 'account-a';
  fetchImpl = jest.fn<Promise<Response>, [string, RequestInit?]>(async () =>
    json([{ asked: true, reason: null }]),
  );
  registration = registerPlusTrialIpc({
    config,
    session: {
      state: (): IAccountState =>
        account
          ? { status: 'signed-in', identity: { id: account } }
          : { status: 'signed-out' },
      accessToken: async () => 'account-a-token',
    },
    entitlement: { expectChange: () => undefined, checkNow: jest.fn() },
    fetchImpl: fetchImpl as typeof fetch,
  });
});

afterEach(() => registration.dispose());

describe('what this member is asked', () => {
  it('asks the server with the account’s own token', async () => {
    expect(await invoke('plus-trial-exit')).toEqual({
      ok: true,
      status: { asked: true },
    });
    expect(nameOf(0)).toBe('my_trial_exit');
    expect(
      (fetchImpl.mock.calls[0][1]?.headers as Record<string, string>)
        .Authorization,
    ).toBe('Bearer account-a-token');
  });

  it('says signed out, and asks nothing, with nobody signed in', async () => {
    account = undefined;
    expect(await invoke('plus-trial-exit')).toEqual({
      ok: false,
      reason: 'signed-out',
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('reads a server before 0054 as nothing to answer', async () => {
    fetchImpl.mockResolvedValue(json({ code: 'PGRST202' }, 404));
    expect(await invoke('plus-trial-exit')).toEqual({
      ok: false,
      reason: 'unavailable',
    });
  });
});

describe('the answer', () => {
  it('sends the reason and the note trimmed, and a void answer is done', async () => {
    fetchImpl.mockResolvedValue(new Response(null, { status: 204 }));
    expect(
      await invoke('plus-trial-exit-report', 'price', '  Yearly, please  '),
    ).toEqual({ ok: true });
    expect(nameOf(0)).toBe('report_trial_exit');
    expect(bodyOf(0)).toEqual({ p_reason: 'price', p_note: 'Yearly, please' });
  });

  it('sends no note as null', async () => {
    fetchImpl.mockResolvedValue(new Response(null, { status: 204 }));
    await invoke('plus-trial-exit-report', 'free-is-enough', '   ');
    expect(bodyOf(0)).toEqual({ p_reason: 'free-is-enough', p_note: null });
  });

  it('never sends a reason the server does not know, or a note too long', async () => {
    expect(await invoke('plus-trial-exit-report', 'because')).toEqual({
      ok: false,
      reason: 'forbidden',
    });
    expect(
      await invoke('plus-trial-exit-report', 'price', 'x'.repeat(501)),
    ).toEqual({ ok: false, reason: 'forbidden' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('reads the server refusing a member it did not ask as nothing to answer', async () => {
    fetchImpl.mockResolvedValue(json({ message: 'not_asked' }, 400));
    expect(await invoke('plus-trial-exit-report', 'price')).toEqual({
      ok: false,
      reason: 'unavailable',
    });
  });
});

describe('the admin list with a window and the lapsed filter', () => {
  const auth = () => ({
    config,
    accessToken: 'admin-token',
    fetchImpl: fetchImpl as typeof fetch,
  });
  const ROW = {
    user_id: '3f1c2a4e-5b6d-4e7f-8a9b-0c1d2e3f4a5b',
    email: 'gone@example.com',
    created_at: '2026-10-14T12:00:00Z',
    confirmed: true,
    admin: false,
    gifted: false,
    deleting: false,
    plus_until: null,
    published: 0,
    board_days: 2,
    likes: 0,
    adds: 1,
    reports: 0,
    listed_count: 1,
    trial_ended_at: '2026-10-15T12:00:00Z',
    exit_reason: 'price',
  };
  const answers = (name: string) => {
    if (name === 'admin_list_accounts') {
      return json([ROW]);
    }
    if (name === 'admin_account_totals') {
      return json([{ matched: 1, paying: 0, lapsed: 1 }]);
    }
    return json([
      { reason: 'price', answers: 1 },
      { reason: 'none', answers: 3 },
    ]);
  };

  beforeEach(() => {
    fetchImpl.mockImplementation(async (url) =>
      answers(new URL(url).pathname.split('/').pop() ?? ''),
    );
  });

  it('sends the window to the list and the totals, and asks for the reasons', async () => {
    const since = Date.parse('2026-10-12T04:00:00Z');
    const outcome = await listAccounts(auth(), {
      query: '',
      plan: 'lapsed',
      offset: 0,
      since,
    });
    const names = fetchImpl.mock.calls.map((_call, index) => nameOf(index));
    expect(names).toEqual([
      'admin_list_accounts',
      'admin_account_totals',
      'admin_trial_exit_reasons',
    ]);
    const window = { p_joined_since: '2026-10-12T04:00:00.000Z' };
    expect(bodyOf(0)).toMatchObject({ p_plan: 'lapsed', ...window });
    expect(bodyOf(1)).toMatchObject(window);
    expect(bodyOf(2)).toMatchObject(window);
    expect(outcome).toMatchObject({
      ok: true,
      page: {
        lapsed: 1,
        exitReasons: [
          { reason: 'price', answers: 1 },
          { reason: 'none', answers: 3 },
        ],
      },
    });
  });

  it('sends no window at all without one, so a server before 0054 still answers', async () => {
    await listAccounts(auth(), { query: '', plan: 'all', offset: 0 });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(bodyOf(0)).not.toHaveProperty('p_joined_since');
    expect(bodyOf(1)).not.toHaveProperty('p_joined_since');
  });

  it('asks for the reasons only on the lapsed list’s first page', async () => {
    await listAccounts(auth(), { query: '', plan: 'lapsed', offset: 50 });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('refuses the whole page when the breakdown does not read', async () => {
    fetchImpl.mockImplementation(async (url) =>
      new URL(url).pathname.endsWith('admin_trial_exit_reasons')
        ? json([{ reason: 'because', answers: 1 }])
        : answers(new URL(url).pathname.split('/').pop() ?? ''),
    );
    expect(
      await listAccounts(auth(), { query: '', plan: 'lapsed', offset: 0 }),
    ).toEqual({ ok: false, reason: 'server' });
  });
});
