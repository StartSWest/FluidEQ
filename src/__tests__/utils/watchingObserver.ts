/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { act } from '@testing-library/react';

type TWatcher = (entries: Array<{ isIntersecting: boolean }>) => void;

export interface IWatchingObserver {
  /** Every observer made since it was installed reports its target in view. */
  comeNear: () => void;
  /** Every observer reports its target out of view. */
  goFar: () => void;
  /** Puts the setup's inert stand-in back. */
  restore: () => void;
}

/**
 * An `IntersectionObserver` a case can fire. The setup's stand-in never
 * reports, as jsdom has no viewport, so a picture drawn only near the view
 * (`useNearView`) would never be drawn at all.
 *
 * A constructor returning an object: `new` hands back that object.
 */
export const installWatchingObserver = (): IWatchingObserver => {
  const standIn = globalThis.IntersectionObserver;
  const watched: TWatcher[] = [];
  function WatchingObserver(callback: TWatcher) {
    watched.push(callback);
    return {
      observe: () => undefined,
      disconnect: () => undefined,
      unobserve: () => undefined,
      takeRecords: () => [],
    };
  }
  globalThis.IntersectionObserver =
    WatchingObserver as unknown as typeof IntersectionObserver;
  const report = (isIntersecting: boolean) =>
    act(() => watched.forEach((callback) => callback([{ isIntersecting }])));
  return {
    comeNear: () => report(true),
    goFar: () => report(false),
    restore: () => {
      globalThis.IntersectionObserver = standIn;
    },
  };
};
