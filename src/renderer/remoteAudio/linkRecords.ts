/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  LINK_SWITCHES_ON,
  linkSwitchesInEffect,
  type IRemoteDuplex,
  type IRemoteNowPlaying,
} from '../../common/remoteAudio';
import type {
  ILinkSwitches,
  IRemoteAudioLink,
  TRemoteAudioPhase,
} from './remoteAudioState';

/** What the window keeps about one linked computer, by peer id. */
export interface ILinkRecord {
  name: string;
  address?: string;
  joined: boolean;
  computerId?: string;
  theirs?: IRemoteDuplex;
  switches: ILinkSwitches;
  receiving: boolean;
  nowPlaying?: IRemoteNowPlaying;
}

export const ALL_ON: ILinkSwitches = LINK_SWITCHES_ON;

/**
 * Paused on either computer: nothing goes either way, and neither one acts
 * on the other's players or its one-player switch until it resumes.
 */
export const linkPaused = (link: ILinkRecord): boolean =>
  link.switches.paused || link.theirs?.paused === true;

/** A saved switch is a preference, not proof that its direction is available.
 * Reflect the peer's source gate and our own source gate without overwriting
 * those preferences, so sharing back on restores the mix and switches. */
export const linkControls = (
  link: ILinkRecord,
  bothWays: boolean,
  sharing: boolean,
) => ({
  receive:
    !linkPaused(link) &&
    (bothWays || !link.joined) &&
    link.theirs?.sends !== false,
  send: !linkPaused(link) && (bothWays || link.joined) && sharing,
});

/**
 * The user's new switches on every link to the computer called `name`. One
 * that no longer plays here is no longer receiving, whatever was arriving.
 */
export const applySwitches = (
  records: Iterable<ILinkRecord>,
  name: string,
  switches: ILinkSwitches,
): void => {
  [...records].forEach((record) => {
    if (
      (record.computerId ? `id:${record.computerId}` : record.name) === name
    ) {
      record.switches = switches;
      if (!linkSwitchesInEffect(switches).play) {
        record.receiving = false;
      }
    }
  });
};

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
  linkSwitchesInEffect(link.switches).play && (bothWays || !link.joined);

/**
 * Whether a link's sound actually reaches this computer: played here, and
 * sent by the other one. Its Share off, its Pause and its Send switched off
 * for this computer all arrive as `sends: false`. An older FluidEQ this one
 * joined never says anything and never sends back.
 *
 * What the bar shows and what the one-player rule pauses follow this, not the
 * Receive switch alone: a computer that stopped sharing kept its song on this
 * computer's bar, and kept being paused by this computer's players, while
 * none of its sound came here (Ivan, 2026-10-26).
 */
export const heardHere = (link: ILinkRecord, bothWays: boolean): boolean =>
  playsHere(link, bothWays) &&
  link.theirs?.sends !== false &&
  !(link.joined && link.theirs === undefined);

/** Whether this computer's sound goes to a link, as the window can tell. */
export const sendsThere = (link: ILinkRecord, bothWays: boolean): boolean =>
  linkSwitchesInEffect(link.switches).send &&
  (bothWays || link.joined) &&
  (link.joined ? link.theirs?.plays !== false : link.theirs?.plays === true);

/** The page's one-word state once the code is on the network. */
export const linkPhase = (
  records: ReadonlyMap<string, ILinkRecord>,
  playbackBlocked: boolean,
): TRemoteAudioPhase => {
  const anyReceiving = [...records.values()].some((link) => link.receiving);
  return playbackBlocked && anyReceiving ? 'playback-blocked' : 'ready';
};
