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
import {
  GROUP_MEDIA_COMMAND,
  GROUP_MEDIA_WATCH,
} from '../common/groupMediaTransport';
import {
  isRemoteTransportCommand,
  type TRemoteTransportCommand,
  type ILanHostDetails,
  type ILanRemoteAudioChunk,
  type ILanRemoteAudioNetworkStats,
  type ILanRemoteAudioSignal,
  type ILanSavedJoin,
  type ILinkSwitches,
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

/** Whether this computer has a Share Audio code from an earlier launch. */
const hasSavedRemoteAudioLan = () =>
  ipcRenderer.invoke('remote-audio-lan-saved') as Promise<boolean>;

/**
 * Listens on this computer's code and goes back to every pasted one.
 * `replay`: this window is new, so every open link is told to it again.
 */
const startRemoteAudioLan = (replay = false) =>
  ipcRenderer.invoke('remote-audio-lan-start', replay) as Promise<{
    details: ILanHostDetails;
    joins: ILanSavedJoin[];
    links: ILanRemoteAudioSignal[];
  }>;

/** Links with the computer whose code this is, beside every other. */
const joinRemoteAudioLan = (code: string) =>
  ipcRenderer.invoke('remote-audio-lan-join', code) as Promise<ILanSavedJoin>;

/** Ends the link with one computer: by its open link, or by its id. */
const unlinkRemoteAudioLan = (target: {
  peerId?: string;
  computerId?: string;
}) => ipcRenderer.invoke('remote-audio-lan-unlink', target) as Promise<void>;

/** Linux: whether the engine's "FluidEQ Send" and "FluidEQ Share In" are
 * there, so a link can run both ways. */
const setRemoteAudioBothWays = (bothWays: boolean) =>
  ipcRenderer.invoke('remote-audio-lan-both-ways', bothWays) as Promise<void>;

/** The network is back: look for every computer still away, now. */
const retryRemoteAudioLan = () =>
  ipcRenderer.invoke('remote-audio-lan-retry') as Promise<void>;

const onRemoteAudioLanResume = (listener: () => void) => {
  const wrapped = () => listener();
  ipcRenderer.on('remote-audio-lan-resume', wrapped);
  return () => ipcRenderer.removeListener('remote-audio-lan-resume', wrapped);
};

const watchGroupMediaKeys = (enabled: boolean): Promise<void> =>
  ipcRenderer.invoke(GROUP_MEDIA_WATCH, enabled);

/** Platform media sessions can feed this same command shape without an
 * injected key; the receiving renderer routes it once across its links. */
const onGroupMediaCommand = (
  listener: (command: TRemoteTransportCommand) => void,
) => {
  const wrapped = (_event: IpcRendererEvent, value: unknown) => {
    if (
      typeof value === 'object' &&
      value !== null &&
      isRemoteTransportCommand(value as Record<string, unknown>)
    ) {
      listener(value as TRemoteTransportCommand);
    }
  };
  ipcRenderer.on(GROUP_MEDIA_COMMAND, wrapped);
  return () => ipcRenderer.removeListener(GROUP_MEDIA_COMMAND, wrapped);
};

/** The codes pasted here, whenever that list changes. */
const onRemoteAudioLanJoins = (listener: (joins: ILanSavedJoin[]) => void) => {
  const wrapped = (_event: IpcRendererEvent, joins: ILanSavedJoin[]) =>
    listener(joins);
  ipcRenderer.on('remote-audio-lan-joins', wrapped);
  return () => {
    ipcRenderer.removeListener('remote-audio-lan-joins', wrapped);
  };
};

const sendRemoteAudioLanSignal = (message: ILanRemoteAudioSignal) =>
  ipcRenderer.invoke('remote-audio-lan-send', message) as Promise<void>;

const sendRemoteAudioLanAudio = (chunk: ILanRemoteAudioChunk) =>
  ipcRenderer.send('remote-audio-lan-audio-send', chunk);

/** "Send my sound", "Play it here" and Pause for the computer called `name`. */
const setRemoteAudioLinkSwitches = (name: string, switches: ILinkSwitches) =>
  ipcRenderer.invoke(
    'remote-audio-lan-switches',
    name,
    switches,
  ) as Promise<void>;

const getRemoteAudioLinkSwitches = (name: string) =>
  ipcRenderer.invoke('remote-audio-lan-switches-for', name) as Promise<
    ILinkSwitches | undefined
  >;

/** Whether this computer's sound is going to another computer. */
const onRemoteAudioLanSending = (listener: (sending: boolean) => void) => {
  const wrapped = (_event: IpcRendererEvent, sending: boolean) =>
    listener(sending === true);
  ipcRenderer.on('remote-audio-lan-sending', wrapped);
  return () => {
    ipcRenderer.removeListener('remote-audio-lan-sending', wrapped);
  };
};

/** This computer's sound could not be captured for the network. */
const onRemoteAudioLanSendingFailed = (listener: () => void) => {
  const wrapped = () => listener();
  ipcRenderer.on('remote-audio-lan-sending-failed', wrapped);
  return () => {
    ipcRenderer.removeListener('remote-audio-lan-sending-failed', wrapped);
  };
};

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
  hasSavedRemoteAudioLan,
  startRemoteAudioLan,
  joinRemoteAudioLan,
  unlinkRemoteAudioLan,
  retryRemoteAudioLan,
  onRemoteAudioLanResume,
  watchGroupMediaKeys,
  onGroupMediaCommand,
  setRemoteAudioBothWays,
  onRemoteAudioLanJoins,
  sendRemoteAudioLanSignal,
  sendRemoteAudioLanAudio,
  setRemoteAudioLinkSwitches,
  getRemoteAudioLinkSwitches,
  onRemoteAudioLanSendingFailed,
  onRemoteAudioLanSending,
  onRemoteAudioLanSignal,
  onRemoteAudioLanAudio,
  onRemoteAudioLanStreaming,
  onRemoteAudioLanNetwork,
  onRemoteAudioLanError,
};

export default remoteAudioBridge;
