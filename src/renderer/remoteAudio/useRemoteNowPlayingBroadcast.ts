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
 *
 * AND ONE OF THOSE MESSAGES SAYS SOMEBODY PRESSED PLAY HERE. That is the only
 * thing the listener's one-player rule acts on, and it is raised here because
 * this is the only end that can tell a press from a description: see
 * `startedHere`.
 */

import { useEffect, useRef } from 'react';
import type {
  IRemoteNowPlaying,
  TRemoteTransportCommand,
} from '../../common/remoteAudio';
import { stopAllPlayback, usePlaybackOwner } from '../audio/playbackOwner';
import type { TPlaybackOwner } from '../audio/playbackOwner';
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
    canNext: source.next !== undefined,
    canPrevious: source.previous !== undefined,
    // The same two questions `SourceTransportBar` asks: a step needs either a
    // relative nudge or a seekable, measured source.
    canStep:
      source.nudge !== undefined ||
      (source.seek !== undefined && source.durationMs > 0),
    canStop: source.stop !== undefined,
  };
};

/**
 * What the sender describes to the listener: its own bar, and then the
 * machine's own player even when paused.
 *
 * The bar here drops a paused browser tab — "worth nothing once it stops",
 * see `setTransportSource` — because on this machine the tab somebody paused
 * an hour ago is not what the bar is for. On the listener it is the opposite:
 * the paused thing is exactly what the press on its bar will resume, and
 * describing nothing took the bar away with the pause. So the sender falls
 * through to the machine's player, paused or not, before saying it has
 * nothing. Stop is different: a stopped session leaves Windows' list and the
 * description honestly ends.
 */
export const pickSourceForRemote = (
  sources: Partial<Record<TPlaybackOwner, ITransportSource>>,
  playingOwner: TPlaybackOwner | undefined,
  lastOwner: TPlaybackOwner | undefined,
): ITransportSource | undefined => {
  // No tab: the sender's bar on a page that is not a player, which is the
  // one that falls through to whatever is actually making the sound.
  const owner = pickTransportOwner(undefined, sources, playingOwner, lastOwner);
  return owner === undefined ? sources.system : sources[owner];
};

/**
 * Whether this description is somebody pressing play ON THIS MACHINE.
 *
 * The listener stops its own music for this, so it has to mean a press and
 * nothing else. Three things that are not a press all look identical in a
 * description that says "playing", and each of them silenced a listener that
 * was happily playing its own album:
 *
 * - THE BAR CHANGING WHAT IT POINTS AT. The listener pauses this machine's
 *   library, the bar falls through to the browser tab that was already
 *   playing here, and the description goes from paused to playing with nobody
 *   near the keyboard. That is the pause coming back as a start, which is the
 *   loop: the listener stops its own player for it and pauses this one again.
 * - A RECONNECTION. The link drops, the peer is new, and the sender
 *   re-announces the song it has been playing all along.
 * - WINDOWS' POLLED SESSION LIST FLAPPING, which republishes a player's state
 *   without the player having done anything.
 *
 * So the question is asked of the PLAYER, not of the bar: this player was not
 * playing a moment ago and is playing now. `seen` carries what each of this
 * machine's players was last doing, and it is what separates the three above
 * from a press — each of them describes a player this machine already knew
 * was playing.
 *
 * ANYTHING ELSE THAT STARTS IS A PRESS, including a player this end is seeing
 * for the first time: a program launched straight into playing publishes its
 * Windows session already playing, and somebody plainly pressed play on it.
 * One player at a time is the whole point of the rule and it does not get
 * holes cut in it to make a loop impossible — the loop is stopped by the
 * clause above, which no starting player can trip.
 *
 * `seen` keeps a player that goes away, which is the other half of that: a
 * Windows session that disappears and comes back playing — the list is
 * polled, and it flaps — is remembered as the one that was already playing.
 */
