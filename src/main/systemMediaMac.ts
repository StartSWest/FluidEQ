/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What the rest of a Mac is playing.
 *
 * macOS NO LONGER ANSWERS THE WHOLE QUESTION. Its equivalent of the Windows
 * session manager is MediaRemote, which was never public and since macOS 15.4
 * answers only processes carrying Apple's own platform signature — every
 * third-party now-playing reader went blank that release. The workarounds
 * that exist load a framework into Apple's `/usr/bin/perl` to borrow its
 * signature, or need System Integrity Protection off; neither belongs in an
 * app that is sold.
 *
 * WHAT IS LEFT IS WHAT PLAYERS SAY ABOUT THEMSELVES. Music and Spotify each
 * broadcast a distributed notification whenever their track or state changes,
 * carrying the title, the artist and the state. Electron subscribes to those
 * in-process (`systemPreferences.subscribeNotification`), so the whole watcher
 * is two subscriptions: no child process, no polling, no permission. Proven on
 * macOS 26.5 with Electron 43 before this was written — a notification posted
 * in each player's shape arrived with its userInfo intact. The cost is two
 * players rather than every player: a browser tab is not among them, and no
 * public interface on this platform can put it there.
 *
 * NOTHING IS KNOWN UNTIL SOMETHING CHANGES. A broadcast is a change, so a song
 * already playing when FluidEQ starts is on the bar from its next pause or
 * track. Asking the player instead is an Apple event, and the first Apple
 * event to a player raises macOS's "wants to control Spotify" sheet — at
 * launch, with nobody having pressed anything. The bar fills one change late
 * rather than open on a consent sheet.
 *
 * NO TIMELINE. The broadcasts carry a duration and no running playhead, and a
 * playhead frozen at 0:00 of 3:20 reads as broken. A snapshot with no
 * duration is already what a live stream is on Windows, so that is what these
 * are: title, artist, state, and the buttons that work.
 *
 * THE BUTTONS ARE APPLESCRIPT, sent to the one player on the bar by bundle
 * id. The first press of any of them raises that consent sheet once per
 * player, which is macOS asking the person who just pressed.
 */
import { execFile } from 'child_process';
import { systemPreferences } from 'electron';
import { MEDIA_TRANSPORT_ACTIONS } from './mediaKeys';
import { ISystemMediaSnapshot, TSystemMediaCommand } from './systemMedia';

/**
 * By absolute path, for the reason `powershell.ts` gives for its own: a bare
 * program name is a search, and this one runs scripts.
 */
const OSASCRIPT_PATH = '/usr/bin/osascript';

interface IMacPlayer {
  /** What the bar shows, and the name that travels to the window and back. */
  app: string;
  bundleId: string;
  notification: string;
  /** "Stop", which Spotify's dictionary does not have: pause and rewind, the
   * same substitute the Windows side uses for players that refuse Stop. */
  stop: readonly string[];
}

const MAC_PLAYERS: readonly IMacPlayer[] = [
  {
    app: 'Music',
    bundleId: 'com.apple.Music',
    notification: 'com.apple.Music.playerInfo',
    stop: ['stop'],
  },
  {
    app: 'Spotify',
    bundleId: 'com.spotify.client',
    notification: 'com.spotify.client.PlaybackStateChanged',
    stop: ['pause', 'set player position to 0'],
  },
];

export interface IMacPlayerState {
  title: string;
  artist: string;
  isPlaying: boolean;
}

/**
 * One broadcast, as a player's state — or nothing, for a player that stopped
 * or has nothing loaded. Both players use the same three keys.
 */
export const readMacPlayerInfo = (
  userInfo: Record<string, unknown>,
): IMacPlayerState | undefined => {
  const title = typeof userInfo.Name === 'string' ? userInfo.Name : '';
  const state = userInfo['Player State'];
  if (!title || (state !== 'Playing' && state !== 'Paused')) {
    return undefined;
  }
  return {
    title,
    artist: typeof userInfo.Artist === 'string' ? userInfo.Artist : '',
    isPlaying: state === 'Playing',
  };
};

/**
 * What the bar shows, from everything heard so far.
 *
 * The same rule the Windows watcher applies: whoever is playing wins, and
 * failing that whoever spoke last. The map is kept in the order the players
 * last spoke, so "last" is its end.
 */
export const macSnapshotOf = (
  states: ReadonlyMap<string, IMacPlayerState>,
): ISystemMediaSnapshot | undefined => {
  const heard = [...states].reverse();
  const shown = heard.find(([, state]) => state.isPlaying) ?? heard[0];
  if (!shown) {
    return undefined;
  }
  const [app, state] = shown;
  return {
    app,
    title: state.title,
    artist: state.artist,
    isPlaying: state.isPlaying,
    positionMs: 0,
    durationMs: 0,
    // Both players take both; neither is offered a seek, because there is no
    // position here to step from.
    canNext: true,
    canPrevious: true,
    canSeek: false,
    playing: heard
      .filter(([, other]) => other.isPlaying)
      .map(([otherApp]) => otherApp),
  };
};

