/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

interface IRestoreSenderCallbacks {
  isActive(): boolean;
  onConnected(deviceName: string): void;
  onDisconnected(): void;
  onFailure(): void;
}

const restoreRemoteAudioSender = async ({
  isActive,
  onConnected,
  onDisconnected,
  onFailure,
}: IRestoreSenderCallbacks) => {
  try {
    const restored = await window.electron.ipcRenderer.restoreRemoteAudioLan();
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
