/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { PLAYER_DEFAULT_HEIGHT, PLAYER_FOLD_HEIGHT } from 'common/constants';
import {
  floorPlayerWidth,
  holdPlayerHeight,
  resizePlayerWindow,
} from './windowModeStore';

/** Which decks are open under the player: its equalizer, visualizer, queue. */
export interface IPlayerDecks {
  eq: boolean;
  vis: boolean;
  queue: boolean;
}

export type TPlayerDeck = keyof IPlayerDecks;

const DECKS_KEY = 'fluideq.player.decks';
const UNFOLDED_KEY = 'fluideq.player.unfoldedHeight';
const TIME_LEFT_KEY = 'fluideq.player.timeLeft';
const VIS_HEIGHT_KEY = 'fluideq.player.visHeight';

/**
 * The visualizer's height until the listener drags its divider, and the least
 * it may have: under 140px a scene is a strip nobody can read.
 */
export const PLAYER_VIS_HEIGHT = 220;
export const PLAYER_VIS_MIN = 140;

/**
 * Above this many bands the equalizer draws its small faders, which is the
 * same switch the stylesheet's `is-dense` makes.
 */
const DENSE_BANDS = 20;

/**
 * The room one band takes, in CSS pixels: its cap plus the gap that keeps it
 * off its neighbour's — 13 + 4 for a wide layout, 10 + 3 for a dense one.
 *
 * THESE ARE THE STYLESHEET'S NUMBERS (`--player-fader-cap` and
 * `--player-band-gap` in `_miniPlayerEq.scss`), and a band is drawn at a
 * whole number of pixels or not at all: fractions of a pixel per band put
 * two pixels of gap beside three and the row reads as uneven, which is what
 * it did at 31 bands (Ivan, 2026-09-21).
 */
const BAND_STEP_PX = 17;
const DENSE_BAND_STEP_PX = 13;
/**
 * Everything on the equalizer's row that is not a band, measured in the
 * window: the scale down the left (15), the preamp (32), the rule after it
 * (1), the three gaps between them (12), the deck's padding (18) and the
 * body's (12), and a pixel each side so the outermost caps are not cut.
 */
const BANDS_SIDE_PX = 96;

/** Whether a band count is drawn with the small faders. */
export const isDenseBands = (bands: number) => bands > DENSE_BANDS;

/**
 * How wide the player has to be for a band layout to be worth reading.
 *
 * Every band gets the same whole number of pixels and the same gap (Ivan,
 * 2026-09-21), so the narrowest the window may be is the layout's own width:
 * thirty-one bands ask for 499, ten for the player's own floor. Main holds
 * the window to it (`floorPlayerWidth`), and the deck row uses the same
 * number to decide whether the equalizer can sit beside the deck rather than
 * under it.
 */
export const playerWidthForBands = (bands: number) =>
  BANDS_SIDE_PX +
  Math.max(0, bands) *
    (isDenseBands(bands) ? DENSE_BAND_STEP_PX : BAND_STEP_PX);

/**
 * How wide the player must be, from every part of it that has a say — the
 * widest of them is what the window is held to (`floorPlayerWidth`).
 *
 * Two parts say something: the band layout (`PlayerBandFloor`, from the
 * arithmetic above) and the equalizer's two rows of keys (`EqDeck`, measured
 * from the keys themselves with every word they can give up gone). The
 * window used to be held to the bands alone, and at that width the foot's
 * last key was cut off at the deck's edge — a control the window can be
 * narrowed past is a control that gets clipped (Ivan, 2026-09-22: "we need a
 * min width so this doesn't happen, so buttons enforce min width
 * naturally"). Each part states its own need and withdraws it when it is
 * not on screen; nothing here guesses at what a row holds.
 */
type TWidthNeed = 'bands' | 'rows';
const widthNeeds = new Map<TWidthNeed, number>();

export const setPlayerWidthNeed = (
  part: TWidthNeed,
  cssWidth: number | undefined,
) => {
  if (cssWidth === undefined || !Number.isFinite(cssWidth) || cssWidth <= 0) {
    widthNeeds.delete(part);
  } else {
    widthNeeds.set(part, Math.ceil(cssWidth));
  }
  floorPlayerWidth(Math.max(0, ...widthNeeds.values()));
};
/**
 * What the player opens with the first time: every deck it has — the
 * equalizer, the visualizer and the queue — which between them fill the tall
 * window it opens at (`PLAYER_DEFAULT_HEIGHT`). The queue too (Ivan,
 * 2026-09-22): before the Library has been opened it says so and offers the
 * way there, which is a better first sight of it than a lamp nobody has
 * pressed.
 */
const DEFAULT_DECKS: IPlayerDecks = { eq: true, vis: true, queue: true };

/**
 * A window at most this tall is the folded player.
 *
 * A little over the strip itself, so a window dragged down to the strip by
 * hand folds too, and not only one folded by the menu.
 */
export const FOLD_THRESHOLD = PLAYER_FOLD_HEIGHT + 24;

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

/**
 * Which decks are open, remembered across launches, as one answer for the
 * whole window.
 *
 * A store rather than a component's own state, because the visualizer being
 * open is not only the player's business: it is the one place a scene is
 * drawn while the window is the player, and the window's tint follows what
 * is drawn (`SceneTint`).
 */
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
 * Whether the player's queue deck is open.
 *
 * Read by the app's shell, which keeps the Library's player mounted while it
 * is (`App.tsx`): the deck lists that player's queue and takes music dropped
 * onto it, and with the player put away the deck had nothing to list and
 * nowhere to put a drop (Ivan, 2026-09-22).
 */