/**
 * `osascript` arguments that tell one player to do something, and only if it
 * is running: `tell` on its own would LAUNCH a player that had quit, which is
 * this app opening somebody's music for them.
 *
 * Every word of the script is from this file. The player is chosen by name
 * from the table above and the verbs from the callers below; nothing that
 * came from a window is ever part of it.
 */
export const macPlayerScript = (
  player: IMacPlayer,
  verbs: readonly string[],
): string[] =>
  [
    `if application id "${player.bundleId}" is running then`,
    `tell application id "${player.bundleId}"`,
    ...verbs,
    'end tell',
    'end if',
  ].flatMap((line) => ['-e', line]);

const states = new Map<string, IMacPlayerState>();
let subscribed = false;
let notify: ((snapshot: ISystemMediaSnapshot | undefined) => void) | undefined;

const tell = (player: IMacPlayer, verbs: readonly string[]): Promise<void> =>
  new Promise((resolve) => {
    // Resolved either way, like every command on the Windows side: a player
    // that refused, a consent sheet answered "Don't Allow", or a player that
    // quit between the broadcast and the press is nothing a window could act
    // on. What the player did next arrives as its own broadcast.
    execFile(OSASCRIPT_PATH, macPlayerScript(player, verbs), () => resolve());
  });

/** The player on the bar, which is the one every button acts on. */
const shownPlayer = (): IMacPlayer | undefined => {
  const app = macSnapshotOf(states)?.app;
  return MAC_PLAYERS.find((player) => player.app === app);
};

const watch = (
  onSnapshot: (snapshot: ISystemMediaSnapshot | undefined) => void,
): void => {
  notify = onSnapshot;
  if (!subscribed) {
    subscribed = true;
    MAC_PLAYERS.forEach((player) => {
      systemPreferences.subscribeNotification(
        player.notification,
        (_event, userInfo) => {
          const state = readMacPlayerInfo(userInfo);
          // Removed and put back rather than overwritten, so the map stays in
          // the order the players last spoke.
          states.delete(player.app);
          if (state) {
            states.set(player.app, state);
          }
          notify?.(macSnapshotOf(states));
        },
      );
    });
  }
  // Answered at once, like the Windows watcher: a window arriving mid-song is
  // told where things stand rather than waiting for the next change.
  onSnapshot(macSnapshotOf(states));
};

/**
 * Stop TELLING anybody; keep listening.
 *
 * The Windows watcher is a PowerShell child that polls, so it is stopped the
 * moment nobody needs it. These are two idle subscriptions, and what they
 * hear is the only way this file knows anything: a reload that dropped them
 * would bring the new window up blind until the next track, where keeping
 * them hands it the song that is playing.
 */
const stopWatching = (): void => {
  notify = undefined;
};

const sendCommand = async (command: TSystemMediaCommand): Promise<void> => {
  const player = shownPlayer();
  if (!player) {
    return;
  }
  if (command === 'next') {
    await tell(player, ['next track']);
  } else if (command === 'previous') {
    await tell(player, ['previous track']);
  } else if (command === 'pause') {
    await tell(player, ['pause']);
  } else if (command === 'stop') {
    await tell(player, player.stop);
  }
  // `seek` is never offered — see `canSeek` — and is dropped if it arrives.
};

const pauseOthers = async (exceptApp: string): Promise<void> => {
  // `exceptApp` came back from a window. It is compared and never used.
  const others = MAC_PLAYERS.filter(
    (player) =>
      player.app !== exceptApp && states.get(player.app)?.isPlaying === true,
  );
  await Promise.all(others.map((player) => tell(player, ['pause'])));
};

const TRANSPORT_VERBS: Record<
  (typeof MEDIA_TRANSPORT_ACTIONS)[number],
  string
> = {
  previous: 'previous track',
  playPause: 'playpause',
  next: 'next track',
};

const sendTransportKey = async (action: unknown): Promise<void> => {
  const name = MEDIA_TRANSPORT_ACTIONS.find((known) => known === action);
  const player = shownPlayer();
  if (name === undefined || !player) {
    return;
  }
  await tell(player, [TRANSPORT_VERBS[name]]);
};

/** Shaped as `ISystemMediaSource`; `systemMediaSource.ts` holds it to that. */
export const macSystemMediaSource = {
  watch,
  stopWatching,
  sendCommand,
  pauseOthers,
  sendTransportKey,
};
