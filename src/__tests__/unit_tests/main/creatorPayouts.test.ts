/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Creators paid for their scenes (premium 0064), from the app's side: what
 * the server's answers are read as, which pages the app will open, and the
 * `fluideq://creators` links Stripe's sign-up comes back through. Money is
 * never decided here — these hold that the app only ever opens Stripe's own
 * pages, asks for the signed-in account alone, and reads a malformed answer
 * as nothing rather than as zero.
 */

const handlers = new Map<string, (...args: unknown[]) => unknown>();
jest.mock('electron', () => ({
  app: {
    isPackaged: false,
    isDefaultProtocolClient: () => false,
    setAsDefaultProtocolClient: jest.fn(),
    on: jest.fn(),
  },
  ipcMain: {
    handle: (channel: string, fn: (...args: unknown[]) => unknown) =>
      handlers.set(channel, fn),
    removeHandler: (channel: string) => handlers.delete(channel),
  },
}));

/* eslint-disable import/first -- the electron mock must be installed first */
import type { IAccountConfig } from '../../../common/accountConfig';
import {
  CREATOR_AGREEMENT_VERSION,
  isPayableCountry,
  parseCreatorStatus,
} from '../../../common/creatorPayouts';
import { appLinkOf, deliverAppLink } from '../../../main/appLinks';
import { registerCreatorIpc } from '../../../main/ipc/creator';
import { registerSceneStoreIpc } from '../../../main/ipc/sceneStore';
import type { ISceneOwnership } from '../../../main/plus/sceneOwnership';
/* eslint-enable import/first */

const CONFIG = {
  supabaseUrl: 'https://example.supabase.co',
  supabaseAnonKey: 'anon',
  apiUrl: 'https://example.supabase.co/functions/v1',
} as unknown as IAccountConfig;

