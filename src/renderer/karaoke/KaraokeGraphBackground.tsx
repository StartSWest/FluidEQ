/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useSyncExternalStore } from 'react';

let host: HTMLDivElement | null = null;
const listeners = new Set<() => void>();
const publishHost = (next: HTMLDivElement | null) => {
  host = next;
  listeners.forEach((listener) => listener());
};
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** The shell moves its one graph here; its existing scene follows the plot. */
export const useKaraokeGraphHost = () =>
  useSyncExternalStore(
    subscribe,
    () => host,
    () => null,
  );

export default function KaraokeGraphBackground() {
  return (
    <div
      ref={publishHost}
      className="karaoke-stage-media karaoke-graph-background"
      aria-hidden="true"
      inert
    />
  );
}
