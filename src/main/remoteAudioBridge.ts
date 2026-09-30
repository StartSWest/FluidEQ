/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { ipcRenderer, IpcRendererEvent } from 'electron';
import type {
  ILanHostDetails,
  ILanRemoteComputer,
  ILanRemoteAudioChunk,
  ILanRemoteAudioNetworkStats,
  ILanRemoteAudioSignal,
  TLanRestoreResult,
  TLanSavedRole,
  TRemoteAudioStopMode,
  TRemoteAudioStreamMode,
} from '../common/remoteAudio';

/**
 * Sound shared to and from another machine: the playback helper, and the LAN
 * link with its signalling, audio and state.
 */

const startRemoteAudioPlayback = (
  output: string,
  volume: number,
): Promise<number> =>
  ipcRenderer.invoke('remote-audio-playback-open', output, volume);
const remoteAudioPlaybackCommand = (
  session: number,
  action: 'output' | 'volume' | 'remove' | 'close',
  value?: string | number,
): Promise<void> =>
  ipcRenderer.invoke('remote-audio-playback-command', session, action, value);
const onRemoteAudioPlayback = (
  listener: (
    event: import('../common/remoteAudioPlayback').TRemotePlaybackEvent,
  ) => void,
) => {
  const wrapped = (
    _event: IpcRendererEvent,
    value: import('../common/remoteAudioPlayback').TRemotePlaybackEvent,
  ) => listener(value);
  ipcRenderer.on('remote-audio-playback-event', wrapped);
  return () => {
    ipcRenderer.removeListener('remote-audio-playback-event', wrapped);
  };
};

const startRemoteAudioLanHost = (replaceCode = false) =>
  ipcRenderer.invoke(
    'remote-audio-lan-host',
    replaceCode,
  ) as Promise<ILanHostDetails>;

const getSavedRemoteAudioLanRole = () =>
  ipcRenderer.invoke('remote-audio-lan-saved-role') as Promise<
    TLanSavedRole | undefined
  >;

const getSavedRemoteAudioLanSenderCode = () =>
  ipcRenderer.invoke('remote-audio-lan-saved-sender-code') as Promise<
    string | undefined
  >;

const restoreRemoteAudioLan = (streamMode: TRemoteAudioStreamMode = 'music') =>
  ipcRenderer.invoke('remote-audio-lan-restore', streamMode) as Promise<
    TLanRestoreResult | undefined
  >;

const joinRemoteAudioLan = (
  code: string,
  streamMode: TRemoteAudioStreamMode = 'music',
) =>
  ipcRenderer.invoke(
    'remote-audio-lan-join',
    code,
    streamMode,
  ) as Promise<ILanRemoteComputer>;

const sendRemoteAudioLanSignal = (message: ILanRemoteAudioSignal) =>
  ipcRenderer.invoke('remote-audio-lan-send', message) as Promise<void>;

const sendRemoteAudioLanAudio = (chunk: ILanRemoteAudioChunk) =>
  ipcRenderer.send('remote-audio-lan-audio-send', chunk);

const stopRemoteAudioLan = (mode: TRemoteAudioStopMode = 'keep-active') =>
  ipcRenderer.invoke('remote-audio-lan-stop', mode) as Promise<void>;

const onRemoteAudioLanSignal = (
  listener: (message: ILanRemoteAudioSignal) => void,
) => {
  const wrapped = (_event: IpcRendererEvent, message: ILanRemoteAudioSignal) =>
    listener(message);
  ipcRenderer.on('remote-audio-lan-signal', wrapped);
  return () => {
    ipcRenderer.removeListener('remote-audio-lan-signal', wrapped);
  };
};

const onRemoteAudioLanAudio = (
  listener: (chunk: ILanRemoteAudioChunk) => void,
) => {
  const wrapped = (_event: IpcRendererEvent, chunk: ILanRemoteAudioChunk) =>
    listener(chunk);
  ipcRenderer.on('remote-audio-lan-audio', wrapped);
  return () => {
    ipcRenderer.removeListener('remote-audio-lan-audio', wrapped);
  };
};

const onRemoteAudioLanStreaming = (listener: (peerId: string) => void) => {
  const wrapped = (_event: IpcRendererEvent, peerId: string) =>
    listener(peerId);
  ipcRenderer.on('remote-audio-lan-streaming', wrapped);
  return () =>
    ipcRenderer.removeListener('remote-audio-lan-streaming', wrapped);
};

const onRemoteAudioLanNetwork = (
  listener: (stats: ILanRemoteAudioNetworkStats) => void,
) => {
  const wrapped = (
    _event: IpcRendererEvent,
    stats: ILanRemoteAudioNetworkStats,
  ) => listener(stats);
  ipcRenderer.on('remote-audio-lan-network', wrapped);
  return () => {
    ipcRenderer.removeListener('remote-audio-lan-network', wrapped);
  };
};

const onRemoteAudioLanError = (listener: () => void) => {
  const wrapped = () => listener();
  ipcRenderer.on('remote-audio-lan-error', wrapped);
  return () => {
    ipcRenderer.removeListener('remote-audio-lan-error', wrapped);
  };
};

const remoteAudioBridge = {
  startRemoteAudioPlayback,
  remoteAudioPlaybackCommand,
  onRemoteAudioPlayback,
  startRemoteAudioLanHost,
  getSavedRemoteAudioLanRole,
  getSavedRemoteAudioLanSenderCode,
  restoreRemoteAudioLan,
  joinRemoteAudioLan,
  sendRemoteAudioLanSignal,
  sendRemoteAudioLanAudio,
  stopRemoteAudioLan,
  onRemoteAudioLanSignal,
  onRemoteAudioLanAudio,
  onRemoteAudioLanStreaming,
  onRemoteAudioLanNetwork,
  onRemoteAudioLanError,
};

export default remoteAudioBridge;
