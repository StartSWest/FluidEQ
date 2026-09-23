/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The EQ mode menu's Treble choice, one answer for the whole window.
 *
 * The menu shows it and the graph draws by it (`useMatchedDesign`), in the
 * main window and in the amp alike, so they hold one copy: a choice made in
 * the menu redraws every graph in the same render, rather than after each has
 * asked main for itself. No polling — the files change only through
 * `selectTrebleDesign`, and are read again whenever the window learns of
 * another engine, or another build of it.
 *
 * `undefined` until the first answer lands. The graph draws the default
 * until then, which is what an absent file plays.
 */

import { useEffect, useSyncExternalStore } from 'react';
import type {
  ITrebleDesigns,
  TTrebleDesign,
  TTrebleScope,
} from 'common/filterDesign';
import { getTrebleDesigns, setTrebleDesign } from './trebleDesignApi';
import { subscribeAudioEngineChanged } from './audioEngineEvents';
import { useKnownAudioEngineStatus } from './useAudioEngineStatus';
import { reportError } from './logger';

let known: ITrebleDesigns | undefined;
let asking: Promise<void> | undefined;
let askAgain = false;
/**
 * Bumped when a choice is sent and again when its answer lands. A reply to a
 * question asked before either describes the files as they were, and must
 * not land on top of the choice.
 */
let choices = 0;
/** Bumped by `resetTrebleDesigns`, so no reply outlives the reset. */
let generation = 0;
const listeners = new Set<() => void>();
let stopListeningForChanges: (() => void) | undefined;

const publish = (next: ITrebleDesigns): void => {
  if (known?.eq === next.eq && known.curves === next.curves) {
    return;
  }
  known = { eq: next.eq, curves: next.curves };
  listeners.forEach((listener) => listener());
};

const askOnce = async (askedIn: number): Promise<void> => {
  const askedAt = choices;
  try {
    const next = await getTrebleDesigns();
    if (askedIn === generation && askedAt === choices) {
      publish(next);
    }
  } catch (error) {
    // The graph still draws, with the default, and the menu with it: a
    // failed read leaves nothing on screen that says something wrong.
    reportError('the treble choice could not be read', error);
  }
};

const askUntilCurrent = async (askedIn: number): Promise<void> => {
  try {
    do {
      askAgain = false;
      // eslint-disable-next-line no-await-in-loop -- one question at a time is the point: each repeat exists because the previous answer may be stale.
      await askOnce(askedIn);
    } while (askAgain && askedIn === generation);
  } finally {
    if (askedIn === generation) {
      asking = undefined;
    }
  }
};

/** Ask main again, and bring every holder of the answer up to date. */
export const refreshTrebleDesigns = (): Promise<void> => {
  if (asking) {
    askAgain = true;
    return asking;
  }
  asking = askUntilCurrent(generation);
  return asking;
};

/**
 * Make a choice and hand every holder the files as they are once it has
 * landed. A failure is thrown for the menu to show, once the window has asked
 * again what the files hold, so the menu never keeps a choice that was not
 * made.
 */
export const selectTrebleDesign = async (
  choice: TTrebleDesign,
  scope: TTrebleScope,
): Promise<void> => {
  choices += 1;
  try {
    const applied = await setTrebleDesign(choice, scope);
    choices += 1;
    publish(applied);
  } catch (error) {
    choices += 1;
    await refreshTrebleDesigns();
    throw error;
  }
};

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  // One engine-changed listener for the window, held while anything shows
  // the answer — an engine installed afresh has a folder with no choice in it.
  stopListeningForChanges ??= subscribeAudioEngineChanged(() => {
    refreshTrebleDesigns();
  });
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && stopListeningForChanges) {
      stopListeningForChanges();
      stopListeningForChanges = undefined;
    }
  };
};

const readTrebleDesigns = (): ITrebleDesigns | undefined => known;

/**
 * Each group's choice as the FluidEQ Engine's folder holds it — the default
 * for both under Equalizer APO, whose folder is somewhere else. Whether the
 * engine playing reads the choice is the caller's to judge, from the engine
 * status (`engineTakesTrebleChoice`).
 */
export const useTrebleDesigns = (): ITrebleDesigns | undefined => {
  const designs = useSyncExternalStore(
    subscribe,
    readTrebleDesigns,
    readTrebleDesigns,
  );
  const status = useKnownAudioEngineStatus();
  const engine = status?.engine;
  const dllVersion = status?.fluid.dllVersion;
  // Asked on mount, and again whenever the window learns of another engine
  // or another build of it: main answers from the chosen engine's folder.
  useEffect(() => {
    refreshTrebleDesigns();
  }, [engine, dllVersion]);
  return designs;
};

/** For a test that wants a window that has not been told anything yet. */
export const resetTrebleDesigns = (): void => {
  generation += 1;
  choices += 1;
  known = undefined;
  asking = undefined;
  askAgain = false;
};