const STATUS = {
  terms: {
    sharePercent: 50,
    holdDays: 30,
    minimumCents: 1000,
    agreementVersion: 1,
    payoutDays: 15,
    payoutsOpen: true,
  },
  account: {
    country: 'DE',
    detailsSubmitted: true,
    payoutsEnabled: true,
    agreedVersion: 1,
  },
  heldCents: 1873,
  readyCents: 1245,
  paidCents: 4210,
  sales: 37,
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

describe('what the server says, read', () => {
  it('reads a creator whole', () => {
    expect(parseCreatorStatus(STATUS)).toEqual(STATUS);
  });

  it('reads payouts as closed unless the server says they are open (premium 0070)', () => {
    const { payoutsOpen, ...before } = STATUS.terms;
    expect(payoutsOpen).toBe(true);
    // A server before 0070 does not say: closed.
    expect(
      parseCreatorStatus({ ...STATUS, terms: before })?.terms.payoutsOpen,
    ).toBe(false);
    expect(
      parseCreatorStatus({
        ...STATUS,
        terms: { ...before, payoutsOpen: 'yes' },
      })?.terms.payoutsOpen,
    ).toBe(false);
  });

  it('reads a creator who has not begun as one with no account', () => {
    expect(parseCreatorStatus({ ...STATUS, account: null })).toEqual({
      ...STATUS,
      account: undefined,
    });
    expect(parseCreatorStatus({ ...STATUS, account: null })).not.toHaveProperty(
      'account',
    );
  });

  it.each([
    ['no terms', { ...STATUS, terms: undefined }],
    [
      'a share over 100',
      { ...STATUS, terms: { ...STATUS.terms, sharePercent: 101 } },
    ],
    ['a fractional cent', { ...STATUS, readyCents: 12.5 }],
    ['figures as text', { ...STATUS, paidCents: '4210' }],
    ['negative sales', { ...STATUS, sales: -1 }],
    ['a broken account', { ...STATUS, account: { country: 'DE' } }],
  ])(
    'refuses an answer with %s, rather than drawing zeroes',
    (_name, value) => {
      expect(parseCreatorStatus(value)).toBeUndefined();
    },
  );

  it('offers only the countries Stripe can pay from a US account', () => {
    expect(isPayableCountry('DE')).toBe(true);
    expect(isPayableCountry('US')).toBe(true);
    expect(isPayableCountry('BR')).toBe(false);
    expect(isPayableCountry('de')).toBe(false);
  });
});

describe('fluideq://creators links', () => {
  it.each([
    ['fluideq://creators/ready', 'creators-ready'],
    ['fluideq://creators/continue/', 'creators-continue'],
  ])('reads %s as %s', (address, link) => {
    expect(appLinkOf(address)).toBe(link);
  });

  it('is never a payment to the credits', () => {
    handlers.clear();
    let refreshes = 0;
    const sent: unknown[] = [];
    const ownership = {
      subscribe: () => () => undefined,
      known: () => undefined,
      refreshNow: () => {
        refreshes += 1;
        return Promise.resolve({ ok: false, reason: 'offline' });
      },
    } as unknown as ISceneOwnership;
    const { dispose } = registerSceneStoreIpc({
      getMainWindow: () =>
        ({
          webContents: { send: (...args: unknown[]) => sent.push(args) },
        }) as never,
      config: CONFIG,
      ownership,
      openExternal: () => true,
    });
    deliverAppLink('creators-ready');
    deliverAppLink('creators-continue');
    expect(refreshes).toBe(0);
    expect(sent).toEqual([]);
    dispose();
  });
});

describe('the creator channels', () => {
  let calls: { url: string; body: unknown; auth: string | null }[];
  let answers: Map<string, Response | (() => Response)>;
  let opened: string[];
  let sent: [string, unknown][];
  let signedIn: string | undefined;
  let onSent: () => void;
  let dispose: () => void;

  const fetchImpl = (async (url: string, init: RequestInit) => {
    const headers = new Headers(init.headers);
    calls.push({
      url,
      body: init.body ? JSON.parse(String(init.body)) : undefined,
      auth: headers.get('Authorization'),
    });
    const body = init.body ? JSON.parse(String(init.body)) : {};
    const key = url.endsWith('/creator-account')
      ? `account:${body.action}`
      : (url.split('/').pop() ?? url);
    const answer = answers.get(key);
    if (!answer) {
      throw new Error(`nothing answers ${key}`);
    }
    return typeof answer === 'function' ? answer() : answer.clone();
  }) as unknown as typeof fetch;

  const call = (channel: string, ...args: unknown[]) => {
    const handler = handlers.get(channel);
    if (!handler) {
      throw new Error(`${channel} is not registered`);
    }
    return handler({}, ...args);
  };

  beforeEach(() => {
    handlers.clear();
    calls = [];
    answers = new Map();
    opened = [];
    sent = [];
    signedIn = 'user-1';
    onSent = () => undefined;
    ({ dispose } = registerCreatorIpc({
      getMainWindow: () =>
        ({
          webContents: {
            send: (channel: string, value: unknown) => {
              sent.push([channel, value]);
              onSent();
            },
          },
        }) as never,
      config: CONFIG,
      session: {
        state: () =>
          ({ identity: signedIn ? { id: signedIn } : undefined }) as never,
        accessToken: () => Promise.resolve('token-1'),
      },
      openExternal: (url) => {
        opened.push(url);
        return true;
      },
      fetchImpl,
    }));
  });

  afterEach(() => dispose());

  it('reads the signed-in account with its own token', async () => {
    answers.set('my_creator', json(200, STATUS));
    await expect(call('creator-get')).resolves.toEqual({
      ok: true,
      status: STATUS,
    });
    expect(calls).toEqual([
      {
        url: 'https://example.supabase.co/rest/v1/rpc/my_creator',
        body: {},
        auth: 'Bearer token-1',
      },
    ]);
  });

  it('asks nothing for somebody signed out', async () => {
    signedIn = undefined;
    await expect(call('creator-get')).resolves.toEqual({
      ok: false,
      reason: 'signed-out',
    });
    expect(calls).toEqual([]);
  });

  it('signs up with the agreement this app shows, the country and the language', async () => {
    answers.set(
      'account:link',
      json(200, { url: 'https://connect.stripe.com/setup/e/acct_1/abc' }),
    );
    await expect(call('creator-sign-up', 'DE', 'de')).resolves.toEqual({
      ok: true,
    });
    expect(calls[0].body).toEqual({
      action: 'link',
      agreementVersion: CREATOR_AGREEMENT_VERSION,
      country: 'DE',
      locale: 'de',
    });
    expect(opened).toEqual(['https://connect.stripe.com/setup/e/acct_1/abc']);
  });

  it('asks in English for a language Stripe has no page in', async () => {
    answers.set(
      'account:link',
      json(200, { url: 'https://connect.stripe.com/setup/e/acct_1/abc' }),
    );
    await call('creator-sign-up', 'DE', 'xx');
    expect((calls[0].body as { locale: string }).locale).toBe('en');
  });

  it('asks nothing for a country Stripe cannot pay', async () => {
    await expect(call('creator-sign-up', 'BR', 'pt')).resolves.toEqual({
      ok: false,
      reason: 'country',
    });
    expect(calls).toEqual([]);
    expect(opened).toEqual([]);
  });

  it.each([
    'https://connect.stripe.com.evil.example/setup',
    'http://connect.stripe.com/setup',
    'https://evil.example/https://connect.stripe.com/',
    'data:text/html,https://connect.stripe.com/',
  ])('never opens a page that is not Stripe’s own: %s', async (url) => {
    answers.set('account:link', json(200, { url }));
    await expect(call('creator-sign-up', 'DE', 'en')).resolves.toEqual({
      ok: false,
      reason: 'server',
    });
    expect(opened).toEqual([]);
  });

  it('opens the dashboard only when Stripe gives one', async () => {
    answers.set(
      'account:dashboard',
      json(200, { url: 'https://connect.stripe.com/express/acct_1/xyz' }),
    );
    await expect(call('creator-dashboard')).resolves.toEqual({ ok: true });
    expect(opened).toEqual(['https://connect.stripe.com/express/acct_1/xyz']);
  });

  it.each([
    [409, { error: 'agreement_outdated' }, 'agreement-outdated'],
    [403, { error: 'banned' }, 'banned'],
    // Signing up closed until FluidEQ can pay creators (premium 0070).
    [403, { error: 'payouts_closed' }, 'unavailable'],
    [403, { error: 'unconfirmed' }, 'unconfirmed'],
    [401, { error: 'signed_out' }, 'signed-out'],
    [502, { error: 'server' }, 'server'],
  ])('says why a sign-up was refused (%s)', async (status, body, reason) => {
    answers.set('account:link', json(status, body));
    await expect(call('creator-sign-up', 'DE', 'en')).resolves.toEqual({
      ok: false,
      reason,
    });
  });

  it('back from Stripe, asks Stripe then the server, and tells the window', async () => {
    answers.set(
      'account:refresh',
      json(200, { detailsSubmitted: true, payoutsEnabled: true }),
    );
    answers.set('my_creator', json(200, STATUS));
    const told = new Promise<void>((resolve) => {
      onSent = resolve;
    });
    deliverAppLink('creators-ready');
    await told;
    expect(calls.map((entry) => entry.url)).toEqual([
      'https://example.supabase.co/functions/v1/creator-account',
      'https://example.supabase.co/rest/v1/rpc/my_creator',
    ]);
    expect(sent).toEqual([['creator-changed', STATUS]]);
  });

  it('tells the window nothing about an account signed out meanwhile', async () => {
    answers.set('account:refresh', json(200, {}));
    answers.set('my_creator', () => {
      signedIn = 'user-2';
      return json(200, STATUS);
    });
    await expect(call('creator-refresh')).resolves.toEqual({
      ok: false,
      reason: 'signed-out',
    });
    expect(sent).toEqual([]);
  });

  // Who a run would pay is for the admin, whose add-on asks it; the app
  // that ships has no way to.
  it('offers the window no payout preview', () => {
    expect(() => call('creator-payouts-preview')).toThrow('not registered');
    expect(calls).toEqual([]);
  });

  // Payouts are the server's schedule alone (Ivan, 2026-10-21): the window
  // has no way to ask for a run.
  it('offers the window no way to pay', () => {
    expect(() => call('creator-payouts-run')).toThrow('not registered');
    expect(calls).toEqual([]);
  });
});
