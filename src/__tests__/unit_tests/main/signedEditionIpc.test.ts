/**
 * @jest-environment node
 */

/**
 * The Signed Edition over IPC (premium 0104): what the window is told about
 * the copy and the account, the download, the checkout's address, and
 * linking a purchase paid with another email. The server is a fetch that
 * answers by path.
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
  registerSignedEditionIpc,
  signedEditionCheckoutUrl,
} from '../../../main/ipc/signedEdition';
import type { IGalleryAccess } from '../../../main/plus/galleryAccess';
import { fakeResponse, ME, SOMEONE } from '../../utils/memberSceneFixtures';
/* eslint-enable import/first */

const config = {
  supabaseUrl: 'https://project.supabase.co',
  supabaseAnonKey: 'anon',
  apiUrl: 'https://project.supabase.co/functions/v1',
} as IAccountConfig;
const ORDER = 'txn_01hv8wptq8987qeep44cyrewp9';
const LINK =
  'https://project.supabase.co/storage/v1/object/sign/signed-edition/FluidEQ-Signed-Setup-2.5.0.exe?token=t';

let signedIn: boolean;
let signedInAs: string;
let duringFetch: (() => void) | undefined;
let answers: Record<string, Response | (() => Response)>;
let calls: Array<{ path: string; authorization: string; body: unknown }>;
const opened: string[] = [];

const fetchImpl = (async (input: string | URL, init?: RequestInit) => {
  const { pathname } = new URL(String(input));
  calls.push({
    path: pathname,
    authorization: String(
      (init?.headers as Record<string, string> | undefined)?.Authorization,
    ),
    body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
  });
  duringFetch?.();
  const answer = answers[pathname];
  if (!answer) {
    return fakeResponse(404, {});
  }
  return typeof answer === 'function' ? answer() : answer;
}) as unknown as typeof fetch;

const access = (): IGalleryAccess => ({
  accountId: () => (signedIn ? signedInAs : undefined),
  entitled: () => signedIn,
  owns: () => false,
  authorize: undefined as unknown as IGalleryAccess['authorize'],
  auth: async () =>
    signedIn ? { config, accessToken: 'token', fetchImpl } : undefined,
});

const invoke = <T>(channel: string, ...args: unknown[]): Promise<T> => {
  const handler = handlers.get(channel);
  if (!handler) {
    throw new Error(`no handler for ${channel}`);
  }
  return handler({}, ...args) as Promise<T>;
};

const setup = (signedCopy = true, publisher = '') =>
  registerSignedEditionIpc({
    access: access(),
    config,
    identity: () =>
      signedIn ? { id: signedInAs, email: 'me@example.com' } : undefined,
    signedCopy,
    ...(publisher ? { publisher } : {}),
    openExternal: async (url) => {
      opened.push(url);
    },
    fetchImpl,
  });

const CLAIM = '/rest/v1/rpc/claim_my_edition';
const PRICE = '/rest/v1/rpc/signed_edition_price';
const FN = '/functions/v1/signed-edition';

beforeEach(() => {
  handlers.clear();
  opened.length = 0;
  calls = [];
  signedIn = true;
  signedInAs = ME;
  duringFetch = undefined;
  answers = {
    [CLAIM]: fakeResponse(200, { signed: true, order: ORDER }),
    [PRICE]: fakeResponse(200, '$19'),
  };
});

