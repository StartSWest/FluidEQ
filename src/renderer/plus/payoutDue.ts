/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useSyncExternalStore } from 'react';
import type { ICreatorPayoutPreview } from 'common/creatorPayouts';

/**
 * Whether creators are owed their payout run, for the admin, wherever in the
 * app they are. Creators are paid every 15 days (Ivan, 2026-10-21: "cada
 * 15"), by a press of the admin's and never on a clock, so the app has to
 * say when that press is owed or it is simply forgotten.
 *
 * Asked once a session per admin account (`PayoutDueNotice`), the way the
 * server's plan limit is; put away, it stays away for the session.
 */

interface IPayoutDueState {
  accountId?: string;
  preview?: ICreatorPayoutPreview;
  putAway?: boolean;
}

let state: IPayoutDueState = {};
let asking: string | undefined;
const listeners = new Set<() => void>();

const publish = (next: IPayoutDueState) => {
  state = next;
  listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const getPayoutDueSnapshot = (): IPayoutDueState => state;

export const usePayoutDue = (): IPayoutDueState =>
  useSyncExternalStore(subscribe, getPayoutDueSnapshot, getPayoutDueSnapshot);

/** Asks once for this admin account; a failure stays quiet. */
export const checkPayoutDue = async (accountId: string) => {
  if (state.accountId === accountId || asking === accountId) {
    return;
  }
  asking = accountId;
  try {
    const outcome = await window.electron?.ipcRenderer
      ?.previewCreatorPayouts?.()
      .catch(() => undefined);
    if (outcome?.ok && asking === accountId) {
      publish({ accountId, preview: outcome.value });
    }
  } finally {
    if (asking === accountId) {
      asking = undefined;
    }
  }
};

export const putAwayPayoutDue = () => {
  publish({ ...state, putAway: true });
};

/** The Payouts page's own newer reading, or a run just made. */
export const adoptPayoutPreview = (preview: ICreatorPayoutPreview) => {
  if (state.accountId !== undefined) {
    publish({ ...state, preview });
  }
};

/** For a test that wants a clean module between runs. */
export const resetPayoutDueStore = () => {
  state = {};
  asking = undefined;
  listeners.clear();
};
