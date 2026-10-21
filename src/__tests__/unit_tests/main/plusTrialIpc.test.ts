/** @jest-environment node */

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
import { AuthError } from '../../../main/account/authClient';
import { registerPlusTrialIpc } from '../../../main/ipc/plusTrial';
import { PLUS_TERMS_VERSION } from '../../../common/plusTerms';
/* eslint-enable import/first */

const config = {
  supabaseUrl: 'https://project.supabase.co',
  supabaseAnonKey: 'sb_publishable_public-key',
  apiUrl: 'https://project.supabase.co/functions/v1',
};
const OFFER = {
  enabled: true,
  days: 15,
  state: 'eligible',
  startedAt: null,
  endsAt: null,
  termsVersion: PLUS_TERMS_VERSION,
  trialTermsVersion: 1,
};
const ACTIVE = {
  ...OFFER,
  state: 'active',
  startedAt: '2026-09-19T12:00:00Z',
  endsAt: '2026-10-19T12:00:00Z',
};
const SETTINGS = {
  enabled: true,
  days: 15,
  eligibleSince: '2026-09-19T12:00:00Z',
};

const deferred = <T>() => {
  let complete: (value: T) => void = () => {
    throw new Error('Promise executor did not run');
  };
  const promise = new Promise<T>((resolve) => {
    complete = resolve;
  });
  return { promise, complete };
};
const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

let account: string | undefined;
let fetchImpl: jest.Mock<Promise<Response>, [string, RequestInit?]>;
let accessToken: jest.Mock<Promise<string>, []>;
let registration: ReturnType<typeof registerPlusTrialIpc>;

const invoke = (channel: string, ...args: unknown[]): Promise<unknown> => {
  const handler = handlers.get(channel);
  if (!handler) {
    throw new Error(`Missing IPC handler: ${channel}`);
  }
  return Promise.resolve(handler({}, ...args));
};

const register = (backend = config) => {
  registration = registerPlusTrialIpc({
    config: backend,
    session: {
      state: (): IAccountState =>
        account
          ? { status: 'signed-in', identity: { id: account } }
          : { status: 'signed-out' },
      accessToken,
    },
    fetchImpl: fetchImpl as typeof fetch,
  });
};

beforeEach(() => {
  handlers.clear();
  account = 'account-a';
  fetchImpl = jest.fn<Promise<Response>, [string, RequestInit?]>(async () =>
    response(OFFER),
  );
  accessToken = jest.fn(async () => 'account-a-token');
  register();
});

afterEach(() => registration.dispose());

it('loads a generic signed-out offer using only the public API key', async () => {
  account = undefined;
  fetchImpl.mockResolvedValue(response({ ...OFFER, state: 'sign-in' }));
  expect(await invoke('plus-trial-offer')).toEqual({
    ok: true,
    offer: {
      enabled: true,
      days: 15,
      state: 'sign-in',
      termsVersion: PLUS_TERMS_VERSION,
      trialTermsVersion: 1,
    },
  });
  const [url, init] = fetchImpl.mock.calls[0];
  expect(url).toBe('https://project.supabase.co/rest/v1/rpc/plus_trial_offer');
  expect(init?.headers).toEqual({
    apikey: 'sb_publishable_public-key',
    'Content-Type': 'application/json',
    Accept: 'application/json',
  });
  expect(accessToken).not.toHaveBeenCalled();
});

// Plus is not sold any more (credits replaced it), so a trial is only read
// here, never started: there is no channel to start one through.
it('offers no way to start a trial', () => {
  expect(handlers.has('plus-trial-start')).toBe(false);
  // The positive control: the reading channels are there.
  expect(handlers.has('plus-trial-offer')).toBe(true);
  expect(handlers.has('plus-trial-settings')).toBe(true);
});

it('does not send a request after the account changes during token refresh', async () => {
  const token = deferred<string>();
  accessToken.mockReturnValue(token.promise);
  const reading = invoke('plus-trial-settings');
  account = 'account-b';
  token.complete('account-b-token');
  expect(await reading).toEqual({ ok: false, reason: 'signed-out' });
  expect(fetchImpl).not.toHaveBeenCalled();
});

it('discards a body read after switching accounts', async () => {
  const body = deferred<unknown>();
  const reading = deferred<void>();
  fetchImpl.mockResolvedValue({
    ok: true,
    status: 200,
    json: () => {
      reading.complete();
      return body.promise;
    },
  } as Response);
  const readingOffer = invoke('plus-trial-offer');
  await reading.promise;
  account = 'account-b';
  body.complete(ACTIVE);
  expect(await readingOffer).toEqual({ ok: false, reason: 'signed-out' });
});

it('does not carry an anonymous offer into a newly signed-in account', async () => {
  account = undefined;
  const reply = deferred<Response>();
  fetchImpl.mockReturnValue(reply.promise);
  const readingOffer = invoke('plus-trial-offer');
  account = 'account-b';
  reply.complete(response({ ...OFFER, state: 'sign-in' }));
  expect(await readingOffer).toEqual({ ok: false, reason: 'signed-out' });
});

