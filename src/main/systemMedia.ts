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
 * REACHED THROUGH POWERSHELL, AND THAT IS NOT LAZINESS. The API is WinRT, and
 * calling WinRT from Node needs a native addon; the maintained ones do not
 * exist and an unmaintained one is a compiled dependency in a signed,
 * paid-for build. Windows PowerShell projects the same namespace natively, so
 * the whole of the integration is a script and a pipe — nothing to compile,
 * nothing to sign, and nothing that can fail to load on somebody else's
 * machine.
 *
 * POLLED, AND THAT IS NOT LAZINESS EITHER. Measured on this machine:
 * `Register-ObjectEvent` against either the manager or a session answers
 * "Windows PowerShell cannot subscribe to Windows RT events", so there is no
 * push to listen to from here. The loop lives inside the child, prints only
 * when something the bar shows has actually changed, and stops the moment the
 * window says it no longer needs it.
 */

import { ChildProcess, spawn } from 'child_process';
import { POWERSHELL_PATH } from './powershell';

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
   * for every session would be three that do nothing on most of them.
   */
  canNext: boolean;
  canPrevious: boolean;
  canSeek: boolean;
}

/** The three things the bar can ask another program's player to do. */
export type TSystemMediaCommand = 'next' | 'previous' | 'seek';

/**
 * The watcher, as one PowerShell script.
 *
 * Passed as an argument rather than written to a file: a script on disk is a
 * file to keep in step with the code that spawns it, and a temporary one is a
 * file to leave behind on a crash.
 *
 * The comparison at the bottom is what keeps this quiet. A player publishes a
 * timeline that advances continuously, so printing every reading would be a
 * line every cycle forever; the bar needs the position to move, but a second's
 * worth of drift is invisible on a seek bar and worth nothing on the wire.
 */
const WATCH_SCRIPT = `
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
$propsType = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties]
$manager = Await ($managerType::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])
if (-not $manager) { exit 1 }

$last = ''
while ($true) {
  $line = 'null'
  try {
    $session = $manager.GetCurrentSession()
    if ($session) {
      $info = $session.GetPlaybackInfo()
      $props = Await ($session.TryGetMediaPropertiesAsync()) $propsType
      $timeline = $session.GetTimelineProperties()
      $controls = $info.Controls
      $payload = [pscustomobject]@{
        app = [string]$session.SourceAppUserModelId
        title = [string]$props.Title
        artist = [string]$props.Artist
        isPlaying = ("$($info.PlaybackStatus)" -eq 'Playing')
        positionMs = [int]$timeline.Position.TotalMilliseconds
        durationMs = [int]$timeline.EndTime.TotalMilliseconds
        canNext = [bool]$controls.IsNextEnabled
        canPrevious = [bool]$controls.IsPreviousEnabled
        canSeek = [bool]$controls.IsPlaybackPositionEnabled
      }
      $line = $payload | ConvertTo-Json -Compress
    }
  } catch {
    $line = 'null'
  }

  # Only what the bar would draw differently. The position is compared in
  # whole seconds for the same reason the bar shows whole seconds.
  $shape = $line
  if ($line -ne 'null') {
    $parsed = $line | ConvertFrom-Json
    $shape = "$($parsed.app)|$($parsed.title)|$($parsed.artist)|$($parsed.isPlaying)|$([int]($parsed.positionMs / 1000))|$($parsed.durationMs)|$($parsed.canNext)$($parsed.canPrevious)$($parsed.canSeek)"
  }
  if ($shape -ne $last) {
    $last = $shape
    [Console]::Out.WriteLine($line)
    [Console]::Out.Flush()
  }

  Start-Sleep -Milliseconds 700
}
`;

let child: ChildProcess | undefined;

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
    };
  } catch {
    return undefined;
  }
};

/**
 * Start reporting what the machine is playing.
 *
 * Idempotent on purpose: the window asks for this whenever its own players
 * fall silent, which can happen twice in a row for one pause, and a second
 * child would be a second PowerShell reading the same sessions.
 */
export const watchSystemMedia = (
  onSnapshot: (snapshot: ISystemMediaSnapshot | undefined) => void,
): void => {
  if (child) {
    return;
  }

  child = spawn(
    POWERSHELL_PATH,
    [
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-Command',
      WATCH_SCRIPT,
    ],
    { windowsHide: true },
  );

  let pending = '';
  child.stdout?.on('data', (chunk: Buffer) => {
    pending += chunk.toString('utf8');
    const lines = pending.split(/\r?\n/);
    pending = lines.pop() ?? '';
    lines.forEach((line) => {
      if (line.trim()) {
        onSnapshot(parseSystemMediaLine(line));
      }
    });
  });

  // Nothing is logged from stderr on purpose. The script's own `catch` prints
  // `null` for a session it could not read, which is the honest answer and
  // already handled; a machine with the namespace missing would otherwise
  // write a stack trace on every cycle.
  child.on('exit', () => {
    child = undefined;
    onSnapshot(undefined);
  });
};

/** Stop reporting. The bar has an owner of its own again, or the window has
 * gone. */
export const stopWatchingSystemMedia = (): void => {
  child?.kill();
  child = undefined;
};

/**
 * Ask the current session to skip or to move its playhead.
 *
 * A process per press, and that is the right trade: these are three buttons
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
  const call = (() => {
    if (command === 'next') {
      return '$session.TrySkipNextAsync()';
    }
    if (command === 'previous') {
      return '$session.TrySkipPreviousAsync()';
    }
    const ticks = Math.max(0, Math.round((positionMs ?? 0) * 10_000));
    return `$session.TryChangePlaybackPositionAsync([long]${ticks})`;
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
$session = $manager.GetCurrentSession()
if (-not $session) { exit 1 }
Await (${call}) ([bool]) | Out-Null
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
