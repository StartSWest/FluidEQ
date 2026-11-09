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
 * The models Claude Code offers, as main read them from it in this run of
 * the app (\`main/studioChat/claudeModels.ts\`): asked once by the first
 * picker shown, and the same answer for every picker after.
 */

let models: IStudioChatModels = NO_STUDIO_CHAT_MODELS;
let asked = false;
const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const ask = () => {
  if (asked) {
    return;
  }
  asked = true;
  window.electron?.ipcRenderer
    ?.studioChatModels?.()
    .then((answer) => {
      models = answer;
      listeners.forEach((listener) => listener());
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

/** For a test: nothing known, and nothing asked yet. */
export const resetStudioChatModelsForTesting = () => {
  models = NO_STUDIO_CHAT_MODELS;
  asked = false;
};
