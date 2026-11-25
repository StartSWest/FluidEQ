/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  GRAPH_STYLE_FAMILIES,
  type TGraphStyleFamily,
} from 'common/graphStyleFamilies';
import type { LocaleCode } from 'common/i18n';
import { isPlusCategory, type TPlusCategory } from 'common/plusGallery';
import {
  isUnseenSceneVersion,
  seenSceneVersion,
} from '../utils/seenSceneVersions';
import { matchesSearch, type IPlusRow, type IStyleRow } from './lookPickerRows';

/**
 * What the look picker shows, as three separate questions (Ivan, 2026-11-19:
 * "made by you, made by FluidEQ, made by whatever ... I don't know").
 *
 * WHERE, the rail's place: everything, what is new, a family of styles, or a
 * category of scenes - only ever what a look IS. FROM, the tabs over the
 * grid: who made it. HOW, the sort. The makers used to be two more pills at
 * the end of the categories, so "Made by you" sat beside "Water" as if it
 * were a kind of picture, and choosing it threw the category away.
 */

/** `all-scenes` is not a family: the styles' own `scenes` family is Animated. */
export type TPickerPlace =
  'everything' | 'fresh' | 'all-scenes' | TGraphStyleFamily | TPlusCategory;

export type TPickerFrom = 'all' | 'fluideq' | 'members' | 'yours';

export type TPickerSort = 'newest' | 'updated' | 'name' | 'used';

export type TPickerView = 'grid' | 'details';

export const PICKER_SORTS: readonly TPickerSort[] = [
  'newest',
  'updated',
  'name',
  'used',
];

/**
 * How a scene has changed for this listener: a version newer than the one
 * last played here (`updated`), a newer one in the gallery than the one on
 * this computer (`newer`), or published lately and never played (`new`).
 */
export type TFreshness = 'new' | 'updated' | 'newer';

/**
 * How long a scene counts as new after the gallery first published it.
 * Two weeks: the gallery's own "This week" lists are a week, and a picker
 * opened once a week would otherwise never see a scene marked.
 */
const NEW_FOR_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * `now` is when the picker opened, so the marks do not change while it is
 * open; Help's drawing passes none and marks nothing new.
 */
export const freshnessOf = (
  row: IPlusRow,
  now: number | undefined,
): TFreshness | undefined => {
  if (row.locked) {
    return undefined;
  }
  if (isUnseenSceneVersion(row.id, row.version)) {
    return 'updated';
  }
  if (row.latest !== undefined) {
    return 'newer';
  }
  const published = row.publishedAt ? Date.parse(row.publishedAt) : NaN;
  return now !== undefined &&
    seenSceneVersion(row.id) === undefined &&
    now - published < NEW_FOR_MS
    ? 'new'
    : undefined;
};

/** Who made a look, as its tile's mark says it (`OriginMark`). */
export const originOf = (row: IStyleRow | IPlusRow): TPickerFrom => {
  if ('look' in row) {
    return row.yours ? 'yours' : 'fluideq';
  }
  if (row.maker === 'mine') {
    return 'yours';
  }
  return row.maker === 'members' ? 'members' : 'fluideq';
};

/**
 * Every From tab a scene is shown under besides All. FluidEQ's own scenes
 * are also Yours to the account that publishes them (`ownsOfficialScenes`,
 * the same word the gallery's hearts go by): Ivan, 2026-11-25, on the
 * account he publishes them from, "all should be on both sides: all mine
 * and all FluidEQ, same number". It counted only its two member scenes as
 * its own. For every other account a scene has exactly one maker.
 */
export const fromsOfScene = (
  row: IPlusRow,
  ownsOfficialScenes: boolean,
): TPickerFrom[] => {
  const origin = originOf(row);
  return origin === 'fluideq' && ownsOfficialScenes
    ? ['fluideq', 'yours']
    : [origin];
};

/**
 * FROM IS WHERE A SCENE COMES FROM, AND NOTHING ELSE (Ivan, 2026-11-25, of
 * "FluidEQ 71" over thirty-two of FluidEQ's scenes: "this is confusing,
 * 71?? we don't have 71 FluidEQ Plus scenes"). The tabs counted the
 * thirty-nine standard styles into FluidEQ and All, and the member's saved
 * styles into Yours, so a tab's number was never the number of scenes it
 * showed. Now a tab other than All shows that maker's scenes alone and no
 * style - a style has no maker to choose between - and All holds back
 * nothing. A family of styles is outside the question altogether: there
 * From is not offered (`LookPickerBody`) and narrows nothing, so a tab left
 * on Members never empties Analysis.
 */
export const keepFrom = (
  row: IStyleRow | IPlusRow,
  from: TPickerFrom,
  ownsOfficialScenes = false,
) =>
  from === 'all' ||
  (!('look' in row) && fromsOfScene(row, ownsOfficialScenes).includes(from));

export const isStylePlace = (place: TPickerPlace): place is TGraphStyleFamily =>
  (GRAPH_STYLE_FAMILIES as readonly string[]).includes(place);

/** Whether the place holds styles at all, or only scenes. */
export const placeHoldsStyles = (place: TPickerPlace) =>
  place === 'everything' || isStylePlace(place);