export const useIsPlayerQueueOpen = () =>
  useSyncExternalStore(subscribeDecks, () => openDecks.queue);

/**
 * How many columns the deck row is laid out in — one stacked player, or the
 * deck and the equalizer side by side.
 *
 * Measured off the real grid in `MiniPlayer` and published here because the
 * answer decides something two floors down: WHERE THE VISUALIZER IS DRAWN.
 * In two columns it is its own deck, as it has always been. In one it is
 * drawn inside the equalizer's screen instead, behind the curve (Ivan,
 * 2026-09-22) — a narrow player is tall enough already without a third block
 * in it, and the screen is the one surface there with room for a picture.
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
 * The visualizer alone, on the whole screen.
 *
 * A double-press on the picture asks for it and a second one — or Escape —
 * gives it back (Ivan, 2026-09-22). Not a deck's business, because it is the
 * WINDOW that changes: the app reads this to know somebody in here has
 * claimed full screen, so the state the window announces is not reconciled
 * straight back out of it (`App.tsx`).
 *
 * Never remembered. Coming back to a player that opens full screen with no
 * way out visible is a window somebody has to work out how to escape.
 */
let isVisFull = false;

export const setPlayerVisFull = (next: boolean) => {
  if (next === isVisFull) {
    return;
  }
  isVisFull = next;
  deckListeners.forEach((listener) => listener());
};

export const usePlayerVisFull = () =>
  useSyncExternalStore(subscribeDecks, () => isVisFull);

/**
 * Whether the visualizer belongs inside the equalizer's screen rather than in
 * a deck of its own: switched on, and nowhere else to put it.
 */
export const useIsVisInsideCurve = () =>
  useSyncExternalStore(
    subscribeDecks,
    () => openDecks.vis && playerColumns < 2 && !isVisFull,
  );

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
 * it and the queue, remembered across launches.
 *
 * One height for each layout (Ivan, 2026-09-21): the deck and the equalizer
 * side by side leave a different shape of window from the two stacked, and
 * a height that suits one is the wrong height in the other — so a wide
 * player and a narrow one each keep what they were given. Set on every step
 * of a drag, written down when the drag ends.
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

/**
 * Whether the clock counts what is left rather than what has played.
 *
 * One setting for the deck's clock and the folded strip's, which are never
 * on screen together: a clock turned round in one and found the other way in
 * the other reads as two clocks disagreeing.
 */
let isTimeLeft = readJson<boolean>(TIME_LEFT_KEY) === true;
const timeLeftListeners = new Set<() => void>();

export const useIsTimeLeft = () =>
  useSyncExternalStore(
    (listener) => {
      timeLeftListeners.add(listener);
      return () => {
        timeLeftListeners.delete(listener);
      };
    },
    () => isTimeLeft,
  );

export const toggleTimeLeft = () => {
  isTimeLeft = !isTimeLeft;
  writeJson(TIME_LEFT_KEY, isTimeLeft);
  timeLeftListeners.forEach((listener) => listener());
};

/** Whether the window is folded to one line, followed as it is resized. */
export const useIsFolded = () => {
  const [isFolded, setIsFolded] = useState(
    () => window.innerHeight <= FOLD_THRESHOLD,
  );
  useEffect(() => {
    const onResize = () => setIsFolded(window.innerHeight <= FOLD_THRESHOLD);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return isFolded;
};

/**
 * The height to unfold back to: the one the player had when it was folded,
 * kept across launches, because a player closed folded opens folded.
 */
const rememberUnfoldedHeight = (height: number) =>
  writeJson(UNFOLDED_KEY, Math.round(height));

const recallUnfoldedHeight = (): number | undefined => {
  const saved = readJson<number>(UNFOLDED_KEY);
  return typeof saved === 'number' &&
    Number.isFinite(saved) &&
    saved > FOLD_THRESHOLD
    ? saved
    : undefined;
};

/**
 * Folding the player to one line and back — from its menu, its strip's own
 * button, or a double-click on the strip, which Windows keeps from the page
 * and main passes on (`player-caption-double-click`).
 */
export const usePlayerFold = () => {
  const isFolded = useIsFolded();
  const fold = useCallback(() => {
    rememberUnfoldedHeight(window.innerHeight);
    // A player whose decks hold its height is held there against this too,
    // so the hold goes first and the strip's own height is asked for after
    // (`usePlayerHeightLimit`).
    holdPlayerHeight(null, null);
    resizePlayerWindow(PLAYER_FOLD_HEIGHT).catch(() => undefined);
  }, []);
  const unfold = useCallback(() => {
    resizePlayerWindow(recallUnfoldedHeight() ?? PLAYER_DEFAULT_HEIGHT).catch(
      () => undefined,
    );
  }, []);

  // Read by a listener subscribed once, so it answers for the window as it
  // is at the double-click and not as it was when it subscribed.
  const isFoldedRef = useRef(isFolded);
  isFoldedRef.current = isFolded;
  useEffect(() => {
    const stop = window.electron?.ipcRenderer.on(
      'player-caption-double-click',
      () => {
        if (isFoldedRef.current) {
          unfold();
        } else {
          fold();
        }
      },
    );
    return () => {
      stop?.();
    };
  }, [fold, unfold]);

  return { isFolded, fold, unfold };
};
