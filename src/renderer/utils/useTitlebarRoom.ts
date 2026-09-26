/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { RefObject, useLayoutEffect } from 'react';

/**
 * Whether the titlebar is crowded: whether keeping the tagline under the name
 * and the creature would cost the wave any of its width. Published as
 * `data-crowded` on the bar, which takes both out (`App.scss`).
 *
 * Ivan, 2026-09-22: "the moment the wave starts narrowing remove help and pet
 * [...] and also hide the 'Your sound' text to make space". Of everything in
 * the bar those two say the least — the same sentence on every launch, and a
 * creature that is company rather than information — so neither may cost the
 * drawing a pixel, and they leave together.
 *
 * MEASURED, NOT WRITTEN DOWN. They used to leave at fixed widths, the tagline
 * at 1560 and the creature at 1280, and the wave was giving ground above both:
 * measured in English it was 22px short at 1561 and 191px short at 1281, with
 * the creature still there. Where it first gives ground depends on the names
 * in the two ends, which is a different width in every language
 * ("Multimedia en línea" against "Online Media").
 *
 * The test. The bar is three tracks, `minmax(max-content, 1fr)` either side
 * of the wave's `auto` one, and the grid grows an `auto` track to its content
 * before it hands a `1fr` track anything beyond its own. So an end with room
 * beside its content means the wave already has all it asks for, and both
 * ends down to their content means the wave has only what was left. Nothing
 * here needs to know how wide the wave wants to be — that stays the
 * stylesheet's to say.
 *
 * Coming back is the same sum the other way: the room the ends have spare
 * against what the two would take back, the tagline's excess over the name
 * above it and the creature with its gap. Away, the tagline is only out of
 * the flow (`position: absolute; visibility: hidden`), which keeps it
 * measurable in whatever language it is in by then; the creature is taken
 * out of the page, because her animations would otherwise go on running
 * unseen, and her width — a fixed 40px box — is remembered from the last
 * time she stood there.
 */

/** An end with less room than this beside its content has none to give. */
const NO_ROOM_PX = 0.5;

/**
 * Room wanted beyond an exact fit before the two come back. Without it, a
 * window on the boundary lays out one way, measures as the other, and flips.
 */
const COMEBACK_MARGIN_PX = 1;

export interface ITitlebarRoom {
  /** How much wider each end's track is than its content, px. */
  leftSpare: number;
  rightSpare: number;
  /** What the tagline and the creature would take back, px. */
  comeback: number;
}

/** The decision alone, apart from the page it is measured on. */
export const isTitlebarCrowded = (
  wasCrowded: boolean,
  { leftSpare, rightSpare, comeback }: ITitlebarRoom,
): boolean =>
  wasCrowded
    ? leftSpare + rightSpare < comeback + COMEBACK_MARGIN_PX
    : leftSpare < NO_ROOM_PX && rightSpare < NO_ROOM_PX;

const gapOf = (element: HTMLElement) =>
  Number.parseFloat(getComputedStyle(element).columnGap) || 0;

/**
 * What an end's parts take side by side: every part in the flow and its gaps,
 * without the elastic `auto` margin between them — which is the room.
 */
const contentWidth = (end: HTMLElement) => {
  const parts = Array.from(end.children).filter(
    (child): child is HTMLElement =>
      child instanceof HTMLElement &&
      child.offsetWidth > 0 &&
      getComputedStyle(child).position !== 'absolute',
  );
  const widths = parts.reduce(
    (total, part) => total + part.getBoundingClientRect().width,
    0,
  );
  return widths + Math.max(0, parts.length - 1) * gapOf(end);
};

const spareIn = (end: HTMLElement) =>
  end.getBoundingClientRect().width - contentWidth(end);

/** A change the ends are measured again for: anything outside a menu. */
const MENU = '[role="menu"]';
const movesAnEnd = (record: MutationRecord) => {
  const element =
    record.target instanceof Element
      ? record.target
      : record.target.parentElement;
  return !element?.closest(MENU);
};