export const placeHoldsScenes = (place: TPickerPlace) => !isStylePlace(place);

export const keepStyleIn = (row: IStyleRow, place: TPickerPlace) =>
  place === 'everything' || row.family === place;

export const keepSceneIn = (
  row: IPlusRow,
  place: TPickerPlace,
  fresh: TFreshness | undefined,
) => {
  if (place === 'everything' || place === 'all-scenes') {
    return true;
  }
  if (place === 'fresh') {
    return fresh !== undefined;
  }
  return isPlusCategory(place) && row.categories.includes(place);
};

/** The style families something is filed under, in the families' order. */
export const stylePlaces = (rows: readonly IStyleRow[]): TGraphStyleFamily[] =>
  GRAPH_STYLE_FAMILIES.filter((family) =>
    rows.some((row) => row.family === family),
  );

/**
 * Every maker that has a scene to show, as the old maker pills only showed
 * when there was somebody to pick. None at all - no scene on this computer
 * yet - and there is nothing to choose between: only All.
 */
export const pickerFroms = (
  plusRows: readonly IPlusRow[],
  ownsOfficialScenes = false,
): TPickerFrom[] => {
  const has = (from: TPickerFrom) =>
    plusRows.some((row) =>
      fromsOfScene(row, ownsOfficialScenes).includes(from),
    );
  const makers: TPickerFrom[] = ['fluideq', 'members', 'yours'];
  return ['all', ...makers.filter(has)];
};

/**
 * Whether the From tabs belong over a place: only where scenes can be, and
 * only once there is a maker to choose. A family of styles holds none.
 */
export const offersFrom = (
  place: TPickerPlace | undefined,
  froms: readonly TPickerFrom[],
) => froms.length > 1 && (place === undefined || placeHoldsScenes(place));

/**
 * A scene the gallery has not described yet has no date and no count: it
 * goes after those that have one, in the order the rows were built, so a
 * sort never shuffles what it knows nothing about.
 */
const byKnown =
  <T>(
    read: (row: IPlusRow) => T | undefined,
    higherFirst: (a: T, b: T) => number,
  ) =>
  (a: IPlusRow, b: IPlusRow) => {
    const left = read(a);
    const right = read(b);
    if (left === undefined || right === undefined) {
      return Number(left === undefined) - Number(right === undefined);
    }
    return higherFirst(left, right);
  };

const time = (value: string | undefined) => {
  const parsed = value ? Date.parse(value) : NaN;
  return Number.isNaN(parsed) ? undefined : parsed;
};

export const sortScenes = (
  rows: readonly IPlusRow[],
  sort: TPickerSort,
  locale: LocaleCode,
): IPlusRow[] => {
  const compare = {
    newest: byKnown(
      (row) => time(row.publishedAt),
      (a, b) => b - a,
    ),
    updated: byKnown(
      (row) => time(row.updatedAt),
      (a, b) => b - a,
    ),
    used: byKnown(
      (row) => row.adds,
      (a, b) => b - a,
    ),
    name: (a: IPlusRow, b: IPlusRow) => a.name.localeCompare(b.name, locale),
  }[sort];
  // `sort` is stable, so equal rows keep the order they were built in.
  return [...rows].sort(compare);
};

/** Styles have no dates or counts: only Name reorders them. */
export const sortStyles = (
  rows: readonly IStyleRow[],
  sort: TPickerSort,
  locale: LocaleCode,
): IStyleRow[] =>
  sort === 'name'
    ? [...rows].sort((a, b) => a.name.localeCompare(b.name, locale))
    : [...rows];

export interface ISelectedLooks {
  styles: IStyleRow[];
  scenes: IPlusRow[];
}

/**
 * The looks a place holds from a maker, matching what is typed. A search
 * looks everywhere (`place` undefined): somebody typing a name does not want
 * it hidden by the place they happened to be standing in.
 *
 * What a From tab counts is exactly the scenes it then shows: the same
 * call, with no other rule between the number and the grid.
 */
export const selectLooks = (
  styleRows: readonly IStyleRow[],
  plusRows: readonly IPlusRow[],
  freshness: ReadonlyMap<string, TFreshness>,
  place: TPickerPlace | undefined,
  from: TPickerFrom,
  query: string,
  ownsOfficialScenes = false,
): ISelectedLooks => {
  const typed = query.trim().length > 0;
  // A family of styles is outside From's question (`keepFrom`).
  const styleFrom = place !== undefined && isStylePlace(place) ? 'all' : from;
  const keep = (row: IStyleRow | IPlusRow) =>
    keepFrom(row, 'look' in row ? styleFrom : from, ownsOfficialScenes) &&
    (!typed || matchesSearch(row.search, query));
  return {
    styles: styleRows.filter(
      (row) =>
        keep(row) &&
        (place === undefined ||
          (placeHoldsStyles(place) && keepStyleIn(row, place))),
    ),
    scenes: plusRows.filter(
      (row) =>
        keep(row) &&
        (place === undefined || keepSceneIn(row, place, freshness.get(row.id))),
    ),
  };
};
