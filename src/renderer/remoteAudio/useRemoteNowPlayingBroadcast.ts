/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * This computer's half of "what is playing over there", told to every
 * computer linked with it — both ways, each plays the other's sound.
 *
 * A computer playing sound it did not start had a bar that said "Nothing
 * playing" through a whole album. This tells it what this computer's own bar
 * is showing — the same description `pickTransportOwner` hands the bar here,
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
import { usePlaybackOwner } from '../audio/playbackOwner';
import type { TPlaybackOwner } from '../audio/playbackOwner';
import pickTransportOwner from '../audio/transportRouting';
import {
  useLastTransportOwner,
  useTransportSources,
} from '../audio/transportSource';
import type { ITransportSource } from '../audio/transportSource';
import { onSinglePlayerChange } from '../utils/singlePlayer';
import { startedHere, wireKey, wireMs } from '../../common/remoteNowPlaying';
import performLocalTransport from './localTransportCommand';

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
 * The bar here keeps a paused browser tab only while it is the last thing
 * played on this machine — see `setTransportSource` — and otherwise goes to
 * this app's last song. On the listener any paused thing here is worth
 * describing: it is exactly what the press on its bar will resume, and
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
  // Never the other computer's own song. Both ways, this computer's bar also
  // shows what a linked computer is playing here (`remote`), and described
  // back over the wire it came home as that computer's "From" lane naming its
  // own song (Ivan's two PCs, 2026-10-02) — and as a player there that never
  // stops, for the one-player rule to pause. What goes out is this computer's
  // own sound, which never carries the other's (`lanAudioHelper.ts`), so its
  // description cannot either.
  const own: Partial<Record<TPlaybackOwner, ITransportSource>> = {
    ...sources,
  };
  delete own.remote;
  const local = (owner: TPlaybackOwner | undefined) =>
    owner === 'remote' ? undefined : owner;
  // No tab: the sender's bar on a page that is not a player, which is the
  // one that falls through to whatever is actually making the sound.
  const owner = pickTransportOwner(
    undefined,
    own,
    local(playingOwner),
    local(lastOwner),
  );
  return owner === undefined ? own.system : own[owner];
};

const useRemoteNowPlayingBroadcast = (
  peerIds: readonly string[],
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

  // Peer ids never contain a newline: they are the transport's own tokens.
  const peerKey = [...peerIds].sort().join('\n');
  /** The computers that have heard the description as it stands. */
  const toldRef = useRef(new Set<string>());
  const lastKeyRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    const ids = peerKey === '' ? [] : peerKey.split('\n');
    const told = toldRef.current;
    [...told].forEach((id) => {
      if (!ids.includes(id)) {
        told.delete(id);
      }
    });
    // A new description goes to every computer, and only a new description
    // can carry a press. A computer that arrives — a reconnection under a new
    // peer id among them — hears the description as it stands and never the
    // press: `startedHere` has seen this player playing since, and the
    // computer already linked heard it the first time.
    const changed = lastKeyRef.current !== key;
    lastKeyRef.current = key;
    (changed ? ids : ids.filter((id) => !told.has(id))).forEach((peerId) => {
      told.add(peerId);
      window.electron.ipcRenderer
        .sendRemoteAudioLanSignal({
          peerId,
          signal: {
            kind: 'now-playing',
            playing: playingRef.current,
            // Absent unless it is true: a computer two versions older reads a
            // message it does not understand the same way it always has, and
            // a message that says nothing about a press is the safe one.
            ...(changed && startedRef.current ? { started: true } : {}),
          },
        })
        .catch(() => undefined);
    });
  }, [key, peerKey]);

  // The one-player switch follows across the links: changed here, it goes to
  // every linked computer; changed on one, it goes on to the others and never
  // back where it came from (`singlePlayer.ts`). With the description as it
  // stands, because a now-playing message without one says this computer's
  // bar is empty.
  const peerIdsRef = useRef<readonly string[]>([]);
  peerIdsRef.current = peerKey === '' ? [] : peerKey.split('\n');
  useEffect(
    () =>
      onSinglePlayerChange((singlePlayer, fromLink) => {
        peerIdsRef.current
          .filter((peerId) => peerId !== fromLink)
          .forEach((peerId) => {
            window.electron.ipcRenderer
              .sendRemoteAudioLanSignal({
                peerId,
                signal: {
                  kind: 'now-playing',
                  playing: playingRef.current,
                  singlePlayer,
                },
              })
              .catch(() => undefined);
          });
      }),
    [],
  );

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
    performLocalTransport(sourceRef.current, command);
  };
  // Stable, so the signal handler that calls it need not re-subscribe.
  const performTransportRef = useRef((command: TRemoteTransportCommand) =>
    performRef.current(command),
  );
  return performTransportRef.current;
};

export default useRemoteNowPlayingBroadcast;
