/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useSyncExternalStore } from 'react';
import type { THiggsfieldAccount } from 'common/studioMakers';

/**
 * Higgsfield as the window last heard of it from main
 * (`main/studioChat/studioMakers.ts`): there in the member's own Claude
 * Code, signed in, or not. The Studio's one maker of pictures, videos and 3D
 * models (Ivan, 2026-11-11: "let's only use Higgsfield").
 *
 * Apart from the chat's own store: it belongs to the member's Claude Code,
 * not to a project's conversation, and is the same whichever scene is open.
 */

interface IMakersState {
  /** Undefined until main has answered once. */
  higgsfield?: THiggsfieldAccount;
  /** Higgsfield is being added, or its sign-in is open. */
  connecting: boolean;
}

const initialState = (): IMakersState => ({ connecting: false });

let state: IMakersState = initialState();
const listeners = new Set<() => void>();

const bridge = () => window.electron?.ipcRenderer;

const set = (next: Partial<IMakersState>) => {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const useStudioMakers = (): IMakersState =>
  useSyncExternalStore(subscribe, () => state);

/** Asks again what the member's Claude Code has of Higgsfield. */
export const checkStudioMakers = async () => {
  const higgsfield = await bridge()?.studioChatMakers?.();
  if (higgsfield) {
    set({ higgsfield });
  }
};

/**
 * Higgsfield added to the member's Claude Code and signed in to, on their
 * press; `another` signs the present account out first. One at a time: a
 * second press while the sign-in is open does nothing.
 */
export const connectHiggsfield = async (another = false) => {
  if (state.connecting) {
    return;
  }
  set({ connecting: true });
  try {
    const higgsfield = await bridge()?.studioChatHiggsfieldConnect?.(another);
    if (higgsfield) {
      set({ higgsfield });
    }
  } finally {
    set({ connecting: false });
  }
};

/** For tests: back to a window that has asked nothing. */
export const resetStudioMakersStore = () => {
  state = initialState();
};
