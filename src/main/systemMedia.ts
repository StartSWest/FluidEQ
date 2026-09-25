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
 * What the rest of the machine is playing.
 *
 * FluidEQ equalises everything the device outputs, and until now its transport
 * bar knew only about the three players inside the app. Spotify, a browser tab
 * or VLC could be the thing being equalised while the bar said nothing was
 * playing at all.
 *
 * Windows does publish this: `GlobalSystemMediaTransportControlsSessionManager`
 * is the same surface the volume flyout's now-playing card is built on, and it
 * carries the title, the artist, the playback state and the timeline of every
 * player that registered one.
 *
 * WATCHED BY A HELPER OF OUR OWN, BECAUSE WINDOWS SAYS WHEN IT CHANGES AND
 * POWERSHELL CANNOT HEAR IT. The watcher was a PowerShell loop reading the
 * session manager every 700 ms, because — measured on this machine —
 * `Register-ObjectEvent` against either the manager or a session answers
 * "Windows PowerShell cannot subscribe to Windows RT events". So it asked
 * again and again, a PowerShell awake for as long as the bar wanted it,
 * finding nothing new almost every time and seeing a change up to 700 ms
 * late. Windows does announce every change the bar draws: sessions coming
 * and going, its own pick moving, a song, a pause, a seek. `FluidEQ-Media.exe`
 * (native/media-watch/src/main.cpp) is a small program that subscribes to
 * those events and prints the same lines the script printed, so the parsing
 * below did not change. It starts when the window asks, holds nothing
 * between runs, and exits when its input closes — which is also what happens
 * when FluidEQ ends however it ends. WinRT from Node itself would need a
 * native addon rebuilt for every Electron; the helper is plain C++ against
 * the Windows SDK, built with the volume and game helpers beside it.
 *
 * The commands (next, previous, seek, stop, pause) are still PowerShell: a
 * process per press, see `sendSystemMediaCommand`.
 */

import { ChildProcess, spawn } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';
import log from 'electron-log';
import { APP_ID } from '../common/branding';
import { POWERSHELL_PATH } from './powershell';

/**
 * THIS APP'S OWN PLAYERS ARE NOT "THE REST OF THE MACHINE".
 *
 * The Media tab is a Chromium guest, and a page playing in it registers a
 * media session like any other player would — under this app's own identity,
 * measured as `com.gigabytz.fluideq`. Reported back it was the same song
 * arriving twice: once as the Media tab's transport and once as "System
 * audio", and pausing the tab left the second card on the bar naming the
 * track the first card had just stopped.
 *
 * So the watcher looks past itself. Anything playing elsewhere wins; failing
 * that, whatever Windows calls the current session, as long as it is not
 * ours; failing that, the first session that is not ours. It is a function
 * rather than a filter at the call site because the command script has to
 * choose the same session the watcher is describing — a "next" that went to
 * the app's own webview because the manager happened to call it current would
 * be a button acting on something other than the card above it.
 *
 * The watcher is native now, and applies this same rule in its own words
 * (`choose` in native/media-watch/src/main.cpp), told `APP_ID` as its one
 * argument so the id is written down once. Change the two together.
 */
const SELF_SKIP = `
$selfId = '${APP_ID}'
function Select-OtherSession($manager) {
  $sessions = @($manager.GetSessions() | Where-Object {
    $_.SourceAppUserModelId -ne $selfId
  })
  foreach ($candidate in $sessions) {
    if ("$($candidate.GetPlaybackInfo().PlaybackStatus)" -eq 'Playing') {
      return $candidate
    }
  }
  $current = $manager.GetCurrentSession()
  if ($current -and $current.SourceAppUserModelId -ne $selfId) { return $current }
  if ($sessions.Count -gt 0) { return $sessions[0] }
  return $null
}
`;

