/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { ipcRenderer, type IpcRendererEvent } from 'electron';
import type { IScenePack } from '../common/scenePacks';
import {
  LIGHTING_PREVIEW_CHANNEL,
  LIGHTING_SCENE_CHANNEL,
  type ILampPreview,
  type ILampSceneChoice,
} from '../common/lighting/lampSceneChoice';
import {
  LIGHTING_DEMO_FRAME_CHANNEL,
  LIGHTING_DEMO_SCENE_CHANNEL,
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
  /** What the desk lights play, whenever the window's part of it moves. */
  chooseLampScene: (choice: ILampSceneChoice) =>
    ipcRenderer.send(LIGHTING_SCENE_CHANNEL, choice),
  /** Each frame the lamps showed, while the Lighting page is open. */
  onLampPreview: (listener: (preview: ILampPreview) => void) => {
    const receive = (_event: IpcRendererEvent, preview: ILampPreview) =>
      listener(preview);
    ipcRenderer.on(LIGHTING_PREVIEW_CHANNEL, receive);
    return () => {
      ipcRenderer.removeListener(LIGHTING_PREVIEW_CHANNEL, receive);
    };
  },
  /** The demo's lamps given back, as its page closes. */
  releaseLighting: () => ipcRenderer.send(LIGHTING_RELEASE_CHANNEL),
  /**
   * Without Plus: a frame of the page's one scene, fire-and-forget. Main
   * lights the devices with it in turns, or not at all.
   */
  sendLightingDemoFrame: (frame: ILightingFrame) =>
    ipcRenderer.send(LIGHTING_DEMO_FRAME_CHANNEL, frame),
  /** The scene that page plays: the Studio's starter, shipped in the app. */
  lightingDemoScene: (): Promise<IScenePack | null> =>
    ipcRenderer.invoke(LIGHTING_DEMO_SCENE_CHANNEL),
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
