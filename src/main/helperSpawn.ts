/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import electronLog from 'electron-log';
import { syncLogLine } from './syncLog';

type TLog = Pick<typeof electronLog, 'error'>;

/**
 * A helper process started so that Windows refusing it is the helper being
 * off, never FluidEQ closing (2.5.2, 2026-11-14: a helper whose start threw
 * took the whole app down five seconds into every launch).
 *
 * `spawn` and `utilityProcess.fork` mostly report a failure as the child's
 * `error` event, which every helper here listens for; but they throw,
 * synchronously, when the operating system refuses the process outright, and
 * a throw from inside a starter reaches whatever called it — an IPC handler,
 * an event, a promise — and from there the fatal handler. Here it is one line
 * in the log, in the shape every start failure takes:
 *
 *   <helper>: could not start (<why>); <what happens next>.
 *
 * (by default that it stays off until FluidEQ starts again; a helper that is
 * asked for again says so) and `undefined`, which each caller treats as it treats a helper that is
 * not installed. The start is passed in, so each caller keeps the exact type
 * of the process it starts.
 */
export const startHelper = <TProcess>(
  name: string,
  start: () => TProcess,
  next = 'it stays off until FluidEQ starts again',
  log: TLog = electronLog,
): TProcess | undefined => {
  try {
    return start();
  } catch (error) {
    log.error(
      syncLogLine({
        feed: name,
        what: 'could not start',
        why: error instanceof Error ? error.message : String(error),
        next,
      }),
    );
    return undefined;
  }
};
