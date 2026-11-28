/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useSyncExternalStore } from 'react';

/**
 * THE PLACES, LAST OF ALL, before the window's own buttons. At the window's
 * largest zoom (level 4, about 2.07x) a 1024px window is 493 CSS px wide, and
 * with the name, the meter, Help and the compact-player switch all gone the
 * nine glyphs, the logo, the actions key and Windows' three still took 577:
 * maximise and close were drawn past the window's right edge and could not be
 * pressed (found 2026-11-27, measured again 2026-11-28 in the harness at
 * every zoom level). So the places go too, one at a time and the least used
 * first, into the actions menu beside them, which lists them while they are
 * away (`useTitlebarPlacesShed`). The equaliser never goes, and neither does
 * the place on screen: choosing one from the menu brings it back to the bar
 * and the next in line goes instead, so the bar always says where the window
 * is.
 */

/** A place that can leave the bar: every tab but the equaliser's. */
export type TTitlebarPlace =
  | 'community'
  | 'share'
  | 'mic'
  | 'games'
  | 'dsp'
  | 'library'
  | 'karaoke'
  | 'video';

/**
 * The order they go in, least used first. Online Media and Karaoke stand
 * apart from the sound; Share Audio and Mic are for somebody else's ears;
 * the rack stays to the last, beside the equaliser it continues.
 */
export const PLACE_SHED_ORDER: readonly TTitlebarPlace[] = [
  'video',
  'karaoke',
  'share',
  'mic',
  'games',
  'library',
  'community',
  'dsp',
];

/** The order they stand in on the bar, left to right, for the menu's list. */
export const PLACE_BAR_ORDER: readonly TTitlebarPlace[] = [
  'community',
  'share',
  'mic',
  'games',
  'dsp',
  'library',
  'karaoke',
  'video',
];

const isPlace = (value: string | undefined): value is TTitlebarPlace =>
  PLACE_SHED_ORDER.some((place) => place === value);

/**
 * The next place to leave: the first in line that is on the bar, not already
 * out and not the one on screen. Undefined when there is none left to give.
 */
export const nextPlaceToShed = (
  shed: readonly TTitlebarPlace[],
  present: readonly TTitlebarPlace[],
  active: TTitlebarPlace | undefined,
): TTitlebarPlace | undefined =>
  PLACE_SHED_ORDER.find(
    (place) =>
      place !== active && present.includes(place) && !shed.includes(place),
  );

// What the actions menu lists. A store and not a prop, like Help's: the bar
// decides it in a layout effect by writing an attribute, never through React
// state, so the rest of the shell is not rendered again for it. Replaced, never
// mutated, so `useSyncExternalStore` sees each change.
let placesShed: readonly TTitlebarPlace[] = [];
const placesShedListeners = new Set<() => void>();
const publishPlacesShed = (next: readonly TTitlebarPlace[]) => {
  placesShed = next;
  placesShedListeners.forEach((listener) => listener());
};
const subscribePlacesShed = (listener: () => void) => {
  placesShedListeners.add(listener);
  return () => {
    placesShedListeners.delete(listener);
  };
};

/** The places out of the titlebar, in the order they stand on it. */
export const useTitlebarPlacesShed = (): readonly TTitlebarPlace[] =>
  useSyncExternalStore(subscribePlacesShed, () => placesShed);

/** How the bar stands, for one step of the places. */
export interface ITitlebarPlacesFit {
  /** Whether the bar runs past its edge. */
  overruns: boolean;
  /** Whether the ends have room for this much back, with a pixel over. */
  hasRoomFor: (width: number) => boolean;
}

export interface ITitlebarPlaces {
  /** Whether any place is out. */
  readonly isAnyShed: () => boolean;
  /**
   * One step: true when it changed the bar. The place on screen comes back
   * first, then one more goes while the bar runs over, then the last to go
   * comes back once there is room for it.
   */
  readonly step: (fit: ITitlebarPlacesFit) => boolean;
  /** Every place back on the bar: the watch is over. */
  readonly reset: () => void;
}

/**
 * The places of one bar. The tabs carry their name as `data-place`; each
 * place out wears `data-shed`, which the stylesheet takes off the bar
 * (`App.scss`), and its strip's first tab still there draws no rule before
 * it. Written here rather than rendered, so each step is laid out before the
 * next is measured, and written again at every step: React leaves an
 * attribute it does not own alone, and a tab it mounts afresh is marked at
 * the measure its arrival causes.
 */
export const watchTitlebarPlaces = (bar: HTMLElement): ITitlebarPlaces => {
  // Last out at the end. What each takes back is measured as it goes: its box
  // and the gap beside it in its strip.
  let shed: TTitlebarPlace[] = [];
  const widths = new Map<TTitlebarPlace, number>();

  const tabOf = (place: TTitlebarPlace) =>
    bar.querySelector<HTMLElement>(`.workspace-tab[data-place="${place}"]`);
  const present = () =>
    PLACE_SHED_ORDER.filter((place) => tabOf(place) !== null);
  const active = () => {
    const place = bar.querySelector<HTMLElement>(
      '.workspace-tab[aria-selected="true"]',
    )?.dataset.place;
    return isPlace(place) ? place : undefined;
  };

  const mark = () =>
    PLACE_SHED_ORDER.forEach((place) =>
      tabOf(place)?.toggleAttribute('data-shed', shed.includes(place)),
    );
  const write = (next: TTitlebarPlace[]) => {
    shed = next;
    mark();
    publishPlacesShed(PLACE_BAR_ORDER.filter((place) => shed.includes(place)));
  };

  const step = ({ overruns, hasRoomFor }: ITitlebarPlacesFit): boolean => {
    mark();
    const onScreen = active();
    if (onScreen && shed.includes(onScreen)) {
      write(shed.filter((place) => place !== onScreen));
      return true;
    }
    if (overruns) {
      const next = nextPlaceToShed(shed, present(), onScreen);
      const tab = next && tabOf(next);
      if (!next || !tab) {
        return false;
      }
      const strip = tab.parentElement;
      const gap = strip
        ? Number.parseFloat(getComputedStyle(strip).columnGap) || 0
        : 0;
      widths.set(next, tab.getBoundingClientRect().width + gap);
      write([...shed, next]);
      return true;
    }
    const last = shed[shed.length - 1];
    if (last && hasRoomFor(widths.get(last) ?? 0)) {
      write(shed.slice(0, -1));
      return true;
    }
    return false;
  };

  return {
    isAnyShed: () => shed.length > 0,
    step,
    reset: () => write([]),
  };
};