describe('what the window is told', () => {
  it('an owning account on a signed copy, with its order and the price the server words', async () => {
    setup();
    expect(await invoke('signed-edition-status')).toEqual({
      signedCopy: true,
      account: 'owned',
      order: ORDER,
      price: '$19',
    });
    // Owning is asked as the account; the price with the public key.
    expect(calls.find((call) => call.path === CLAIM)?.authorization).toBe(
      'Bearer token',
    );
    expect(calls.find((call) => call.path === PRICE)?.authorization).toBe(
      'Bearer anon',
    );
  });

  // The name on the certificate is the developer's own, read from the build.
  it('names the publisher of a signed copy, and never one for the free copy', async () => {
    setup(true, 'Ivan Carmenates Garcia');
    expect(await invoke('signed-edition-status')).toMatchObject({
      signedCopy: true,
      publisher: 'Ivan Carmenates Garcia',
    });
    handlers.clear();
    setup(false, 'Ivan Carmenates Garcia');
    expect(await invoke('signed-edition-status')).not.toHaveProperty(
      'publisher',
    );
  });

  it('says which copy this is whatever the account', async () => {
    setup(false);
    answers[CLAIM] = fakeResponse(200, { signed: false, order: null });
    expect(await invoke('signed-edition-status')).toEqual({
      signedCopy: false,
      account: 'not-owned',
      price: '$19',
    });
  });

  it('nobody signed in is signed out, and the server is not asked about an account', async () => {
    setup();
    signedIn = false;
    expect(await invoke('signed-edition-status')).toEqual({
      signedCopy: true,
      account: 'signed-out',
      price: '$19',
    });
    expect(calls.some((call) => call.path === CLAIM)).toBe(false);
  });

  it.each([
    ['a server before the edition', () => fakeResponse(404, {}), 'unknown'],
    ['a server that fails', () => fakeResponse(500, {}), 'unknown'],
    [
      'an answer that is not one',
      () => fakeResponse(200, { signed: 'yes' }),
      'unknown',
    ],
    ['a session the server refuses', () => fakeResponse(401, {}), 'signed-out'],
  ])('%s is never read as not owning', async (_label, answer, account) => {
    setup();
    answers[CLAIM] = answer;
    expect(
      ((await invoke('signed-edition-status')) as { account: string }).account,
    ).toBe(account);
  });

  it('shows no price the server did not word, and no order that is not one', async () => {
    setup();
    answers[PRICE] = fakeResponse(200, '<b>$19</b>');
    answers[CLAIM] = fakeResponse(200, { signed: true, order: '../x' });
    expect(await invoke('signed-edition-status')).toEqual({
      signedCopy: true,
      account: 'owned',
    });
    answers[PRICE] = fakeResponse(500, {});
    expect(await invoke('signed-edition-status')).toEqual({
      signedCopy: true,
      account: 'owned',
    });
  });

  it('keeps an answer from the account it was asked for', async () => {
    setup();
    duringFetch = () => {
      signedInAs = SOMEONE;
    };
    expect(
      ((await invoke('signed-edition-status')) as { account: string }).account,
    ).toBe('unknown');
  });
});

describe('the download', () => {
  it('opens the installer link in the browser for an owning account', async () => {
    setup();
    answers[FN] = fakeResponse(200, {
      owned: true,
      version: '2.5.0',
      file: 'FluidEQ-Signed-Setup-2.5.0.exe',
      url: LINK,
    });
    expect(await invoke('signed-edition-download')).toEqual({
      ok: true,
      version: '2.5.0',
      url: LINK,
    });
    expect(opened).toEqual([LINK]);
  });

  it.each([
    [401, 'signed-out'],
    [403, 'not-owned'],
    [503, 'no-release'],
    [500, 'failed'],
  ])('a %s answer opens nothing', async (status, reason) => {
    setup();
    answers[FN] = fakeResponse(status, { owned: false });
    expect(await invoke('signed-edition-download')).toEqual({
      ok: false,
      reason,
    });
    expect(opened).toEqual([]);
  });

  it('opens only a link on the account’s own server', async () => {
    setup();
    answers[FN] = fakeResponse(200, {
      owned: true,
      version: '2.5.0',
      url: 'https://evil.example/FluidEQ-Setup.exe',
    });
    expect(await invoke('signed-edition-download')).toEqual({
      ok: false,
      reason: 'failed',
    });
    expect(opened).toEqual([]);
  });

  it('asks nothing signed out', async () => {
    setup();
    signedIn = false;
    expect(await invoke('signed-edition-download')).toEqual({
      ok: false,
      reason: 'signed-out',
    });
    expect(calls).toEqual([]);
  });
});

