/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import log from 'electron-log';

/**
 * Whether a watching helper that ended by itself is started again, for the
 * helpers the window asks for once and keeps: what other apps are playing
 * (`systemMedia.ts`) and the output's volume (`systemVolume.ts`).
 *
 * PUT BACK, because nothing else would. Each is asked for when its part of
 * the window appears and kept while it shows, so one that ended left that
 * part blind for as long as it stayed up. The media helper did, in the
 * installed app after hours of running, with no crash on record and nothing
 * in the app asking it to stop (Ivan, 2026-10-01): Spotify's play and pause
 * went quiet on the bar, and a song started in the Library no longer paused
 * Spotify, because whether anything else is playing is that helper's to say.
 *
 * Not one that never printed anything: that is a helper that cannot run here,
 * and starting it again would only end the same way. Nor more than
 * `REPLACED_IN_A_ROW_MAX` in a row that each ended before printing a second,
 * different line; one that has followed a change holds, and starts the count
 * again.
 */
export const REPLACED_IN_A_ROW_MAX = 3;

/** One run of a helper, from its start to its end. */
export interface IHelperRun {
  /** A line it printed; a line that differs from the one before counts. */
  heard: (line: string) => void;
  /**
   * It ended by itself — never called for a stop the app asked for, which
   * lets go of the helper first and is how "nobody wants it any more" is
   * said. Says so in the log, with `how` (its exit code or the failure to
   * start), and answers whether to start another.
   */
  ended: (how: string) => boolean;
}

export interface IHelperReplacement {
  /** The window asked for the helper afresh: the count starts again. */
  asked: () => void;
  /** A helper has just been started. */
  run: () => IHelperRun;
}

/** `name` is how the log calls the helper. */
export const createHelperReplacement = (name: string): IHelperReplacement => {
  let replacedInARow = 0;
  return {
    asked: () => {
      replacedInARow = 0;
    },
    run: () => {
      // For the log alone: how long a helper that ended had run.
      const startedAt = Date.now();
      let readings = 0;
      let lastLine: string | undefined;
      return {
        heard: (line) => {
          if (line === lastLine) {
            return;
          }
          lastLine = line;
          readings += 1;
          if (readings === 2) {
            replacedInARow = 0;
          }
        },
        ended: (how) => {
          const replace =
            readings > 0 && replacedInARow < REPLACED_IN_A_ROW_MAX;
          // Said every time: nothing else records why a helper went.
          log.warn(
            `The ${name} ended by itself after ${Math.round(
              (Date.now() - startedAt) / 1000,
            )} s and ${readings} readings (${how}); ${
              replace ? 'starting another' : 'not starting another'
            }`,
          );
          if (replace) {
            replacedInARow += 1;
          }
          return replace;
        },
      };
    },
  };
};
