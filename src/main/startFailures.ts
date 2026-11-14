/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import fs from 'fs';
import path from 'path';
import writeFileAtomically from './atomicWrite';

/**
 * WHETHER A FATAL ERROR IN MAIN IS A START THAT KEEPS FAILING.
 *
 * 2.5.2 closed itself about five seconds into every launch on Ivan's machine
 * (2026-11-14): a helper Windows refused to start called back into a value
 * still being assigned, the fatal handler relaunched once, the relaunch died
 * the same way, and the window simply never stayed. Nothing told him why.
 *
 * Every launch writes when it began. A fatal error within START_WINDOW_MS of
 * that is a failed start and is counted; a later one is not, and clears the
 * count. Below START_FAILURE_LIMIT failed starts in a row the process is
 * relaunched as before; at the limit it is relaunched into the report window
 * instead (`startFailureReport.ts`), which says what went wrong and offers
 * the bug report, and does not start the app. A quit the user asked for
 * clears the count, and so does the report window's Try again.
 *
 * All of it is decided from the clock at the moment of the launch and of the
 * error, read from a file in userData; nothing waits on a timer.
 */
/** The argument a process relaunched only for the report window carries. */
export const START_REPORT_ARGUMENT = '--fluideq-start-report';
export const START_WINDOW_MS = 60_000;
export const START_FAILURE_LIMIT = 3;
const FILE_NAME = 'start-failures.json';
const CAUSE_LIMIT = 400;

export interface IStartFailures {
  /** When the current launch began (ms since epoch). */
  launchedAt?: number;
  /** Failed starts in a row, this one included once counted. */
  failedStarts: number;
  /** The last failed start's error, one line. */
  cause?: string;
}

/**
 * What a fatal error leads to: the app again, the report window, or nothing
 * - a late fatal in a process that was itself a relaunch after one, which is
 * how a crash long after starting stays one relaunch rather than a loop.
 */
export type TFatalDecision = 'relaunch' | 'report' | 'stop';

/** Carried by a process relaunched after a fatal error. */
export const ERROR_RESTART_ARGUMENT = '--fluideq-error-restarted';

/** The arguments a relaunch into the app itself is given, its own marks off. */
export const appRelaunchArguments = (argv: readonly string[]) =>
  argv
    .slice(1)
    .filter(
      (arg) => arg !== START_REPORT_ARGUMENT && arg !== ERROR_RESTART_ARGUMENT,
    );

const fileOf = (userDataDir: string) => path.join(userDataDir, FILE_NAME);

export const readStartFailures = (userDataDir: string): IStartFailures => {
  try {
    const value: unknown = JSON.parse(
      fs.readFileSync(fileOf(userDataDir), 'utf8'),
    );
    if (typeof value !== 'object' || value === null) {
      return { failedStarts: 0 };
    }
    const raw = value as Record<string, unknown>;
    const count = Number(raw.failedStarts);
    return {
      launchedAt:
        typeof raw.launchedAt === 'number' && Number.isFinite(raw.launchedAt)
          ? raw.launchedAt
          : undefined,
      failedStarts:
        Number.isInteger(count) && count > 0 ? Math.min(count, 99) : 0,
      cause: typeof raw.cause === 'string' ? raw.cause : undefined,
    };
  } catch {
    // No file yet, or one that cannot be read: a first launch.
    return { failedStarts: 0 };
  }
};

const write = (userDataDir: string, state: IStartFailures) => {
  try {
    writeFileAtomically(fileOf(userDataDir), JSON.stringify(state, null, 2));
  } catch {
    // A start counter that cannot be written must never be what stops a
    // launch or a fatal exit; the worst it costs is one relaunch too many.
  }
};

/** The first line of an error, as the report window and the log name it. */
export const causeLine = (reason: unknown): string => {
  const text =
    reason instanceof Error
      ? `${reason.name}: ${reason.message}`
      : String(reason);
  const line = text.split(/\r?\n/)[0].trim();
  return line.length > CAUSE_LIMIT ? `${line.slice(0, CAUSE_LIMIT)}…` : line;
};

/** A launch begins: kept with the count of failed starts before it. */
export const markLaunch = (userDataDir: string, now: number) => {
  write(userDataDir, { ...readStartFailures(userDataDir), launchedAt: now });
};

/**
 * A fatal error in main: counted if it came within the start window, and
 * what to do next.
 */
export const recordFatal = (
  userDataDir: string,
  now: number,
  reason: unknown,
  /** This process was itself relaunched after a fatal error. */
  wasRestarted = false,
): { decision: TFatalDecision; state: IStartFailures } => {
  const before = readStartFailures(userDataDir);
  const isStart =
    before.launchedAt !== undefined &&
    now >= before.launchedAt &&
    now - before.launchedAt <= START_WINDOW_MS;
  const state: IStartFailures = {
    launchedAt: before.launchedAt,
    failedStarts: isStart ? before.failedStarts + 1 : 0,
    cause: isStart ? causeLine(reason) : before.cause,
  };
  write(userDataDir, state);
  let decision: TFatalDecision = 'relaunch';
  if (state.failedStarts >= START_FAILURE_LIMIT) {
    decision = 'report';
  } else if (!isStart && wasRestarted) {
    decision = 'stop';
  }
  return { decision, state };
};

/** A start that ended well (a quit asked for, or Try again): count cleared. */
export const clearStartFailures = (userDataDir: string) => {
  const before = readStartFailures(userDataDir);
  if (before.failedStarts === 0 && before.cause === undefined) {
    return;
  }
  write(userDataDir, { launchedAt: before.launchedAt, failedStarts: 0 });
};
