/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * One gate for everything the app does to the machine by itself.
 *
 * Four things run the setup helper without anybody pressing a button:
 * Equalizer APO switched off at an engine switch and again from the output
 * list, the engine's installation repaired from a status read, and repaired
 * again from the window once sound has been heard past an engine that never
 * ran. Each is one Windows permission prompt and one restart of Windows
 * audio, and each kept its own "once" — so two of them could reach the same
 * conclusion from the same facts seconds apart and put two prompts on
 * screen, then restart every stream on the machine twice, for one user
 * action. A prompt declined on the first was no defence against the second.
 *
 * So every automatic run asks here first. Two rules: nothing automatic
 * starts while another automatic run is in flight, and each kind of run
 * happens once a session — except that switching Equalizer APO off and
 * putting it back are each other's undo, so one of them makes the other
 * possible again, or a user could not switch engines twice in one sitting.
 *
 * Main-side, because main is the one place both the window's requests and
 * main's own reads pass through; the window asks whether its repair is still
 * wanted rather than deciding for itself.
 */

import log from 'electron-log';

export type TAutomaticSetup = 'suspend-apo' | 'restore-apo' | 'install';

/** What makes one kind of run possible again. */
const UNDONE_BY: Partial<Record<TAutomaticSetup, TAutomaticSetup>> = {
  'suspend-apo': 'restore-apo',
  'restore-apo': 'suspend-apo',
};

export interface IAutomaticSetup {
  /**
   * Runs `work` unless another automatic run is in flight or this kind has
   * already run this session; returns undefined when it did not run, which
   * every caller treats as "already handled", never as a failure.
   */
  attempt: <T>(
    kind: TAutomaticSetup,
    work: () => Promise<T>,
  ) => Promise<T | undefined>;
  /** Whether `kind` would run right now — for a window deciding to ask. */
  wanted: (kind: TAutomaticSetup) => boolean;
}

export const createAutomaticSetup = (): IAutomaticSetup => {
  let inFlight: TAutomaticSetup | undefined;
  const done = new Set<TAutomaticSetup>();

  const wanted = (kind: TAutomaticSetup): boolean =>
    inFlight === undefined && !done.has(kind);

  return {
    wanted,
    attempt: async (kind, work) => {
      if (!wanted(kind)) {
        log.info(
          `Automatic ${kind} skipped: ${
            inFlight
              ? `${inFlight} is still running`
              : 'already run this session'
          }`,
        );
        return undefined;
      }
      inFlight = kind;
      done.add(kind);
      const undone = UNDONE_BY[kind];
      if (undone) {
        done.delete(undone);
      }
      try {
        return await work();
      } finally {
        inFlight = undefined;
      }
    },
  };
};

export default createAutomaticSetup;
