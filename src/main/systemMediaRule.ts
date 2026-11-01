/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * One player at a time between two of the machine's other programs, kept by
 * main beside the watcher that reads them (`ipc/systemMedia.ts`).
 *
 * It lived in the window, which was fine while the window never went away:
 * hidden in the tray it still read every change. A window let go in the tray
 * (`windowUnload.ts`) reads nothing, and Spotify and a Netflix tab played on
 * together until somebody opened FluidEQ again. The watcher was already
 * main's, so the rule is too; the window keeps only its own half — a player
 * of ours going quiet when something outside starts (`shouldYieldToSystem`),
 * which needs the window's players anyway.
 *
 * The switch is the window's (`singlePlayer.ts`), and it says every change,
 * and its state each time it loads; until it has, this takes the switch's own
 * default, on.
 */
import type { ISystemMediaSnapshot } from './systemMedia';

/**
 * The program that just started over another that was already playing, if
 * that is what happened — the one that keeps the sound while the rest are
 * asked to stop.
 *
 * The rule had a hole the size of the machine: it was always "ours against
 * theirs", so a Netflix tab started over a playing Spotify was two programs
 * at once through one curve and nothing stopped either. Both are somebody
 * else's and neither is on this app's register, so the only thing that can
 * separate them is which one just started.
 *
 * A TRANSITION, for the reason the rest of this rule is one: Windows
 * republishes a player's state when nothing has happened, and a list read as
 * a state would stop the album somebody is listening to because the app
 * blinked.
 *
 * AND NOTHING WHEN EVERY PLAYER IS NEW TO US, which is what the first reading
 * after this app opens looks like. Two programs found already playing is not
 * somebody pressing play — nobody pressed anything, which of them is the
 * newer is not knowable from here, and silencing one of them for opening an
 * equaliser would be the app taking a decision it was never asked for.
 */
export const startedOverOthers = (
  known: ReadonlySet<string>,
  playing: readonly string[],
): string | undefined => {
  const started = playing.filter((app) => !known.has(app));
  if (started.length === 0 || started.length === playing.length) {
    return undefined;
  }
  return started[started.length - 1];
};

export interface IExternalPlayerRule {
  /** Every reading the watcher makes, in order. */
  heard: (snapshot: ISystemMediaSnapshot | undefined) => void;
  setSinglePlayer: (isOn: boolean) => void;
  /** The switch as the window last said it, for Share Audio's rule. */
  isSinglePlayer: () => boolean;
}

export const createExternalPlayerRule = (
  pauseOthers: (exceptApp: string) => Promise<void>,
): IExternalPlayerRule => {
  /** Which programs were playing at the last reading. */
  let known: ReadonlySet<string> = new Set();
  let isSinglePlayer = true;
  return {
    heard: (snapshot) => {
      const playing = snapshot?.playing ?? [];
      const winner = startedOverOthers(known, playing);
      known = new Set(playing);
      if (winner !== undefined && isSinglePlayer) {
        // Nothing to tell anybody when Windows will not pause one: the next
        // reading says what is playing, as it does for every other outcome.
        pauseOthers(winner).catch(() => undefined);
      }
    },
    setSinglePlayer: (isOn) => {
      isSinglePlayer = isOn;
    },
    isSinglePlayer: () => isSinglePlayer,
  };
};
