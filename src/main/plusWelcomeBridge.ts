/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { ipcRenderer, type IpcRendererEvent } from 'electron';
import type { TPlusWelcomeState } from './ipc/plusWelcome';

/**
 * The renderer's side of the welcome to Plus: whether to show it, and that it
 * was closed. Its own module, like `plusTermsNoticeBridge`, so `api.ts` gains
 * one line rather than three functions.
 */
export const plusWelcomeBridge = {
  getPlusWelcome: (): Promise<TPlusWelcomeState> =>
    ipcRenderer.invoke('plus-welcome'),
  /** Names the edition the welcome showed, so only that one is recorded. */
  plusWelcomeSeen: (edition: number): Promise<TPlusWelcomeState> =>
    ipcRenderer.invoke('plus-welcome-seen', edition),
  onPlusWelcome: (listener: (welcome: TPlusWelcomeState) => void) => {
    const receive = (_event: IpcRendererEvent, welcome: TPlusWelcomeState) =>
      listener(welcome);
    ipcRenderer.on('plus-welcome-changed', receive);
    return () => {
      ipcRenderer.removeListener('plus-welcome-changed', receive);
    };
  },
};
