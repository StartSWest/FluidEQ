/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { PLAYER_DEFAULT_HEIGHT, PLAYER_FOLD_HEIGHT } from 'common/constants';
import {
  holdPlayerHeight,
  needPlayerWidth,
  resizePlayerWindow,
} from './windowModeStore';

/**
 * The amp's rows that never break onto a second line (`useRowNeed`), each
 * with the width it needs on one: the widest of them is what the amp's one
 * width rises to past its own (`needPlayerWidth`). Each says its own and
 * withdraws it when it goes; nothing here guesses at what a row holds.
 */
export type TWidthNeed = 'soundHead' | 'soundTabs' | 'soundFoot' | 'shelfTabs';

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
  needPlayerWidth(Math.max(0, ...widthNeeds.values()));
};

const UNFOLDED_KEY = 'fluideq.player.unfoldedHeight';
const TIME_LEFT_KEY = 'fluideq.player.timeLeft';

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
 * One set of listeners for everything laid out here that the window reads:
 * the sound section, the queue's page, and the picture alone on the whole
 * screen.
 */
const layoutListeners = new Set<() => void>();

const subscribeLayout = (listener: () => void) => {
  layoutListeners.add(listener);
  return () => {
    layoutListeners.delete(listener);
  };
};

const publishLayout = () => layoutListeners.forEach((listener) => listener());

/**
 * The one amp's Sound section (Ivan, 2026-10-25): open or folded to its
 * header, and which face it shows — the three tone knobs or the faders.
 * Remembered across launches; the faders' face keeps the key the Stage's
 * equalizer kept it under, so nobody's choice is lost to the new amp.
 */
export type TPlayerSoundFace = 'bands' | 'tone';

export interface IPlayerSound {
  isOpen: boolean;
  face: TPlayerSoundFace;
}

const SOUND_OPEN_KEY = 'fluideq.player.soundOpen';
const SOUND_FACE_KEY = 'fluideq.player.eqFace';

let sound: IPlayerSound = {
  isOpen: readJson<boolean>(SOUND_OPEN_KEY) !== false,
  face: (() => {
    try {
      return window.localStorage.getItem(SOUND_FACE_KEY) === 'tone'
        ? 'tone'
        : 'bands';
    } catch {
      // Storage can be refused; the faders are the first face.
      return 'bands';
    }
  })(),
};

export const usePlayerSound = () => {
  const current = useSyncExternalStore(subscribeLayout, () => sound);
  const setSound = useCallback((next: Partial<IPlayerSound>) => {
    sound = { ...sound, ...next };
    writeJson(SOUND_OPEN_KEY, sound.isOpen);
    try {
      window.localStorage.setItem(SOUND_FACE_KEY, sound.face);
    } catch {
      // Remembered where storage allows; the face shown does not depend on it.
    }
    publishLayout();
  }, []);
  return { sound: current, setSound };
};

/**
 * Which page the one amp's queue shows: what plays next, or the Library's
 * playlists. Both share one box, so a change of page never changes the
 * amp's height (Ivan, 2026-10-25: "it cannot change app height").
 */
export type TPlayerQueuePage = 'next' | 'playlists';

const QUEUE_PAGE_KEY = 'fluideq.player.queuePage';

let queuePage: TPlayerQueuePage =
  readJson<string>(QUEUE_PAGE_KEY) === 'playlists' ? 'playlists' : 'next';

export const usePlayerQueuePage = () => {
  const current = useSyncExternalStore(subscribeLayout, () => queuePage);
  const setQueuePage = useCallback((next: TPlayerQueuePage) => {
    queuePage = next;
    writeJson(QUEUE_PAGE_KEY, next);
    publishLayout();
  }, []);
  return { queuePage: current, setQueuePage };
};

/**
 * Whether the queue's space is open or folded to its tabs (Ivan, 2026-10-25:
 * "let's up next section be collapsible too"). Folded, the picture at the
 * top of the amp takes the room it gives back. Remembered across launches;
 * open the first time.
 */
const SHELF_OPEN_KEY = 'fluideq.player.shelfOpen';

let isShelfOpen = readJson<boolean>(SHELF_OPEN_KEY) !== false;

export const usePlayerShelfOpen = () => {
  const current = useSyncExternalStore(subscribeLayout, () => isShelfOpen);
  const setShelfOpen = useCallback((next: boolean) => {
    isShelfOpen = next;
    writeJson(SHELF_OPEN_KEY, next);
    publishLayout();
  }, []);
  return { isShelfOpen: current, setShelfOpen };
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
 * Folding the player to one line and back, from its menu and its strip's own
 * button.
 *
 * Not from a double-click on the header (Ivan, 2026-10-26: "this is not
 * working the double click"). The header is the window's drag handle, so the
 * page never sees a click there, and Windows sent the player's window no
 * caption double-click at all: hooked in main and logged on his machine, two
 * double-clicks on the header brought none. The only other way to have one
 * is to time two presses, which is guessing at the listener's own
 * double-click setting, so the fold is the menu's and the strip's.
 */
export const usePlayerFold = () => {
  const isFolded = useIsFolded();
  const fold = useCallback(() => {
    rememberUnfoldedHeight(window.innerHeight);
    // The player's own floor holds the window above the strip, so the hold
    // goes first and the strip's own height is asked for after
    // (`usePlayerHeightFloor`).
    holdPlayerHeight(null, null);
    resizePlayerWindow(PLAYER_FOLD_HEIGHT).catch(() => undefined);
  }, []);
  const unfold = useCallback(() => {
    resizePlayerWindow(recallUnfoldedHeight() ?? PLAYER_DEFAULT_HEIGHT).catch(
      () => undefined,
    );
  }, []);

  return { isFolded, fold, unfold };
};
