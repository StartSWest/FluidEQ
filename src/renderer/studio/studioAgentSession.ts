import { useSyncExternalStore } from 'react';

/**
 * Whether the member's AI has started working with the Studio in this
 * window's life: the member copied the AI prompt, or their AI asked FluidEQ
 * for something (`useStudioAgent.ts`). From then on, while the Studio is open
 * and its door is, FluidEQ goes on hearing the music for it
 * (`useSongListening.ts`) - and not before, so a door opened once, long ago,
 * holds the capture open for nobody.
 */

let working = false;
const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const snapshot = () => working;

export const markStudioAgentWorking = () => {
  if (!working) {
    working = true;
    listeners.forEach((listener) => listener());
  }
};

export const useStudioAgentWorking = () =>
  useSyncExternalStore(subscribe, snapshot, snapshot);
