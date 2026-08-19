/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

/**
 * The one-copy rule, extended across builds.
 *
 * `app.requestSingleInstanceLock` is keyed on the user data directory, and
 * development and the installed build do not share one: dev resolves its name
 * from `release/app/package.json` and lands in `%APPDATA%\fluideq-app`, while
 * the installed build is stamped with `productName` and lands in
 * `%APPDATA%\FluidEQ`. So Electron's lock stops two copies of the same build
 * and nothing else — while the thing it exists to prevent does not care which
 * build did it. Two processes write the same Equalizer APO config, each sees
 * the other's write as somebody editing the file from outside, and they spend
 * the session adopting each other.
 *
 * What they do share is `%APPDATA%` itself, one level above both data
 * directories, so a marker there is visible to either build.
 *
 * WHY NOT AN OPEN FILE HANDLE, which is the usual answer: Node opens files on
 * Windows with share-delete, so a second process can unlink a file the first
 * still holds. Measured, not assumed — the handle proves nothing about whether
 * anyone is alive.
 *
 * So the marker states a pid and a time, and both have to agree before this
 * refuses to start. The time is what makes it safe: a copy that crashed leaves
 * its marker behind, and a pid the operating system later hands to something
 * unrelated would otherwise lock the user out of their equaliser permanently.
 * A marker nobody has refreshed inside `MARKER_STALE_MS` belongs to nobody,
 * whatever its pid now points at.
 */

import fs from 'fs';

export interface IInstanceMarker {
  pid: number;
  /** Epoch milliseconds, rewritten on the interval below while the app runs. */
  at: number;
}

/**
 * How long a marker outlives its last refresh.
 *
 * Short on purpose. Every minute this is set to is a minute a crashed copy can
 * keep the next one out, and refusing to start is a far worse failure than the
 * confusion this prevents.
 */
export const MARKER_STALE_MS = 60_000;

/** Comfortably inside the staleness window, so a slow tick is not a handover. */
export const MARKER_REFRESH_MS = 20_000;

/** Whether a pid belongs to a process that still exists. */
export const isProcessAlive = (pid: number): boolean => {
  if (!Number.isInteger(pid) || pid <= 0) {
    return false;
  }
  try {
    // Signal 0 checks for the process without touching it.
    process.kill(pid, 0);
    return true;
  } catch (e) {
    // EPERM is a process that exists and is not ours to signal. Both builds run
    // as the same user so it should not arise, but "exists" is the answer.
    return (e as NodeJS.ErrnoException).code === 'EPERM';
  }
};

const readMarker = (markerPath: string): IInstanceMarker | undefined => {
  try {
    const input: unknown = JSON.parse(fs.readFileSync(markerPath, 'utf8'));
    if (
      typeof input !== 'object' ||
      input === null ||
      typeof (input as IInstanceMarker).pid !== 'number' ||
      typeof (input as IInstanceMarker).at !== 'number'
    ) {
      return undefined;
    }
    return input as IInstanceMarker;
  } catch {
    // No marker, or one nobody can parse. Either way nothing is claimed.
    return undefined;
  }
};

/**
 * Whether another copy of FluidEQ — any build — is running right now.
 *
 * The clock and the liveness check are arguments so this can be tested without
 * spawning processes or waiting a minute.
 *
 * FAILS OPEN BY CONSTRUCTION: every uncertain answer here is `false`. A missing
 * marker, an unreadable one, a stale one, a pid that no longer resolves — all
 * of them mean "start". The cost of a wrong `false` is the confusion this was
 * written to prevent; the cost of a wrong `true` is an equaliser that will not
 * open, and those are not the same size.
 */
export const isAnotherInstanceLive = (
  markerPath: string,
  {
    now = Date.now(),
    selfPid = process.pid,
    isAlive = isProcessAlive,
  }: {
    now?: number;
    selfPid?: number;
    isAlive?: (pid: number) => boolean;
  } = {},
): boolean => {
  const marker = readMarker(markerPath);
  if (!marker || marker.pid === selfPid) {
    return false;
  }
  if (now - marker.at > MARKER_STALE_MS || marker.at > now + MARKER_STALE_MS) {
    // Also refused when the marker is written in the future, which is what a
    // clock change looks like from here.
    return false;
  }
  return isAlive(marker.pid);
};

/**
 * Claim the marker for this process and keep it fresh.
 *
 * Returns the release, which is safe to call more than once — quitting runs
 * through several paths and none of them should have to know whether another
 * already ran.
 */
export const claimInstance = (
  markerPath: string,
  {
    selfPid = process.pid,
    now = () => Date.now(),
    setInterval: schedule = setInterval,
    clearInterval: unschedule = clearInterval,
  }: {
    selfPid?: number;
    now?: () => number;
    setInterval?: typeof setInterval;
    clearInterval?: typeof clearInterval;
  } = {},
): (() => void) => {
  const write = () => {
    try {
      const marker: IInstanceMarker = { pid: selfPid, at: now() };
      fs.writeFileSync(markerPath, JSON.stringify(marker), 'utf8');
    } catch {
      // A marker that cannot be written costs the cross-build check and
      // nothing else. Never let it stop the app starting.
    }
  };

  write();
  const timer = schedule(write, MARKER_REFRESH_MS);
  // Nothing here should hold the process open a moment longer than the window.
  timer.unref?.();

  let released = false;
  return () => {
    if (released) {
      return;
    }
    released = true;
    unschedule(timer);
    try {
      // Only ever our own. A marker another copy has since claimed is theirs.
      if (readMarker(markerPath)?.pid === selfPid) {
        fs.unlinkSync(markerPath);
      }
    } catch {
      // Left behind, and stale within the minute. Not worth failing a quit.
    }
  };
};
