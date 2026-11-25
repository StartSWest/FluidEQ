/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  compactSearchText,
  matchesSearchTerms,
  searchTerms,
} from '../../../common/searchText';
import {
  NONE_CHAIN_ID,
  type IDspCatalogEntry,
} from '../../dsp/dspPresetCatalog';

/**
 * The groups the titlebar plate's search files its finds under, in the
 * Preset tab's order: Yours, then the factory's. The Gaming chains are the
 * Gaming tab's (a game's sound is tuned in the Gaming Lab alone), and None
 * is the panel's own first row, so neither is searched.
 */
export const SEARCH_GROUPS = [
  'saved',
  'basic',
  'genre',
  'scene',
  'repair',
] as const;
export type TSearchGroup = (typeof SEARCH_GROUPS)[number];

const isSearchGroup = (group: string): group is TSearchGroup =>
  (SEARCH_GROUPS as readonly string[]).includes(group);

/** What a preset says about itself beyond its name, in the window's language. */
export interface IPresetWords {
  /** A genre's line (`genreHookKey`), or undefined for any other preset. */
  hook?: string;
  /** The stages its rack runs (`dspPresetStages`), empty under Equalizer APO. */
  stages: readonly string[];
}

export interface IPresetFind {
  preset: IDspCatalogEntry;
  /**
   * Why a preset found by what it does was found, for its row's hint: the
   * genre's line, or the one stage the query named. Undefined for a find by
   * name, whose row says what it always says.
   */
  because?: { kind: 'hook' | 'stage'; text: string };
}

export interface IPresetSearch {
  terms: readonly string[];
  /** Found by name, a section per group that has any. */
  byName: ReadonlyArray<{ group: TSearchGroup; finds: IPresetFind[] }>;
  /** Found by a genre's line or a stage the rack runs, after every name. */
  byWhat: IPresetFind[];
  count: number;
}

/**
 * Every preset the search reaches, in catalogue order. Under Equalizer APO a
 * Room copy is left out, as both pickers leave it out there: APO plays a
 * chain's curve and nothing else, so it would be the chain it copies under a
 * name that promises a room.
 */
export const searchablePresets = (
  catalog: readonly IDspCatalogEntry[],
  isApo: boolean,
): IDspCatalogEntry[] =>
  catalog.filter(
    (preset) =>
      preset.id !== NONE_CHAIN_ID &&
      isSearchGroup(preset.group) &&
      !(isApo && preset.group !== 'saved' && preset.settings.room.enabled),
  );

/**
 * Names first, grouped; then what the others do. Every word typed has to be
 * in the same field — a name, a genre's line, or one stage's name — in any
 * order, folded as every search in the app folds (`searchText.ts`), so
 * "drum bass" finds "Drum & bass" and "bass" finds every chain that runs
 * Bass Forge or Bass Punch. Undefined while nothing is typed.
 */
export const searchPresets = (
  presets: readonly IDspCatalogEntry[],
  query: string,
  wordsOf: (preset: IDspCatalogEntry) => IPresetWords,
): IPresetSearch | undefined => {
  const terms = searchTerms(query);
  if (terms.length === 0) {
    return undefined;
  }
  const holds = (text: string | undefined) =>
    text !== undefined &&
    text !== '' &&
    matchesSearchTerms(compactSearchText(text), terms);
  const named: IPresetFind[] = [];
  const byWhat: IPresetFind[] = [];
  presets.forEach((preset) => {
    if (holds(preset.name)) {
      named.push({ preset });
      return;
    }
    const { hook, stages } = wordsOf(preset);
    if (hook !== undefined && holds(hook)) {
      byWhat.push({ preset, because: { kind: 'hook', text: hook } });
      return;
    }
    const stage = stages.find(holds);
    if (stage !== undefined) {
      byWhat.push({ preset, because: { kind: 'stage', text: stage } });
    }
  });
  const byName = SEARCH_GROUPS.map((group) => ({
    group,
    finds: named.filter(({ preset }) => preset.group === group),
  })).filter(({ finds }) => finds.length > 0);
  return {
    terms,
    byName,
    byWhat,
    count: named.length + byWhat.length,
  };
};

/** The finds in the order they are drawn, which is the order the keys walk. */
export const findsInOrder = (search: IPresetSearch): IPresetFind[] => [
  ...search.byName.flatMap(({ finds }) => finds),
  ...search.byWhat,
];
