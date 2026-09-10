import { useSyncExternalStore } from 'react';
import type { IAccountState } from 'main/account/session';

/**
 * What the renderer knows about the signed-in account.
 *
 * A module store rather than a context, for the same reason the graph's look
 * selection is one: this is a single value read from a handful of places that
 * are nowhere near each other in the tree, and threading a provider through the
 * app to carry one object would be more moving parts than the object is worth.
 *
 * Nothing here touches the network. Every field arrives over IPC from the main
 * process, which is the only side that holds a token. What was typed into the
 * form crosses once, in one direction, and is kept on neither side.
 */

const SIGNED_OUT: IAccountState = { status: 'signed-out' };

let state: IAccountState = SIGNED_OUT;
let subscribed = false;
const listeners = new Set<() => void>();

const publish = (next: IAccountState) => {
  state = next;
  listeners.forEach((listener) => listener());
};

/**
 * `window.electron` is absent under Jest, where components render without a
 * preload. Reaching for it optionally rather than guarding at every call site
 * keeps that detail here instead of in the components.
 */
const bridge = () => window.electron?.ipcRenderer;

const start = () => {
  if (subscribed) {
    return () => {};
  }
  subscribed = true;
  const api = bridge();
  // The first read, because the main process already knows the answer at
  // startup: a session restored from disk exists before the window does, and
  // waiting for a change event would show "signed out" to somebody who is not.
  api
    ?.getAccountState?.()
    .then(publish)
    .catch(() => {
      // A build with no backend, or a handler that is not registered. Signed out
      // is the correct reading of both, and it is already the state.
    });
  return api?.onAccountState?.(publish) ?? (() => {});
};

let stop: () => void = () => {};

export const subscribeAccount = (listener: () => void) => {
  if (listeners.size === 0) {
    stop = start();
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const getAccountSnapshot = (): IAccountState => state;

export const useAccount = (): IAccountState =>
  useSyncExternalStore(
    subscribeAccount,
    getAccountSnapshot,
    getAccountSnapshot,
  );

const adopt = (next: IAccountState | undefined) => {
  if (next) {
    publish(next);
  }
};

export const signUpAccount = async (details: {
  email: string;
  password: string;
  name?: string;
}) => adopt(await bridge()?.signUpAccount?.(details));

export const signInAccount = async (credentials: {
  email: string;
  password: string;
}) => adopt(await bridge()?.signInAccount?.(credentials));

export const confirmAccountCode = async (code: string) =>
  adopt(await bridge()?.confirmAccountCode?.(code));

export const resendAccountCode = async () =>
  adopt(await bridge()?.resendAccountCode?.());

export const forgotAccountPassword = async (email: string) =>
  adopt(await bridge()?.forgotAccountPassword?.(email));

export const resetAccountPassword = async (details: {
  code: string;
  password: string;
}) => adopt(await bridge()?.resetAccountPassword?.(details));

export const abandonAccountPending = async () =>
  adopt(await bridge()?.abandonAccountPending?.());

export const signOutAccount = async () => {
  await bridge()?.signOutAccount?.();
};

/** Releases the IPC listener. For a test that wants a clean module between runs. */
export const resetAccountStore = () => {
  stop();
  stop = () => {};
  subscribed = false;
  listeners.clear();
  state = SIGNED_OUT;
};