/**
 * Watch the bar and keep `data-crowded` true to it. Returns the teardown.
 *
 * The bar is observed for size and the ends for what is in them, never the
 * ends for size: they are grid tracks, and every decision here moves them, so
 * a `ResizeObserver` on them would be answering its own writes — the loop
 * Chromium reports as undelivered notifications. The bar's width is the
 * window's and nothing in it. Their contents change by text (the language,
 * the media tab's one-word name), by children (the creature leaves while the
 * chrome idles) and by class (a tab chosen); `style` is left out, because the
 * creature's level is written there twenty times a second.
 *
 * Nothing inside an open menu counts. The actions menu and Help open inside
 * the right end, out of the flow, so what changes in them changes no end's
 * width — but every step of the menu's Brightness slider rewrote its
 * percentage and restyled its row, and each of those measured the bar: five
 * reads of the layout a step, on a window whose style had just been changed
 * everywhere, which was most of what held the slider to 20 frames a second.
 * A menu opening or closing is a child added to or taken from something
 * outside it, and is still measured.
 */
export const watchTitlebarRoom = (
  bar: HTMLElement,
  left: HTMLElement,
  right: HTMLElement,
): (() => void) => {
  let petWidth = 0;
  const pet = () => right.querySelector<HTMLElement>(':scope > .support-pet');

  const comeback = () => {
    const tagline = left.querySelector<HTMLElement>(
      '.workspace-header__tagline',
    );
    const column = tagline?.parentElement;
    // At the narrowest widths the name and tagline are a hover card out of
    // the flow, where showing the tagline costs the bar nothing.
    const taglineBack =
      tagline && column && getComputedStyle(column).position !== 'absolute'
        ? Math.max(
            0,
            tagline.getBoundingClientRect().width -
              column.getBoundingClientRect().width,
          )
        : 0;
    return taglineBack + (pet() && petWidth > 0 ? petWidth + gapOf(right) : 0);
  };

  /** One decision; true when it changed the bar. */
  const decide = () => {
    const wasCrowded = bar.hasAttribute('data-crowded');
    if (!wasCrowded) {
      petWidth = pet()?.getBoundingClientRect().width || petWidth;
    }
    const crowded = isTitlebarCrowded(wasCrowded, {
      leftSpare: spareIn(left),
      rightSpare: spareIn(right),
      comeback: wasCrowded ? comeback() : 0,
    });
    if (crowded === wasCrowded) {
      return false;
    }
    bar.toggleAttribute('data-crowded', crowded);
    return true;
  };

  // Settled before anything is painted: each decision is read straight back
  // off the layout it produced, so a creature met for the first time while
  // the bar is crowded — whose width was not yet known — can come back and
  // go again in the same frame. Three rounds is one more than that takes.
  const measure = () => {
    for (let round = 0; round < 3; round += 1) {
      if (!decide()) {
        return;
      }
    }
  };

  measure();
  const size = new ResizeObserver(measure);
  size.observe(bar);
  const contents = new MutationObserver((records) => {
    if (records.some(movesAnEnd)) {
      measure();
    }
  });
  [left, right].forEach((end) =>
    contents.observe(end, {
      characterData: true,
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class'],
    }),
  );
  return () => {
    size.disconnect();
    contents.disconnect();
    bar.removeAttribute('data-crowded');
  };
};

export const useTitlebarRoom = (
  header: RefObject<HTMLElement | null>,
  left: RefObject<HTMLElement | null>,
  right: RefObject<HTMLElement | null>,
) => {
  // A layout effect, so the first decision is made before the first paint
  // and a narrow window never shows the two for a frame.
  useLayoutEffect(() => {
    const bar = header.current;
    // `ResizeObserver` is absent in the jsdom the titlebar's tests run under —
    // see `useTransportStrip` for the same guard — so this is a no-op there
    // rather than something to mock.
    if (
      !bar ||
      !left.current ||
      !right.current ||
      typeof ResizeObserver === 'undefined'
    ) {
      return undefined;
    }
    return watchTitlebarRoom(bar, left.current, right.current);
  }, [header, left, right]);
};

export default useTitlebarRoom;
