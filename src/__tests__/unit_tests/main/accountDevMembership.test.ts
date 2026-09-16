/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { registerAccountIpc } from '../../../main/ipc/account';

/**
 * The pretend membership, and the one rule about it: it walks the path a real
 * payment walks.
 *
 * Buy Me a Coffee has no test mode, so this button is the only way anybody
 * ever sees what a payment does to the app — the membership turning on, the
 * welcome, the locks opening. The moment it takes a shortcut the real path
 * does not, it stops testing anything: a read that began before the webhook
 * landed answered with the old row and the membership sat unnoticed until
 * the four-hour staleness gate opened, which is exactly what a real payment
 * does NOT do, because `openBillingPage` says `expectChange` first.
 */

const mockHandlers = new Map<
  string,
  (event: unknown, value: unknown) => unknown
>();
jest.mock('electron', () => ({
  app: {
    whenReady: () => Promise.resolve(),
    on: jest.fn(),
    getVersion: () => '0.0.0-test',
  },
  ipcMain: {
    handle: (
      name: string,
      handler: (event: unknown, value: unknown) => unknown,
    ) => mockHandlers.set(name, handler),
    removeHandler: (name: string) => mockHandlers.delete(name),
  },
}));

const mockEntitlement = {
  status: jest.fn(() => ({ state: 'none' })),
  subscribe: jest.fn(() => jest.fn()),
  checkIfDue: jest.fn(() => Promise.resolve()),
  checkNow: jest.fn(() => Promise.resolve({ state: 'active' })),
  expectChange: jest.fn(),
  forget: jest.fn(),
  releaseDevelopmentOverride: jest.fn(),
};
const mockSend = jest.fn(() => Promise.resolve());

jest.mock('../../../common/accountConfig', () => ({
  ACCOUNT_CONFIG: {},
  isAccountConfigured: () => true,
  isCheckoutConfigured: () => true,
}));
jest.mock('../../../main/account/session', () => ({
  createAccountSession: () => ({
    state: () => ({ status: 'signed-in', identity: { id: 'u-1' } }),
    accessToken: () => Promise.resolve('token'),
    dispose: jest.fn(),
  }),
}));
jest.mock('../../../main/account/entitlement', () => ({
  createEntitlement: () => mockEntitlement,
}));
jest.mock('../../../main/account/membershipSimulator', () => ({
  createMembershipSimulator: () => ({ send: mockSend }),
}));
jest.mock('../../../main/accountCredentials', () => ({
  createAccountCredentialStore: jest.fn(),
}));
jest.mock('../../../main/encryptedJsonStore', () => ({
  createEncryptedJsonStore: jest.fn(),
}));
// The real `BillingError` with it: the handler asks whether the failure is
// one, and a mock without it throws where a refusal should be reported.
jest.mock('../../../main/account/billingClient', () => ({
  ...jest.requireActual('../../../main/account/billingClient'),
  createBillingClient: () => ({
    checkoutUrl: jest.fn(),
    portalUrl: jest.fn(),
  }),
}));
jest.mock('../../../main/safeExternal', () => ({
  __esModule: true,
  default: jest.fn(() => true),
}));

const simulate = (value: unknown) =>
  mockHandlers.get('dev-membership-simulate')!(undefined, value) as Promise<{
    ok: boolean;
  }>;

describe('the pretend membership', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockHandlers.clear();
    registerAccountIpc({
      getMainWindow: () => null,
      userDataDir: 'unused',
      developmentSimulator: true,
    });
  });

  it('comes back from a pretend payment the way it comes back from a real one', async () => {
    await expect(simulate('started')).resolves.toEqual({ ok: true });

    expect(mockSend).toHaveBeenCalledWith('token', 'started');
    // The pin a FLUIDEQ_DEV_ENTITLED window holds would answer for the
    // server for ever otherwise.
    expect(mockEntitlement.releaseDevelopmentOverride).toHaveBeenCalled();
    // The sentence the merchant's own page gets, and the reason the answer
    // is believed rather than judged recent enough to skip.
    expect(mockEntitlement.expectChange).toHaveBeenCalled();
    expect(mockEntitlement.checkNow).toHaveBeenCalled();
  });

  it('asks for nothing, and expects nothing, on a word it does not know', async () => {
    await expect(simulate('whatever')).resolves.toEqual({
      ok: false,
      failure: 'signed_out',
    });
    expect(mockSend).not.toHaveBeenCalled();
    expect(mockEntitlement.expectChange).not.toHaveBeenCalled();
  });

  it('leaves the membership alone when the server refuses', async () => {
    mockSend.mockRejectedValueOnce(new Error('nope'));

    await expect(simulate('cancelled')).resolves.toEqual({
      ok: false,
      failure: 'network',
    });
    // Nothing was written, so there is nothing to come back for: telling the
    // app to expect a change it will never see would make every later event
    // ask the server again, for ever.
    expect(mockEntitlement.expectChange).not.toHaveBeenCalled();
    expect(mockEntitlement.checkNow).not.toHaveBeenCalled();
  });
});
