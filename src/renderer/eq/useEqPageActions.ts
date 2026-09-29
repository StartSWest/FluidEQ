/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { PointerEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  DEFAULT_QUALITY,
  FilterTypeEnum,
  IFilter,
  IFilterEdit,
  isBandEnabled,
  MAX_FREQUENCY,
  MAX_NUM_FILTERS,
  MIN_FREQUENCY,
  MIN_NUM_FILTERS,
  NO_GAIN_FILTER_TYPES,
} from 'common/constants';
import { ErrorDescription } from 'common/errors';
import {
  addEqualizerSlider,
  removeEqualizerSlider,
  setFilterValues,
} from '../utils/equalizerApi';
import { FilterActionEnum } from '../utils/FluidEqContext';
import useTone from './useTone';
import { clamp } from '../utils/utils';
import { BAND_MENU_EVENT } from '../components/BandMenu';
import { type TEqPageBands } from './useEqPageBands';

/**
 * What the EQ page does to its bands: selecting several by dragging over
 * them, deleting, resetting, retyping, adding a band or one beside another,
 * switching them on and off, and clearing the EQ — built on the bands and
 * run after their hooks, in the order the page always ran them.
 */
const useEqPageActions = (bands: TEqPageBands) => {
  const {
    filters,
    dispatchFilter,
    setGlobalError,
    selectedFilterIds,
    setSelectedFilterIds,
    t,
    frequencySortedFilters,
    selectedFilters,
    selectedCount,
    isGroupEdit,
    bandsRef,
    selectionBox,
    setSelectionBox,
  } = bands;
  const getSelectionPoint = (event: PointerEvent<HTMLDivElement>) => {
    const bounds = bandsRef.current?.getBoundingClientRect();
    if (!bounds) {
      return undefined;
    }
    return {
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
    };
  };

  const handleBandsPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) {
      return;
    }
    const point = getSelectionPoint(event);
    if (!point) {
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelectionBox({
      startX: point.x,
      startY: point.y,
      currentX: point.x,
      currentY: point.y,
    });
  };

  const handleBandsPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!selectionBox) {
      return;
    }
    const point = getSelectionPoint(event);
    if (!point) {
      return;
    }
    setSelectionBox((current) =>
      current ? { ...current, currentX: point.x, currentY: point.y } : current,
    );
  };

  const finishBandSelection = (event: PointerEvent<HTMLDivElement>) => {
    if (!selectionBox) {
      return;
    }
    const bounds = bandsRef.current?.getBoundingClientRect();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    const left = Math.min(selectionBox.startX, selectionBox.currentX);
    const right = Math.max(selectionBox.startX, selectionBox.currentX);
    const top = Math.min(selectionBox.startY, selectionBox.currentY);
    const bottom = Math.max(selectionBox.startY, selectionBox.currentY);
    const isClick = right - left < 6 && bottom - top < 6;
    const selectedIds = isClick
      ? []
      : Array.from(
          bandsRef.current?.querySelectorAll<HTMLElement>('[data-filter-id]') ||
            [],
        )
          .filter((element) => {
            if (!bounds) {
              return false;
            }
            const elementBounds = element.getBoundingClientRect();
            return (
              elementBounds.right >= bounds.left + left &&
              elementBounds.left <= bounds.left + right &&
              elementBounds.bottom >= bounds.top + top &&
              elementBounds.top <= bounds.top + bottom
            );
          })
          .map((element) => element.dataset.filterId)
          .filter((id): id is string => !!id);
    const additive = event.ctrlKey || event.metaKey || event.shiftKey;
    setSelectedFilterIds(
      additive
        ? [...new Set([...selectedFilterIds, ...selectedIds])]
        : selectedIds,
    );
    setSelectionBox(undefined);
  };

  /**
   * Delete the whole selection, down to the floor and no further.
   *
   * One request per band rather than a batch, because unlike a parameter edit
   * each removal changes which bands exist and the main process hands back a
   * new id space. The count is re-checked as it goes, so selecting everything
   * and pressing delete leaves the minimum standing instead of failing
   * outright — the alternative is a button that refuses to do anything at all
   * once the selection is large enough.
   */
  /**
   * The bands a delete would actually take, floor included.
   *
   * Read by the confirmation as well as by the delete itself, so the question
   * says the real number rather than the number selected: pressing delete with
   * everything selected removes all but the minimum, and asking "delete 10
   * bands?" before removing 6 would be a lie told by the safeguard.
   */
  const deletableFilters = useMemo(
    () =>
      selectedFilters.slice(
        0,
        Math.max(0, frequencySortedFilters.length - MIN_NUM_FILTERS),
      ),
    [frequencySortedFilters.length, selectedFilters],
  );

  /**
   * Whether Delete is armed, i.e. the next press on it actually deletes.
   *
   * The confirmation is the button itself rather than a panel over the plot:
   * the question is about bands that are lit on the graph, and anything drawn
   * on top of them hides the only answer to "which ones?".
   */
  const [isDeleteArmed, setIsDeleteArmed] = useState(false);
  const deleteCellRef = useRef<HTMLDivElement>(null);

  /**
   * The button's own sentence, which is also what it says while armed.
   *
   * The label collapses to a bare bin as soon as the row runs out of room, so
   * this carries the whole thing — including, once armed, that the next press
   * is the one that removes the band.
   */
  const deleteLabel = (() => {
    if (isDeleteArmed) {
      return isGroupEdit
        ? t('eq.delete.armedAriaGroup', { count: deletableFilters.length })
        : t('eq.delete.armedAria');
    }
    return isGroupEdit
      ? t('eq.deleteSelectionAria', { count: selectedCount })
      : t('eq.deleteAria');
  })();

  const deleteSelectedFilter = async () => {
    if (selectedCount === 0) {
      return;
    }
    const deletable = deletableFilters;
    if (deletable.length === 0) {
      return;
    }
    try {
      // Sequential on purpose: the main process rewrites the config on each
      // removal, and firing them together is the flood this whole path exists
      // to avoid.
      // eslint-disable-next-line no-restricted-syntax
      for (const filter of deletable) {
        // eslint-disable-next-line no-await-in-loop
        await removeEqualizerSlider(filter.id);
        dispatchFilter({
          type: FilterActionEnum.REMOVE,
          id: filter.id,
        });
      }
      setSelectedFilterIds([]);
    } catch (e) {
      setGlobalError(e as ErrorDescription);
    }
  };

  // Absolute rather than relative, unlike the sliders above: "back to zero"
  // means the same thing for every band in the selection, and nudging a group
  // by the primary's distance from zero would leave the rest somewhere else.
  const resetSelectedGain = async () => {
    const edits: IFilterEdit[] = selectedFilters
      .filter(
        (filter) =>
          filter.gain !== 0 && !NO_GAIN_FILTER_TYPES.includes(filter.type),
      )
      .map((filter) => ({ id: filter.id, gain: 0 }));
    if (edits.length === 0) {
      return;
    }
    dispatchFilter({ type: FilterActionEnum.EDITS, edits });
    try {
      await setFilterValues(edits);
    } catch (e) {
      setGlobalError(e as ErrorDescription);
    }
  };

  // Bass, Mid and Treble, a layer of their own laid over the bands, shown
  // when nothing is selected — shared with the compact player's Tone face.
  const { tone, isDisabled: isToneDisabled, turnTone, resetTone } = useTone();

  // The one control that sets rather than nudges — a group of Peak bands asked
  // to become Low Shelf all become Low Shelf.
  const setSelectedType = async (newType: FilterTypeEnum) => {
    const edits: IFilterEdit[] = selectedFilters
      .filter((filter) => filter.type !== newType)
      .map((filter) => ({ id: filter.id, type: newType }));
    if (edits.length === 0) {
      return;
    }
    dispatchFilter({ type: FilterActionEnum.EDITS, edits });
    try {
      await setFilterValues(edits);
    } catch (e) {
      setGlobalError(e as ErrorDescription);
    }
  };

  const addFilter = async () => {
    if (frequencySortedFilters.length >= MAX_NUM_FILTERS) {
      return;
    }

    const explicitSelectedFilter = selectedFilterIds
      .map((id) => filters[id])
      .find(Boolean);

    if (!explicitSelectedFilter) {
      const occupiedFrequencies = new Set(
        frequencySortedFilters.map((filter) => filter.frequency),
      );
      let frequency = 1000;
      while (occupiedFrequencies.has(frequency) && frequency <= MAX_FREQUENCY) {
        frequency += 1;
      }
      if (frequency > MAX_FREQUENCY) {
        frequency = 999;
        while (
          occupiedFrequencies.has(frequency) &&
          frequency >= MIN_FREQUENCY
        ) {
          frequency -= 1;
        }
        if (frequency < MIN_FREQUENCY) {
          return;
        }
      }
      try {
        const id = await addEqualizerSlider(frequency);
        dispatchFilter({
          type: FilterActionEnum.ADD,
          id,
          frequency,
        });
      } catch (e) {
        setGlobalError(e as ErrorDescription);
      }
      return;
    }

    await addFilterBeside(
      explicitSelectedFilter,
      explicitSelectedFilter.frequency >= 1000 ? 'right' : 'left',
    );
  };

  /**
   * A new band next to `anchorFilter`, on the side asked for, at the
   * geometric midpoint between it and its neighbour there — or the edge of
   * the range when there is no neighbour. Add band chooses the side by the
   * 1 kHz rule; the band's own menu lets the user choose.
   */
  const addFilterBeside = async (
    anchorFilter: IFilter,
    side: 'left' | 'right',
  ) => {
    if (frequencySortedFilters.length >= MAX_NUM_FILTERS) {
      return;
    }
    const selectedFilterIndex = frequencySortedFilters.findIndex(
      (filter) => filter.id === anchorFilter.id,
    );
    if (selectedFilterIndex === -1) {
      return;
    }

    const shouldAddToRight = side === 'right';
    const leftBoundary =
      frequencySortedFilters[
        shouldAddToRight ? selectedFilterIndex : selectedFilterIndex - 1
      ]?.frequency ?? MIN_FREQUENCY;
    const rightBoundary =
      frequencySortedFilters[
        shouldAddToRight ? selectedFilterIndex + 1 : selectedFilterIndex
      ]?.frequency ?? MAX_FREQUENCY;

    if (leftBoundary + 1 >= rightBoundary) {
      return;
    }

    const frequency = clamp(
      Math.round(Math.sqrt(leftBoundary * rightBoundary)),
      MIN_FREQUENCY,
      MAX_FREQUENCY,
    );

    const boundedFrequency = clamp(
      frequency,
      leftBoundary + 1,
      rightBoundary - 1,
    );

    try {
      const id = await addEqualizerSlider(boundedFrequency);
      dispatchFilter({
        type: FilterActionEnum.ADD,
        id,
        frequency: boundedFrequency,
      });
      // The new band is the one being worked on now.
      setSelectedFilterIds([id]);
    } catch (e) {
      setGlobalError(e as ErrorDescription);
    }
  };

  /**
   * Put bands in or out of the chain, keeping everything they are set to.
   *
   * Absolute rather than a per-band flip, like `setSelectedType` below and
   * unlike the dials: asked to switch off, a mixed set goes off in its
   * entirety. A control whose result depends on which bands in a selection
   * happened to be on already is one nobody can predict, and the state the
   * user can see — the one the switch is drawn in — is what they are acting
   * on.
   *
   * Shared by the switch in the selected-band row and by the band menu, so
   * "off" means the same thing whichever way it is reached.
   */
  const setFiltersEnabled = async (
    targets: readonly IFilter[],
    isEnabled: boolean,
  ) => {
    const edits: IFilterEdit[] = targets
      .filter((filter) => isBandEnabled(filter) !== isEnabled)
      .map((filter) => ({ id: filter.id, isEnabled }));
    if (edits.length === 0) {
      return;
    }
    dispatchFilter({ type: FilterActionEnum.EDITS, edits });
    try {
      await setFilterValues(edits);
    } catch (e) {
      setGlobalError(e as ErrorDescription);
    }
  };

  /** Gain back to nothing and Q back to the default: the bands as they were born. */
  const resetFilters = async (targets: readonly IFilter[]) => {
    const edits: IFilterEdit[] = targets.map((filter) => {
      const edit: IFilterEdit = { id: filter.id, quality: DEFAULT_QUALITY };
      if (!NO_GAIN_FILTER_TYPES.includes(filter.type)) {
        edit.gain = 0;
      }
      return edit;
    });
    if (edits.length === 0) {
      return;
    }
    dispatchFilter({ type: FilterActionEnum.EDITS, edits });
    try {
      await setFilterValues(edits);
    } catch (e) {
      setGlobalError(e as ErrorDescription);
    }
  };

  // The band menu: opened by a right-click on a band's handle on the graph
  // or on its slider, and answered here because this is where the actions
  // live. The two surfaces are different components in different subtrees,
  // so the request travels as an event with the band's id and the point on
  // screen it was asked at.
  const [bandMenu, setBandMenu] = useState<
    { filterId: string; x: number; y: number } | undefined
  >(undefined);

  // Everything that disarms Delete, and not one of them is a timer: a button that
  // goes back to safe on its own schedule is a button whose second press means
  // something different depending on how long you thought about it.
  useEffect(() => {
    if (!isDeleteArmed) {
      return undefined;
    }
    const onPointerDown = (event: MouseEvent) => {
      if (!deleteCellRef.current?.contains(event.target as Node)) {
        setIsDeleteArmed(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsDeleteArmed(false);
      }
    };
    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isDeleteArmed]);

  // An armed button that now means a different set of bands is worse than no
  // safeguard at all. Pressing elsewhere already disarms it; this is the case
  // that never goes through the pointer — arrow keys and Select all move the
  // selection while the button is armed.
  useEffect(() => {
    setIsDeleteArmed(false);
  }, [selectedFilterIds]);
  useEffect(() => {
    const onOpen = (event: Event) => {
      const { detail } = event as CustomEvent<{
        filterId: string;
        x: number;
        y: number;
      }>;
      if (detail && filters[detail.filterId]) {
        // A right-click on a band that is already part of a selection keeps
        // the selection, and the menu then acts on all of it. On any other
        // band it is that band alone, like a left-click.
        if (!selectedFilterIds.includes(detail.filterId)) {
          setSelectedFilterIds([detail.filterId]);
        }
        setBandMenu(detail);
      }
    };
    window.addEventListener(BAND_MENU_EVENT, onOpen);
    return () => window.removeEventListener(BAND_MENU_EVENT, onOpen);
  }, [filters, selectedFilterIds, setSelectedFilterIds]);

  return {
    handleBandsPointerDown,
    handleBandsPointerMove,
    finishBandSelection,
    isDeleteArmed,
    setIsDeleteArmed,
    deleteCellRef,
    deleteLabel,
    deleteSelectedFilter,
    resetSelectedGain,
    tone,
    isToneDisabled,
    turnTone,
    resetTone,
    setSelectedType,
    addFilter,
    addFilterBeside,
    setFiltersEnabled,
    resetFilters,
    bandMenu,
    setBandMenu,
  };
};

export type TEqPageActions = ReturnType<typeof useEqPageActions>;

export default useEqPageActions;
