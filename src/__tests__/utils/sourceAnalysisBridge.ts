/* FluidEQ — GPL-3.0-or-later */
import {
  copySourceAnalysisUpdate,
  SOURCE_ANALYSIS_CHANNEL,
  type ISourceAnalysisUpdate,
} from '../../common/dsp/sourceAnalysis';
import isRequestId from '../../common/ipcRequestId';

type TListener = (...args: unknown[]) => void;
type TAction = 'publish' | 'capable' | 'prepare' | 'fallback' | 'release';

export interface ISourceAnalysisRequest {
  action: TAction;
  update?: ISourceAnalysisUpdate;
  requestId: number;
}

/** A main process with host playback by default, and real correlated replies. */
export const createSourceAnalysisBridge = ({
  capable = false,
  prepare = false,
  fallback = true,
}: {
  capable?: boolean;
  prepare?: boolean;
  fallback?: boolean;
} = {}) => {
  const listeners = new Map<string, Set<TListener>>();
  const requests: ISourceAnalysisRequest[] = [];
  const knownChannel = (channel: string) => {
    if (
      channel !== SOURCE_ANALYSIS_CHANNEL &&
      channel !== 'window-state-changed'
    ) {
      throw new Error(`Unexpected source-analysis fixture channel: ${channel}`);
    }
  };
  const emit = (channel: string, ...args: unknown[]) => {
    knownChannel(channel);
    [...(listeners.get(channel) ?? [])].forEach((listener) =>
      listener(...args),
    );
  };
  const on = (channel: string, listener: TListener) => {
    knownChannel(channel);
    const subscribed = listeners.get(channel) ?? new Set<TListener>();
    subscribed.add(listener);
    listeners.set(channel, subscribed);
    return () => {
      subscribed.delete(listener);
      if (subscribed.size === 0) {
        listeners.delete(channel);
      }
    };
  };
  const sendMessage = (
    channel: string,
    args: unknown[],
    requestId?: unknown,
  ) => {
    if (channel !== SOURCE_ANALYSIS_CHANNEL || !isRequestId(requestId)) {
      throw new Error('Expected a correlated source-analysis request');
    }
    const [action, rawUpdate] = args;
    if (
      args.length !== 2 ||
      (action !== 'publish' &&
        action !== 'capable' &&
        action !== 'prepare' &&
        action !== 'fallback' &&
        action !== 'release')
    ) {
      throw new Error(`Unexpected source-analysis action: ${String(action)}`);
    }
    const needsUpdate =
      action === 'publish' || action === 'prepare' || action === 'fallback';
    const update = needsUpdate
      ? copySourceAnalysisUpdate(rawUpdate)
      : undefined;
    if ((needsUpdate && !update) || (!needsUpdate && rawUpdate !== undefined)) {
      throw new Error(`Invalid source-analysis update for ${action}`);
    }
    requests.push({ action, update, requestId });
    let result = true;
    if (action === 'capable') {
      result = capable;
    }
    if (action === 'prepare') {
      result = prepare;
    }
    if (action === 'fallback') {
      result = fallback;
    }
    // sendRequest subscribes after sending; Electron never replies in the send.
    Promise.resolve().then(() => emit(channel, { result }, requestId));
  };
  return {
    sendMessage,
    // Preload's cleanup returns Electron's emitter, which renderer callers ignore.
    // This fixture implements the observable contract: remove the exact listener.
    on: on as Window['electron']['ipcRenderer']['on'],
    requests,
    emit,
    listenerCount: (channel: string) => listeners.get(channel)?.size ?? 0,
  };
};
