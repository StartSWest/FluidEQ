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
 * has it back — the same thing a library track does when it is paused. What
 * this never does is take the bar from a player of this app's that is actually
 * playing; that one wins, and the watcher in main is not even running while it
 * does.
 *
 * Play/pause goes out as a media key rather than through the session: the key
 * is the one transport command that reaches every player on Windows, it is
 * already how the titlebar's buttons work, and Windows answers a session
 * command with nothing this app could show.
 */

import { useEffect } from 'react';
import type { ISystemMediaSnapshot } from '../../main/systemMedia';
import { usePlaybackOwner } from './playbackOwner';
import { clearTransportSource, setTransportSource } from './transportSource';

/** What the bar shows for a player that has published no artist. */
const subtitleFor = (snapshot: ISystemMediaSnapshot): string | undefined =>
  snapshot.artist || snapshot.app || undefined;

export const useSystemMediaSource = (): void => {
  // WHILE ONE OF THIS APP'S OWN PLAYERS IS PLAYING, AND NOT MERELY LOADED.
  //
  // A paused album on the Library tab does not silence the machine: sound
  // could still be coming from a browser, and that is exactly the case the bar
  // used to be blank for. Only something this app is actually playing takes
  // the watcher down — and when it does, it is also the thing the bar shows.
  const playingOwner = usePlaybackOwner();
  const isAppPlaying = playingOwner !== undefined;

  useEffect(() => {
    const bridge = window.electron?.ipcRenderer;
    if (!bridge?.watchSystemMedia || !bridge.onSystemMedia) {
      return undefined;
    }

    if (isAppPlaying) {
      clearTransportSource('system');
      bridge.watchSystemMedia(false).catch(() => undefined);
      return undefined;
    }

    const unsubscribe = bridge.onSystemMedia((snapshot) => {
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
  }, [isAppPlaying]);
};

export default useSystemMediaSource;
