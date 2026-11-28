/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useSyncExternalStore } from 'react';
import type { LocaleCode } from 'common/i18n';
import type { IGalleryScene } from 'common/plusGallery';
import { resolveSceneName, type TLocalizedName } from 'common/scenePacks';

/**
 * THE ORDER OF THE LOOKS, for the picker and for the arrows alike (Ivan,
 * 2026-11-27: "show scenes plus and standard in same order of the next next
 * next ... the menu that opens needs to be in same order").
 *
 * The arrows used to walk the looks in the order their lists were built -
 * the standard looks, then FluidEQ's scenes as the account's listing came,
 * then the members' - while the picker showed the scenes newest first, so
 * the look after the one on the graph was nowhere near it in the menu. Now
 * both read this module: the picker lays its places out with `orderLooks`
 * and the arrows walk `orderLooks` over the same looks (`getLookWalk`).
 *
 * The walk is the picker's Everything exactly as it shows with From on All:
 * the Plus scenes in the order chosen in its Sort menu, Name by default, and
 * then the standard looks in their fixed order - Analysis, then Animated,
 * each look saved in the designer right under the look it was made from. A
 * locked scene is shown in the menu and never stepped onto.
 *
 * Next never stops at the end of a group: past the last Analysis look comes
 * the first Animated one, past the last standard look the first scene, past
 * the last scene the Analyzer, and Previous the same way back - the Everything
 * grid read on and round. Every other place in the picker shows that same
 * order with the looks it does not hold left out, so neighbours there are in
 * the arrows' order too; New and updated alone keeps an order of its own, by
 * date (`TSortShelf`), which the arrows do not follow.
 *
 * The standard looks keep their designed order under every sort: they are a
 * fixed set, measuring views first, and an alphabet would scatter them.
 */

export type TLookSort = 'newest' | 'updated' | 'name' | 'used';

/** The Sort menu's entries, in the order it lists them. */
export const LOOK_SORTS: readonly TLookSort[] = [
  'newest',
  'updated',
  'name',
  'used',
];

/**
 * Which of the picker's two orders a place is laid out in. New and updated
 * is a list of what changed lately, so it reads newest first and keeps its
 * own Sort; every other place is the catalogue, alphabetical unless the
 * reader chose otherwise, and the catalogue's order is the one the arrows
 * walk.
 */
export type TSortShelf = 'catalogue' | 'fresh';

export type TLookSorts = Readonly<Record<TSortShelf, TLookSort>>;

export const DEFAULT_LOOK_SORTS: TLookSorts = {
  catalogue: 'name',
  fresh: 'newest',
};

/**
 * Chosen for the session, as the picker's place and view are: a launch opens
 * on the defaults again.
 */
let sorts: TLookSorts = DEFAULT_LOOK_SORTS;
const listeners = new Set<() => void>();

export const getLookSorts = (): TLookSorts => sorts;

export const setLookSort = (shelf: TSortShelf, sort: TLookSort) => {
  if (sorts[shelf] === sort) {
    return;
  }
  sorts = { ...sorts, [shelf]: sort };
  listeners.forEach((listener) => listener());
};

export const subscribeLookSorts = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** Both orders, as one stable object until one of them changes. */
export const useLookSorts = (): TLookSorts =>
  useSyncExternalStore(subscribeLookSorts, getLookSorts, getLookSorts);

/** For tests: the session's first order again. */
export const resetLookSortsForTesting = () => {
  sorts = DEFAULT_LOOK_SORTS;
  listeners.forEach((listener) => listener());
};

/** Everything a scene is put in order by. */
export interface ISceneOrderFacts {
  id: string;
  /** In the window's language: the name the reader sees on its tile. */
  name: string;
  /**
   * When the gallery first published it, when its newest version went up and
   * how many members have added it, from the gallery's own listing: absent
   * for a scene this session's gallery has not described.
   */
  publishedAt?: string;
  updatedAt?: string;
  adds?: number;
}

/**
 * A scene's facts, worked out the one way the picker's tile and the arrows'
 * walk both use, so the two can never sort the same scene differently.
 */
export const sceneOrderFacts = (
  id: string,
  scene: { names: TLocalizedName },
  gallery: IGalleryScene | undefined,
  locale: LocaleCode,
): ISceneOrderFacts => ({
  id,
  name: resolveSceneName(scene, locale),
  ...(gallery
    ? {
        updatedAt: gallery.updatedAt,
        adds: gallery.adds,
        ...(gallery.firstPublishedAt
          ? { publishedAt: gallery.firstPublishedAt }
          : {}),
      }
    : {}),
});

