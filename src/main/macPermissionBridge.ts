/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { ipcRenderer } from 'electron';
import type { TMacAudioPermission } from '../common/macAudioPermission';

/**
 * The renderer's side of the Mac's sound permission: what macOS says, and
 * the System Settings page that changes it (`macPermissionIpc.ts`).
 */
export const macPermissionBridge = {
  getMacAudioPermission: (): Promise<TMacAudioPermission> =>
    ipcRenderer.invoke('mac-audio-permission'),
  getMacScreenPermission: (): Promise<TMacAudioPermission> =>
    ipcRenderer.invoke('mac-screen-permission'),
  openMacAudioPrivacy: (): Promise<void> =>
    ipcRenderer.invoke('open-mac-audio-privacy'),
};
