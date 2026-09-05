/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type {
  ILanPairingOption,
  ILanRemoteAudioNetworkStats,
  IRemoteNowPlaying,
  TRemoteAudioStreamMode,
} from '../../common/remoteAudio';
import type { TRemoteAudioMeterListener } from './meter';

/** One sending computer, as the listener knows it. */
export interface IRemoteAudioComputer {
  address?: string;
  id: string;
  name: string;
  /** What its bar is showing, as it last told us. Absent until it says. */
  nowPlaying?: IRemoteNowPlaying;
}

export type TRemoteAudioRole = 'listener' | 'sender';
export type TRemoteAudioPhase =
  | 'idle'
  | 'preparing'
  | 'waiting'
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'playback-blocked'
  | 'error';
export type TRemoteAudioError = 'lan' | 'capture' | 'playback' | 'connection';

export interface IRemoteAudioValue {
  connectedCount: number;
  connectedComputers: IRemoteAudioComputer[];
  deviceName?: string;
  error?: TRemoteAudioError;
  lanOptions: ILanPairingOption[];
  networkStats: ILanRemoteAudioNetworkStats[];
  phase: TRemoteAudioPhase;
  role?: TRemoteAudioRole;
  startListening(replaceCode?: boolean): Promise<void>;
  startSending(code: string): Promise<void>;
  stop(): Promise<void>;
  resumePlayback(): Promise<void>;
  setStreamMode(mode: TRemoteAudioStreamMode): void;
  streamMode: TRemoteAudioStreamMode;
  subscribeMeter(listener: TRemoteAudioMeterListener): () => void;
}
