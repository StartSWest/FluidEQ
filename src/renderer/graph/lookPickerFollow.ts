/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { PICK } from './lookPickerParts';

/**
 * Keys that walk the picker's places and tiles, or scroll its list: the
 * reader moving through the looks themselves.
 */
const WALK_KEYS = new Set([
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'PageUp',
  'PageDown',
  'Home',
  'End',
]);

const playingIn = (scroller: HTMLElement) =>
  scroller.querySelector<HTMLElement>(`${PICK}[aria-pressed="true"]`);

/**
 * Scrolls `scroller` alone so `tile` stands in the middle of its view, or
 * at its top when the tile is taller than the view. `scrollIntoView` was
 * used before and scrolls every scrollable ancestor as well.
 */
export const centreIn = (scroller: HTMLElement, tile: HTMLElement) => {
  const view = scroller.getBoundingClientRect();
  const box = tile.getBoundingClientRect();
  // The window scales in as it opens, and the rectangles are read under
  // that transform while scrolling is in layout pixels: measured mid-way,
  // the tile came out 4px off once it settled, and further off mid-way.
  // Dividing by the scale reads both in layout pixels. jsdom lays nothing
  // out (no offsetHeight), and reads as unscaled.
  const scale =
    scroller.offsetHeight > 0 ? view.height / scroller.offsetHeight : 1;
  const top = (box.top - view.top) / scale - scroller.clientTop;
  const room = scroller.clientHeight - box.height / scale;
  const shift = top - Math.max(0, room / 2);
  // A sub-pixel remainder is a rounding of the layout, not a move.
  if (Math.abs(shift) >= 1) {
    scroller.scrollTop += shift;
  }
};

/**
 * Keeps the playing look's tile in the middle of the picker's list, and the
 * keyboard on it, until the reader takes the list over (Ivan, 2026-11-26:
 * "when I open this window it needs to always open on the current analyzer
 * or viz that is playing on the graph; sometimes it jumps to another place").
 *
 * It was scrolled to once, as the window arrived, and the list kept moving
 * after that: opening asks the gallery for its newest page and the scene
 * packs for new versions, and every answer rebuilds the rows while the window
 * is open. Under Newest a new scene lands above the playing tile, and in
 * Everything the styles stand under every scene, so a style that was centred
 * ended up a row or a screen further down. A tile that was not drawn yet when
 * the window arrived was never scrolled to at all.
 *
 * Now every change to the list's size or contents brings the tile back,
 * until a wheel, a touch, the scrollbar or a walking key says the reader is
 * looking somewhere else; from then on the list is theirs. The scroll events
 * themselves are not read, because the centring makes them too.
 *
 * Returns what stops following.
 */
export const followPlaying = (
  body: HTMLElement,
  onTakeOver: () => void,
): (() => void) => {
  const scroller = body.querySelector<HTMLElement>('[data-look-picker-scroll]');
  if (!scroller) {
    return () => undefined;
  }
  let focused = false;
  const bring = () => {
    const tile = playingIn(scroller);
    if (!tile) {
      return;
    }
    centreIn(scroller, tile);
    if (!focused) {
      focused = true;
      tile.focus({ preventScroll: true });
    }
  };

  // A look with no tile (a draft) leaves the caret in the search, as before;
  // the tile takes the keyboard if it is drawn later.
  if (!playingIn(scroller)) {
    body
      .closest('[data-anchored-menu]')
      ?.querySelector<HTMLInputElement>('.look-picker__search input')
      ?.focus();
  }
  bring();

  const sizes = new ResizeObserver(bring);
  const watchSizes = () => {
    sizes.disconnect();
    sizes.observe(scroller);
    Array.from(scroller.children).forEach((part) => sizes.observe(part));
  };
  watchSizes();
  // A re-sort moves tiles without changing any size.
  const contents = new MutationObserver(() => {
    watchSizes();
    bring();
  });
  contents.observe(scroller, { childList: true, subtree: true });

  const takeOver = () => onTakeOver();
  // Pressed on the list itself rather than a tile: its scrollbar.
  const onPointer = (event: PointerEvent) => {
    if (event.target === scroller) {
      onTakeOver();
    }
  };
  const onKey = (event: KeyboardEvent) => {
    if (WALK_KEYS.has(event.key)) {
      onTakeOver();
    }
  };
  const menu = body.closest<HTMLElement>('[data-anchored-menu]') ?? body;
  // Read mid-way, the scale is a ratio of rounded heights and leaves the
  // tile up to 2px off (measured); once the opening transform has ended the
  // rectangles are layout pixels. A transform resizes nothing, so the
  // observers above never hear of it.
  const onSettled = (event: Event) => {
    if (event.target === menu) {
      bring();
    }
  };
  menu.addEventListener('animationend', onSettled);
  scroller.addEventListener('wheel', takeOver, { passive: true });
  scroller.addEventListener('touchstart', takeOver, { passive: true });
  scroller.addEventListener('pointerdown', onPointer);
  menu.addEventListener('keydown', onKey);
  return () => {
    sizes.disconnect();
    contents.disconnect();
    scroller.removeEventListener('wheel', takeOver);
    scroller.removeEventListener('touchstart', takeOver);
    scroller.removeEventListener('pointerdown', onPointer);
    menu.removeEventListener('keydown', onKey);
    menu.removeEventListener('animationend', onSettled);
  };
};