/** One line of the watcher's output: what one player is doing. */
export interface ISystemMediaSnapshot {
  /**
   * Who is playing it, as Windows knows them.
   *
   * An AUMID — "Chrome", "Spotify.exe", a package family name. Shown as-is
   * rather than mapped to a pretty name: a table of the ten apps somebody
   * thought of would be wrong about the eleventh, and the raw id is at least
   * always true.
   */
  app: string;
  title: string;
  artist: string;
  isPlaying: boolean;
  positionMs: number;
  /** Zero where the player publishes no timeline — a live stream has none. */
  durationMs: number;
  /**
   * What this player says it will accept, and the reason the bar asks.
   *
   * A session publishes a set of enabled controls, and they differ per player
   * and per page: a YouTube video in Chrome answers yes to moving the playhead
   * and no to next and previous, while a Spotify queue answers yes to all
   * three. Buttons drawn from the flags are buttons that work; buttons drawn
   * for every session would be controls that do nothing on most of them.
   */
  canNext: boolean;
  canPrevious: boolean;
  canSeek: boolean;
  /**
   * Every OTHER program on the machine that is playing right now, by app id,
   * this app's own left out.
   *
   * The bar shows one of them; this is the whole list, and it is here because
   * one player at a time has to hold between two programs that are both
   * somebody else's. Spotify playing and a Netflix tab started over it is two
   * things at once through one curve — the same fault as two of this app's
   * own players at once — and neither of them is a player this app could
   * notice starting from the single session it used to be told about: the one
   * it was told about is whichever Windows listed first, which is as likely
   * to be the one that was already going.
   */
  playing: string[];
  /**
   * Which picture the player published for this song, or empty for none yet.
   *
   * An id and not the picture: a reading goes out every second a song plays,
   * the picture is tens or hundreds of kilobytes that do not change for the
   * length of it, and the window fetches it once by this id
   * (`getSystemMediaCover`).
   */
  coverId: string;
}

/** What the watcher's cover line holds, as main keeps it. */
interface ISystemMediaCover {
  id: string;
  /** A `data:` URL, which the window's policy already admits for pictures. */
  url: string;
}

/** A cover's id: the first eight bytes of its MD5, in hex. */
const COVER_ID = /^[0-9a-f]{16}$/;

/**
 * The formats a cover may arrive in, which are the four the watcher sniffs.
 * Anything else is refused rather than guessed at: the picture comes from
 * another program's media session, and an `<img>` given a type it was not
 * built for is a question nobody needs to ask.
 */
const COVER_TYPES: ReadonlySet<string> = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

/** How a cover line starts, so a malformed one is never read as a reading. */
const COVER_LINE = '{"cover":';

/**
 * What the bar can ask another program's player to do.
 *
 * `pause` is the one that is not a button: it is sent when a player of this
 * app's starts, so that the machine's sound gets out of the way the same way
 * one of our own players does. A pause and never a toggle — a media key would
 * have *started* whatever was sitting there paused.
 */
export type TSystemMediaCommand =
  'next' | 'previous' | 'seek' | 'stop' | 'pause';

/**
 * The watcher's executable, where this platform has one. Windows alone
 * publishes media sessions this way.
 */
export const SYSTEM_MEDIA_EXECUTABLE =
  process.platform === 'win32' ? 'FluidEQ-Media.exe' : undefined;

const resourcesPath = (): string => {
  const { resourcesPath: found } = process as NodeJS.Process & {
    resourcesPath?: string;
  };
  return typeof found === 'string' ? found : '';
};

/**
 * The helper beside the packaged app, or in the native build's output in
 * development — looked for the way `findSystemVolumeExecutable` looks for
 * its own.
 */
export const findSystemMediaExecutable = (): string | undefined => {
  if (!SYSTEM_MEDIA_EXECUTABLE) {
    return undefined;
  }
  return [
    path.join(resourcesPath(), 'native', SYSTEM_MEDIA_EXECUTABLE),
    path.join(__dirname, '../../native/.build/bin', SYSTEM_MEDIA_EXECUTABLE),
    path.join(__dirname, '../../../native/.build/bin', SYSTEM_MEDIA_EXECUTABLE),
  ].find((candidate) => existsSync(candidate));
};

