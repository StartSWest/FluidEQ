import { useSyncExternalStore } from 'react';
import type { IMakerMonth, TMakerMonthFailure } from 'common/makerMonth';

/**
 * The month a maker earned by publishing, as the account panel sees it.
 *
 * Kept per account, like the profile beside it: the answer for one account is
 * never shown for another, and an answer that arrives for an account no
 * longer signed in is dropped rather than shown.
 *
 * Nothing here decides access. The membership the app acts on is the
 * entitlement; this only says where it came from and when it runs out, so the
 * panel can ask for another scene before it does.
 */

export interface IMakerMonthState {
  /** The account the rest of this is about, or undefined when signed out. */
  accountId?: string;
  month?: IMakerMonth;
  /** Whether the server has answered for this account at least once. */
  loaded: boolean;
  /** The last failure, until the next attempt. */
  error?: TMakerMonthFailure;
}

const INITIAL: IMakerMonthState = { loaded: false };

let state: IMakerMonthState = INITIAL;
const listeners = new Set<() => void>();

const bridge = () => window.electron?.ipcRenderer;

const publish = (next: Partial<IMakerMonthState>) => {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const getMakerMonthSnapshot = (): IMakerMonthState => state;

export const useMakerMonth = (): IMakerMonthState =>
  useSyncExternalStore(subscribe, getMakerMonthSnapshot, getMakerMonthSnapshot);

/** Asks the server for this account's month; what is on screen stays meanwhile. */
export const loadMakerMonth = async (accountId: string) => {
  if (state.accountId !== accountId) {
    state = { ...INITIAL, accountId };
    publish({});
  }
  const outcome = await bridge()?.getMakerMonth?.();
  if (!outcome || state.accountId !== accountId) {
    return;
  }
  if (outcome.ok) {
    publish({ month: outcome.month, loaded: true, error: undefined });
  } else {
    publish({ error: outcome.reason });
  }
};

/** Signed out: nothing about the last account stays on screen. */
export const forgetMakerMonth = () => {
  if (state.accountId !== undefined) {
    state = INITIAL;
    publish({});
  }
};

/** For a test that wants a clean module between runs. */
export const resetMakerMonthStore = () => {
  state = INITIAL;
  listeners.clear();
};
