/** @jest-environment node */
import { registerAccountIpc } from '../../../main/ipc/account';

const mockHandlers = new Map<
  string,
  (event: unknown, value?: unknown) => unknown
>();
const mockSignIn = jest.fn();
const mockSignUp = jest.fn();
let mockConfigured = true;
jest.mock('electron', () => ({
  ipcMain: {
    handle: (
      name: string,
      handler: (event: unknown, value?: unknown) => unknown,
    ) => mockHandlers.set(name, handler),
    removeHandler: jest.fn(),
  },
  app: { whenReady: () => Promise.resolve() },
}));
jest.mock('../../../common/accountConfig', () => ({
  ACCOUNT_CONFIG: {},
  isAccountConfigured: () => mockConfigured,
  isCheckoutConfigured: () => false,
}));
jest.mock('../../../main/account/session', () => ({
  createAccountSession: () => ({
    state: () => ({ status: 'signed-out' }),
    signIn: mockSignIn,
    signUp: mockSignUp,
    dispose: jest.fn(),
  }),
}));
jest.mock('../../../main/account/entitlement', () => ({
  createEntitlement: () => ({ checkIfDue: jest.fn() }),
}));
jest.mock('../../../main/accountCredentials', () => ({
  createAccountCredentialStore: jest.fn(),
}));
jest.mock('../../../main/encryptedJsonStore', () => ({
  createEncryptedJsonStore: jest.fn(),
}));
jest.mock('../../../main/account/billingClient', () => ({
  createBillingClient: jest.fn(),
}));
jest.mock('../../../main/safeExternal', () => ({
  __esModule: true,
  default: jest.fn(),
}));
const call = (name: string, value: unknown) =>
  mockHandlers.get(name)!(undefined, value);
beforeEach(() => {
  jest.clearAllMocks();
  mockConfigured = true;
  registerAccountIpc({ getMainWindow: () => null, userDataDir: 'unused' });
});
it('keeps short existing passwords valid for login and trims email', () => {
  call('account-sign-in', { email: ' person@example.com ', password: 'pw' });
  expect(mockSignIn).toHaveBeenCalledWith({
    email: 'person@example.com',
    password: 'pw',
  });
});
it.each([
  ['bad', 'pw', 'invalid_email'],
  ['person@example.com', '', 'wrong_credentials'],
  ['person@example.com', 'x'.repeat(129), 'wrong_credentials'],
])('refuses invalid login with a visible error', (email, password, error) => {
  expect(call('account-sign-in', { email, password })).toEqual({
    status: 'signed-out',
    error,
  });
  expect(mockSignIn).not.toHaveBeenCalled();
});
it.each(['short', 'x'.repeat(129)])(
  'refuses invalid new passwords before signup',
  (password) => {
    expect(
      call('account-sign-up', { email: 'person@example.com', password }),
    ).toMatchObject({ error: 'weak_password' });
    expect(mockSignUp).not.toHaveBeenCalled();
  },
);
it('refuses oversized names rather than silently dropping them', () => {
  expect(
    call('account-sign-up', {
      email: 'person@example.com',
      password: 'valid password',
      name: 'x'.repeat(81),
    }),
  ).toMatchObject({ error: 'rejected' });
  expect(mockSignUp).not.toHaveBeenCalled();
});
it('reports unavailable configuration instead of a no-op', () => {
  mockConfigured = false;
  expect(
    call('account-sign-in', { email: 'person@example.com', password: 'pw' }),
  ).toMatchObject({ error: 'rejected' });
  expect(mockSignIn).not.toHaveBeenCalled();
});
