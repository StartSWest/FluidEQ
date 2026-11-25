/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useSyncExternalStore } from 'react';
import type { THiggsfieldAccount } from 'common/studioMakers';

/**
 * Higgsfield as the window last heard of it from main
 * (`main/studioChat/higgsfieldWatch.ts`): there in the member's own Claude
 * Code, signed in, or not. The Studio's one maker of pictures, videos and 3D
 * models (Ivan, 2026-11-11: "let's only use Higgsfield").
 *
 * Apart from the chat's own store: it belongs to the member's Claude Code,
 * not to a project's conversation, and is the same whichever scene is open.
 */

interface IMakersState {
  /**
   * The last answer: main's kept one the moment a check starts, then the
   * check's own. Undefined only on a computer that has never been checked.
   */
  higgsfield?: THiggsfieldAccount;
  /** A check is running: what is shown may be about to change. */
  checking: boolean;
  /** Higgsfield is being added, or its sign-in is open. */
  connecting: boolean;
}

const initialState = (): IMakersState => ({
  checking: false,
  connecting: false,
});

let state: IMakersState = initialState();
/** The checks this window has running, which `checking` says are any. */
let checks = 0;
const listeners = new Set<() => void>();
let unlisten: (() => void) | undefined;

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

/**
 * Hears main for the window's life: a chat's own report of its servers
 * changes Higgsfield the moment a turn starts, with nothing to ask.
 */
export const watchStudioMakers = () => {
  if (!unlisten) {
    unlisten = bridge()?.onStudioChatMakers?.((higgsfield) =>
      set({ higgsfield }),
    );
  }
};

/**
 * The last answer main kept - across runs of the app - where the window has
 * none yet. Nothing is asked of Claude Code.
 */
export const knowStudioMakers = async () => {
  if (state.higgsfield !== undefined) {
    return;
  }
  const known = await bridge()?.studioChatMakersKnown?.();
  // An answer that came meanwhile is newer than what was kept.
  if (known && state.higgsfield === undefined) {
    set({ higgsfield: known });
  }
};

/**
 * Asks again what the member's Claude Code has of Higgsfield. The card
 * shows the last answer kept in main at once and says it is being checked,
 * until the check answers.
 */
export const checkStudioMakers = async () => {
  checks += 1;
  set({ checking: true });
  try {
    await knowStudioMakers();
    const higgsfield = await bridge()?.studioChatMakers?.();
    if (higgsfield) {
      set({ higgsfield });
    }
  } finally {
    checks -= 1;
    set({ checking: checks > 0 });
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

/** For tests: back to a window that has asked nothing and hears nothing. */
export const resetStudioMakersStore = () => {
  unlisten?.();
  unlisten = undefined;
  checks = 0;
  state = initialState();
};
