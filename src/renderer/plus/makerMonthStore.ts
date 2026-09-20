import { useSyncExternalStore } from 'react';
import type { IMakerMonth } from 'common/makerMonth';

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

/**
 * A month, or none yet. There is deliberately no "loading" and no "failed":
 * everything built on this draws nothing at all without a month — the card
 * is absent, the notice is absent — so a failure and a member who has never
 * published are the same picture, and a state nobody can see is a state
 * nobody should be keeping.
 */
export interface IMakerMonthState {
  /** The account the rest of this is about, or undefined when signed out. */
  accountId?: string;
  month?: IMakerMonth;
}

const INITIAL: IMakerMonthState = {};

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
    publish({ month: outcome.month });
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
