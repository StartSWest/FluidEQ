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
import type { TMakerMonthOutcome } from '../../../common/makerMonth';
import { registerMakerMonthIpc } from '../../../main/ipc/makerMonth';
import type { IGalleryAccess } from '../../../main/plus/galleryAccess';

/**
 * The maker's month over IPC. What matters here is whose answer it is: the
 * token belongs to one account, and an answer that arrives after somebody
 * else has signed in is not theirs to see.
 */

const ME = 'c0ffee00-1111-4222-8333-444455556666';
const SOMEONE = 'deadbeef-1111-4222-8333-444455556666';

const answer = (over: Record<string, unknown> = {}) => ({
  until: null,
  waiting: 0,
  earnedThisMonth: false,
  scene: null,
  submissions: 0,
  rejections: 0,
  allowed: 2,
  refusalsAllowed: 2,
  maker: false,
  ...over,
});

interface ISetup {
  /**
   * `null` is signed out. Not `undefined`: passing that explicitly takes the
   * default, which would quietly test the opposite of what it says.
   */
  account?: string | null;
  body?: unknown;
  status?: number;
  onEachCall?: () => void;
  onMaker?: (id: string) => void;
}

const setup = ({
  account = ME,
  body = answer(),
  status = 200,
  onEachCall,
  onMaker,
}: ISetup = {}) => {
  let current: string | undefined = account ?? undefined;
  const access = {
    accountId: () => current,
    auth: async () =>
      current
        ? {
            config: {
              supabaseUrl: 'https://example.test',
              supabaseAnonKey: 'k',
            },
            accessToken: 'token',
            fetchImpl: async () => {
              onEachCall?.();
              return {
                ok: status >= 200 && status < 300,
                status,
                json: async () => body,
              } as unknown as Response;
            },
          }
        : undefined,
    entitled: () => true,
  } as unknown as IGalleryAccess;
  const registration = registerMakerMonthIpc({
    access,
    ...(onMaker ? { onMaker } : {}),
  });
  return {
    registration,
    signIn: (id: string | undefined) => {
      current = id;
    },
    ask: () => handlers.get('maker-month')?.({}) as Promise<TMakerMonthOutcome>,
  };
};

afterEach(() => handlers.clear());

test('signed out, it asks the server nothing', async () => {
  let asked = false;
  const { ask } = setup({
    account: null,
    onEachCall: () => {
      asked = true;
    },
  });

  await expect(ask()).resolves.toEqual({ ok: false, reason: 'signed-out' });
  expect(asked).toBe(false);
});

test('it answers with the month the server describes', async () => {
  const { ask } = setup({
    body: answer({
      until: '2026-11-01T00:00:00.000Z',
      waiting: 2,
      maker: true,
    }),
  });

  await expect(ask()).resolves.toEqual({
    ok: true,
    month: {
      until: '2026-11-01T00:00:00.000Z',
      waiting: 2,
      earnedThisMonth: false,
      submissions: 0,
      rejections: 0,
      allowed: 2,
      refusalsAllowed: 2,
      maker: true,
    },
  });
});

// The bug this is for: a token is one account's, and an answer that lands
// after somebody else has signed in must not be shown to them.
test('an answer for an account that has since signed out is not given', async () => {
  const kit = setup({ body: answer({ maker: true }) });
  const asked = kit.ask();
  kit.signIn(SOMEONE);

  await expect(asked).resolves.toEqual({ ok: false, reason: 'signed-out' });
});

test('a server that refuses is a failure, not an empty month', async () => {
  const { ask } = setup({ status: 401 });
  await expect(ask()).resolves.toEqual({ ok: false, reason: 'signed-out' });

  handlers.clear();
  const other = setup({ status: 500 });
  await expect(other.ask()).resolves.toEqual({ ok: false, reason: 'server' });
});

test('a server from before the earned month reads as an account that never published', async () => {
  const { ask } = setup({ body: 'no such function' });

  await expect(ask()).resolves.toEqual({
    ok: true,
    month: {
      waiting: 0,
      earnedThisMonth: false,
      submissions: 0,
      allowed: 2,
      rejections: 0,
      refusalsAllowed: 2,
      maker: false,
    },
  });
});

test('the Studio is told only when the server says this account is a maker', async () => {
  const told: string[] = [];
  const kit = setup({
    body: answer({ maker: true }),
    onMaker: (id) => told.push(id),
  });
  await kit.ask();
  expect(told).toEqual([ME]);

  handlers.clear();
  told.length = 0;
  const notAMaker = setup({
    body: answer({ maker: false }),
    onMaker: (id) => told.push(id),
  });
  await notAMaker.ask();
  expect(told).toEqual([]);
});
