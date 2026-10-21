/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useSyncExternalStore } from 'react';
import type {
  ICreatorStatus,
  TCreatorFailure,
  TCreatorOutcome,
} from 'common/creatorPayouts';

/**
 * A creator's payouts as the account panel sees them (premium 0064).
 *
 * Kept per account, like the maker's month beside it: an answer for one
 * account is never shown for another, and one that arrives for an account no
 * longer signed in is dropped. Main pushes a fresh answer when Stripe's
 * sign-up sends the creator back (`fluideq://creators/…`), whatever has the
 * focus; the panel asks again each time it opens.
 *
 * Nothing here decides anything: who can be paid, how much and when are the
 * server's, and arrive with every answer.
 */

export interface ICreatorState {
  /** The account the rest is about; undefined when signed out. */
  accountId?: string;
  status?: ICreatorStatus;
  /** Why the last ask failed, while there is no status to show instead. */
  failure?: TCreatorFailure;
}

const INITIAL: ICreatorState = {};

let state: ICreatorState = INITIAL;
const listeners = new Set<() => void>();
let offPush: (() => void) | undefined;

const bridge = () => window.electron?.ipcRenderer;

const publish = (next: Partial<ICreatorState>) => {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener());
};

const adopt = (accountId: string, outcome: TCreatorOutcome | undefined) => {
  if (!outcome || state.accountId !== accountId) {
    return;
  }
  publish(
    outcome.ok
      ? { status: outcome.status, failure: undefined }
      : { failure: outcome.reason },
  );
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  // Main's push, heard only while something on screen listens.
  if (!offPush) {
    offPush = bridge()?.onCreatorChanged?.((status) => {
      if (state.accountId) {
        publish({ status, failure: undefined });
      }
    });
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      offPush?.();
      offPush = undefined;
    }
  };
};

export const getCreatorSnapshot = (): ICreatorState => state;

export const useCreator = (): ICreatorState =>
  useSyncExternalStore(subscribe, getCreatorSnapshot, getCreatorSnapshot);

const bindAccount = (accountId: string) => {
  if (state.accountId !== accountId) {
    state = { ...INITIAL, accountId };
    publish({});
  }
};

/** Asks the server; what is on screen stays meanwhile. */
export const loadCreator = async (accountId: string) => {
  bindAccount(accountId);
  adopt(accountId, await bridge()?.getCreatorStatus?.());
};

/** Asks Stripe what the account can do now, then the server. */
export const refreshCreator = async (accountId: string) => {
  bindAccount(accountId);
  adopt(accountId, await bridge()?.refreshCreatorStatus?.());
};

/** Signed out: nothing about the last account stays on screen. */
export const forgetCreator = () => {
  if (state.accountId !== undefined) {
    state = INITIAL;
    publish({});
  }
};

/** For a test that wants a clean module between runs. */
export const resetCreatorStore = () => {
  state = INITIAL;
  listeners.clear();
  offPush?.();
  offPush = undefined;
};
