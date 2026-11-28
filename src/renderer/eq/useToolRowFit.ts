/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { type RefObject, useLayoutEffect } from 'react';

/**
 * How much of the row's wording is shown, most first: everything; the
 * groups' captions given up; then Add's and Clear's words, so the saved EQ
 * key keeps the name of the one that is loaded and the tabs keep what they hold —
 * at 1600 px that was the difference between "15 · Movie · On" shown and not
 * (Ivan, 2026-11-20, choosing it: "yes, my answer is the recommended"); then
 * what each tab holds ("15", the preset's name, Off), the tabs keeping their
 * names; then the tools' words too, each
 * left its glyph and its tooltip (Smart EQ keeps its word at every width);
 * last, the tabs' own words, each tab its glyph and its tooltip, the open
 * one still underlined. The tabs' chips go before the tools' words because a
 * tool without its word is a glyph to learn, and a tab without its chip
 * still says what it is; the tabs' words go last because they are where the
 * page is.
 */
const FITS = [
  'full',
  'uncaptioned',
  'quiet-bands',
  'bare-tabs',
  'icons',
  'icon-tabs',
] as const;

/**
 * THE TOOL ROW NEVER WRAPS AND NEVER RUNS OFF (Ivan, 2026-11-17, B1): the
 * first of `FITS` whose tools fit the room the tabs leave, written on the row
 * as `data-fit` for the stylesheet. Measured, not a breakpoint: the words are
 * a French or a Russian row's as well as an English one's, a band design's
 * name or a running Smart EQ's mode, and a width that suits one of them
 * clips another. Tried in order on the element itself within the one
 * layout pass, so no level is ever painted that does not fit.
 *
 * Measured again when the room changes and when the tools' own width does
 * (another tab's tools, a word that changed); trying the levels ends where it
 * started for the same content, so the observer is not woken by its own
 * answer.
 */
const useToolRowFit = (
  row: RefObject<HTMLElement | null>,
  slot: RefObject<HTMLElement | null>,
  tools: RefObject<HTMLElement | null>,
) => {
  useLayoutEffect(() => {
    const rowElement = row.current;
    const slotElement = slot.current;
    const toolsElement = tools.current;
    if (!rowElement || !slotElement || !toolsElement) {
      return undefined;
    }
    const fit = () => {
      const fits = FITS.find((level) => {
        rowElement.dataset.fit = level;
        return toolsElement.offsetWidth <= slotElement.clientWidth;
      });
      rowElement.dataset.fit = fits ?? FITS[FITS.length - 1];
    };
    fit();
    if (typeof ResizeObserver === 'undefined') {
      return undefined;
    }
    const observer = new ResizeObserver(fit);
    observer.observe(slotElement);
    observer.observe(toolsElement);
    return () => observer.disconnect();
  }, [row, slot, tools]);
};

export default useToolRowFit;
