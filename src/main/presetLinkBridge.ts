/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { ipcRenderer } from 'electron';
import {
  PRESET_LINK_ARRIVED,
  PRESET_LINK_TAKE,
} from '../common/presetLinkChannels';
import {
  FETCH_SHARED_PRESET,
  SHARE_PRESET_LINK,
  isSharedPresetId,
  type TSharePresetLinkOutcome,
  type TSharedPresetFetchOutcome,
} from '../common/presetShare/sharedPresetLink';

// A shared preset opened from fluideq.com (`presetLinks.ts`): the window asks
// for the id waiting when it starts, and again whenever main says one came.
// Short links themselves (`ipc/sharedPresetLinks.ts`): made for one of the
// listener's presets, and the preset a link names fetched by main.
export const presetLinkBridge = {
  takePresetLink: async (): Promise<string | undefined> => {
    const id: unknown = await ipcRenderer.invoke(PRESET_LINK_TAKE);
    return isSharedPresetId(id) ? id : undefined;
  },
  onPresetLink: (listener: () => void) => {
    const handler = () => listener();
    ipcRenderer.on(PRESET_LINK_ARRIVED, handler);
    return () => {
      ipcRenderer.removeListener(PRESET_LINK_ARRIVED, handler);
    };
  },
  sharePresetLink: (
    name: string,
    code: string,
  ): Promise<TSharePresetLinkOutcome> =>
    ipcRenderer.invoke(SHARE_PRESET_LINK, name, code),
  fetchSharedPreset: (id: string): Promise<TSharedPresetFetchOutcome> =>
    ipcRenderer.invoke(FETCH_SHARED_PRESET, id),
};
