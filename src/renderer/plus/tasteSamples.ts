/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useSyncExternalStore } from 'react';
import { GALLERY_REFRESH_AFTER_MS } from './galleryStore';

/**
 * The official scenes an account without Plus can taste live, so a card can
 * say so before it is opened. Every other scene's page shows its picture and
 * the way to Plus: the server hands a live taste only to these (server
 * migration 0023), because the whole scene reaches the machine that plays it.
 *
 * Asked when a card first needs it, and again when it is needed after the
 * gallery's own refresh interval; one request at a time.
 */

const NONE: ReadonlySet<string> = new Set();

let samples: ReadonlySet<string> = NONE;
let fetchedAt: number | undefined;
let inFlight: Promise<void> | undefined;
const listeners = new Set<() => void>();

const load = (now: number) => {
  if (
    inFlight ||
    (fetchedAt !== undefined && now - fetchedAt < GALLERY_REFRESH_AFTER_MS)
  ) {
    return;
  }
  const ask = window.electron?.ipcRenderer?.listGalleryTasteSamples;
  if (!ask) {
    return;
  }
  inFlight = ask()
    .then((ids) => {
      samples = new Set(ids);
      fetchedAt = Date.now();
      listeners.forEach((listener) => listener());
      return undefined;
    })
    .catch(() => undefined)
    .finally(() => {
      inFlight = undefined;
    });
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  load(Date.now());
  return () => {
    listeners.delete(listener);
  };
};

const snapshot = () => samples;

export const useTasteSamples = (): ReadonlySet<string> =>
  useSyncExternalStore(subscribe, snapshot, snapshot);

/** For a test that wants a clean module between runs. */
export const resetTasteSamples = () => {
  samples = NONE;
  fetchedAt = undefined;
  inFlight = undefined;
  listeners.clear();
};
