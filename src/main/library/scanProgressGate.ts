/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ILibraryScanProgress } from '../../common/library/types';

/**
 * Which of a scan's progress reports are worth carrying to another process.
 *
 * The walk reports every file it touches (`reportProgress`), which is what a
 * cancel check and the scanner's own tests want. Carried as it was, that was
 * a message per file from the worker to main and another from main to the
 * window, in both phases: twenty-eight thousand of each for an unchanged
 * library of fourteen thousand songs, every one handled on main between the
 * replies the window was waiting for. The strip that shows them is redrawn at
 * most once a frame (`LibraryContext`) and reads "6,712 of 14,077".
 *
 * So the first report goes (it puts the strip on screen), and the last (it
 * takes the strip off), and in between: while discovering, one per folder
 * the walk enters; once parsing, the first, then one whenever the whole
 * percentage moves; after every batch of tracks sent, the next — a slow file,
 * a large video or a network share, flushes a batch of its own, so a slow
 * walk still reports every file; and at the latest every `EVERY_FILES` files,
 * so a folder of thousands or a percent of a large library never holds the
 * strip still. Counts and the walk's own events decide, never a clock.
 */
const EVERY_FILES = 32;

const percentOf = (progress: ILibraryScanProgress): number =>
  progress.seen > 0 ? Math.floor((progress.parsed * 100) / progress.seen) : 0;

export interface IScanProgressGate {
  /** Hand every report here; the ones worth carrying are passed on. */
  progress: (next: ILibraryScanProgress) => void;
  /** Say a batch of tracks has just gone out, so the next report follows it. */
  tracksSent: () => void;
}

export const gateScanProgress = (
  send: (progress: ILibraryScanProgress) => void,
): IScanProgressGate => {
  let last: ILibraryScanProgress | undefined;
  let batchSent = false;

  const isWorthSending = (next: ILibraryScanProgress): boolean => {
    if (!last || next.isDone || batchSent) {
      return true;
    }
    if (next.parsed === 0) {
      return (
        next.current !== last.current ||
        next.seen + next.karaokeSkipped - (last.seen + last.karaokeSkipped) >=
          EVERY_FILES
      );
    }
    return (
      last.parsed === 0 ||
      percentOf(next) !== percentOf(last) ||
      next.parsed - last.parsed >= EVERY_FILES
    );
  };

  return {
    progress: (next) => {
      if (!isWorthSending(next)) {
        return;
      }
      last = next;
      batchSent = false;
      send(next);
    },
    tracksSent: () => {
      batchSent = true;
    },
  };
};
