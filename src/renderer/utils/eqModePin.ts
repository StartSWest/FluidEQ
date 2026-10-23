/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useSyncExternalStore } from 'react';
import { createFlagSetting } from './graphStorage';
import { requestSoundPane } from './soundPane';

/**
 * Whether the EQ mode menu is pinned beside the graph: the first card of the
 * sound panel instead of a menu laid over the curves it changes (Ivan,
 * 2026-10-06: "when that eq mode windows is open I cannot see the curves";
 * of four mockups he chose this one). Pinned from the start: offered behind a
 * pin in the menu, it was never found, and the menu went on covering the
 * curves ("I can see the modal there"). Remembered once somebody puts it back
 * in the menu.
 *
 * The card stands only while the EQ page's own EQ mode button is on screen.
 * That button is what brings the card back into view, and the curves the
 * card changes are drawn on that page. The amp's decks keep the menu: no
 * panel stands beside them.
 */
const PINNED_AT_FIRST = true;
const pinnedSetting = createFlagSetting(
  'fluideq.eqModePinned',
  PINNED_AT_FIRST,
);

let buttonsOnScreen = 0;
let revealGeneration = 0;
let isRevealOwed = false;
let isTriggerFocusOwed = false;

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const useEqModePinned = (): boolean =>
  useSyncExternalStore(pinnedSetting.subscribe, pinnedSetting.get);

/**
 * Brings the card into view, putting the panel it stands in on screen first
 * when that is folded or shut (Ivan, 2026-10-06: "it needs to open the side
 * menu if closed"): the pin's press, and the pinned button's.
 */
export const revealEqModeCard = () => {
  isRevealOwed = true;
  revealGeneration += 1;
  requestSoundPane();
  notify();
};

/** The menu's pin: the card in the menu's place, and on screen at once. */
export const pinEqMode = () => {
  pinnedSetting.set(true);
  revealEqModeCard();
};

/**
 * The card's own button: back into the menu, whose button takes the focus
 * the card's had, so a keyboard is left where the settings went.
 */
export const unpinEqMode = () => {
  isRevealOwed = false;
  isTriggerFocusOwed = true;
  pinnedSetting.set(false);
};

/** The EQ page's EQ mode button, counted while it is on screen. */
export const useEqModeButtonOnScreen = () => {
  useEffect(() => {
    buttonsOnScreen += 1;
    notify();
    return () => {
      buttonsOnScreen -= 1;
      notify();
    };
  }, []);
};

/** Whether the card stands in the panel. */
export const useEqModeCardShown = (): boolean => {
  const isPinned = useEqModePinned();
  const isButtonOnScreen = useSyncExternalStore(
    subscribe,
    () => buttonsOnScreen > 0,
  );
  return isPinned && isButtonOnScreen;
};

/** Counts the reveals asked for, so the card can tell a new one. */
export const useEqModeRevealGeneration = (): number =>
  useSyncExternalStore(subscribe, () => revealGeneration);

/**
 * Whether the card still owes a reveal, answered once: the card takes it on
 * the first render that finds the panel on screen.
 */
export const takeEqModeReveal = (): boolean => {
  const owed = isRevealOwed;
  isRevealOwed = false;
  return owed;
};

/** Whether the menu's button takes the focus back from an unpin, once. */
export const takeEqModeTriggerFocus = (): boolean => {
  const owed = isTriggerFocusOwed;
  isTriggerFocusOwed = false;
  return owed;
};

/** For tests: pinned as at first, with nothing owed. */
export const resetEqModePinForTesting = () => {
  pinnedSetting.set(PINNED_AT_FIRST);
  isRevealOwed = false;
  isTriggerFocusOwed = false;
};
