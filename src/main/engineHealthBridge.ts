/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { ipcRenderer, type IpcRendererEvent } from 'electron';
import {
  ENGINE_HEALTH_CHANGED_CHANNEL,
  ENGINE_HEALTH_CHANNEL,
  type IEngineHealth,
} from '../common/engineHealth';

/**
 * The window's side of what the FluidEQ Engine says about each output. Its
 * own module, like `plusTermsNoticeBridge`, so `api.ts` gains one line.
 */
export const engineHealthBridge = {
  /** Read from disk now, never from a cache: see `useEngineTrouble`. */
  getEngineHealth: (): Promise<IEngineHealth> =>
    ipcRenderer.invoke(ENGINE_HEALTH_CHANNEL),
  onEngineHealth: (listener: (health: IEngineHealth) => void) => {
    const receive = (_event: IpcRendererEvent, health: IEngineHealth) =>
      listener(health);
    ipcRenderer.on(ENGINE_HEALTH_CHANGED_CHANNEL, receive);
    return () => {
      ipcRenderer.removeListener(ENGINE_HEALTH_CHANGED_CHANNEL, receive);
    };
  },
};
