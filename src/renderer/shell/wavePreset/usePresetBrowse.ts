/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  NONE_CHAIN_ID,
  dspPresetRowHint,
  dspPresetStages,
  inListOrder,
  type IDspCatalogEntry,
} from '../../dsp/dspPresetCatalog';
import { genreHookKey } from '../../dsp/genreNotesModel';
import { applyDspSettings, persistDspSettings } from '../../dsp/store';
import { useDspPresetSelection } from '../../dsp/useDspPresetSelection';
import { useFluidEqLayers } from '../../utils/FluidEqContext';
import { useTranslation } from '../../utils/I18nContext';
import { isOwnPreset, usePlayingPreset } from '../../components/useVoicingPick';
import {
  findsInOrder,
  searchPresets,
  searchablePresets,
  type IPresetWords,
} from './presetSearch';
import useFavouriteEdits from './useFavouriteEdits';

/** One row the keys can land on, in the order the panel draws them. */
export interface IBrowseRow {
  id: string;
  /** None and the row that only says what plays take no star. */
  isStarrable: boolean;
}

/**
 * Everything the titlebar plate's panel knows below its head: what is typed,
 * what it finds, the favourites as this opening shows them, which row the
 * keys are on, and what a press does (Ivan, 2026-11-25, design A: "search the
 * full list here and add to favourites").
 *
 * Held by the plate (`WavePresetMusic`) rather than by the list, because the
 * panel's own keys (`presetMenuKeys`) answer from anywhere in it, the head
 * included; it reads what plays from the plate's own `usePlayingPreset`.
 */
const usePresetBrowse = (
  isOpen: boolean,
  close: () => void,
  playing: ReturnType<typeof usePlayingPreset>,
) => {
  const { t } = useTranslation();
  const { settings, favorites, catalog, activeId, active, isApo } = playing;
  const { isEnabled, isBlockingError } = useFluidEqLayers();
  const { apply, selecting } = useDspPresetSelection(
    settings,
    applyDspSettings,
    persistDspSettings,
    true,
  );
  const [query, setQueryState] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);
  // Set by the arrows: the strip then says which keys do what.
  const [usedKeys, setUsedKeys] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const rowIdBase = useId();
  const known = useMemo(() => catalog.map((preset) => preset.id), [catalog]);
  const starred = useMemo(
    () => new Set(favorites.map((preset) => preset.id)),
    [favorites],
  );
  const edits = useFavouriteEdits(isOpen, known, starred);

  // A panel opened again starts without the last search.
  useLayoutEffect(() => {
    if (!isOpen) {
      setQueryState('');
      setActiveIndex(-1);
      setUsedKeys(false);
    }
  }, [isOpen]);

  const searchable = useMemo(
    () => searchablePresets(catalog, isApo),
    [catalog, isApo],
  );
  const wordsOf = (preset: IDspCatalogEntry): IPresetWords => {
    const hook = genreHookKey(preset.id);
    return {
      hook: hook ? t(hook) : undefined,
      // Equalizer APO runs no rack: a stage is nothing a preset does there.
      stages: isApo ? [] : dspPresetStages(preset, t),
    };
  };
  const search = searchPresets(searchable, query, wordsOf);

  /** What a row says about a preset when it was not found by that. */
  const hintOf = (preset: IDspCatalogEntry): string => {
    if (isOwnPreset(preset)) {
      return t('wavePreset.yours');
    }
    if (isApo) {
      return wordsOf(preset).hook ?? t('dsp.quick.apo');
    }
    return dspPresetRowHint(preset, t);
  };

  // What played without a star when the panel opened stands under None for
  // the whole opening, starred here or not: given a star, it would otherwise
  // leave that row for its place among the favourites under the pointer.
  // Read as the panel opens, during the render that opens it.
  const [opening, setOpening] = useState({ isOpen, lead: '' });
  if (opening.isOpen !== isOpen) {
    setOpening({
      isOpen,
      lead: isOpen && active && !starred.has(active.id) ? active.id : '',
    });
  }
  const leadId = active?.id === opening.lead ? opening.lead : '';

  // The favourites in the Preset tab's order, with the ones unstarred in
  // this opening still standing where they were (`useFavouriteEdits`).
  const shownFavourites = inListOrder(catalog).filter(
    (preset) =>
      preset.id !== NONE_CHAIN_ID &&
      preset.id !== leadId &&
      (starred.has(preset.id) || edits.gone.has(preset.id)),
  );
  // What plays when it is no favourite stands under None as the chosen row,
  // so the list never hides it.
  const playingElsewhere =
    active && !shownFavourites.some((preset) => preset.id === active.id)
      ? active
      : undefined;

  const rows: IBrowseRow[] = search
    ? findsInOrder(search).map(({ preset }) => ({
        id: preset.id,
        isStarrable: true,
      }))
    : [
        { id: 'none', isStarrable: false },
        ...(playingElsewhere
          ? [{ id: playingElsewhere.id, isStarrable: true }]
          : []),
        ...shownFavourites.map((preset) => ({
          id: preset.id,
          isStarrable: true,
        })),
      ];

  const setQuery = (next: string) => {
    setQueryState(next);
    // Typing moves on from the last star, and lands on the first find, so
    // "pop" and Enter plays Pop.
    edits.dismiss();
    setActiveIndex(next.trim() ? 0 : -1);
  };

  const play = (id: string) => {
    close();
    // The one playing is already playing: the press only closes the list.
    if (id !== activeId) {
      apply(id).catch(() => undefined);
    }
  };

  return {
    query,
    setQuery,
    search,
    rows,
    activeIndex: Math.min(activeIndex, rows.length - 1),
    setActiveIndex,
    usedKeys,
    noteKeys: () => setUsedKeys(true),
    /** The id a row is drawn with, for the field's active descendant. */
    rowId: (index: number) => `${rowIdBase}-row-${index}`,
    listId: `${rowIdBase}-list`,
    inputRef,
    edits,
    starred,
    shownFavourites,
    playingElsewhere,
    activeId,
    searchableCount: searchable.length,
    catalog,
    hintOf,
    play,
    isDisabled: isBlockingError || !isEnabled || selecting,
  };
};

export type TPresetBrowse = ReturnType<typeof usePresetBrowse>;

export default usePresetBrowse;
