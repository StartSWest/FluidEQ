import { useSyncExternalStore } from 'react';
import type { IPlusProfile, TProfileFailure } from 'common/plusProfile';

/**
 * The member's name — the @handle and display name the leaderboard ranks and
 * the Visualizers gallery credits — as the Plus tab sees it.
 *
 * Kept per account: the answer for one account is never shown for another.
 * Every load names the account it is for, a different account starts from
 * nothing, and an answer that arrives for an account no longer signed in is
 * dropped rather than shown.
 */

export interface IProfileState {
  /** The account the rest of this is about, or undefined when signed out. */
  accountId?: string;
  profile?: IPlusProfile;
  /** Whether the server has answered for this account at least once. */
  loaded: boolean;
  saving: boolean;
  /** The last failure, until the next attempt. */
  error?: TProfileFailure;
}

const INITIAL: IProfileState = { loaded: false, saving: false };

let state: IProfileState = INITIAL;
const listeners = new Set<() => void>();

const bridge = () => window.electron?.ipcRenderer;

const publish = (next: Partial<IProfileState>) => {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const getProfileSnapshot = (): IProfileState => state;

export const useProfile = (): IProfileState =>
  useSyncExternalStore(subscribe, getProfileSnapshot, getProfileSnapshot);

/** Asks the server for this account's name; the one on screen stays meanwhile. */
export const loadProfile = async (accountId: string) => {
  if (state.accountId !== accountId) {
    state = { ...INITIAL, accountId };
    publish({});
  }
  const result = await bridge()?.plusProfile?.();
  if (!result || state.accountId !== accountId) {
    return;
  }
  if (result.ok) {
    publish({ profile: result.value ?? undefined, loaded: true });
  } else {
    publish({ error: result.failure });
  }
};

/** Signed out: nothing about the last account stays on screen. */
export const forgetProfile = () => {
  if (state.accountId !== undefined) {
    state = INITIAL;
    publish({});
  }
};

/** Chooses the name, once. Resolves whether it was taken. */
export const createProfile = async (
  handle: string,
  displayName: string,
): Promise<boolean> => {
  const { accountId } = state;
  if (!accountId || state.saving) {
    return false;
  }
  publish({ saving: true, error: undefined });
  const result = await bridge()?.plusCreateProfile?.(handle, displayName);
  if (state.accountId !== accountId) {
    return false;
  }
  if (!result) {
    publish({ saving: false });
    return false;
  }
  if (!result.ok) {
    publish({ saving: false, error: result.failure });
    return false;
  }
  publish({ saving: false, profile: result.value, loaded: true });
  return true;
};

export const clearProfileError = () => {
  if (state.error) {
    publish({ error: undefined });
  }
};

/** For tests: a clean module between runs. */
export const resetProfileStore = () => {
  listeners.clear();
  state = INITIAL;
};
