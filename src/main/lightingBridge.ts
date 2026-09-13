/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { ipcRenderer, type IpcRendererEvent } from 'electron';
import {
  LIGHTING_FRAME_CHANNEL,
  LIGHTING_OPEN_RAZER_CHROMA_CHANNEL,
  LIGHTING_OPEN_WINDOWS_SETTINGS_CHANNEL,
  LIGHTING_RELEASE_CHANNEL,
  LIGHTING_SETTINGS_CHANNEL,
  LIGHTING_STATE_CHANGED_CHANNEL,
  LIGHTING_STATE_CHANNEL,
  LIGHTING_WATCH_CHANNEL,
  type ILightingFrame,
  type ILightingSettings,
  type ILightingState,
} from '../common/lighting/lightingModel';

/**
 * The window's side of dynamic lighting. Its own module, like
 * `engineHealthBridge`, so `api.ts` gains one line.
 */
export const lightingBridge = {
  lightingState: (): Promise<ILightingState> =>
    ipcRenderer.invoke(LIGHTING_STATE_CHANNEL),
  setLightingSettings: (
    settings: Partial<ILightingSettings>,
  ): Promise<ILightingState> =>
    ipcRenderer.invoke(LIGHTING_SETTINGS_CHANNEL, settings),
  onLightingState: (listener: (state: ILightingState) => void) => {
    const receive = (_event: IpcRendererEvent, state: ILightingState) =>
      listener(state);
    ipcRenderer.on(LIGHTING_STATE_CHANGED_CHANNEL, receive);
    return () => {
      ipcRenderer.removeListener(LIGHTING_STATE_CHANGED_CHANNEL, receive);
    };
  },
  /** Fire-and-forget, thirty times a second while a Plus scene plays. */
  sendLightingFrame: (frame: ILightingFrame) =>
    ipcRenderer.send(LIGHTING_FRAME_CHANNEL, frame),
  releaseLighting: () => ipcRenderer.send(LIGHTING_RELEASE_CHANNEL),
  watchLighting: (open: boolean) =>
    ipcRenderer.send(LIGHTING_WATCH_CHANNEL, open),
  /** `developers` opens Windows' developer page instead of Dynamic Lighting. */
  openWindowsLightingSettings: (
    page: 'lighting' | 'developers' = 'lighting',
  ): Promise<void> =>
    ipcRenderer.invoke(LIGHTING_OPEN_WINDOWS_SETTINGS_CHANNEL, page),
  openRazerChroma: (): Promise<boolean> =>
    ipcRenderer.invoke(LIGHTING_OPEN_RAZER_CHROMA_CHANNEL),
};
