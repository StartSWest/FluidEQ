/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { RefObject, useLayoutEffect, useSyncExternalStore } from 'react';

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
 *
 * AFTER THEM, THE BAR ITSELF RUNS OUT. The window's minimum is 1024, but the
 * page zooms to about twice its size, and from about 650px the bar's ends at
 * their content and the meter at its floor were wider than the window: the
 * minimise, maximise and close buttons went past its right edge. So, in the
 * order Ivan chose (2026-09-28, "shed small things"), the meter goes
 * (`data-shed-meter`), then Help and the compact-player switch
 * (`data-shed-tools`), and the tabs and the window's buttons always stay.
 * Neither of the two is lost: the actions menu beside them takes both in
 * while they are away (`useTitlebarToolsShed`). Each goes when the bar runs
 * past its edge and comes back when the ends have room for what it takes
 * back, remembered as it went; the last to go is the first back, and the
 * tagline and the creature come back only after both.
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

export interface ITitlebarFit {
  /** How far the bar's contents run past its padding box, px. */
  overrun: number;
  /** How much wider the two ends' tracks are than their content, px. */
  spare: number;
  /** What coming back would take, px, remembered as it went. */
  takesBack: number;
}

/** One of the bar's own parts: whether it is out, given how the bar fits. */
export const isShedFromTitlebar = (
  wasShed: boolean,
  { overrun, spare, takesBack }: ITitlebarFit,
): boolean =>
  wasShed ? spare < takesBack + COMEBACK_MARGIN_PX : overrun > NO_ROOM_PX;

// Whether Help and the compact-player switch are out of the bar, for the
// actions menu to take them in. A store and not a prop: the bar decides it
// in a layout effect by writing an attribute, never through React state, so
// the rest of the shell is not rendered again for it.
let toolsShed = false;
const toolsShedListeners = new Set<() => void>();
const setToolsShed = (next: boolean) => {
  if (next !== toolsShed) {
    toolsShed = next;
    toolsShedListeners.forEach((listener) => listener());
  }
};
const subscribeToolsShed = (listener: () => void) => {
  toolsShedListeners.add(listener);
  return () => {
    toolsShedListeners.delete(listener);
  };
};

/** True while Help and the compact-player switch are out of the titlebar. */
export const useTitlebarToolsShed = () =>
  useSyncExternalStore(subscribeToolsShed, () => toolsShed);

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

  // The bar's own parts, in the order they go.
  const meter = () => bar.querySelector<HTMLElement>(':scope > .titlebar-nav');
  const tools = () =>
    Array.from(
      right.querySelectorAll<HTMLElement>(
        '.titlebar-instrument > :is(.help-menu, .window-mode-switch)',
      ),
    );
  // What each would take back, measured the moment it went: the meter at its
  // floor and the gap its track stood in, the two tools and their gaps.
  let meterBack = 0;
  let toolsBack = 0;

  /** How far the right end runs past the bar's padding box, px. */
  const overrun = () => {
    const edge =
      bar.getBoundingClientRect().right -
      (Number.parseFloat(getComputedStyle(bar).paddingRight) || 0);
    return Math.max(0, right.getBoundingClientRect().right - edge);
  };
  const fit = (takesBack: number): ITitlebarFit => ({
    overrun: overrun(),
    spare: spareIn(left) + spareIn(right),
    takesBack,
  });

  /**
   * The bar's own parts, last out first back; true when it changed the bar.
   * Undefined when neither is out and the bar still fits with the meter,
   * which leaves the tagline and the creature to the decision below.
   */
  const shed = (): boolean | undefined => {
    if (bar.hasAttribute('data-shed-tools')) {
      if (isShedFromTitlebar(true, fit(toolsBack))) {
        return false;
      }
      bar.removeAttribute('data-shed-tools');
      setToolsShed(false);
      return true;
    }
    if (bar.hasAttribute('data-shed-meter')) {
      if (!isShedFromTitlebar(true, fit(meterBack))) {
        bar.removeAttribute('data-shed-meter');
        return true;
      }
      if (!isShedFromTitlebar(false, fit(0))) {
        return false;
      }
      toolsBack = tools().reduce(
        (total, tool) =>
          total +
          tool.getBoundingClientRect().width +
          (tool.parentElement ? gapOf(tool.parentElement) : 0),
        0,
      );
      bar.setAttribute('data-shed-tools', '');
      setToolsShed(true);
      return true;
    }
    if (bar.hasAttribute('data-crowded') && isShedFromTitlebar(false, fit(0))) {
      meterBack = (meter()?.getBoundingClientRect().width ?? 0) + gapOf(bar);
      bar.setAttribute('data-shed-meter', '');
      return true;
    }
    return undefined;
  };

  /** One decision; true when it changed the bar. */
  const decide = () => {
    const shedding = shed();
    if (shedding !== undefined) {
      return shedding;
    }
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
  // go again in the same frame, and a window that opens at its narrowest
  // sheds all three steps before its first frame. Five rounds is one more
  // than the longest of those takes.
  const measure = () => {
    for (let round = 0; round < 5; round += 1) {
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
    bar.removeAttribute('data-shed-meter');
    bar.removeAttribute('data-shed-tools');
    setToolsShed(false);
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
