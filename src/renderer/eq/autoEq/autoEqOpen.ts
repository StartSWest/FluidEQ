/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useRef } from 'react';
import { setEqLayerTab } from '../eqLayerTab';

/** Asks the window for the EQ page (`App.tsx` listens), as the Gaming Lab
 * is asked for (`gamingLabEvents.ts`). */
export const OPEN_AUTO_EQ_EVENT = 'fluideq-open-auto-eq';

/**
 * Asking Auto EQ's panel to open from somewhere else — the Output panel's
 * one-time note about the old "Remember each song's sound" switch.
 *
 * The EQ page may not be mounted when the ask is made (the note opens it):
 * the ask is held until the button that answers it arrives, and answered
 * once.
 */
const listeners = new Set<() => void>();
let isAsked = false;

export const requestAutoEqOpen = (): void => {
  // The page, and on it the tab whose tools hold Auto EQ's button.
  window.dispatchEvent(new CustomEvent(OPEN_AUTO_EQ_EVENT));
  setEqLayerTab('bands');
  if (listeners.size === 0) {
    isAsked = true;
    return;
  }
  listeners.forEach((listener) => listener());
};

/** The button's side: `open` runs for an ask made now or before it mounted. */
export const useAutoEqOpenRequest = (open: () => void): void => {
  const latest = useRef(open);
  useEffect(() => {
    latest.current = open;
  });
  useEffect(() => {
    const listener = () => latest.current();
    listeners.add(listener);
    if (isAsked) {
      isAsked = false;
      listener();
    }
    return () => {
      listeners.delete(listener);
    };
  }, []);
};