/**
 * Said once per run. With no helper — a development tree before its native
 * build — nothing is reported and nothing stands in for it, and the window
 * asks again every time its own players fall silent: a line each time would
 * bury the log.
 */
let missingHelperLogged = false;

let child: ChildProcess | undefined;

/**
 * Who to tell, and what was last said.
 *
 * BOTH EXIST BECAUSE THE WINDOW CAN BE RELOADED AND THE WATCHER CANNOT.
 *
 * A subscribe used to be dropped whenever a child was already running, which
 * meant the callback belonged to the FIRST window for the life of the process.
 * Reload the window — crash recovery, a dev restart, Ctrl+R — and the new one
 * asked for the watcher, was told it was already running, and then never
 * received a single snapshot: they were still being sent to a sender that no
 * longer existed. The bar said nothing was playing while a browser tab played,
 * and nothing short of quitting the app fixed it.
 *
 * The remembered snapshot is the other half. The child prints only when what
 * the bar would draw has changed, so a window arriving mid-song has to be told
 * where things stand rather than waiting for the next change — which for a
 * player that publishes no timeline is not one second away but the end of the
 * track.
 */
let notify: ((snapshot: ISystemMediaSnapshot | undefined) => void) | undefined;
let lastSnapshot: ISystemMediaSnapshot | undefined;
/**
 * The last cover the watcher sent, which is the only one anybody can be asking
 * for: the window asks by the id on the reading it has just been handed, and
 * the watcher sends a song's cover before that song's first reading.
 */
let lastCover: ISystemMediaCover | undefined;

/** The playing list: a list from the helper, a bare string where the
 * PowerShell watcher's JSON collapsed a list of one, or missing from an
 * older watcher. */
const playingApps = (value: unknown): string[] => {
  if (typeof value === 'string') {
    return value ? [value] : [];
  }
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(
    (entry): entry is string => typeof entry === 'string' && entry.length > 0,
  );
};

/** Parse one line of the watcher's output. Anything unrecognised is nothing
 * playing, which is also what the script prints when a session throws. */
export const parseSystemMediaLine = (
  line: string,
): ISystemMediaSnapshot | undefined => {
  const trimmed = line.trim();
  if (!trimmed || trimmed === 'null') {
    return undefined;
  }
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (typeof parsed !== 'object' || parsed === null) {
      return undefined;
    }
    const record = parsed as Record<string, unknown>;
    const title = typeof record.title === 'string' ? record.title : '';
    if (!title) {
      // A session with no title is a player that registered and has nothing
      // loaded. There is nothing to put on a bar.
      return undefined;
    }
    return {
      app: typeof record.app === 'string' ? record.app : '',
      title,
      artist: typeof record.artist === 'string' ? record.artist : '',
      isPlaying: record.isPlaying === true,
      positionMs:
        typeof record.positionMs === 'number' && record.positionMs > 0
          ? record.positionMs
          : 0,
      durationMs:
        typeof record.durationMs === 'number' && record.durationMs > 0
          ? record.durationMs
          : 0,
      // Absent is "no", for a payload from an older watcher or a session that
      // answered nothing: a button that is not drawn is a button nobody
      // presses in vain.
      canNext: record.canNext === true,
      canPrevious: record.canPrevious === true,
      canSeek: record.canSeek === true,
      // One app id comes back as a bare string rather than a list of one:
      // PowerShell's own JSON does that to a single-element array, and a
      // reader that only understood the list would go blind exactly when one
      // program is playing — which is every ordinary moment before a second
      // one starts.
      playing: playingApps(record.playing),
      // Absent from an older watcher, and anything that is not an id is no
      // cover at all rather than a key the window would ask main for in vain.
      coverId:
        typeof record.coverId === 'string' && COVER_ID.test(record.coverId)
          ? record.coverId
          : '',
    };
  } catch {
    return undefined;
  }
};