export const startedHere = (
  seen: ReadonlyMap<TPlaybackOwner, boolean>,
  source: ITransportSource | undefined,
): boolean =>
  source !== undefined && source.isPlaying && seen.get(source.owner) !== true;

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
        playing.canNext,
        playing.canPrevious,
        playing.canStep,
        playing.canStop,
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
  const source = pickSourceForRemote(sources, playingOwner, lastOwner);
  const sourceRef = useRef(source);
  sourceRef.current = source;

  const playing = describeForRemote(source);
  const key = wireKey(playing);
  const playingRef = useRef(playing);
  playingRef.current = playing;

  /**
   * What each of this machine's players was last seen doing.
   *
   * Every player, not only the one on the bar: the fall-through that made the
   * loop is the bar moving to a player it was not describing, and the answer
   * to "was that one already playing?" has to have been recorded while
   * something else held the bar.
   */
  const seenRef = useRef(new Map<TPlaybackOwner, boolean>());
  const startedRef = useRef(false);
  startedRef.current = startedHere(seenRef.current, source);

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
        signal: {
          kind: 'now-playing',
          playing: playingRef.current,
          // Absent unless it is true: a listener two versions older reads a
          // message it does not understand the same way it always has, and a
          // message that says nothing about a press is the safe one.
          ...(startedRef.current ? { started: true } : {}),
        },
      })
      .catch(() => undefined);
    // `key` is the message; `connected` is the listener arriving. Both are
    // reasons to send, and nothing else is. A reconnection therefore
    // re-announces the description and never the press — `startedHere` has
    // seen this player playing since, so it answers no.
  }, [connected, key, senderPeerIdRef]);

  // After the send, and on every render rather than on a change: a player
  // that starts while another holds the bar sends no message, and it is
  // exactly that player's state the next press test is asked about.
  useEffect(() => {
    const seen = seenRef.current;
    (Object.keys(sources) as TPlaybackOwner[]).forEach((owner) => {
      const entry = sources[owner];
      if (entry) {
        seen.set(owner, entry.isPlaying);
      }
    });
  });

  const performRef = useRef<(command: TRemoteTransportCommand) => void>(
    () => undefined,
  );
  performRef.current = (command) => {
    const { current } = sourceRef;
    if (!current) {
      return;
    }
    if (command.command === 'toggle') {
      current.toggle();
      return;
    }
    if (command.command === 'stop') {
      current.stop?.();
      return;
    }
    if (command.command === 'next') {
      current.next?.();
      return;
    }
    if (command.command === 'previous') {
      current.previous?.();
      return;
    }
    if (command.command === 'nudge') {
      // The source's own step first, for the reason the bar prefers it: where
      // there is one, it is because this end cannot be trusted to know the
      // position — see `ITransportSource.nudge`.
      if (current.nudge) {
        current.nudge(command.deltaMs);
        return;
      }
      current.seek?.(
        Math.min(
          current.durationMs,
          Math.max(0, current.positionMs + command.deltaMs),
        ),
      );
      return;
    }
    // The listener started something of its own and its one-player rule says
    // this must stop. Never a toggle: whatever is described here may already
    // be paused, and a toggle would start it. The machine's own programs are
    // asked to pause — all of them, because the listener wants this machine
    // quiet and the bar names only the one Windows listed first; a player of
    // ours is stopped through the register, the way another of ours would
    // stop it.
    if (!current.isPlaying) {
      return;
    }
    if (current.owner === 'system') {
      window.electron?.ipcRenderer
        .pauseOtherSystemPlayers()
        .catch(() => undefined);
      return;
    }
    // Never the wire: a pause that arrived over the link must not leave by
    // it. This end registers no `remote` player today, and that is exactly
    // the kind of fact that stops being true one feature later.
    stopAllPlayback('remote');
  };
  // Stable, so the signal handler that calls it need not re-subscribe.
  const performTransportRef = useRef((command: TRemoteTransportCommand) =>
    performRef.current(command),
  );
  return performTransportRef.current;
};

export default useRemoteNowPlayingBroadcast;
