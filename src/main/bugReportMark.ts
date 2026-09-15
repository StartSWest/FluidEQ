/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Where the last delivered bug report's logs ended, so the next one's begin
 * there.
 *
 * One small file in the app's data folder holding one moment: when the logs
 * of the last report that actually left the machine were gathered. The
 * report gathers first and is delivered later — copied, mailed, opened as an
 * issue — and a dialog closed without any of that must not move the mark, or
 * the lines it showed would be in no report at all. So the mark is written
 * only when the window says a report went out, with the gather moment that
 * report carried.
 */

import fs from 'fs';
import path from 'path';
import log from 'electron-log';

const MARK_FILE = 'bug-report-mark.json';

interface IBugReportMark {
  /** ISO moment the last delivered report's logs were gathered. */
  gatheredAt: string;
}

const isMark = (value: unknown): value is IBugReportMark =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as { gatheredAt?: unknown }).gatheredAt === 'string' &&
  !Number.isNaN(Date.parse((value as { gatheredAt: string }).gatheredAt));

/** The moment the last delivered report's logs were gathered, or undefined. */
export const readBugReportMark = async (
  userDataDir: string,
): Promise<string | undefined> => {
  try {
    const text = await fs.promises.readFile(
      path.join(userDataDir, MARK_FILE),
      'utf8',
    );
    const parsed: unknown = JSON.parse(text);
    return isMark(parsed) ? parsed.gatheredAt : undefined;
  } catch (error) {
    // No file is the ordinary state of a machine nobody has reported from;
    // anything else is worth a line, since it silently turns the next report
    // into "everything", which is long.
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      log.warn('The bug report mark could not be read', error);
    }
    return undefined;
  }
};

/** Records that a report gathered at `gatheredAt` has left the machine. */
export const writeBugReportMark = async (
  userDataDir: string,
  gatheredAt: string,
): Promise<void> => {
  if (Number.isNaN(Date.parse(gatheredAt))) {
    log.warn(`Refusing a bug report mark that is not a time: ${gatheredAt}`);
    return;
  }
  const mark: IBugReportMark = { gatheredAt };
  try {
    await fs.promises.writeFile(
      path.join(userDataDir, MARK_FILE),
      JSON.stringify(mark),
      'utf8',
    );
  } catch (error) {
    log.warn('The bug report mark could not be written', error);
  }
};