/** Whether a line of the watcher's is a cover rather than a reading. */
export const isSystemMediaCoverLine = (line: string): boolean =>
  line.trimStart().startsWith(COVER_LINE);

/**
 * Read one cover line, or nothing if any part of it is not what the watcher
 * writes. Every part is checked, because the bytes are another program's.
 */
export const parseSystemMediaCover = (
  line: string,
): ISystemMediaCover | undefined => {
  if (!isSystemMediaCoverLine(line)) {
    return undefined;
  }
  try {
    const parsed: unknown = JSON.parse(line.trim());
    if (typeof parsed !== 'object' || parsed === null) {
      return undefined;
    }
    const { cover } = parsed as Record<string, unknown>;
    if (typeof cover !== 'object' || cover === null) {
      return undefined;
    }
    const { id, type, data } = cover as Record<string, unknown>;
    if (
      typeof id !== 'string' ||
      !COVER_ID.test(id) ||
      typeof type !== 'string' ||
      !COVER_TYPES.has(type) ||
      typeof data !== 'string' ||
      !BASE64.test(data)
    ) {
      return undefined;
    }
    return { id, url: `data:${type};base64,${data}` };
  } catch {
    return undefined;
  }
};

/**
 * Start reporting what the machine is playing.
 *
 * One child, however many times this is asked for: the window asks whenever
 * its own players fall silent, which can happen twice in a row for one pause,
 * and a second child would be a second helper told about the same sessions.
 *
 * But the LISTENER is replaced every time, and the caller is answered with
 * what is playing right now before this returns. See `notify` for the reload
 * this is the whole point of.
 *
 * `locate` is the tests' way in; the app always looks where the build puts
 * the helper.
 */
export const watchSystemMedia = (
  onSnapshot: (snapshot: ISystemMediaSnapshot | undefined) => void,
  locate: () => string | undefined = findSystemMediaExecutable,
): void => {
  notify = onSnapshot;
  if (child) {
    // Already watching, for somebody else. Hand the new subscriber the state
    // rather than making it wait for the next change.
    onSnapshot(lastSnapshot);
    return;
  }

  const executable = locate();
  if (!executable) {
    // No fallback poll. The PowerShell loop this replaced is exactly what the
    // helper exists not to be, and a second way of reading the same thing is
    // a second thing to keep in step; the bar shows the app's own players,
    // as it would on a machine with nothing else playing.
    if (!missingHelperLogged) {
      missingHelperLogged = true;
      log.warn(
        'Other apps’ media is not reported: FluidEQ-Media.exe was not found (it is built with the native helpers).',
      );
    }
    return;
  }

  // The app's own id is the helper's one argument, so the rule that looks
  // past this app's sessions (`SELF_SKIP`) reads the same id on both sides.
  // Nobody reads its stderr, so it is not a pipe that could fill.
  const started = spawn(executable, [APP_ID], {
    stdio: ['pipe', 'pipe', 'ignore'],
    windowsHide: true,
  });
  child = started;

  let pending = '';
  // Decoded by the stream, never chunk by chunk. The helper writes UTF-8, and
  // a pipe read can end in the middle of a character: decoding each chunk on
  // its own turns both halves of that character into replacement marks, in
  // the middle of a title.
  started.stdout?.setEncoding('utf8');
  started.stdout?.on('data', (chunk: string) => {
    // A helper that was stopped can still print before it is gone — an event
    // landing as its input closed — and that reading is not the current
    // helper's to hand on.
    if (started !== child) {
      return;
    }
    pending += chunk;
    const lines = pending.split(/\r?\n/);
    pending = lines.pop() ?? '';
    lines.forEach((line) => {
      if (!line.trim()) {
        return;
      }
      // A cover is kept, never forwarded as a reading. One that fails its
      // checks is dropped here too: read as a reading it would parse as
      // "nothing playing" and blank the bar in the middle of a song.
      if (isSystemMediaCoverLine(line)) {
        lastCover = parseSystemMediaCover(line) ?? lastCover;
        return;
      }
      lastSnapshot = parseSystemMediaLine(line);
      // `notify` rather than `onSnapshot`: this child outlives the window that
      // started it, and the reading must go to whoever is listening NOW.
      notify?.(lastSnapshot);
    });
  });

  // Closing this input is how the helper is stopped. A helper that has
  // already gone makes the close fail, and its exit already said so.
  started.stdin?.on('error', () => undefined);

  const ended = () => {
    // Only the CURRENT watcher's death means anything. A window reload stops
    // this child and starts the next one at once, and this exit is delivered
    // only once the old helper has actually gone — after the new one is
    // already running. Taken as the current child's, it cleared the new child
    // out of the module while it kept running: the fresh window was told
    // nothing was playing in the middle of a song, the next subscribe started
    // a third watcher, and the second one was never stopped, because stop
    // only reaches the child it knows about.
    if (child !== started) {
      return;
    }
    child = undefined;
    lastSnapshot = undefined;
    lastCover = undefined;
    notify?.(undefined);
  };
  started.on('error', (error) => {
    log.info('The media helper could not start', error);
    ended();
  });
  started.on('exit', ended);
};