it.each([
  [400, 'terms_outdated', '22023', 'terms-outdated'],
  [400, 'trial_unavailable', 'P0001', 'unavailable'],
  [400, 'trial_ineligible', 'P0001', 'ineligible'],
  [401, 'authentication_required', '28000', 'signed-out'],
  [403, 'authentication_required', '42501', 'signed-out'],
  [403, 'admin_required', '42501', 'forbidden'],
  [500, 'unexpected', 'XX000', 'server'],
])(
  'translates the server refusal %s / %s',
  async (status, message, code, reason) => {
    fetchImpl.mockResolvedValue(response({ code, message }, status));
    expect(await invoke('plus-trial-settings')).toEqual({
      ok: false,
      reason,
    });
  },
);

it('fails closed when the server or a token cannot be reached', async () => {
  fetchImpl.mockRejectedValue(new Error('offline'));
  expect(await invoke('plus-trial-offer')).toEqual({
    ok: false,
    reason: 'offline',
  });
  accessToken.mockRejectedValue(new Error('offline'));
  expect(await invoke('plus-trial-settings')).toEqual({
    ok: false,
    reason: 'offline',
  });
});

it('keeps signed-out settings local, and unconfigured offers unavailable', async () => {
  account = undefined;
  expect(await invoke('plus-trial-settings')).toEqual({
    ok: false,
    reason: 'signed-out',
  });
  expect(await invoke('plus-trial-set-offer', true)).toEqual({
    ok: false,
    reason: 'signed-out',
  });
  register({ ...config, supabaseUrl: '' });
  expect(await invoke('plus-trial-offer')).toEqual({
    ok: false,
    reason: 'unavailable',
  });
  expect(fetchImpl).not.toHaveBeenCalled();
});

it('reads and changes administrator settings with the caller token', async () => {
  fetchImpl.mockResolvedValueOnce(response(SETTINGS));
  fetchImpl.mockResolvedValueOnce(
    response({
      enabled: false,
      days: 15,
      eligibleSince: '2026-09-19T12:00:00Z',
    }),
  );
  expect(await invoke('plus-trial-settings')).toEqual({
    ok: true,
    settings: { enabled: true, days: 15, eligibleSince: 1789819200000 },
  });
  expect(await invoke('plus-trial-set-offer', false)).toMatchObject({
    ok: true,
  });
  expect(fetchImpl.mock.calls.map(([url]) => new URL(url).pathname)).toEqual([
    '/rest/v1/rpc/admin_plus_trial_settings',
    '/rest/v1/rpc/admin_set_plus_trial_offer',
  ]);
  expect(JSON.parse(String(fetchImpl.mock.calls[1][1]?.body))).toEqual({
    p_enabled: false,
  });
  expect(await invoke('plus-trial-set-offer', 'true')).toEqual({
    ok: false,
    reason: 'forbidden',
  });
  expect(fetchImpl).toHaveBeenCalledTimes(2);
});

it('rejects malformed settings', async () => {
  fetchImpl.mockResolvedValue(response({ ...SETTINGS, days: 30 }));
  expect(await invoke('plus-trial-settings')).toEqual({
    ok: false,
    reason: 'server',
  });
});

it('continues normally when refreshing the token keeps the same account', async () => {
  accessToken.mockResolvedValue('account-a-refreshed');
  fetchImpl.mockResolvedValue(response(SETTINGS));
  expect(await invoke('plus-trial-settings')).toMatchObject({ ok: true });
  expect(fetchImpl.mock.calls[0][1]?.headers).toMatchObject({
    Authorization: 'Bearer account-a-refreshed',
  });
});

it('rejects a personal offer returned to an anonymous caller', async () => {
  account = undefined;
  fetchImpl.mockResolvedValue(response(ACTIVE));
  expect(await invoke('plus-trial-offer')).toEqual({
    ok: false,
    reason: 'server',
  });
});

it('discards administrator settings when the account changes during the request', async () => {
  const reply = deferred<Response>();
  const requested = deferred<void>();
  fetchImpl.mockImplementation(() => {
    requested.complete();
    return reply.promise;
  });
  const saving = invoke('plus-trial-set-offer', true);
  await requested.promise;
  account = 'account-b';
  reply.complete(
    response({
      enabled: true,
      days: 15,
      eligibleSince: '2026-09-19T12:00:00Z',
    }),
  );
  expect(await saving).toEqual({ ok: false, reason: 'signed-out' });
});

it('keeps an expired refresh distinct from a temporary authentication service failure', async () => {
  accessToken.mockRejectedValueOnce(
    new AuthError('expired', 'Session changed'),
  );
  expect(await invoke('plus-trial-settings')).toEqual({
    ok: false,
    reason: 'signed-out',
  });
  accessToken.mockRejectedValueOnce(new AuthError('rate_limited', 'Try later'));
  expect(await invoke('plus-trial-settings')).toEqual({
    ok: false,
    reason: 'server',
  });
  expect(fetchImpl).not.toHaveBeenCalled();
});
