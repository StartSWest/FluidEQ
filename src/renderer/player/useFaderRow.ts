/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { type RefObject, useLayoutEffect } from 'react';

/**
 * How many bands one page of the row holds, at a width a finger can grip
 * (Ivan, 2026-10-25: "make sure they fit the 10 bands the width remaining").
 */
const BANDS_PER_PAGE = 10;

/**
 * ONE WIDTH FOR A BAND, WHATEVER THE LAYOUT (Ivan, 2026-10-25: "all bands
 * need to fit same … if we add more we just do left and right scroll into
 * other sections", "fit the 10 bands the width remaining"). The row is cut
 * into ten equal steps — the amp's width is fixed, so that is one size for
 * good — and a layout of ten or fewer stands in the middle of it, while a
 * bigger one runs on past the row's edge in pages of ten, turned with the
 * arrows at its ends or by scrolling sideways. Thirty-one bands squeezed into
 * the row were too narrow to grip and lost their names to every other one.
 *
 * Each step is the same width, with the same gap between them — IN THE
 * PIXELS THE SCREEN HAS (Ivan, 2026-09-21: keep a minimum between the
 * bands).
 *
 * Shared out by the browser, each band gets a fraction of a pixel and the
 * caps land two apart in one place and three in the next, which reads as
 * a bunched row however equal the numbers are. Whole CSS pixels are not
 * enough either — the page can be zoomed, this window sits at about 0.91,
 * and a whole CSS pixel is then a fraction of a real one. So the row is
 * measured in device pixels and cut into equal steps there, the gap is a
 * whole number of them and never less than the deck asks for, the row is
 * pushed to the next whole device pixel, and the few left over are split
 * between its two ends.
 *
 * A row drawn inside a box with a CSS `zoom` of its own (What's New's
 * picture of the player, `PlayerPicture`) is measured on the screen at that
 * zoom and written in its own pixels, which are the zoom's times as small:
 * `currentCSSZoom` says by how much. It is 1 in the player's window, where
 * the arithmetic is exactly what it always was.
 *
 * Written straight onto the row, so a window being dragged does not
 * re-render the equalizer on every frame of it. `onFit` runs after each fit
 * and on each scroll of the row, for whoever keeps the page arrows.
 */
const useFaderRow = (
  rowRef: RefObject<HTMLDivElement | null>,
  count: number,
  onFit: () => void,
) => {
  useLayoutEffect(() => {
    const row = rowRef.current;
    if (!row || typeof ResizeObserver === 'undefined') {
      return undefined;
    }
    const fit = () => {
      const deck = row.parentElement ?? row;
      // From the deck, never from the row: the row is where the snapped
      // lengths are written, and reading those back would snap them again.
      const deckStyle = getComputedStyle(deck);
      const base =
        parseFloat(deckStyle.getPropertyValue('--player-band-gap')) || 4;
      const band =
        parseFloat(deckStyle.getPropertyValue('--player-fader-cap')) || 13;
      // jsdom has no zoom to report.
      const zoom = row.currentCSSZoom || 1;
      const ratio = (window.devicePixelRatio || 1) * zoom;
      const box = row.getBoundingClientRect();
      const width = box.width / zoom;
      const left = box.left / zoom;
      const gap = Math.max(1, Math.round(base * ratio));
      const widest = Math.max(2, Math.round(band * ratio));
      const room = Math.floor(width * ratio);
      // A page shared out in whole pixels, with the gap taken off the top:
      // whatever is left is the band, and the cap is never wider than that,
      // or the caps eat the gap the row was measured out to keep.
      const step = Math.max(gap + 2, Math.floor((room + gap) / BANDS_PER_PAGE));
      const cap = Math.min(widest, step - gap);
      // Ten or fewer stand in the middle; more start at the left edge,
      // where each page starts.
      const spare =
        count > BANDS_PER_PAGE ? 0 : Math.max(0, room - (count * step - gap));
      const edge = Math.ceil(left * ratio) - left * ratio;
      row.style.setProperty('--player-band-gap', `${gap / ratio}px`);
      row.style.setProperty('--player-band-width', `${(step - gap) / ratio}px`);
      row.style.setProperty('--player-fader-cap', `${cap / ratio}px`);
      row.style.setProperty('--player-page-width', `${room / ratio}px`);
      row.style.paddingLeft = `${(edge + Math.floor(spare / 2)) / ratio}px`;
      onFit();
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(row);
    row.addEventListener('scroll', onFit, { passive: true });
    return () => {
      observer.disconnect();
      row.removeEventListener('scroll', onFit);
    };
  }, [count, onFit, rowRef]);
};

export default useFaderRow;
