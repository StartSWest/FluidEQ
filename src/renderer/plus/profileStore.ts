import { useEffect, useRef, useSyncExternalStore } from 'react';
import {
  HANDLE_PATTERN,
  type IPlusProfile,
  type THandleAvailability,
  type TProfileFailure,
} from 'common/plusProfile';
import type { TPlusProfileResult } from 'main/ipc/plusProfile';

/**
 * The member's name — the @handle and display name the Visualizers gallery
 * credits — as the Plus tab sees it.
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

type TSave = (
  handle: string,
  displayName: string,
) => Promise<TPlusProfileResult<IPlusProfile>> | undefined;

/**
 * One request to the server about the name, kept to the account that made
 * it. Resolves whether the name was taken; a failure stays on `error` until
 * the next attempt.
 */
const save = async (
  request: TSave,
  handle: string,
  displayName: string,
): Promise<boolean> => {
  const { accountId } = state;
  if (!accountId || state.saving) {
    return false;
  }
  publish({ saving: true, error: undefined });
  const result = await request(handle, displayName);
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

/** Chooses the name, once. Resolves whether it was taken. */
export const createProfile = (
  handle: string,
  displayName: string,
): Promise<boolean> =>
  save(
    (wanted, name) => bridge()?.plusCreateProfile?.(wanted, name),
    handle,
    displayName,
  );

/** Changes the name already chosen. Resolves whether the change was taken. */
export const updateProfile = (
  handle: string,
  displayName: string,
): Promise<boolean> =>
  save(
    (wanted, name) => bridge()?.plusUpdateProfile?.(wanted, name),
    handle,
    displayName,
  );

/**
 * Whether a handle can be had, as the save would answer (premium 0106);
 * undefined when the server could not be asked. A handle off the pattern is
 * `invalid` without asking anybody.
 */
export const checkHandleAvailability = async (
  handle: string,
): Promise<THandleAvailability | undefined> => {
  if (!HANDLE_PATTERN.test(handle)) {
    return 'invalid';
  }
  const result = await bridge()
    ?.plusHandleAvailability?.(handle)
    .catch(() => undefined);
  return result?.ok ? result.value : undefined;
};

/**
 * What a publication needs of this account (Ivan, 2026-11-12: a scene is
 * published under a name and an @handle): `missing` once the server has
 * said this account has chosen neither, and never before it has answered —
 * a dialog must not ask for a name the account may already have. Asks the
 * server for this account when nothing is known of it yet.
 */
export const usePublicIdentity = (
  accountId: string | undefined,
): { loaded: boolean; missing: boolean; profile?: IPlusProfile } => {
  const current = useProfile();
  const known = accountId !== undefined && current.accountId === accountId;
  // Asked once per account per mount: the load itself makes `known` true
  // before it answers, and asking again then would be the same question.
  const asked = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (
      accountId &&
      !(known && current.loaded) &&
      asked.current !== accountId
    ) {
      asked.current = accountId;
      loadProfile(accountId).catch(() => undefined);
    }
  }, [accountId, known, current.loaded]);
  const loaded = known && current.loaded;
  return {
    loaded,
    missing: loaded && current.profile === undefined,
    ...(known && current.profile ? { profile: current.profile } : {}),
  };
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
