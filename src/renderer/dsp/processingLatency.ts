/* FluidEQ — GPL-3.0-or-later */
import { useSyncExternalStore } from 'react';
import type { IEngineLatency } from '../../common/engineHealth';

export interface IPlayerProcessingLatency {
  endpoint: string;
  latency: IEngineLatency;
}

let snapshot: IPlayerProcessingLatency | undefined;
let fingerprint = '';
const listeners = new Set<() => void>();
const read = () => snapshot;
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const setPlayerProcessingLatency = (
  next: IPlayerProcessingLatency | undefined,
) => {
  const nextFingerprint = next ? JSON.stringify(next) : '';
  if (fingerprint === nextFingerprint) {
    return;
  }
  fingerprint = nextFingerprint;
  snapshot = next;
  listeners.forEach((listener) => listener());
};

export const usePlayerProcessingLatency = () =>
  useSyncExternalStore(subscribe, read, read);
