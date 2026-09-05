/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The listener's half of "what is playing over there".
 *
 * Turns what a sending computer said its bar is showing into the same
 * `ITransportSource` the app's own players publish, so the listener's bar
 * draws it with the same card and the same play button instead of "Nothing
 * playing" — the way `useSystemMediaSource` does for a browser tab on this
 * machine. The bar's third line names the computer.
 *
 * ONE DESCRIPTION, HOWEVER MANY SENDERS. The bar has room for one thing, and
 * the honest one is whichever sender is actually playing — the one that
 * started most recently while several are, since under the one-player rule
 * the others are being paused as it is drawn. A sender that has said nothing
 * yet, or whose bar is empty, is not a candidate.
 *
 * The buttons go back over the wire to the sender and are pressed there, on
 * whatever its bar is showing — and only the buttons the sender said its
 * source answers, the rule the bar already applies to a web page or a Windows
 * session here. No slider: a position read a second ago on another machine
 * is not a playhead this one can move honestly, so the step travels as a
 * delta and the sender resolves it against the truth.
 *
 * ONE PLAYER AT A TIME REACHES ACROSS THE WIRE, under the same switch that
 * governs the machine's other programs. The sender's song comes out of this
 * machine's speakers, so a library track started here over it is two things
 * at once through one curve — the fault the rule exists for. Both directions:
 *
 * - Something starts here, and the sender is asked to pause. While the remote
 *   plays it is registered as a player, so `claimPlayback` from the library
 *   and `stopAllPlayback` from a browser tab starting reach it exactly as they
 *   reach each other. It never claims playback itself.
 * - A sender starts, and everything here stops: the app's own players
 *   through the register, the machine's own player by name, and every OTHER
 *   sender that is playing — with three computers sending, the one whose
 *   user just pressed play is the one anybody wants to hear. On the
 *   TRANSITION to playing, never on the state — see `shouldYieldToSystem` for
 *   the second in between where reading the state made two players take
 *   turns stopping each other. And before the remote is registered for this
 *   round, or "everything of ours" would have paused the sender right back.
 */

import { useEffect, useRef, useState } from 'react';
import { buildSongIdentity } from 'common/songIdentity';
import { REMOTE_NUDGE_LIMIT_MS } from '../../common/remoteAudio';
import type { TRemoteTransportCommand } from '../../common/remoteAudio';
import { registerPlayer, stopAllPlayback } from '../audio/playbackOwner';
import {
  clearTransportSource,
  isTransportPlaying,
  setTransportSource,
} from '../audio/transportSource';
import { useSinglePlayer } from '../utils/singlePlayer';
import type {
  IRemoteAudioComputer,
  TRemoteAudioRole,
} from './remoteAudioState';

/** The sender worth the bar: the one that started last if it is still
 * playing, then any that is playing, then whoever described itself. */
export const pickRemoteNowPlaying = (
  computers: IRemoteAudioComputer[],
  lastStartedId?: string,
): IRemoteAudioComputer | undefined =>
  computers.find(
    (computer) =>
      computer.id === lastStartedId && computer.nowPlaying?.isPlaying === true,
  ) ??
  computers.find((computer) => computer.nowPlaying?.isPlaying === true) ??
  computers.find((computer) => computer.nowPlaying !== undefined);

/** Which senders have just gone from paused to playing, in list order. */
export const startedSenders = (
  known: ReadonlySet<string>,
  playing: readonly string[],
): string[] => playing.filter((id) => !known.has(id));

const sendTransport = (peerId: string, command: TRemoteTransportCommand) => {
  window.electron.ipcRenderer
    .sendRemoteAudioLanSignal({
      peerId,
      signal: { kind: 'transport', ...command },
    })
    .catch(() => undefined);
};

const useRemoteNowPlayingSource = (
  role: TRemoteAudioRole | undefined,
  computers: IRemoteAudioComputer[],
): void => {
  const singlePlayer = useSinglePlayer();
  const [lastStartedId, setLastStartedId] = useState<string | undefined>(
    undefined,
  );
  const computer =
    role === 'listener'
      ? pickRemoteNowPlaying(computers, lastStartedId)
      : undefined;
  const playing = computer?.nowPlaying;
  const peerId = computer?.id;
  const playingIds =
    role === 'listener'
      ? computers
          .filter((entry) => entry.nowPlaying?.isPlaying === true)
          .map((entry) => entry.id)
      : [];
  // Peer ids never contain a newline: they are the transport's own tokens.
  const playingKey = playingIds.join('\n');
  const playingIdsRef = useRef(playingIds);
  playingIdsRef.current = playingIds;

  useEffect(() => {
    if (!computer || !playing || !peerId) {
      clearTransportSource('remote');
      return;
    }
    setTransportSource({
      owner: 'remote',
      title: playing.title,
      subtitle: playing.subtitle,
      origin: computer.name,
      identity: buildSongIdentity(
        'remote',
        computer.name,
        playing.title,
        playing.artist,
      ),
      isPlaying: playing.isPlaying,
      positionMs: playing.positionMs,
      durationMs: playing.durationMs,
      toggle: () => sendTransport(peerId, { command: 'toggle' }),
      stop: playing.canStop
        ? () => sendTransport(peerId, { command: 'stop' })
        : undefined,
      nudge: playing.canStep
        ? (deltaMs: number) =>
            sendTransport(peerId, {
              command: 'nudge',
              deltaMs: Math.max(
                -REMOTE_NUDGE_LIMIT_MS,
                Math.min(REMOTE_NUDGE_LIMIT_MS, deltaMs),
              ),
            })
        : undefined,
      next: playing.canNext
        ? () => sendTransport(peerId, { command: 'next' })
        : undefined,
      previous: playing.canPrevious
        ? () => sendTransport(peerId, { command: 'previous' })
        : undefined,
    });
  }, [computer, peerId, playing]);

  const knownPlayingRef = useRef<ReadonlySet<string>>(new Set());
  useEffect(() => {
    const now = playingIdsRef.current;
    const started = startedSenders(knownPlayingRef.current, now);
    knownPlayingRef.current = new Set(now);
    if (started.length > 0) {
      setLastStartedId(started[started.length - 1]);
    }
    if (!singlePlayer || now.length === 0) {
      return undefined;
    }
    if (started.length > 0) {
      // A sender pressed play. Ours stops, the way it stops when a browser
      // tab here starts; the machine's own player is asked by name because a
      // toggle sent to something paused would start it; and so is every other
      // sender still playing, the newest press being the one that counts.
      const winner = started[started.length - 1];
      stopAllPlayback();
      if (isTransportPlaying('system')) {
        window.electron?.ipcRenderer
          .sendSystemMediaCommand('pause')
          .catch(() => undefined);
      }
      now
        .filter((id) => id !== winner)
        .forEach((id) => sendTransport(id, { command: 'pause' }));
    }
    // Registered after the stop above, never before it: `stopAllPlayback`
    // reaches every registered player, and this one would have paused the
    // sender that just pressed play.
    return registerPlayer('remote', () =>
      playingIdsRef.current.forEach((id) =>
        sendTransport(id, { command: 'pause' }),
      ),
    );
  }, [playingKey, singlePlayer]);

  useEffect(() => () => clearTransportSource('remote'), []);
};

export default useRemoteNowPlayingSource;
