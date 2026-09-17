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
 * - A sender says somebody pressed play over there, and everything here
 *   stops: the app's own players through the register, the machine's own
 *   player by name, and every OTHER sender that is playing — with three
 *   computers sending, the one whose user just pressed play is the one
 *   anybody wants to hear.
 *
 * THE PRESS IS A MESSAGE, NOT SOMETHING THIS END WORKS OUT. This end used to
 * compare each round of descriptions with the last and call a sender that had
 * appeared among the playing ones "started". Three ordinary things look
 * exactly like that and none of them is a press — a reconnection, which gives
 * the sender a brand new peer id; the sender's bar falling through to a
 * player that was already going on that machine, which is what the pause sent
 * from here CAUSES; and Windows' polled session list flapping. So the pause
 * this end sent came back one description later as a start, and the rule
 * stopped the very music whose user had just pressed play. `startedHere` on
 * the sender answers the question where it can be answered, and this end acts
 * on the answer and on nothing else.
 *
 * The stop spares the register's own `remote` entry, whose stopper is a pause
 * going back out over the wire — including to the computer that just pressed
 * play.
 */

import { useEffect, useRef, useState } from 'react';
import { buildSongIdentity } from 'common/songIdentity';
import { REMOTE_NUDGE_LIMIT_MS } from '../../common/remoteAudio';
import type { TRemoteTransportCommand } from '../../common/remoteAudio';
import { setAppVolume } from '../audio/appVolume';
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
): ((peerId: string) => void) => {
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
      // This machine is the one playing the sender's audio, so the fader is
      // ours to apply — see the gain stage in `createPcmMixer`. Nothing is
      // sent over the link for it: how loud somebody else's speakers are is
      // not this end's business.
      setVolume: setAppVolume,
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

  // While a sender plays, the sound arriving is a player of this machine's as
  // far as the one-player rule is concerned — it just is not one this app can
  // pause except by asking. Registered only while something is actually
  // playing, so a connected but silent computer is not a player.
  useEffect(() => {
    if (!singlePlayer || playingIdsRef.current.length === 0) {
      return undefined;
    }
    return registerPlayer('remote', () =>
      playingIdsRef.current.forEach((id) =>
        sendTransport(id, { command: 'pause' }),
      ),
    );
  }, [playingKey, singlePlayer]);

  const singlePlayerRef = useRef(singlePlayer);
  singlePlayerRef.current = singlePlayer;
  // Stable, and reads everything through refs: the signal handler that calls
  // it must not have to re-subscribe on every description a sender sends.
  const acceptStart = useRef((startedPeerId: string) => {
    setLastStartedId(startedPeerId);
    if (!singlePlayerRef.current) {
      return;
    }
    // Ours stops, the way it stops when a browser tab here starts — but never
    // the wire itself, or the pause would go to the computer that just
    // pressed play and to the others twice. The machine's own player is asked
    // by name because a toggle sent to something paused would start it, and
    // every other sender is asked in so many words.
    stopAllPlayback('remote');
    if (isTransportPlaying('system')) {
      window.electron?.ipcRenderer
        .sendSystemMediaCommand('pause')
        .catch(() => undefined);
    }
    playingIdsRef.current
      .filter((id) => id !== startedPeerId)
      .forEach((id) => sendTransport(id, { command: 'pause' }));
  });

  useEffect(() => () => clearTransportSource('remote'), []);
  return acceptStart.current;
};

export default useRemoteNowPlayingSource;