/**
 * The picture for a cover id the window was just handed, or nothing when that
 * cover is no longer the current one — a song that changed between the
 * reading and the ask, which is the window's cue not to draw it.
 */
export const getSystemMediaCover = (id: string): string | undefined =>
  lastCover?.id === id ? lastCover.url : undefined;

/** Stop reporting. The bar has an owner of its own again, or the window has
 * gone. */
export const stopWatchingSystemMedia = (): void => {
  // Its input closing is what ends the helper — the same end it meets when
  // the app itself goes, however it goes — and it lets go of Windows' event
  // subscriptions on the way out rather than being cut off holding them.
  child?.stdin?.end();
  child = undefined;
  // Cleared with the child: a reading kept past the watcher's life would be
  // handed to the next subscriber as though it were current, and it would name
  // whatever was playing whenever this was last switched off.
  lastSnapshot = undefined;
  lastCover = undefined;
  notify = undefined;
};

/**
 * Ask the current session to skip, stop, or move its playhead.
 *
 * A process per press, and that is the right trade: these are a few buttons
 * somebody clicks occasionally, the watcher's loop must not stall waiting on
 * a command, and a command that had to travel down the watcher's stdin would
 * be a protocol between two programs where a one-line script does.
 *
 * Play and pause do NOT come through here — they go out as a media key (see
 * `mediaKeys`), which reaches every player on Windows including the ones that
 * never registered a session at all.
 *
 * The position is absolute and in milliseconds; the API takes ticks of 100ns,
 * which is the only unit conversion in this file and the reason it is written
 * out rather than inlined.
 */