describe('the checkout', () => {
  it('opens the site with the account and its address in the fragment, never the query', async () => {
    setup();
    await invoke('signed-edition-buy');
    const url = new URL(opened[0] ?? '');
    expect(url.origin + url.pathname).toBe('https://fluideq.com/pricing');
    expect(url.search).toBe('');
    expect(url.hash).toBe(`#signed?account=${ME}&email=me%40example.com`);
  });

  it('opens the plain page for nobody signed in, and leaves out an address that is not one', () => {
    expect(signedEditionCheckoutUrl()).toBe(
      'https://fluideq.com/pricing#signed',
    );
    expect(signedEditionCheckoutUrl({ id: ME, email: 'not an address' })).toBe(
      `https://fluideq.com/pricing#signed?account=${ME}`,
    );
  });
});

describe('a purchase paid with another address', () => {
  it('asks for a code to that address, and says only sent, limited or failed', async () => {
    setup();
    answers[`${FN}/link`] = fakeResponse(200, { sent: true });
    expect(
      await invoke('signed-edition-link-start', ' paid@example.com '),
    ).toBe('sent');
    expect(calls[0]).toEqual({
      path: `${FN}/link`,
      authorization: 'Bearer token',
      body: { email: 'paid@example.com' },
    });
    answers[`${FN}/link`] = fakeResponse(429, { error: 'limited' });
    expect(await invoke('signed-edition-link-start', 'paid@example.com')).toBe(
      'limited',
    );
    answers[`${FN}/link`] = fakeResponse(500, {});
    expect(await invoke('signed-edition-link-start', 'paid@example.com')).toBe(
      'failed',
    );
  });

  it.each([
    [200, { linked: true }, 'linked'],
    [403, { linked: false }, 'no'],
    [409, { linked: false, reason: 'too-soon' }, 'too-soon'],
    [401, {}, 'signed-out'],
    [500, {}, 'failed'],
    [200, { linked: 'yes' }, 'failed'],
  ])('the code typed back: %s %j is %s', async (status, body, outcome) => {
    setup();
    answers[`${FN}/link/confirm`] = fakeResponse(status, body);
    expect(
      await invoke('signed-edition-link-finish', 'paid@example.com', '123456'),
    ).toBe(outcome);
    expect(calls[0]?.body).toEqual({
      email: 'paid@example.com',
      code: '123456',
    });
  });

  it('sends nothing that is not an address or a six-digit code, and nothing signed out', async () => {
    setup();
    expect(await invoke('signed-edition-link-start', 'nope')).toBe('failed');
    expect(await invoke('signed-edition-link-start', 42)).toBe('failed');
    expect(
      await invoke('signed-edition-link-finish', 'paid@example.com', '12345'),
    ).toBe('no');
    expect(
      await invoke('signed-edition-link-finish', 'paid@example.com', 123456),
    ).toBe('no');
    signedIn = false;
    expect(await invoke('signed-edition-link-start', 'paid@example.com')).toBe(
      'signed-out',
    );
    expect(
      await invoke('signed-edition-link-finish', 'paid@example.com', '123456'),
    ).toBe('signed-out');
    expect(calls).toEqual([]);
  });
});

// The offer says how many credits the edition comes with from the server's
// own count, the one that grants them.
describe('the credits it comes with', () => {
  it('passes the server’s count on, owned or not', async () => {
    setup();
    answers[CLAIM] = fakeResponse(200, {
      signed: false,
      order: null,
      credits: 12,
    });
    expect(await invoke('signed-edition-status')).toMatchObject({
      account: 'not-owned',
      credits: 12,
    });
  });

  it.each([0, -3, 1.5, '12', 5000, null])(
    'says no count for %p',
    async (credits) => {
      setup();
      answers[CLAIM] = fakeResponse(200, { signed: false, credits });
      expect(await invoke('signed-edition-status')).not.toHaveProperty(
        'credits',
      );
    },
  );
});
