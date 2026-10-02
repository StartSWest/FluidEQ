/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type {
  ILanPairingOption,
  ILanRemoteAudioNetworkStats,
  IRemoteDuplex,
  IRemoteNowPlaying,
} from '../../common/remoteAudio';
import type { TRemoteAudioMeterListener } from './meter';

/** One computer linked with this one, as the one-player rule knows it. */
export interface IRemoteAudioComputer {
  address?: string;
  id: string;
  name: string;
  /** What its bar is showing, as it last told us. Absent until it says. */
  nowPlaying?: IRemoteNowPlaying;
}

/** "Send my sound" and "Play it here", for one linked computer. */
export interface ILinkSwitches {
  send: boolean;
  play: boolean;
}

/** One linked computer, as the Share Audio page draws it. */
export interface IRemoteAudioLink extends IRemoteAudioComputer {
  /** This computer pasted its code: it is the one this computer joined. */
  joined: boolean;
  /** What it said it does with the link; absent until it says. A FluidEQ
   * from before both ways never says, and never sends back. */
  theirs?: IRemoteDuplex;
  switches: ILinkSwitches;
  /** Its sound is arriving here now. */
  receiving: boolean;
}

/**
 * `listener` and `sender` survive as the two ways into a link, not as what a
 * computer does on it: `listener` shows this computer's code and waits,
 * `sender` pasted another's. Either way, once linked, both directions run.
 */
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
  /** Whether this computer can play another's sound while it sends its own
   * (Windows); elsewhere a link runs one way. */
  bothWays: boolean;
  /** This computer's name while its code is shown; the other's once joined. */
  deviceName?: string;
  error?: TRemoteAudioError;
  lanOptions: ILanPairingOption[];
  links: IRemoteAudioLink[];
  networkStats: ILanRemoteAudioNetworkStats[];
  phase: TRemoteAudioPhase;
  role?: TRemoteAudioRole;
  /** This computer's sound is going to at least one computer. */
  sending: boolean;
  /** This computer's sound could not be captured for the network. */
  sendingFailed: boolean;
  showCode(replaceCode?: boolean): Promise<void>;
  link(code: string): Promise<void>;
  unlink(): Promise<void>;
  setSwitches(name: string, switches: ILinkSwitches): Promise<void>;
  resumePlayback(): Promise<void>;
  subscribeMeter(listener: TRemoteAudioMeterListener): () => void;
}
