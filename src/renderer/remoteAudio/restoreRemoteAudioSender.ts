/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { TRemoteAudioStreamMode } from '../../common/remoteAudio';

interface IRestoreSenderCallbacks {
  isActive(): boolean;
  onConnected(deviceName: string): void;
  onDisconnected(): void;
  onFailure(): void;
  streamMode: TRemoteAudioStreamMode;
}

const restoreRemoteAudioSender = async ({
  isActive,
  onConnected,
  onDisconnected,
  onFailure,
  streamMode,
}: IRestoreSenderCallbacks) => {
  try {
    const restored =
      await window.electron.ipcRenderer.restoreRemoteAudioLan(streamMode);
    if (!isActive()) {
      return;
    }
    if (!restored || restored.role !== 'sender') {
      onDisconnected();
      return;
    }
    onConnected(restored.listener.deviceName);
  } catch {
    if (isActive()) {
      onFailure();
    }
  }
};

export default restoreRemoteAudioSender;
