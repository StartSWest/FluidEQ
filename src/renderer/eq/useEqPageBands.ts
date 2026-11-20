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

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  IFilter,
  IFilterEdit,
  isBandEnabled,
  NO_GAIN_FILTER_TYPES,
} from 'common/constants';
import { ErrorDescription } from 'common/errors';
import { selectionModeFromEvent } from 'common/bandSelection';
import { FilterActionEnum, useFluidEqContext } from '../utils/FluidEqContext';
import { useTranslation } from '../utils/I18nContext';
import { labelledFilterOptions } from '../icons/FilterTypeIcon';
import { isInsideAnchoredMenu } from '../widgets/AnchoredMenu';
import { sortHelper, useLatestCall } from '../utils/utils';
import { useOverflowScroll } from '../utils/useOverflowScroll';
import { IBandPlacement, isSamePlacement } from './bandPlacement';
import { applyBandPlacement, measureBandPlacement } from './bandsRail';
import {
  bandGainEdits,
  bandGainWrite,
  groupEdits as selectionEdits,
  groupWrite,
  TBandField,
} from './bandEdits';
import { setFilterValues } from '../utils/equalizerApi';
import {
  type IBandSelectEvent,
  type TBandDensity,
} from '../components/FrequencyBand';
import qualityWheelEdits from '../graph/qualityWheel';

/**
 * The EQ page's bands: the filters and their layout, the band row's size
 * and places, the selection and hover, the tone and the cuts, and every
 * edit a band takes from its slider or its knob — everything the actions
 * and the markup read, returned as one object in the order it is declared.
 */
