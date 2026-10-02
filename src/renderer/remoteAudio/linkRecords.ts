/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type {
  IRemoteDuplex,
  IRemoteNowPlaying,
} from '../../common/remoteAudio';
import type {
  ILinkSwitches,
  IRemoteAudioLink,
  TRemoteAudioPhase,
  TRemoteAudioRole,
} from './remoteAudioState';

/** What the window keeps about one linked computer, by peer id. */
export interface ILinkRecord {
  name: string;
  address?: string;
  joined: boolean;
  theirs?: IRemoteDuplex;
  switches: ILinkSwitches;
  receiving: boolean;
  nowPlaying?: IRemoteNowPlaying;
}

export const ALL_ON: ILinkSwitches = { send: true, play: true };

export const linkViews = (
  records: ReadonlyMap<string, ILinkRecord>,
): IRemoteAudioLink[] =>
  [...records.entries()].map(([id, record]) => ({ id, ...record }));

/**
 * Whether this computer plays a link's sound.
 *
 * Off the switch, or — where a computer cannot play another's sound while it
 * sends its own (`bothWays` false: the capture there hears everything this
 * computer plays) — off for the computer this one joined, which is the one it
 * sends to. That is the link as it ran before both ways.
 */
export const playsHere = (link: ILinkRecord, bothWays: boolean): boolean =>
  link.switches.play && (bothWays || !link.joined);

/** Whether this computer's sound goes to a link, as the window can tell. */
export const sendsThere = (link: ILinkRecord, bothWays: boolean): boolean =>
  link.switches.send &&
  (bothWays || link.joined) &&
  (link.joined ? link.theirs?.plays !== false : link.theirs?.plays === true);

/** The page's one-word state, from who is linked and how. */
export const linkPhase = (
  role: TRemoteAudioRole | undefined,
  records: ReadonlyMap<string, ILinkRecord>,
  playbackBlocked: boolean,
): TRemoteAudioPhase => {
  if (!role) {
    return 'idle';
  }
  if (records.size === 0) {
    return role === 'listener' ? 'waiting' : 'connecting';
  }
  const anyReceiving = [...records.values()].some((link) => link.receiving);
  return playbackBlocked && anyReceiving ? 'playback-blocked' : 'connected';
};
