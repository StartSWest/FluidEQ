/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ITrayRelaunch } from './nativeTray/trayHostWire';

/**
 * Electron leaving while FluidEQ goes on (the core split's 7b).
 *
 * The window already goes when it is put away with nothing to do
 * (`windowUnload.ts`); this is the step after it. FluidEQ-Tray holds the icon
 * and the engine's line (`nativeTray/`), and the engines go on applying what
 * main last wrote, so once main itself has nothing to do it tells the tray it
 * is leaving and ends — the tray starts it again when it is opened.
 *
 * WHAT HOLDS IT. A window, and every job main still does with no window:
 * each is named here, and any one keeps the process. They are the jobs left
 * to move out of Electron, so the list shrinks as they do. A hold nobody
 * releases keeps FluidEQ as it always was, never less.
 */

/** What keeps main running with no window; see the note above. */
export type TAppHold =
  /** A window: shown, hidden in the tray, or on its way. */
  | 'window'
  /** A job only main does yet, by name. */
  | `job:${string}`;

export interface IAppLeave {
  hold: (reason: TAppHold, isHeld: boolean) => void;
  /** What holds it now, for the log and a bug report. */
  holding: () => TAppHold[];
}

export interface IAppLeaveDeps {
  /** Whether there is a tray to leave FluidEQ with (`nativeTray/`). */
  canLeave: () => boolean;
  /** Winds main down and ends it, leaving the engines as they are. */
  leave: () => void;
  log: (message: string) => void;
}

export const createAppLeave = ({
  canLeave,
  leave,
  log,
}: IAppLeaveDeps): IAppLeave => {
  // The launch's own window holds it from the first moment: nothing may
  // leave before there has been a window to put away.
  const holds = new Set<TAppHold>(['window']);
  let isLeaving = false;

  const decide = () => {
    if (isLeaving || holds.size > 0 || !canLeave()) {
      return;
    }
    isLeaving = true;
    log('Nothing needs this process now: FluidEQ goes on from its tray.');
    leave();
  };

  return {
    hold: (reason, isHeld) => {
      if (isHeld) {
        holds.add(reason);
        return;
      }
      if (holds.delete(reason) && reason === 'window' && holds.size > 0) {
        // Said once, as the window goes, so a report can tell why FluidEQ
        // kept its Electron process with nothing on screen.
        log(`This process stays for: ${[...holds].join(', ')}.`);
      }
      decide();
    },
    holding: () => [...holds],
  };
};

/**
 * How the tray starts FluidEQ again: this program, as it was started, less
 * what made this launch a hidden one — a press on Open is somebody asking
 * for the window.
 */
export const relaunchCommand = (
  {
    execPath,
    argv,
    cwd,
  }: { execPath: string; argv: readonly string[]; cwd: string },
  hiddenArgs: readonly string[],
): ITrayRelaunch => ({
  file: execPath,
  args: argv.slice(1).filter((arg) => !hiddenArgs.includes(arg)),
  cwd,
});

export interface ILeaveToTrayDeps {
  /** The tray's menu as the tray will answer it alone (`tray.ts`). */
  showTrayForLeaving: () => void;
  /** What a quit winds down before it turns the engines off, and only it. */
  windDown: () => Promise<void>;
  /**
   * Hands the tray the relaunch (`nativeTray/`): true once it has been told,
   * false when its line had already ended.
   */
  tellTray: () => Promise<boolean>;
  /** Ends the process without `before-quit`, which would turn the engines off. */
  exit: () => void;
  /**
   * A fresh FluidEQ in the tray in this one's place: with the tray gone as
   * it was told, nothing would be left holding FluidEQ, and this process has
   * already wound down what it ran.
   */
  restart: () => void;
  log: (message: string, error?: unknown) => void;
}

/**
 * The leaving itself, in the order that keeps the sound: the tray's menu
 * first, so a press during the rest is the tray's; the quit's winding down,
 * so nothing is lost; the tray told; and only then the end. A tray that went
 * meanwhile cannot have been told — ending then would take FluidEQ with it,
 * and a FluidEQ that ends is one whose sound comes off — so a fresh one
 * starts in its place.
 */
export const leaveToTray = async ({
  showTrayForLeaving,
  windDown,
  tellTray,
  exit,
  restart,
  log,
}: ILeaveToTrayDeps): Promise<void> => {
  showTrayForLeaving();
  await windDown().catch((error: unknown) =>
    log('Winding down before leaving failed', error),
  );
  if (await tellTray()) {
    exit();
    return;
  }
  log('FluidEQ-Tray went as this process was leaving; starting afresh.');
  restart();
};
