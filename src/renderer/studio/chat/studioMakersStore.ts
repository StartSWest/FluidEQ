/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useSyncExternalStore } from 'react';
import type {
  IStudioMakers,
  TStudioMaker,
  TStudioMakerChoice,
} from 'common/studioMakers';

/**
 * The member's own makers of pictures as the window last heard of them from
 * main (`main/studioChat/studioMakers.ts`): a GPT plugin and Higgsfield in
 * their Claude Code, and which of the two they said to use. One copy for the
 * Accounts pane and the card that asks which, so a choice remembered on the
 * card is the one Accounts shows.
 *
 * Apart from the chat's own store: these belong to the member's Claude Code,
 * not to a project's conversation, and are the same whichever scene is open.
 */

interface IMakersState {
  /** Undefined until main has answered once. */
  makers?: IStudioMakers;
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

/** Asks again what the member's Claude Code has of GPT and Higgsfield. */
export const checkStudioMakers = async () => {
  const makers = await bridge()?.studioChatMakers?.();
  if (makers) {
    set({ makers });
  }
};

/** The choice as the member just made it, shown before main has kept it. */
export const showStudioMakerChoice = (choice: TStudioMakerChoice) => {
  if (state.makers) {
    set({ makers: { ...state.makers, choice } });
  }
};

/** Which of the two makes things from now on, or to be asked each time. */
export const setStudioMakerChoice = async (choice: TStudioMakerChoice) => {
  showStudioMakerChoice(choice);
  const kept = await bridge()?.studioChatMakersChoice?.(choice);
  if (kept) {
    showStudioMakerChoice(kept);
  }
};

/** The maker pressed on the card that asks which, kept when told to be. */
export const sendStudioMakerAnswer = (
  id: string,
  maker: TStudioMaker,
  remember: boolean,
) => {
  if (remember) {
    showStudioMakerChoice(maker);
  }
  return (
    bridge()?.studioChatMakerAnswer?.(id, maker, remember) ?? Promise.resolve()
  );
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
    const makers = await bridge()?.studioChatHiggsfieldConnect?.(another);
    if (makers) {
      set({ makers });
    }
  } finally {
    set({ connecting: false });
  }
};

/** For tests: back to a window that has asked nothing. */
export const resetStudioMakersStore = () => {
  state = initialState();
};
