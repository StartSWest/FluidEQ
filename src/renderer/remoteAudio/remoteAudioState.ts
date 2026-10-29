/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type {
  ILanRemoteAudioNetworkStats,
  ILanSavedJoin,
  ILinkSwitches,
  IRemoteDuplex,
  IRemoteNowPlaying,
} from '../../common/remoteAudio';
import type { TRemoteAudioMeterListener } from './meter';

export type { ILinkSwitches };

/** One computer linked with this one, as the one-player rule knows it. */
export interface IRemoteAudioComputer {
  address?: string;
  id: string;
  name: string;
  /** What its bar is showing, as it last told us. Absent until it says. */
  nowPlaying?: IRemoteNowPlaying;
}

/** One linked computer, as the Share Audio page draws it. */
export interface IRemoteAudioLink extends IRemoteAudioComputer {
  /** This computer pasted its code: it is the one this computer joined. */
  joined: boolean;
  /** Its lasting id; absent for a FluidEQ from before all to all. */
  computerId?: string;
  /** What it said it does with the link; absent until it says. A FluidEQ
   * from before both ways never says, and never sends back. */
  theirs?: IRemoteDuplex;
  switches: ILinkSwitches;
  /** Its sound is arriving here now. */
  receiving: boolean;
}

/**
 * The page's one word for Share Audio. `ready`: this computer's code is on
 * the network, linked to nobody or to anybody — every computer listens and
 * joins at once, so there is no side to wait on.
 */
export type TRemoteAudioPhase =
  'idle' | 'preparing' | 'ready' | 'playback-blocked' | 'error';
export type TRemoteAudioError =
  'lan' | 'capture' | 'playback' | 'connection' | 'code';

export interface IRemoteAudioValue {
  /** Whether this computer can play another's sound while it sends its own;
   * where it cannot, a link runs one way. */
  bothWays: boolean;
  /** Local source gate; per-computer Send choices are preserved under it. */
  sharing: boolean;
  setSharing(sharing: boolean): Promise<void>;
  /** This computer's name on the network. */
  deviceName?: string;
  /** This computer's one code, the same for every computer it links with;
   * absent while it is on no network. */
  code?: string;
  error?: TRemoteAudioError;
  links: IRemoteAudioLink[];
  /** Computers whose code was pasted here that are not linked right now:
   * this one keeps looking for them. */
  looking: ILanSavedJoin[];
  networkStats: ILanRemoteAudioNetworkStats[];
  phase: TRemoteAudioPhase;
  /** This computer's sound is going to at least one computer. */
  sending: boolean;
  /** This computer's sound could not be captured for the network. */
  sendingFailed: boolean;
  start(): Promise<void>;
  /** True once the code is saved and being linked. */
  link(code: string): Promise<boolean>;
  /** Ends one link — by its open connection, or a computer still looked for —
   * and leaves every other alone. */
  unlink(target: { peerId?: string; computerId?: string }): Promise<void>;
  setSwitches(name: string, switches: ILinkSwitches): Promise<void>;
  resumePlayback(): Promise<void>;
  subscribeMeter(listener: TRemoteAudioMeterListener): () => void;
}
