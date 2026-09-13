import '@testing-library/jest-dom';
import { act, renderHook } from '@testing-library/react';
import {
  getAccountSnapshot,
  resetAccountStore,
  signInAccount,
  signUpAccount,
  useAccountKnown,
} from '../../../renderer/account/accountStore';

const original = window.electron;
afterEach(() => {
  window.electron = original;
  resetAccountStore();
});
const bridge = (methods: Record<string, unknown>) => {
  window.electron = {
    ipcRenderer: methods,
  } as unknown as typeof window.electron;
};
it('reports a missing sign-in handler instead of silently succeeding', async () => {
  bridge({});
  await act(() => signInAccount({ email: 'test@example.com', password: 'pw' }));
  expect(getAccountSnapshot()).toMatchObject({
    status: 'signed-out',
    error: 'rejected',
  });
});
it('reports IPC rejection and permits a later successful retry', async () => {
  const signIn = jest
    .fn()
    .mockRejectedValueOnce(new Error('Disconnected'))
    .mockResolvedValueOnce({ status: 'signed-in', identity: { id: 'me' } });
  bridge({ signInAccount: signIn });
  await signInAccount({ email: 'test@example.com', password: 'pw' });
  expect(getAccountSnapshot().error).toBe('network');
  await signInAccount({ email: 'test@example.com', password: 'pw' });
  expect(getAccountSnapshot()).toEqual({
    status: 'signed-in',
    identity: { id: 'me' },
  });
});
it('reports failed registration transport without exposing the thrown text', async () => {
  bridge({
    signUpAccount: jest
      .fn()
      .mockRejectedValue(new Error('private transport detail')),
  });
  await signUpAccount({ email: 'test@example.com', password: 'test password' });
  expect(getAccountSnapshot()).toEqual({
    status: 'signed-out',
    error: 'network',
  });
});
it('is not an answer until the main process gives one, and a window with no backend has nothing to wait for', async () => {
  let answer: (state: { status: string }) => void = () => {};
  bridge({
    getAccountState: () =>
      new Promise((resolve) => {
        answer = resolve;
      }),
  });
  const { result } = renderHook(() => useAccountKnown());
  expect(result.current).toBe(false);
  await act(async () => answer({ status: 'signed-out' }));
  expect(result.current).toBe(true);

  resetAccountStore();
  bridge({});
  expect(renderHook(() => useAccountKnown()).result.current).toBe(true);
});
