/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later

@jest-environment node
*/

import { ACCOUNT_CONFIG } from '../../../common/accountConfig';
import type {
  IEntitlementRecord,
  IEntitlementStatus,
} from '../../../main/account/entitlement';
import type { IAccountState } from '../../../main/account/session';
import { registerAccountIpc } from '../../../main/ipc/account';
import {
  claimStarterCredits,
  fetchSceneStore,
  startCreditCheckout,
} from '../../../main/plus/sceneStoreApi';

let mockAccountState: IAccountState;
let mockOnState: (state: IAccountState) => void;
let mockRefresh: () => Promise<IEntitlementStatus>;
let mockStored: IEntitlementRecord | undefined;
let mockReady: Promise<void>;
let markReady: () => void;

jest.mock('electron', () => ({
  app: { whenReady: () => mockReady, getVersion: () => '2.3.1' },
  ipcMain: {
    handle: (channel: string, handler: typeof mockRefresh) => {
      if (channel === 'entitlement-refresh') {
        mockRefresh = handler;
      }
    },
    removeHandler: jest.fn(),
  },
}));
jest.mock('../../../common/accountConfig', () => ({
  ACCOUNT_CONFIG: {
    supabaseUrl: 'https://project.example',
    supabaseAnonKey: 'public',
    apiUrl: 'https://project.example/functions/v1',
  },
}));
jest.mock('../../../main/account/session', () => ({
  createAccountSession: (options: { onState: typeof mockOnState }) => {
    mockOnState = options.onState;
    return {
      state: () => mockAccountState,
      accessToken: async () => 'access-1',
      dispose: jest.fn(),
    };
  },
}));
jest.mock('../../../main/accountCredentials', () => ({
  createAccountCredentialStore: jest.fn(),
}));
jest.mock('../../../main/encryptedJsonStore', () => ({
  createEncryptedJsonStore: () => ({
    available: () => true,
    read: () => mockStored,
    write: (value: IEntitlementRecord) => {
      mockStored = value;
    },
    clear: () => {
      mockStored = undefined;
    },
  }),
}));

const account: IAccountState = {
  status: 'signed-in',
  identity: { id: 'user-1', email: 'person@example.com' },
};
const day = 24 * 60 * 60 * 1000;
const accessPath = '/rest/v1/entitlements';
const json = (value: unknown) => new Response(JSON.stringify(value));
let registration: ReturnType<typeof registerAccountIpc>;
let fetchImpl: jest.MockedFunction<typeof fetch>;

beforeEach(() => {
  mockAccountState = { status: 'signed-out' };
  mockStored = undefined;
  mockReady = new Promise<void>((resolve) => {
    markReady = resolve;
  });
  jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
  fetchImpl = jest.mocked(globalThis.fetch);
  registration = registerAccountIpc({
    getMainWindow: () => null,
    userDataDir: 'unused',
  });
});

afterEach(async () => {
  mockAccountState = { status: 'signed-out' };
  markReady();
  await mockReady;
  registration.dispose();
  jest.restoreAllMocks();
});

it.each(['launch', 'sign-in'])(
  'reads existing access on %s and refresh without a billing lookup',
  async (trigger) => {
    fetchImpl.mockImplementation(async (input) =>
      new URL(String(input)).pathname === accessPath
        ? json([
            {
              status: 'active',
              plan: 'gift',
              current_period_end: new Date(Date.now() + day).toISOString(),
              cancel_at_period_end: true,
            },
          ])
        : new Response('{"error":"merchant"}', { status: 502 }),
    );
    const check = jest.spyOn(
      registration.entitlement,
      trigger === 'launch' ? 'checkIfDue' : 'checkNow',
    );
    mockAccountState = account;
    if (trigger === 'launch') {
      markReady();
      await mockReady;
    } else {
      mockOnState(account);
    }

    expect(check).toHaveBeenCalledTimes(1);
    await check.mock.results[0].value;
    const activeGift = { state: 'active', plan: 'gift' };
    expect(registration.entitlement.status()).toMatchObject(activeGift);
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    await expect(mockRefresh()).resolves.toMatchObject(activeGift);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    fetchImpl.mock.calls.forEach(([input, init]) => {
      const url = new URL(String(input));
      expect(url.pathname).toBe(accessPath);
      expect(url.searchParams.get('user_id')).toBe('eq.user-1');
      expect(init?.method ?? 'GET').toBe('GET');
      expect(new Headers(init?.headers).get('Authorization')).toBe(
        'Bearer access-1',
      );
      expect(new Headers(init?.headers).get('apikey')).toBe('public');
    });
  },
);

it.each([
  ['an expired token', () => new Response('{}', { status: 401 })],
  ['a server error', () => new Response('{}', { status: 503 })],
  [
    'a network error',
    () => {
      throw new TypeError('offline');
    },
  ],
  ['an unreadable answer', () => new Response('<html>')],
])('keeps cached access through %s', async (_label, reply) => {
  mockAccountState = account;
  const cached: IEntitlementRecord = {
    userId: 'user-1',
    status: 'active',
    plan: 'gift',
    periodEndsAt: Date.now() + day,
    verifiedAt: Date.now(),
    cancelAtPeriodEnd: true,
  };
  mockStored = cached;
  fetchImpl.mockImplementation(async () => reply());

  await expect(mockRefresh()).resolves.toMatchObject({ state: 'active' });
  expect(mockStored).toBe(cached);
  expect(fetchImpl).toHaveBeenCalledTimes(1);
});

it('reads and claims credits and opens checkout using only the store APIs', async () => {
  const checkout = 'https://checkout.stripe.com/c/pay/test';
  const pack = { id: 'pack-5', credits: 5, priceCents: 499 };
  fetchImpl
    .mockResolvedValueOnce(json(3))
    .mockResolvedValueOnce(
      json({ balance: 3, starterClaimed: true, owned: [], packs: [pack] }),
    )
    .mockResolvedValueOnce(json({ url: checkout }));
  const auth = { config: ACCOUNT_CONFIG, accessToken: 'access-1', fetchImpl };

  await expect(claimStarterCredits(auth)).resolves.toEqual({ ok: true });
  await expect(fetchSceneStore(auth)).resolves.toMatchObject({
    ok: true,
    store: { balance: 3, starterClaimed: true, packs: [pack] },
  });
  await expect(startCreditCheckout(auth, pack.id, 'en')).resolves.toEqual({
    ok: true,
    url: checkout,
  });
  expect(
    fetchImpl.mock.calls.map(([input]) => new URL(String(input)).pathname),
  ).toEqual([
    '/rest/v1/rpc/claim_starter_credits',
    '/rest/v1/rpc/my_store',
    '/functions/v1/create-credit-checkout',
  ]);
});
