/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useCallback, useState, useSyncExternalStore } from 'react';
import { usePlayerVisFull } from '../playerLayout';

/**
 * The 2.0 amp's own layout: which of its decks are open, how many columns
 * they stand in, and the visualizer deck's height — over the state both amps
 * share, which is the window's (`../playerLayout.ts`: folding, the picture
 * on the whole screen, the time-left clock, the width floor), and is passed
 * on from here so the amp's files read one module.
 */
export {
  isDenseBands,
  playerWidthForBands,
  setPlayerVisFull,
  setPlayerWidthNeed,
  toggleTimeLeft,
  useIsTimeLeft,
  usePlayerFold,
  usePlayerVisFull,
} from '../playerLayout';

/** Which decks are open under the player: its equalizer, visualizer, queue. */
export interface IPlayerDecks {
  eq: boolean;
  vis: boolean;
  queue: boolean;
}

export type TPlayerDeck = keyof IPlayerDecks;

const DECKS_KEY = 'fluideq.player.decks';
const VIS_HEIGHT_KEY = 'fluideq.player.visHeight';

/**
 * The visualizer's height until the listener drags its divider, and the least
 * it may have: under 140px a scene is a strip nobody can read.
 */
export const PLAYER_VIS_HEIGHT = 220;
export const PLAYER_VIS_MIN = 140;

/**
 * Every deck open the first time the player is opened (Ivan, 2026-09-22):
 * before the Library has been opened the queue says so and offers the way
 * there, which is a better first sight of it than a lamp nobody has pressed.
 */
const DEFAULT_DECKS: IPlayerDecks = { eq: true, vis: true, queue: true };

const readJson = <T>(key: string): T | undefined => {
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? undefined : (JSON.parse(raw) as T);
  } catch {
    // Storage can be refused; the player opens as it does the first time.
    return undefined;
  }
};

const writeJson = (key: string, value: unknown) => {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Remembered for next time where storage allows; nothing else depends on it.
  }
};

/** Which decks are open, remembered across launches, as one answer. */
let openDecks: IPlayerDecks = (() => {
  const saved = readJson<Partial<IPlayerDecks>>(DECKS_KEY);
  return {
    eq: typeof saved?.eq === 'boolean' ? saved.eq : DEFAULT_DECKS.eq,
    vis: typeof saved?.vis === 'boolean' ? saved.vis : DEFAULT_DECKS.vis,
    queue:
      typeof saved?.queue === 'boolean' ? saved.queue : DEFAULT_DECKS.queue,
  };
})();
const deckListeners = new Set<() => void>();

const subscribeDecks = (listener: () => void) => {
  deckListeners.add(listener);
  return () => {
    deckListeners.delete(listener);
  };
};

export const usePlayerDecks = () => {
  const decks = useSyncExternalStore(subscribeDecks, () => openDecks);
  const setDeck = useCallback((deck: TPlayerDeck, isOpen: boolean) => {
    openDecks = { ...openDecks, [deck]: isOpen };
    writeJson(DECKS_KEY, openDecks);
    deckListeners.forEach((listener) => listener());
  }, []);
  return { decks, setDeck };
};

/** Whether the player is drawing its visualizer right now. */
export const useIsPlayerVisOpen = () =>
  useSyncExternalStore(subscribeDecks, () => openDecks.vis);

/**
 * How many columns the deck row is laid out in — one stacked player, or the
 * deck and the equalizer side by side.
 *
 * Measured off the real grid in `ClassicAmp` and published here because the
 * answer decides WHERE THE VISUALIZER IS DRAWN. In two columns it is its own
 * deck; in one it is drawn inside the equalizer's screen instead, behind the
 * curve (Ivan, 2026-09-22) — a narrow player is tall enough already without a
 * third block in it, and the screen is the one surface there with room for a
 * picture.
 */
let playerColumns = 1;

export const setPlayerColumns = (next: number) => {
  if (next === playerColumns || !Number.isFinite(next) || next < 1) {
    return;
  }
  playerColumns = next;
  deckListeners.forEach((listener) => listener());
};

export const usePlayerColumns = () =>
  useSyncExternalStore(subscribeDecks, () => playerColumns);

/**
 * Whether the visualizer belongs inside the equalizer's screen rather than in
 * a deck of its own: switched on, and nowhere else to put it — never while it
 * has the whole screen.
 */
export const useIsVisInsideCurve = () => {
  const isFull = usePlayerVisFull();
  const isStacked = useSyncExternalStore(
    subscribeDecks,
    () => openDecks.vis && playerColumns < 2,
  );
  return isStacked && !isFull;
};

/** A height for each layout: the decks in one column, or two. */
type TVisHeights = Partial<Record<'one' | 'two', number>>;

const readVisHeights = (): TVisHeights => {
  const saved = readJson<TVisHeights | number>(VIS_HEIGHT_KEY);
  // One number is what the player wrote before it kept a height per layout;
  // it was the one the listener had set, so both start from it.
  if (typeof saved === 'number' && Number.isFinite(saved)) {
    return { one: Math.round(saved), two: Math.round(saved) };
  }
  return typeof saved === 'object' && saved !== null ? saved : {};
};

const heightIn = (heights: TVisHeights, key: 'one' | 'two') => {
  const saved = heights[key];
  return typeof saved === 'number' &&
    Number.isFinite(saved) &&
    saved >= PLAYER_VIS_MIN
    ? Math.round(saved)
    : PLAYER_VIS_HEIGHT;
};

/**
 * The visualizer's height as the listener left it with the divider between
 * it and the queue, remembered across launches: one for each layout (Ivan,
 * 2026-09-21), because a height that suits the decks side by side is the
 * wrong one with them stacked. Set on every step of a drag, written down
 * when the drag ends.
 */
export const usePlayerVisHeight = (columns: number) => {
  const key = columns >= 2 ? 'two' : 'one';
  const [heights, setHeights] = useState<TVisHeights>(readVisHeights);
  const setVisHeight = useCallback(
    (height: number) =>
      setHeights((previous) => ({ ...previous, [key]: Math.round(height) })),
    [key],
  );
  const saveVisHeight = useCallback(
    (height: number) =>
      writeJson(VIS_HEIGHT_KEY, {
        ...readVisHeights(),
        [key]: Math.round(height),
      }),
    [key],
  );
  return { visHeight: heightIn(heights, key), setVisHeight, saveVisHeight };
};