// One collator per language, built on first use: `localeCompare` builds a
// new one for every comparison. Numeric, so "Ocean 2" comes before
// "Ocean 10" as a reader expects of names.
const collators = new Map<LocaleCode, Intl.Collator>();
const collatorFor = (locale: LocaleCode): Intl.Collator => {
  const known = collators.get(locale);
  if (known) {
    return known;
  }
  const made = new Intl.Collator(locale, { numeric: true });
  collators.set(locale, made);
  return made;
};

const time = (value: string | undefined) => {
  const parsed = value ? Date.parse(value) : NaN;
  return Number.isNaN(parsed) ? undefined : parsed;
};

/**
 * Highest first; a scene the gallery has not described has no date and no
 * count, and goes after those that have one.
 */
const highestFirst =
  (read: (row: ISceneOrderFacts) => number | undefined) =>
  (a: ISceneOrderFacts, b: ISceneOrderFacts) => {
    const left = read(a);
    const right = read(b);
    if (left === undefined || right === undefined) {
      return Number(left === undefined) - Number(right === undefined);
    }
    return right - left;
  };

const BY_SORT: Record<
  TLookSort,
  (a: ISceneOrderFacts, b: ISceneOrderFacts) => number
> = {
  newest: highestFirst((row) => time(row.publishedAt)),
  updated: highestFirst((row) => time(row.updatedAt)),
  used: highestFirst((row) => row.adds),
  name: () => 0,
};

const byCodeUnits = (a: string, b: string) => {
  if (a === b) {
    return 0;
  }
  return a < b ? -1 : 1;
};

/**
 * The scenes in `sort`'s order. A TOTAL order: what the sort cannot tell
 * apart - the same date, no date at all, the same name - goes by name in the
 * reader's language and then by id, never by the order the rows came in.
 * The picker builds its rows from the account's listings and the arrows
 * from the looks that can play, each in its own order; ordered from the
 * facts alone, the same scenes come out the same way from both.
 */
export const orderScenes = <T extends ISceneOrderFacts>(
  rows: readonly T[],
  sort: TLookSort,
  locale: LocaleCode,
): T[] => {
  const collator = collatorFor(locale);
  const bySort = BY_SORT[sort];
  return [...rows].sort(
    (a, b) =>
      bySort(a, b) ||
      collator.compare(a.name, b.name) ||
      byCodeUnits(a.id, b.id),
  );
};

export interface IOrderedLooks<S, C> {
  scenes: C[];
  styles: S[];
  /** The scenes then the standard looks: the Everything grid, read on. */
  all: Array<S | C>;
}

/**
 * The looks as the picker lays them out and the arrows walk them: the
 * scenes in `sort`'s order, then the standard looks as they are given,
 * which is their fixed order (`getSelectableLooks`).
 */
export const orderLooks = <S, C extends ISceneOrderFacts>(
  styles: readonly S[],
  scenes: readonly C[],
  sort: TLookSort,
  locale: LocaleCode,
): IOrderedLooks<S, C> => {
  const ordered = orderScenes(scenes, sort, locale);
  return {
    scenes: ordered,
    styles: [...styles],
    all: [...ordered, ...styles],
  };
};

/**
 * The look one step along `walk` from `from`, skipping any `allowed`
 * refuses, or undefined when nothing qualifies. The step, what Auto prepares
 * ahead of it and the pictures at the graph's edges all ask this, so each
 * names exactly the look the press puts on.
 *
 * The walk keeps its place and direction whatever is skipped, and gives up
 * after a full turn rather than looping for ever. A look found nowhere in it
 * (a scene set aside this session) is walked from the walk's first look.
 */
export const stepAlong = (
  walk: readonly string[],
  from: string,
  direction: 1 | -1,
  allowed: (id: string) => boolean = () => true,
): string | undefined => {
  const count = walk.length;
  const start = Math.max(0, walk.indexOf(from));
  for (let step = 1; step <= count; step += 1) {
    // `+ count` before the remainder, so a backwards walk past the start
    // lands on the end rather than on a negative index.
    const at = (((start + direction * step) % count) + count) % count;
    const next = walk[at];
    if (next !== undefined && allowed(next)) {
      return next;
    }
  }
  return undefined;
};
