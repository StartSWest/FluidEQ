/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  useEffect,
  useState,
  useSyncExternalStore,
  type FocusEvent,
} from 'react';

/**
 * ONE TILE PLAYS AT A TIME, in the whole window (Ivan, 2026-11-26: "FluidEQ
 * is consuming too much due to all the videos and analyser thumbnails
 * playing. Let's only play the one hovering, and play it full, no fps
 * drop"). It is the tile under the pointer, or the one the keyboard is on;
 * every other tile shows its picture. The look picker's scene tiles and its
 * standard looks, its Details rows and the Gallery's cards all go by it
 * (`GalleryCard`, `lookTileClips.tsx`, `LookPickerTiles`), so a scene's clip
 * and a live look never play side by side either.
 *
 * This replaced every clip in view playing (2026-11-24/25) and every
 * standard look in view drawing at twelve a second. Measured in the
 * one-play harness, headless Chrome with software GL and decoding, the
 * look picker at 1400x900: 30 clips decoding at once, 4.4 to 6.5 cores in
 * all; the Gallery 24 clips, 5.5 cores.
 *
 * When both the pointer and the keyboard are on tiles, the one reached last
 * plays, and when that one is let go the other plays again. Nothing plays
 * while the window is hidden; what was wanted plays again when it shows.
 */

/** The tiles that want to play, in the order they asked; the last plays. */
let wanting: readonly symbol[] = [];
let playing: symbol | undefined;
const listeners = new Set<() => void>();

const settle = () => {
  const next = document.hidden ? undefined : wanting[wanting.length - 1];
  if (next !== playing) {
    playing = next;
    listeners.forEach((listener) => listener());
  }
};

const subscribe = (listener: () => void) => {
  if (listeners.size === 0) {
    document.addEventListener('visibilitychange', settle);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      document.removeEventListener('visibilitychange', settle);
    }
  };
};

const want = (tile: symbol, on: boolean) => {
  wanting = wanting.filter((each) => each !== tile);
  if (on) {
    wanting = [...wanting, tile];
  }
  settle();
};

/**
 * Whether this tile is the one that plays: it is `wanted` (pointed at or
 * focused, and it has something to play) and no tile was wanted after it.
 */
export const useOnePlaying = (wanted: boolean): boolean => {
  const [tile] = useState(() => Symbol('playing tile'));
  useEffect(() => {
    want(tile, wanted);
    return () => want(tile, false);
  }, [tile, wanted]);
  return useSyncExternalStore(subscribe, () => playing === tile);
};

/**
 * Whether the keyboard put the focus here, as the browser judges it: a
 * click focuses a button too, and a tile clicked and then left must not
 * keep playing under a pointer that has moved on.
 */
const focusShown = (target: EventTarget) =>
  target instanceof Element && target.matches(':focus-visible');

/**
 * Whether the pointer is on a tile or the keyboard is in it, and the
 * handlers that tell: the whole tile answers, its own buttons included -
 * a hand resting on a card's heart is still on the card, and focus moving
 * between a card's controls is not leaving it. On a touch screen the
 * pointer is on the tile while the finger is down, so a press and hold
 * plays it and lifting the finger stops it.
 */
export const useTileAttention = () => {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  return {
    attention: hovered || focused,
    handlers: {
      onPointerEnter: () => setHovered(true),
      onPointerLeave: () => setHovered(false),
      onFocus: (event: FocusEvent<HTMLElement>) =>
        setFocused(focusShown(event.target)),
      onBlur: (event: FocusEvent<HTMLElement>) => {
        const next = event.relatedTarget;
        if (!(next instanceof Node && event.currentTarget.contains(next))) {
          setFocused(false);
        }
      },
    },
  };
};
