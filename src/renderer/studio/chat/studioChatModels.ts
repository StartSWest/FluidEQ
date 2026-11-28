/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useSyncExternalStore } from 'react';
import {
  NO_STUDIO_CHAT_MODELS,
  type IStudioChatModels,
} from 'common/studioChat';

/**
 * The models Claude Code offers, as main read them from it
 * (`main/studioChat/claudeModels.ts`): asked by the first picker shown,
 * the same answer for every picker after, and replaced whenever main hears
 * Claude Code's list change - an update, a new catalog, another account -
 * with no restart. Asked again when Claude Code refused a model
 * (`refreshStudioChatModels`).
 */

let models: IStudioChatModels = NO_STUDIO_CHAT_MODELS;
let asked = false;
let listening = false;
const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const take = (answer: IStudioChatModels) => {
  models = answer;
  listeners.forEach((listener) => listener());
};

const ask = () => {
  // Every change main hears from now on, for as long as the window lives.
  if (!listening) {
    listening = true;
    window.electron?.ipcRenderer?.onStudioChatModels?.(take);
  }
  if (asked) {
    return;
  }
  asked = true;
  window.electron?.ipcRenderer
    ?.studioChatModels?.()
    .then((answer) => {
      take(answer);
      return undefined;
    })
    .catch(() => {
      // Main keeps the last list it had and answers with it; a call that
      // fails outright leaves the lines under their bare names.
      asked = false;
    });
};

export const useStudioChatModels = (): IStudioChatModels => {
  useEffect(ask, []);
  return useSyncExternalStore(subscribe, () => models);
};

/**
 * Ask main again, for what Claude Code refused since the list was first
 * asked: main keeps its answer and adds the refusals to it, so Claude Code
 * itself is not asked again.
 */
export const refreshStudioChatModels = () => {
  asked = false;
  ask();
};

/** For a test: nothing known, and nothing asked or listened to yet. */
export const resetStudioChatModelsForTesting = () => {
  models = NO_STUDIO_CHAT_MODELS;
  asked = false;
  listening = false;
};
