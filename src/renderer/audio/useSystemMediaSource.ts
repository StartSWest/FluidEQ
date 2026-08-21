/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

/**
 * The bar, for sound this app is not making.
 *
 * FluidEQ equalises the whole device, so the music being shaped by the curve
 * on screen is very often a browser tab or Spotify — and the transport bar
 * used to say nothing was playing at all. Windows publishes what every player
 * registered with it is doing; main reads it (see `systemMedia`) and this
 * turns it into the same `ITransportSource` the app's own three players
 * publish, so the bar draws it with the same card, cover and buttons.
 *
 * WHAT IS PLAYING WINS, WHOEVER IS PLAYING IT. The rule the bar has always
 * had, extended to the one player this app does not own: sound from a browser
 * keeps the bar on every page until it stops, and then the page's own player
 * has it back — the same thing a library track does when it is paused.
 *
 * ONE OF THEM AT A TIME, in both directions. This app is the equaliser
 * everything on the machine runs through, so a browser tab playing over a
 * library song is two things at once through one curve — the same fault as
 * two of this app's own players at once, and it reads the same way. Start
 * something here and the machine's player is asked to pause; start something
 * out there and ours stops.
 *
 * The bar's play/pause button goes out as a media key rather than through the
 * session: the key is the one transport command that reaches every player on
 * Windows, including those that never registered a session, and it is already
 * how the titlebar's buttons work.
 *
 * The pause sent when one of our own players starts is the exception, and has
 * to be: a toggle would have started whatever was sitting there paused. That
 * one is asked of the session by name.
 */

import { useEffect, useRef } from 'react';
import type { ISystemMediaSnapshot } from '../../main/systemMedia';
import { stopAllPlayback, usePlaybackOwner } from './playbackOwner';
import type { TPlaybackOwner } from './playbackOwner';
import { clearTransportSource, setTransportSource } from './transportSource';

/** What the bar shows for a player that has published no artist. */
const subtitleFor = (snapshot: ISystemMediaSnapshot): string | undefined =>
  snapshot.artist || snapshot.app || undefined;

/**
 * Whether the app should go quiet because something outside just started.
 *
 * A TRANSITION, and that is the whole of the trick. "It is playing out there
 * and we are playing here" is true for a second after we ask an external
 * player to pause — the pause has been sent and the next reading has not
 * caught up — so acting on the state rather than on the change made the two
 * take it in turns to stop each other. Asking whether it *started* is what
 * separates "somebody pressed play in a browser" from "the thing we just
 * paused has not stopped yet", and it needs no clock to do it.
 *
 * The other half is the same rule from the other side, and it lives in the
 * hook: when a player of ours starts, the machine's player is asked to pause.
 * One of the two is always making the sound.
 */
export const shouldYieldToSystem = (
  wasPlaying: boolean,
  isPlaying: boolean,
  appOwner: TPlaybackOwner | undefined,
): boolean => isPlaying && !wasPlaying && appOwner !== undefined;

export const useSystemMediaSource = (): void => {
  const playingOwner = usePlaybackOwner();
  /**
   * The last thing the watcher said, and who was playing when it said it.
   *
   * Refs rather than state: they are read inside a subscription registered
   * once, and re-registering it on every change would take the watcher down
   * and put it back several times a second.
   */
  const lastSnapshotRef = useRef<ISystemMediaSnapshot | undefined>(undefined);
  const playingOwnerRef = useRef<TPlaybackOwner | undefined>(undefined);
  playingOwnerRef.current = playingOwner;

  // THE WATCHER STAYS UP WHILE THIS APP IS PLAYING, and that is the price of
  // the rule working both ways: a browser tab starting is a thing that has to
  // be noticed, and it cannot be noticed by something that was switched off
  // for the duration.
  useEffect(() => {
    const bridge = window.electron?.ipcRenderer;
    if (!bridge?.watchSystemMedia || !bridge.onSystemMedia) {
      return undefined;
    }

    const unsubscribe = bridge.onSystemMedia((snapshot) => {
      const wasPlaying = lastSnapshotRef.current?.isPlaying === true;
      lastSnapshotRef.current = snapshot;
      if (
        shouldYieldToSystem(
          wasPlaying,
          snapshot?.isPlaying === true,
          playingOwnerRef.current,
        )
      ) {
        // Somebody pressed play somewhere else. Ours stops, the way it stops
        // when somebody presses play on another tab of this app.
        stopAllPlayback();
      }
      if (!snapshot) {
        clearTransportSource('system');
        return;
      }
      setTransportSource({
        owner: 'system',
        title: snapshot.title,
        subtitle: subtitleFor(snapshot),
        isPlaying: snapshot.isPlaying,
        positionMs: snapshot.positionMs,
        durationMs: snapshot.durationMs,
        toggle: () => {
          window.electron?.ipcRenderer
            .sendMediaTransport('playPause')
            .catch(() => undefined);
        },
        // A STEP RATHER THAN A SLIDER, and the position is the child's.
        //
        // Windows will move another player's playhead — measured on Chrome:
        // 1533s to 1538s — but it publishes a position only when the player
        // republishes one, so the number here can be seconds old. Working out
        // "five seconds on" from a stale reading would jump the video
        // somewhere nobody asked for; the command carries a target worked out
        // from the last reading and Windows resolves it against the truth.
        nudge: snapshot.canSeek
          ? (deltaMs: number) => {
              window.electron?.ipcRenderer
                .sendSystemMediaCommand(
                  'seek',
                  Math.max(0, snapshot.positionMs + deltaMs),
                )
                .catch(() => undefined);
            }
          : undefined,
        // Only where the session says it takes them. A YouTube video in
        // Chrome answers no to both and a Spotify queue answers yes.
        next: snapshot.canNext
          ? () => {
              window.electron?.ipcRenderer
                .sendSystemMediaCommand('next')
                .catch(() => undefined);
            }
          : undefined,
        previous: snapshot.canPrevious
          ? () => {
              window.electron?.ipcRenderer
                .sendSystemMediaCommand('previous')
                .catch(() => undefined);
            }
          : undefined,
      });
    });

    bridge.watchSystemMedia(true).catch(() => undefined);

    return () => {
      unsubscribe();
      bridge.watchSystemMedia(false).catch(() => undefined);
      clearTransportSource('system');
    };
  }, []);

  /**
   * And the same rule from our side: what we start, we start alone.
   *
   * Sent on the change of owner rather than on every snapshot, so it is one
   * command per press of play. A pause asked of the session by name and never
   * the play/pause key — a toggle sent to something already paused would
   * start it, which is this app turning somebody's music on for them.
   */
  useEffect(() => {
    if (playingOwner === undefined || !lastSnapshotRef.current?.isPlaying) {
      return;
    }
    window.electron?.ipcRenderer
      .sendSystemMediaCommand('pause')
      .catch(() => undefined);
  }, [playingOwner]);
};

export default useSystemMediaSource;
