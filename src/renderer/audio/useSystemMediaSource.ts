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
 * ONE OF THEM AT A TIME, IN EVERY DIRECTION AND WHOEVER THEY ARE. This app is
 * the equaliser everything on the machine runs through, so a browser tab
 * playing over a library song is two things at once through one curve — the
 * same fault as two of this app's own players at once, and it reads the same
 * way. Start something here and every program out there is asked to pause;
 * start something out there and ours stops; and start a video over a playing
 * album, neither of them ours, and the album stops for the video. That last
 * one was missing for the life of the feature, because the rule was written
 * as "ours against theirs" and asked only about the single session on the
 * bar — which with two programs playing is as likely to be the one that was
 * already going.
 *
 * The bar's play/pause button goes out as a media key rather than through the
 * session: the key is the one transport command that reaches every player on
 * Windows, including those that never registered a session, and it is already
 * how the titlebar's buttons work.
 *
 * Every pause this rule sends is a pause and never that key, and has to be: a
 * toggle would have started whatever was sitting there paused, which is this
 * app turning somebody's music on for them.
 */

import { useCallback, useEffect, useRef } from 'react';
import { buildSongIdentity } from 'common/songIdentity';
import type { IGameProfile } from '../../common/games';
import type { ISystemMediaSnapshot } from '../../main/systemMedia';
import { useSoundingGame } from '../games/useGameSound';
import { stopAllPlayback, usePlaybackOwner } from './playbackOwner';
import type { TPlaybackOwner } from './playbackOwner';
import type { ITransportSource } from './transportSource';
import {
  clearTransportSource,
  isTransportPlaying,
  setTransportSource,
} from './transportSource';
import { isSinglePlayerEnabled } from '../utils/singlePlayer';

/** What the bar shows for a player that has published no artist. */
const subtitleFor = (snapshot: ISystemMediaSnapshot): string | undefined =>
  snapshot.artist || snapshot.app || undefined;

/**
 * What the bar spends its one line on for the machine's own sound.
 *
 * A game registers no player with Windows — no title, no artist, no
 * play/pause — so while one is playing the bar had nothing to show and said
 * nothing was playing at all, which is the same hole this file was written to
 * fill for browsers. The game goes there instead, but never over a player
 * that is actually playing: Spotify started over a game in the background is
 * what somebody is listening to, and the bar follows the sound.
 *
 * A player that is merely PAUSED loses to the game, for the same reason: a
 * paused Spotify is not what is coming out of the speakers, and the game is.
 */
export const systemBarShows = (
  snapshot: ISystemMediaSnapshot | undefined,
  game: { name: string } | undefined,
): 'session' | 'game' | 'none' => {
  if (snapshot?.isPlaying) {
    return 'session';
  }
  if (game) {
    return 'game';
  }
  return snapshot ? 'session' : 'none';
};

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
 * ANY of the machine's programs starting, not the one on the bar. The bar
 * shows whichever session Windows listed first among those playing, which
 * with two of them is as likely to be the one that was already going: a
 * Netflix tab started behind a playing Spotify changed nothing the bar's own
 * session was doing, so a song of ours played straight through it.
 *
 * The other half is the same rule from the other side, and it lives in the
 * hook: when a player of ours starts, the machine's player is asked to pause.
 * One of the two is always making the sound.
 *
 * `remotePlaying` is another computer's song arriving over the LAN link — not
 * a player of ours, so never the owner, but sound through this output all the
 * same, and the browser tab starting is somebody choosing over it. Stopping
 * "everything of ours" reaches it because the listener registers it as a
 * player while it plays — see `useRemoteNowPlayingSource`.
 */
export const shouldYieldToSystem = (
  somethingStarted: boolean,
  appOwner: TPlaybackOwner | undefined,
  isSinglePlayer: boolean,
  remotePlaying = false,
): boolean =>
  isSinglePlayer &&
  somethingStarted &&
  (appOwner !== undefined || remotePlaying);

/**
 * The program that just started over another that was already playing, if
 * that is what happened — the one that keeps the sound while the rest are
 * asked to stop.
 *
 * The rule had a hole the size of the machine: it was always "ours against
 * theirs", so a Netflix tab started over a playing Spotify was two programs
 * at once through one curve and nothing stopped either. Both are somebody
 * else's and neither is on this app's register, so the only thing that can
 * separate them is which one just started.
 *
 * A TRANSITION, for the reason the rest of this rule is one: Windows
 * republishes a player's state when nothing has happened, and a list read as
 * a state would stop the album somebody is listening to because the app
 * blinked.
 *
 * AND NOTHING WHEN EVERY PLAYER IS NEW TO US, which is what the first reading
 * after this app opens looks like. Two programs found already playing is not
 * somebody pressing play — nobody pressed anything, which of them is the
 * newer is not knowable from here, and silencing one of them for opening an
 * equaliser would be the app taking a decision it was never asked for.
 */
