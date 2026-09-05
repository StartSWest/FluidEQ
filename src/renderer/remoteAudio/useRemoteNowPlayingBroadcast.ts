/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The sender's half of "what is playing over there".
 *
 * The listener plays sound it did not start, so its bar said "Nothing
 * playing" through a whole album. This tells it what the sender's own bar is
 * showing — the same description `pickTransportOwner` hands the bar here,
 * whether that is a library track, a karaoke session, a Media page or a
 * browser tab Windows reported — and carries the listener's play/pause press
 * back to the same source.
 *
 * ONE MESSAGE A SECOND AT MOST, and none while nothing changes. Position is
 * republished several times a second by every player; a control message per
 * tick would be noise beside the PCM stream, and a paused song has nothing
 * new to say. The message goes out when the title, the line under it, the
 * play state, the length or the whole second of position moves, and again
 * when a listener (re)connects, because a listener that joined mid-song has
 * not heard the description yet.
 */

import { useEffect, useRef } from 'react';
import type {
  IRemoteNowPlaying,
  TRemoteTransportCommand,
} from '../../common/remoteAudio';
import { usePlaybackOwner } from '../audio/playbackOwner';
import pickTransportOwner from '../audio/transportRouting';
import {
  useLastTransportOwner,
  useTransportSources,
} from '../audio/transportSource';
import type { ITransportSource } from '../audio/transportSource';
import type { TRemoteAudioPhase, TRemoteAudioRole } from './remoteAudioState';

/** A player's clock, made safe for the wire: whole, finite, not negative. */
const wireMs = (value: number): number =>
  Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;

/** The sender's bar description, reduced to what another machine can draw. */
export const describeForRemote = (
  source: ITransportSource | undefined,
): IRemoteNowPlaying | undefined => {
  if (!source || !source.title.trim()) {
    return undefined;
  }
  return {
    title: source.title.slice(0, 256),
    subtitle: source.subtitle?.slice(0, 256) || undefined,
    artist: source.identity?.artist?.slice(0, 256),
    isPlaying: source.isPlaying,
    positionMs: wireMs(source.positionMs),
    durationMs: wireMs(source.durationMs),
  };
};

/** Everything a message would say, so two that say the same are one. */
const wireKey = (playing: IRemoteNowPlaying | undefined): string =>
  playing
    ? JSON.stringify([
        playing.title,
        playing.subtitle,
        playing.artist,
        playing.isPlaying,
        playing.durationMs,
        Math.floor(playing.positionMs / 1000),
      ])
    : '';

const useRemoteNowPlayingBroadcast = (
  role: TRemoteAudioRole | undefined,
  phase: TRemoteAudioPhase,
  senderPeerIdRef: { current: string | undefined },
): ((command: TRemoteTransportCommand) => void) => {
  const sources = useTransportSources();
  const playingOwner = usePlaybackOwner();
  const lastOwner = useLastTransportOwner();
  // No tab: the sender's bar on a page that is not a player, which is the
  // one that falls through to whatever is actually making the sound.
  const owner = pickTransportOwner(undefined, sources, playingOwner, lastOwner);
  const source = owner === undefined ? undefined : sources[owner];
  const sourceRef = useRef(source);
  sourceRef.current = source;

  const playing = describeForRemote(source);
  const key = wireKey(playing);
  const playingRef = useRef(playing);
  playingRef.current = playing;

  const connected =
    role === 'sender' && (phase === 'connecting' || phase === 'connected');
  useEffect(() => {
    const peerId = senderPeerIdRef.current;
    if (!connected || !peerId) {
      return;
    }
    window.electron.ipcRenderer
      .sendRemoteAudioLanSignal({
        peerId,
        signal: { kind: 'now-playing', playing: playingRef.current },
      })
      .catch(() => undefined);
    // `key` is the message; `connected` is the listener arriving. Both are
    // reasons to send, and nothing else is.
  }, [connected, key, senderPeerIdRef]);

  const performRef = useRef<(command: TRemoteTransportCommand) => void>(
    () => undefined,
  );
  performRef.current = (command) => {
    if (command === 'toggle') {
      sourceRef.current?.toggle();
    }
  };
  // Stable, so the signal handler that calls it need not re-subscribe.
  const performTransportRef = useRef((command: TRemoteTransportCommand) =>
    performRef.current(command),
  );
  return performTransportRef.current;
};

export default useRemoteNowPlayingBroadcast;
