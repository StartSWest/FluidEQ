/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useSyncExternalStore } from 'react';
import type { TranslationKey } from 'common/i18n';
import {
  limitLevelOf,
  nearestLimit,
  type IServerLimitShare,
  type TLimitLevel,
  type TServerLimit,
} from 'common/serverUsage';

/**
 * The free plan's limit nearest to full, for the admin, wherever in the app
 * they are (Ivan, 2026-10-21: "we need to know when we are on the supabase
 * limit so we pay it"). The Server page says it at its top; this carries it
 * to the corner notice and the Server tab's badge.
 *
 * Measured once a session per admin account, when the app first learns the
 * account is the admin's (`ServerLimitNotice`): a member never asks, and the
 * admin's later visits to the Server page measure again by themselves.
 */

export const LIMIT_TITLES: Record<
  Exclude<TLimitLevel, 'ok'>,
  TranslationKey
> = {
  warn: 'insights.server.limit.warn',
  full: 'insights.server.limit.full',
};

export const LIMIT_NAMES: Record<TServerLimit, TranslationKey> = {
  database: 'insights.server.limit.database',
  files: 'insights.server.limit.files',
  accounts: 'insights.server.limit.accounts',
};

interface IServerLimitState {
  accountId?: string;
  nearest?: IServerLimitShare;
  /** The level the admin put the notice away at, this session. */
  putAwayAt?: TLimitLevel;
}

let state: IServerLimitState = {};
let asking: string | undefined;
const listeners = new Set<() => void>();

const publish = (next: IServerLimitState) => {
  state = next;
  listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const getServerLimitSnapshot = (): IServerLimitState => state;

export const useServerLimit = (): IServerLimitState =>
  useSyncExternalStore(
    subscribe,
    getServerLimitSnapshot,
    getServerLimitSnapshot,
  );

/** The level the notice and the badge show, or `ok` for nothing to show. */
export const shownLevel = (limit: IServerLimitState): TLimitLevel =>
  limit.nearest ? limitLevelOf(limit.nearest.share) : 'ok';

/** Measures once for this admin account; a failure stays quiet. */
export const checkServerLimit = async (accountId: string) => {
  if (state.accountId === accountId || asking === accountId) {
    return;
  }
  asking = accountId;
  try {
    const outcome = await window.electron?.ipcRenderer
      ?.adminServerUsage?.()
      .catch(() => undefined);
    if (outcome?.ok && asking === accountId) {
      publish({ accountId, nearest: nearestLimit(outcome.value) });
    }
  } finally {
    if (asking === accountId) {
      asking = undefined;
    }
  }
};

/** Put away until it gets worse: a red notice comes back after an amber one. */
export const putAwayServerLimit = () => {
  publish({ ...state, putAwayAt: shownLevel(state) });
};

/** A newer measurement, from the Server page itself, for the same admin. */
export const adoptServerLimit = (nearest: IServerLimitShare) => {
  if (state.accountId !== undefined) {
    publish({ ...state, nearest });
  }
};

/** For a test that wants a clean module between runs. */
export const resetServerLimitStore = () => {
  state = {};
  asking = undefined;
  listeners.clear();
};
