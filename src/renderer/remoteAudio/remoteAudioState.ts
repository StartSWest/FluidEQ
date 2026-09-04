/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type {
  ILanPairingOption,
  ILanRemoteAudioNetworkStats,
  TRemoteAudioStreamMode,
} from '../../common/remoteAudio';
import type { TRemoteAudioMeterListener } from './meter';

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
  connectedComputers: { address?: string; id: string; name: string }[];
  deviceName?: string;
  error?: TRemoteAudioError;
  lanOptions: ILanPairingOption[];
  networkStats: ILanRemoteAudioNetworkStats[];
  phase: TRemoteAudioPhase;
  role?: TRemoteAudioRole;
  resumeSending(): Promise<void>;
  startListening(replaceCode?: boolean): Promise<void>;
  startSending(code: string): Promise<void>;
  stop(): Promise<void>;
  resumePlayback(): Promise<void>;
  setStreamMode(mode: TRemoteAudioStreamMode): void;
  streamMode: TRemoteAudioStreamMode;
  subscribeMeter(listener: TRemoteAudioMeterListener): () => void;
}
