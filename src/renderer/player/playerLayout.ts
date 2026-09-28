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

const SHEET_KEY = 'fluideq.player.sheet';
const UNFOLDED_KEY = 'fluideq.player.unfoldedHeight';
const TIME_LEFT_KEY = 'fluideq.player.timeLeft';

/**
 * Above this many bands the equalizer draws its small faders, which is the
 * same switch the stylesheet's `is-dense` makes.
 */
const DENSE_BANDS = 20;

/**
 * The least room one band may take, in CSS pixels: its cap plus the gap that
 * keeps it off its neighbour's — 13 + 4 for a wide layout, 10 + 3 for a
 * dense one. A wider window draws the caps bigger, up to the stylesheet's
 * `--player-fader-cap`; this is the floor.
 *
 * THESE ARE THE STYLESHEET'S NUMBERS (`--player-band-gap` and the dense
 * `--player-fader-cap` in `_miniPlayerEqFaders.scss`), and a band is drawn at a
 * whole number of pixels or not at all: fractions of a pixel per band put
 * two pixels of gap beside three and the row reads as uneven, which is what
 * it did at 31 bands (Ivan, 2026-09-21).
 */
const BAND_STEP_PX = 17;
const DENSE_BAND_STEP_PX = 13;
/**
 * Everything on the equalizer's row that is not a band: the preamp (32), the
 * rule after it (1), the two gaps either side of the rule (12), the sheet's
 * padding (32) and its margin from the window's edge (20), and a pixel each
 * side so the outermost caps are not cut. `_miniPlayerEqFaders.scss` and
 * `_miniPlayerSheet.scss` hold the same numbers.
 */
const BANDS_SIDE_PX = 99;

/** Whether a band count is drawn with the small faders. */
export const isDenseBands = (bands: number) => bands > DENSE_BANDS;

/**
 * How wide the player has to be for a band layout to be worth reading.
 *
 * Every band gets the same whole number of pixels and the same gap (Ivan,
 * 2026-09-21), so the narrowest the window may be is the layout's own width:
 * thirty-one bands ask for 502, ten for the player's own floor. Main holds
 * the window to it (`floorPlayerWidth`).
 */
export const playerWidthForBands = (bands: number) =>
  BANDS_SIDE_PX +
  Math.max(0, bands) *
    (isDenseBands(bands) ? DENSE_BAND_STEP_PX : BAND_STEP_PX);

/**
 * How wide the player must be, from every part of it that has a say — the
 * widest of them is what the window is held to (`floorPlayerWidth`).
 *
 * Three parts say something: the band layout (`PlayerBandFloor`, from the
 * arithmetic above), the equalizer's two rows of keys (`EqDeck`, measured
 * from the keys themselves with every word they can give up gone), and the
 * Stage's visualizer bar (`PlayerStageBar`, measured the same way). A control
 * the window can be narrowed past is a control that gets clipped (Ivan,
 * 2026-09-22: "we need a min width so this doesn't happen, so buttons enforce
 * min width naturally"). Each part states its own need and withdraws it when
 * it is not on screen; nothing here guesses at what a row holds.
 */
type TWidthNeed = 'bands' | 'rows' | 'bar';
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
 * What the window needs across beside a row of the sheet: the sheet's own
 * padding round the row, and its margin from the window's edge on each side
 * — the right-hand one, which in a wide window is the only one the sheet
 * has, stands for both.
 *
 * FROM THE STYLESHEET, NEVER FROM WHERE THE SHEET STANDS. It was worked out
 * from the sheet's box, and while the picture takes the screen the sheet is
 * not drawn at all: a box of nothing put the window's whole width into the
 * need, main held the amp to the width of the screen, and that is the size
 * it was remembered at (Ivan, 2026-09-28: "it always starts in fullscreen").
 */
export const sheetAllowance = (sheet: Element) => {
  const style = getComputedStyle(sheet);
  return (
    parseFloat(style.paddingLeft) +
    parseFloat(style.paddingRight) +
    2 * parseFloat(style.marginRight)
  );
};

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

/** Which of the sheet's two pages is up: the equalizer or the queue. */
export type TPlayerSheetTab = 'eq' | 'queue';

/**
 * The glass sheet along the foot of the amp (the Stage, Ivan 2026-09-27):
 * which page it shows, and whether it is open or lowered to its tabs, which
 * gives the picture the room. Remembered across launches; the first time it
 * opens on the equalizer.
 */
export interface IPlayerSheet {
  tab: TPlayerSheetTab;
  isOpen: boolean;
}

let sheet: IPlayerSheet = (() => {
  const saved = readJson<Partial<IPlayerSheet>>(SHEET_KEY);
  return {
    tab: saved?.tab === 'queue' ? 'queue' : 'eq',
    isOpen: typeof saved?.isOpen === 'boolean' ? saved.isOpen : true,
  };
})();

/**
 * One set of listeners for everything laid out here that the window reads:
 * the sheet, and the picture alone on the whole screen.
 */
const layoutListeners = new Set<() => void>();

const subscribeLayout = (listener: () => void) => {
  layoutListeners.add(listener);
  return () => {
    layoutListeners.delete(listener);
  };
};

const publishLayout = () => layoutListeners.forEach((listener) => listener());

export const usePlayerSheet = () => {
  const current = useSyncExternalStore(subscribeLayout, () => sheet);
  const setSheet = useCallback((next: Partial<IPlayerSheet>) => {
    sheet = { ...sheet, ...next };
    writeJson(SHEET_KEY, sheet);
    publishLayout();
  }, []);
  return { sheet: current, setSheet };
};

/**
 * The visualizer alone, on the whole screen.
 *
 * A double-press on the picture asks for it and a second one — or Escape —
 * gives it back (Ivan, 2026-09-22). The WINDOW changes: the app reads this to
 * know somebody in here has claimed full screen, so the state the window
 * announces is not reconciled straight back out of it (`App.tsx`).
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
  publishLayout();
};

export const usePlayerVisFull = () =>
  useSyncExternalStore(subscribeLayout, () => isVisFull);

/**
 * Whether the clock counts what is left rather than what has played.
 *
 * One setting for the dock's clock and the folded strip's, which are never
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
 * button, or a double-click on the header, which Windows keeps from the page
 * and main passes on (`player-caption-double-click`).
 */
export const usePlayerFold = () => {
  const isFolded = useIsFolded();
  const fold = useCallback(() => {
    rememberUnfoldedHeight(window.innerHeight);
    // The player's own floor holds the window above the strip, so the hold
    // goes first and the strip's own height is asked for after
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
