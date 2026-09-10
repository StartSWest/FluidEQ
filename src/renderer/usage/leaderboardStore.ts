import { useSyncExternalStore } from 'react';
import type {
  ILeaderboardBoard,
  ILeaderboardStatus,
} from 'main/ipc/leaderboard';
import type {
  TLeaderboardFailure,
  TLeaderboardPeriod,
} from 'main/usage/leaderboardApi';

/**
 * The leaderboard, as the renderer sees it: whether this person is in, how
 * much they listened today, and the board itself when asked for.
 */

export interface ILeaderboardState {
  status: ILeaderboardStatus;
  board?: ILeaderboardBoard;
  loading: boolean;
  error?: TLeaderboardFailure;
  /** Set after "remove my data" succeeded, until the next change. */
  removed: boolean;
}

const INITIAL: ILeaderboardState = {
  status: { optedIn: false, todayMinutes: 0, eligible: false },
  loading: false,
  removed: false,
};

let state = INITIAL;
let subscribed = false;
const listeners = new Set<() => void>();

const bridge = () => window.electron?.ipcRenderer;

const publish = (next: Partial<ILeaderboardState>) => {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener());
};

const start = () => {
  if (subscribed) {
    return () => {};
  }
  subscribed = true;
  const api = bridge();
  api
    ?.leaderboardStatus?.()
    .then((status) => publish({ status }))
    .catch(() => undefined);
  return (
    api?.onLeaderboardStatus?.((status) => publish({ status })) ?? (() => {})
  );
};

let stop: () => void = () => {};

export const subscribeLeaderboard = (listener: () => void) => {
  if (listeners.size === 0) {
    stop = start();
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const getLeaderboardSnapshot = () => state;

export const useLeaderboard = (): ILeaderboardState =>
  useSyncExternalStore(
    subscribeLeaderboard,
    getLeaderboardSnapshot,
    getLeaderboardSnapshot,
  );

/** Re-read the tally — for when the Account panel opens. */
export const refreshLeaderboardStatus = async () => {
  const status = await bridge()?.leaderboardStatus?.();
  if (status) {
    publish({ status });
  }
};

export const setLeaderboardOptIn = async (value: boolean) => {
  const status = await bridge()?.leaderboardOptIn?.(value);
  if (status) {
    publish({ status, removed: false, error: undefined });
  }
};

export const loadLeaderboard = async (period: TLeaderboardPeriod) => {
  publish({ loading: true, error: undefined });
  const result = await bridge()?.leaderboardBoard?.(period);
  if (!result) {
    publish({ loading: false });
    return;
  }
  if (result.ok) {
    publish({ board: result.value, loading: false });
  } else {
    publish({ loading: false, error: result.failure });
  }
};

export const removeMeFromLeaderboard = async () => {
  const result = await bridge()?.leaderboardRemoveMe?.();
  if (result?.ok) {
    publish({ removed: true, board: undefined, error: undefined });
  } else if (result) {
    publish({ error: result.failure });
  }
};

/** For tests: a clean module between runs. */
export const resetLeaderboardStore = () => {
  stop();
  stop = () => {};
  subscribed = false;
  listeners.clear();
  state = INITIAL;
};