const useEqPageBands = () => {
  const {
    filters,
    isLoading,
    isBlockingError,
    dispatchFilter,
    setGlobalError,
    selectedFilterId,
    selectedFilterIds,
    setSelectedFilterIds,
    toggleFilterSelection,
    hoveredFilterId,
    setHoveredFilterId,
    bypassed,
  } = useFluidEqContext();
  const { t } = useTranslation();
  const filterOptions = useMemo(() => labelledFilterOptions(t), [t]);
  const frequencySortedFilters = useMemo(
    () => Object.values(filters).sort(sortHelper),
    [filters],
  );

  // Typed, because the page hands it on in an object, where an inferred
  // literal would widen to any string.
  const density = useMemo<TBandDensity>(() => {
    if (frequencySortedFilters.length <= 6) {
      return 'full';
    }
    if (frequencySortedFilters.length <= 15) {
      return 'compact';
    }
    return 'dense';
  }, [frequencySortedFilters.length]);

  /**
   * The band the editor below is showing, or nothing at all.
   *
   * This used to fall back to the first band whenever the selection was empty,
   * which meant the editor could never close: clearing the selection left it
   * open on a band that was no longer highlighted anywhere, so the panel and
   * the bands disagreed about what was selected and moving a control edited a
   * band the user had just deselected.
   */
  const selectedFilter = useMemo(
    () => filters[selectedFilterId],
    [filters, selectedFilterId],
  );
  const isSelectedGainDisabled = selectedFilter
    ? NO_GAIN_FILTER_TYPES.includes(selectedFilter.type)
    : true;

  /**
   * Every band the editor is speaking for, primary first.
   *
   * Empty when nothing is selected, which is what closes the editor. One entry
   * for the ordinary case, and the whole selection when there is one — so the
   * controls below can say "3 bands" and act on all of them without each of
   * them re-deriving which bands those are.
   */
  const selectedFilters = useMemo(
    () =>
      selectedFilterIds
        .map((id) => filters[id])
        .filter((filter): filter is IFilter => Boolean(filter)),
    [filters, selectedFilterIds],
  );
  const selectedCount = selectedFilters.length;
  const isGroupEdit = selectedCount > 1;
  /**
   * What the on/off switch shows for the selection.
   *
   * `some` rather than `every`: a mixed selection reads as on, so pressing the
   * switch means "switch these off" and pressing it again means "switch them
   * back on". Read the other way a mixed group would read as off, and the
   * first press would turn ON the bands the user had just been looking at as
   * off — the opposite of what the control appears to offer.
   */
  const isSelectionEnabled = selectedFilters.some(isBandEnabled);

  // Read by the group edit below, which runs from a throttled timer and must
  // see the selection and the bands as they are when it fires rather than as
  // they were when the drag started.
  const selectedFilterRef = useRef(selectedFilter);
  selectedFilterRef.current = selectedFilter;
  const selectedFilterIdsRef = useRef(selectedFilterIds);
  selectedFilterIdsRef.current = selectedFilterIds;

  /**
   * Nothing is selected to begin with, and nothing selects itself after that.
   *
   * The page used to open on the first band, which is the lowest one — so
   * every launch put the editor on a bass band nobody had asked for, and the
   * tone controls that stand in the same place with nothing selected were
   * something you had to click away to find. Opening on none of them shows the
   * whole rack first, which is the right subject for a page called Parametric
   * EQ, and a band is one click away.
   *
   * The one case left is a selection gone stale — the band it named was
   * deleted, or the layout was swapped underneath it. That releases rather
   * than moves to a neighbour: an editor for a band that no longer exists is
   * wrong, and so is picking a different one on the user's behalf.
   */
  useEffect(() => {
    if (selectedFilterId && !filters[selectedFilterId]) {
      setSelectedFilterIds([]);
    }
  }, [filters, selectedFilterId, setSelectedFilterIds]);

  /**
   * A press anywhere else puts the selection down.
   *
   * The editor below opens on whatever is selected, and there was no way to
   * close it except by clicking the empty part of the band rail or of the
   * graph — so it sat open across the bottom of the page while the user was
   * working somewhere else entirely, on a band they had stopped caring about.
   *
   * Three regions are excluded, each for its own reason: the rail and the
   * graph both select bands themselves, and a dialog is a surface that should
   * leave the page behind it exactly as it was.
   *
   * Capture phase, so this runs before whatever the press was actually for.
   * Pressing a band in the graph clears the selection here and the graph's own
   * handler then sets it, which is the order that ends on the band the user
   * pressed; in the bubble phase the two happen the other way round and every
   * selection is undone a moment after it is made.
   */
  useEffect(() => {
    if (selectedFilterIds.length === 0) {
      return undefined;
    }
    // The DOM's event rather than React's synthetic one: the name is taken in
    // this file by the React type, and nothing here needs the pointer detail.
    const onPointerDown = (event: Event) => {
      const target = event.target as HTMLElement | null;
      // The toolbar is not "outside". Add band places the new band beside
      // the selected one, and the press on the button arrived here first and
      // cleared the selection it was about to use — so every add landed at
      // the 1 kHz default however carefully a band had been picked.
      //
      // Nor is the band menu, for the same reason one step later: it is
      // portalled to the body, so a press on "Reset 5 bands" arrived here
      // first, emptied the selection, and the click that followed found a
      // menu that now covered one band.
      //
      // Nor is the selected band's filter list. `Dropdown` portals it to the
      // body as well, so picking Notch arrived here first, emptied the
      // selection, and the editor — the dropdown with it — was gone before
      // the click could land: the pane closed and the type never changed
      // (Ivan, 2026-09-22). The karaoke workspace asks the same question.
      if (
        target?.closest?.(
          '.bands-rail, .eq-flat-editor, .graph-wrapper, .eq-toolbar, .main-content-title, [role="dialog"], .dropdown-menu-layer',
        ) ||
        isInsideAnchoredMenu(target)
      ) {
        return;
      }
      setSelectedFilterIds([]);
    };
    // And Escape, which closes the band's popover with its selection
    // (`EqBandEditor`), from anywhere on the page or from nothing focused —
    // the filter list open inside it closes with it. Not one something else
    // has already answered (`defaultPrevented`), and not one meant for a
    // dialog standing over the page.
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        event.key !== 'Escape' ||
        event.defaultPrevented ||
        !(
          target === document.body ||
          target?.closest?.('.workspace-tab-panel--eq')
        )
      ) {
        return;
      }
      setSelectedFilterIds([]);
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [selectedFilterIds.length, setSelectedFilterIds]);

  // The bands as they are right now, not as they were when this render's
  // closures were made. The group edit below runs from a throttled timer, so
  // everything captured in that closure is frozen at the moment the drag
  // started.
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  const bandsRef = useRef<HTMLDivElement>(null);
  // The row as state as well, for the placement below. The row is drawn a
  // few renders after this component, once the page has what it needs, and
  // a placement that read only the ref ran before the row existed and was
  // never asked again: on a fresh start the bands stayed evenly spaced, off
  // their points on the graph, until the window was resized.
  const [bandsElement, setBandsElement] = useState<HTMLDivElement | null>(null);
  const attachBands = useCallback((element: HTMLDivElement | null) => {
    bandsRef.current = element;
    setBandsElement(element);
  }, []);
  // Whether the band rail runs past its viewport, and the way to the rest.
  const canScrollBands = useOverflowScroll(frequencySortedFilters.length);

  /**
   * The bands in fixed places across the rail, low to high, at most
   * `MAX_BAND_PITCH` apart and centred where that leaves room
   * (`bandPlacement.ts`, Ivan 2026-11-16); too many to fit at the narrowest a
   * band reads at, the row scrolls instead. Measured against the rail, which
   * is the page's width whether or not the graph is above it.
   *
   * Keyed on how many bands there are and nothing about them: a frequency
   * dragged on the graph moves no slider (Ivan, 2026-09-26), and neither a
   * gain drag nor a frequency drag re-reads a box on every step. Two bands
   * that pass each other trade places because the row is drawn in frequency
   * order.
   *
   * Whether the bands are placed is the one thing about it the page renders
   * from. Where they stand is written onto the row itself
   * (`applyBandPlacement`): it changes on every frame of a window being
   * resized, and as state each change rendered the page again — the
   * thirty-one bands, the Tone's dials and the graph's points — on every
   * frame (Ivan, 2026-09-27: "improve app resizing so it doesnt over
   * calculate").
   */
  const bandCount = frequencySortedFilters.length;
  const [isPlaced, setIsPlaced] = useState(false);
  useLayoutEffect(() => {
    const bands = bandsElement;
    if (!bands || bandCount === 0) {
      setIsPlaced(false);
      return undefined;
    }
    let applied: IBandPlacement | undefined;
    const settle = (next: IBandPlacement | undefined) => {
      if (!isSamePlacement(applied, next)) {
        applied = next;
        applyBandPlacement(bands, next);
      }
      setIsPlaced(next !== undefined);
    };
    // The rail's width is independent of overflowing bands and scroll arrows.
    // Watching the row instead fed our own layout change back into the fit
    // decision and could alternate placed/scrolling forever at a fixed width.
    const rail = bands.closest('.bands-rail');
    const scroller = bands.closest('.workspace-tab-panel__scroll');
    const place = () => settle(measureBandPlacement(bands, bandCount));
    place();
    if (typeof ResizeObserver === 'undefined') {
      return undefined;
    }
    const observer = new ResizeObserver(place);
    if (rail) {
      observer.observe(rail);
    }
    if (scroller) {
      observer.observe(scroller);
    }
    return () => observer.disconnect();
  }, [bandsElement, bandCount]);
  const [selectionBox, setSelectionBox] = useState<
    | { startX: number; startY: number; currentX: number; currentY: number }
    | undefined
  >();

  /**
   * Write a group edit to Equalizer APO.
   *
   * Separate from working out what the edit is, because the two want opposite
   * treatment: the calculation is pure and cheap and runs on every frame of a
   * drag, while this ends in a config rewrite and a preset save and must not.
   */
  const flushGroupEdit = useCallback(
    async (edits: IFilterEdit[]) => {
      try {
        await setFilterValues(edits);
      } catch (e) {
        setGlobalError(e as ErrorDescription);
      }
    },
    [setGlobalError],
  );

  // One write on its way at a time, the newest edit waiting behind it: a drag
  // no longer queues a rewrite per frame, and its last edit always lands. It
  // was a throttle, at most one write per 100 ms and the last one put on a
  // timer; the write already says when it is done, and that is when the next
  // can go.
  const groupFlush = useLatestCall(flushGroupEdit);

  // The selection and the bands as they are when the edit runs (`bandEdits`).
  const groupEdits = useCallback(
    (field: TBandField, newValue: number) =>
      selectionEdits(
        filtersRef.current,
        selectedFilterRef.current,
        selectedFilterIdsRef.current,
        field,
        newValue,
      ),
    [],
  );
  const gainEdits = useCallback(
    (filterId: string, newValue: number) =>
      bandGainEdits(
        filtersRef.current,
        selectedFilterRef.current,
        selectedFilterIdsRef.current,
        filterId,
        newValue,
      ),
    [],
  );

  // THE STORE AT ONCE, THE ENGINE AFTER IT (Ivan, 2026-09-26: "so the user
  // feels it is really fast … and the settings come after, non blocking UI").
  // Every step renders the bands and the graph in the same frame as the
  // thumb, the way a drag on the graph always has. It was a transition, which
  // React throws away whenever a newer update arrives: while the hand kept
  // moving, each step's render was dropped for the next one's and the curve
  // only caught up when the hand slowed — the slider moved and the curve
  // trailed it, where dragging the dot moved both together (Ivan,
  // 2026-10-03: "if I move the slider the curve movement has a lag"). The
  // engine still hears it one write at a time (`groupFlush`).
  const showGroupEdits = useCallback(
    (edits: IFilterEdit[]) =>
      dispatchFilter({ type: FilterActionEnum.EDITS, edits }),
    [dispatchFilter],
  );

  /**
   * Move one parameter across everything selected, in the store and then in
   * the engine.
   *
   * The edit is shown at once and written one write at a time. Both halves
   * matter: showing it at once is what makes the next delta measure from
   * where the band actually is, and one write at a time is what stops a drag
   * queueing a config rewrite per frame (`groupFlush`). They are absolute
   * values, so an edit folded into a newer one mid-drag loses nothing — the
   * one that lands last is complete.
   */
  const updateSelectedGroup = useCallback(
    async (field: TBandField, newValue: number) => {
      const edits = groupEdits(field, newValue);
      if (edits.length === 0) {
        return;
      }
      showGroupEdits(edits);
      await groupFlush(
        groupWrite(
          filtersRef.current,
          selectedFilterRef.current,
          selectedFilterIdsRef.current,
          field,
          newValue,
        ),
      );
    },
    [groupEdits, groupFlush, showGroupEdits],
  );

  // The callbacks every band is handed, stable across a drag: read
  // through refs, so another band's step gives no band a new prop and the
  // memoised bands stay as they are (`FrequencyBand`).
  // The engine is told where the bands land even when the preview already
  // shows them there (`bandGainWrite`), or a queued step is dropped.
  const handleBandGainChange = useCallback(
    async (filterId: string, newValue: number) => {
      const write = bandGainWrite(
        filtersRef.current,
        selectedFilterRef.current,
        selectedFilterIdsRef.current,
        filterId,
        newValue,
      );
      if (write.length === 0) {
        return;
      }
      const changes = gainEdits(filterId, newValue);
      if (changes.length > 0) {
        showGroupEdits(changes);
      }
      await groupFlush(write);
    },
    [gainEdits, groupFlush, showGroupEdits],
  );

  // Through a ref: the context's selection callback is made again whenever
  // a band moves, since it reads the bands, and handed on as it is it gave
  // every band a new prop at every step of a drag.
  const toggleFilterSelectionRef = useRef(toggleFilterSelection);
  toggleFilterSelectionRef.current = toggleFilterSelection;
  // A drag's step in the store alone: the band hands the engine its value
  // through its own queue, where a reset waits in line behind it.
  const handleBandGainPreview = useCallback(
    (filterId: string, newValue: number) => {
      const edits = gainEdits(filterId, newValue);
      if (edits.length > 0) {
        showGroupEdits(edits);
      }
    },
    [gainEdits, showGroupEdits],
  );

  const handleBandSelect = useCallback(
    (filterId: string, event: IBandSelectEvent) =>
      toggleFilterSelectionRef.current(filterId, selectionModeFromEvent(event)),
    [],
  );

  // Ctrl+scroll over a band: its Q, or the selection's when it is in it, by
  // the graph's own step (`qualityWheel.ts`).
  const handleBandQualityWheel = useCallback(
    (filterId: string, direction: 1 | -1) => {
      const edits = qualityWheelEdits(
        filtersRef.current,
        selectedFilterIdsRef.current,
        filterId,
        direction,
      );
      if (edits.length === 0) {
        return;
      }
      showGroupEdits(edits);
      groupFlush(edits).catch(() => undefined);
    },
    [groupFlush, showGroupEdits],
  );

  const handleBandHover = useCallback(
    (filterId: string, isHovered: boolean) =>
      setHoveredFilterId(isHovered ? filterId : ''),
    [setHoveredFilterId],
  );

  return {
    filters,
    isLoading,
    isBlockingError,
    dispatchFilter,
    setGlobalError,
    selectedFilterIds,
    setSelectedFilterIds,
    hoveredFilterId,
    bypassed,
    t,
    filterOptions,
    frequencySortedFilters,
    density,
    selectedFilter,
    isSelectedGainDisabled,
    selectedFilters,
    selectedCount,
    isGroupEdit,
    isSelectionEnabled,
    bandsRef,
    bandsElement,
    attachBands,
    canScrollBands,
    isPlaced,
    selectionBox,
    setSelectionBox,
    updateSelectedGroup,
    handleBandGainChange,
    handleBandGainPreview,
    handleBandSelect,
    handleBandQualityWheel,
    handleBandHover,
  };
};

export type TEqPageBands = ReturnType<typeof useEqPageBands>;

export default useEqPageBands;
