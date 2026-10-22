import { useSyncExternalStore } from 'react';
import {
  SIGNED_OUT_LISTENING,
  type IListeningStatus,
  type TListeningFailure,
} from 'common/listening';

/**
 * Where the signed-in account stands on the listening statistics, as main
 * reports it (`ipc/listening.ts`), and the one action the window takes on
 * it: the account's answer. Shared by the notice that asks and the account
 * panel's card, so an answer in either shows in both at once.
 */

export interface IListeningState {
  status: IListeningStatus;
  /** An answer being written: both places hold their buttons meanwhile. */
  saving: boolean;
  error?: TListeningFailure;
}

const INITIAL: IListeningState = {
  status: SIGNED_OUT_LISTENING,
  saving: false,
};

let state = INITIAL;
let stop: () => void = () => {};
const listeners = new Set<() => void>();

const bridge = () => window.electron?.ipcRenderer;

const publish = (next: Partial<IListeningState>) => {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener());
};

const start = () => {
  const api = bridge();
  api
    ?.listeningStatus?.()
    .then((status) => publish({ status }))
    .catch(() => undefined);
  return (
    api?.onListeningStatus?.((status) => publish({ status })) ?? (() => {})
  );
};

const subscribe = (listener: () => void) => {
  if (listeners.size === 0) {
    stop = start();
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      stop();
      stop = () => {};
    }
  };
};

const snapshot = () => state;

export const useListening = (): IListeningState =>
  useSyncExternalStore(subscribe, snapshot, snapshot);

/** The account's answer: kept on, or switched off (which deletes what was sent). */
export const setListeningSharing = async (sharing: boolean): Promise<void> => {
  const api = bridge();
  if (!api?.setListeningSharing) {
    publish({ error: 'offline' });
    return;
  }
  publish({ saving: true, error: undefined });
  try {
    const outcome = await api.setListeningSharing(sharing);
    publish(
      outcome.ok
        ? { status: outcome.status, saving: false }
        : { status: outcome.status, saving: false, error: outcome.reason },
    );
  } catch {
    publish({ saving: false, error: 'offline' });
  }
};

/** For tests: a clean module between runs. */
export const resetListeningStore = () => {
  stop();
  stop = () => {};
  listeners.clear();
  state = INITIAL;
};
