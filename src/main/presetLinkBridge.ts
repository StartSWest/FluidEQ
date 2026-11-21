/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { ipcRenderer } from 'electron';
import {
  PRESET_LINK_ARRIVED,
  PRESET_LINK_TAKE,
} from '../common/presetLinkChannels';

// A shared preset opened from fluideq.com (`presetLinks.ts`): the window asks
// for the one waiting when it starts, and again whenever main says one came.
export const presetLinkBridge = {
  takePresetLink: async (): Promise<string | undefined> => {
    const code: unknown = await ipcRenderer.invoke(PRESET_LINK_TAKE);
    return typeof code === 'string' ? code : undefined;
  },
  onPresetLink: (listener: () => void) => {
    const handler = () => listener();
    ipcRenderer.on(PRESET_LINK_ARRIVED, handler);
    return () => {
      ipcRenderer.removeListener(PRESET_LINK_ARRIVED, handler);
    };
  },
};