export const startedOverOthers = (
  known: ReadonlySet<string>,
  playing: readonly string[],
): string | undefined => {
  const started = playing.filter((app) => !known.has(app));
  if (started.length === 0 || started.length === playing.length) {
    return undefined;
  }
  return started[started.length - 1];
};

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
  /** Which of the machine's programs were playing at the last reading, so a
   * start can be told from a state republished unchanged. */
  const knownPlayingAppsRef = useRef<ReadonlySet<string>>(new Set());
  const playingOwnerRef = useRef<TPlaybackOwner | undefined>(undefined);
  playingOwnerRef.current = playingOwner;
  // The game whose sound is on, which is the machine's own sound as much as a
  // browser tab is, and the one kind of it Windows publishes nothing about.
  const game = useSoundingGame();
  const gameRef = useRef(game);
  gameRef.current = game;

  /** The one place that decides what the bar says for this machine. */
  const show = useCallback(
    (
      snapshot: ISystemMediaSnapshot | undefined,
      playingGame: IGameProfile | undefined,
    ) => {
      const shown = systemBarShows(snapshot, playingGame);
      if (shown === 'game' && playingGame) {
        setTransportSource(gameSource(playingGame));
        return;
      }
      if (shown === 'session' && snapshot) {
        setTransportSource(sessionSource(snapshot));
        return;
      }
      clearTransportSource('system');
    },
    [],
  );

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
      lastSnapshotRef.current = snapshot;
      // Who is playing out there, and who of them has just started. Both
      // questions are asked of the whole machine rather than of the one
      // session on the bar — see `startedOverOthers`.
      const playingApps = snapshot?.playing ?? [];
      const known = knownPlayingAppsRef.current;
      const started = playingApps.some((app) => !known.has(app));
      const winner = startedOverOthers(known, playingApps);
      knownPlayingAppsRef.current = new Set(playingApps);
      // One player at a time between two programs that are both somebody
      // else's. The one that just started keeps the sound and the rest are
      // asked to stop, while the switch is on.
      if (winner !== undefined && isSinglePlayerEnabled()) {
        bridge.pauseOtherSystemPlayers(winner).catch(() => undefined);
      }
      if (
        shouldYieldToSystem(
          started,
          playingOwnerRef.current,
          isSinglePlayerEnabled(),
          isTransportPlaying('remote'),
        )
      ) {
        // Somebody pressed play somewhere else. Ours stops, the way it stops
        // when somebody presses play on another tab of this app.
        stopAllPlayback();
      }
      show(snapshot, gameRef.current);
    });

    bridge.watchSystemMedia(true).catch(() => undefined);

    return () => {
      unsubscribe();
      bridge.watchSystemMedia(false).catch(() => undefined);
      clearTransportSource('system');
    };
  }, [show]);

  // A game starting, ending, or having its chain taken over by hand changes
  // what the bar should say without Windows publishing anything at all.
  useEffect(() => {
    show(lastSnapshotRef.current, game);
  }, [game, show]);

  /**
   * And the same rule from our side: what we start, we start alone.
   *
   * EVERY program that is playing, not one of them. This used to pause the
   * session on the bar, which is whichever Windows listed first: press play
   * here with Spotify and a video both going and one of the two carried on
   * over the song.
   *
   * Sent on the change of owner rather than on every snapshot, so it is one
   * command per press of play. Pauses, never the play/pause key — a toggle
   * sent to something already paused would start it, which is this app
   * turning somebody's music on for them.
   */
  useEffect(() => {
    if (
      !isSinglePlayerEnabled() ||
      playingOwner === undefined ||
      (lastSnapshotRef.current?.playing.length ?? 0) === 0
    ) {
      return;
    }
    window.electron?.ipcRenderer
      .pauseOtherSystemPlayers()
      .catch(() => undefined);
  }, [playingOwner]);
};

/** The machine's own player, as the bar drives it. */
const sessionSource = (snapshot: ISystemMediaSnapshot): ITransportSource => ({
  owner: 'system',
  title: snapshot.title,
  subtitle: subtitleFor(snapshot),
  identity: buildSongIdentity(
    'system',
    snapshot.app,
    snapshot.title,
    snapshot.artist,
  ),
  isPlaying: snapshot.isPlaying,
  positionMs: snapshot.positionMs,
  durationMs: snapshot.durationMs,
  toggle: () => {
    window.electron?.ipcRenderer
      .sendMediaTransport('playPause')
      .catch(() => undefined);
  },
  // Stop is not a media key: it is a distinct session command. Main uses
  // native Stop where the player has one, or pause-and-rewind where it
  // does not, so every external player gets the same visible control.
  stop: () => {
    window.electron?.ipcRenderer
      .sendSystemMediaCommand('stop')
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

/**
 * A game, as the bar drives it — which is to say it does not.
 *
 * There is nothing to press: a game publishes no player to Windows, so it
 * takes no play, no pause and no skip, and a button that answered none of
 * them would be worse than no button. It carries its own icon as the cover,
 * the way every other thing on this bar carries one.
 */
const gameSource = (game: IGameProfile): ITransportSource => ({
  owner: 'system',
  title: game.name,
  ...(game.icon ? { artworkUrl: game.icon } : {}),
  isPlaying: true,
  canToggle: false,
  positionMs: 0,
  durationMs: 0,
  toggle: () => undefined,
});

export default useSystemMediaSource;