export const sendSystemMediaCommand = async (
  command: TSystemMediaCommand,
  positionMs?: number,
): Promise<void> => {
  const commandScript = (() => {
    if (command === 'next') {
      return 'Await ($session.TrySkipNextAsync()) ([bool]) | Out-Null';
    }
    if (command === 'previous') {
      return 'Await ($session.TrySkipPreviousAsync()) ([bool]) | Out-Null';
    }
    if (command === 'pause') {
      return 'Await ($session.TryPauseAsync()) ([bool]) | Out-Null';
    }
    if (command === 'stop') {
      // Chrome pages and Spotify commonly expose pause and seek without
      // advertising Stop. Give them the same stop-and-rewind behavior rather
      // than drawing a button that silently does nothing.
      return `
$stopped = Await ($session.TryStopAsync()) ([bool])
if (-not $stopped) {
  Await ($session.TryPauseAsync()) ([bool]) | Out-Null
  $controls = $session.GetPlaybackInfo().Controls
  if ($controls.IsPlaybackPositionEnabled) {
    Await ($session.TryChangePlaybackPositionAsync([long]0)) ([bool]) | Out-Null
  }
}`;
    }
    const ticks = Math.max(0, Math.round((positionMs ?? 0) * 10_000));
    return `Await ($session.TryChangePlaybackPositionAsync([long]${ticks})) ([bool]) | Out-Null`;
  })();

  const script = `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Runtime.WindowsRuntime | Out-Null
$asTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
  $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and
  $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation\`1'
})[0]
function Await($op, $type) {
  $task = $asTask.MakeGenericMethod($type).Invoke($null, @($op))
  if (-not $task.Wait(4000)) { return $null }
  $task.Result
}
$managerType = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType = WindowsRuntime]
$manager = Await ($managerType::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])
if (-not $manager) { exit 1 }
${SELF_SKIP}
$session = Select-OtherSession $manager
if (-not $session) { exit 1 }
${commandScript}
`;

  await new Promise<void>((resolve) => {
    const runner = spawn(
      POWERSHELL_PATH,
      [
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-Command',
        script,
      ],
      { windowsHide: true },
    );
    // Resolved either way. Windows answers a refused command with `false` and
    // a session that has gone with nothing at all, and neither is something
    // the window could show or act on.
    runner.on('exit', () => resolve());
    runner.on('error', () => resolve());
  });
};

/**
 * Quieten every program that is playing, sparing the one named — or all of
 * them, when nothing is named.
 *
 * ONE PLAYER AT A TIME, WHOEVER THE PLAYERS ARE. The rule used to reach only
 * as far as this app's own: start a song here and ONE of the machine's
 * players was asked to stop, start something out there and ours stopped.
 * Spotify playing while a Netflix tab starts is the same fault — two things
 * at once through one curve — with neither of them ours, and nothing stopped
 * either; and a song started here with two of them already playing stopped
 * whichever one Windows happened to list first.
 *
 * One run for the whole round rather than one per program: each of these is a
 * PowerShell process, and a machine with four players would otherwise pay
 * four of them for one press of play.
 *
 * THE APP ID TRAVELS IN THE ENVIRONMENT, NEVER IN THE SCRIPT. It is Windows'
 * own string, but it reaches here from the window, and a window that could
 * put text inside this script would be a window writing PowerShell. Nothing
 * quotes an environment variable wrong. An empty one spares nobody, which no
 * real app id can be.
 */
export const pauseOtherSystemPlayers = async (
  exceptApp: string,
): Promise<void> => {
  const script = `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Runtime.WindowsRuntime | Out-Null
$asTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
  $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and
  $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation\`1'
})[0]
function Await($op, $type) {
  $task = $asTask.MakeGenericMethod($type).Invoke($null, @($op))
  if (-not $task.Wait(4000)) { return $null }
  $task.Result
}
$managerType = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType = WindowsRuntime]
$manager = Await ($managerType::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])
if (-not $manager) { exit 1 }
$selfId = '${APP_ID}'
$except = [string]$env:FLUIDEQ_MEDIA_EXCEPT
foreach ($candidate in @($manager.GetSessions())) {
  try {
    $id = [string]$candidate.SourceAppUserModelId
    if ($id -eq $selfId -or $id -eq $except) { continue }
    if ("$($candidate.GetPlaybackInfo().PlaybackStatus)" -ne 'Playing') { continue }
    Await ($candidate.TryPauseAsync()) ([bool]) | Out-Null
  } catch {
  }
}
`;

  await new Promise<void>((resolve) => {
    const runner = spawn(
      POWERSHELL_PATH,
      [
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-Command',
        script,
      ],
      {
        windowsHide: true,
        env: { ...process.env, FLUIDEQ_MEDIA_EXCEPT: exceptApp },
      },
    );
    // Same as every command here: a player that refuses, or one that has gone
    // between the reading and the asking, is not something a window could act
    // on.
    runner.on('exit', () => resolve());
    runner.on('error', () => resolve());
  });
};
