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
  CSSProperties,
  PointerEvent,
  ReactElement,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import {
  FilterTypeEnum,
  IFilter,
  IFilterEdit,
  isBandEnabled,
  DEFAULT_QUALITY,
  MAX_NUM_FILTERS,
  MAX_FREQUENCY,
  MAX_GAIN,
  MAX_QUALITY,
  MIN_NUM_FILTERS,
  MIN_FREQUENCY,
  MIN_GAIN,
  MIN_QUALITY,
  NO_GAIN_FILTER_TYPES,
} from 'common/constants';
import { selectionModeFromEvent } from 'common/bandSelection';
import { ErrorDescription } from 'common/errors';
import FrequencyBand from './components/FrequencyBand';
import { FilterActionEnum, useFluidEqContext } from './utils/FluidEqContext';
import './styles/MainContent.scss';
import './styles/MultiSelect.scss';
import Spinner from './icons/Spinner';
import { clamp, sortHelper, useLatestCall } from './utils/utils';
import Button from './widgets/Button';
import AnchoredMenu, { isInsideAnchoredMenu } from './widgets/AnchoredMenu';
import OverflowArrow from './components/OverflowArrow';
import { useOverflowScroll } from './utils/useOverflowScroll';
import { useEqTitleSlot } from './utils/eqTitleSlot';
import {
  IBandPlacement,
  isSamePlacement,
  placeBandsUnderPlot,
  usePlotGeometry,
} from './graph/plotGeometry';
import {
  addEqualizerSlider,
  removeEqualizerSlider,
  setFilterValues,
} from './utils/equalizerApi';
import Dropdown from './widgets/Dropdown';
import Knob from './widgets/Knob';
import Switch from './widgets/Switch';
import BandMenu, { BAND_MENU_EVENT } from './components/BandMenu';
import { TONE_MAX_DB } from '../common/tone';
import useBubblePlacement from './eq/useBubblePlacement';

import { labelledFilterOptions } from './icons/FilterTypeIcon';
import { toggleContinuousEq, useContinuousEq } from './utils/continuousEq';
import {
  SMART_EQ_MODES,
  SMART_EQ_MODE_NAME,
  SMART_EQ_MODE_NOTE,
  TSmartEqMode,
  isContinuousMode,
  setSmartEqMode,
  useSmartEqMode,
} from './utils/smartEqMode';
import {
  cancelSmartEq,
  endSmartEqStatus,
  runSmartEq,
  useSmartEqRun,
  useSmartEqStatus,
} from './utils/smartEqRun';
import useIsAutoEqRunning from './utils/autoEqRunning';
import {
  endCorrectionFlash,
  useCorrectionFlash,
} from './utils/correctionFlash';
import isOwnAnimationEnd from './utils/ownAnimationEnd';
import VoicingQuickPick from './components/VoicingQuickPick';
import ActiveLayers from './components/ActiveLayers';
import ListenedLatency from './components/ListenedLatency';
import OutputRate from './components/OutputRate';
import SongEqSaveSwitch from './components/SongEqSaveSwitch';
import EqModeSelect from './components/EqModeSelect';
import EqCutKnob from './eq/EqCutKnob';
import BandLayoutMenu from './components/BandLayoutMenu';
import ClearEqButton from './components/ClearEqButton';
import MenuIcon from './icons/MenuIcon';
import TrashIcon from './icons/TrashIcon';
import ConfirmIcon from './icons/ConfirmIcon';
import { PetArt } from './SupportPet';
import { useTranslation } from './utils/I18nContext';
import useTone, { TONE_CONTROLS } from './eq/useTone';

const MainContent = () => {
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
  // Above the graph while the graph stands between the title and the bands
  // (`eqTitleSlot.ts`); here, above the bands, otherwise.
  const titleSlot = useEqTitleSlot();
  const placeTitle = (title: ReactElement) =>
    titleSlot ? createPortal(title, titleSlot) : title;
  /**
   * What Smart EQ is doing, read from where it is actually happening.
   *
   * Not this component's state any more, and that is the whole of the fix: the
   * measurements used to live here, so leaving the EQ tab unmounted them
   * mid-capture. They are hosted in `SmartEqEngine` now, above the tabs, and
   * this reads the same three values it used to own.
   */
  const { listeningFor, isRunning: isBalancing } = useSmartEqRun();
  const balanceStatus = useSmartEqStatus();
  const isContinuousOn = useContinuousEq();
  const smartEqMode = useSmartEqMode();
  const [isModeMenuOpen, setIsModeMenuOpen] = useState(false);
  const modeMenuHolder = useRef<HTMLSpanElement>(null);
  /**
   * On, chosen, and not held up by a switch on the other side of the screen.
   *
   * The mode staying on through a bypass is right — it is a preference, and the
   * layer comes back — but a lit button over a stopped loop is the app claiming
   * to be doing something it is not.
   *
   * Read from `useIsAutoEqRunning` rather than restated here: the save switch
   * below and the song recorder behind it stand or fall on the same three
   * conditions, and three copies of them is how the switch came to be offered
   * over a stopped loop.
   */
  const isContinuousRunning = useIsAutoEqRunning();
  const smartLabel = isBalancing
    ? t('eq.smart.cancelAria')
    : t('eq.smart.aria');
  const continuousLabel = t('eq.smart.continuousAria');
  /**
   * A correction landing, for as long as the bubble's text holds the applied
   * colour — its own animation, whose end is what clears the flash.
   */
  const correctionFlash = useCorrectionFlash();
  /**
   * What the bubble says: an announcement if there is one, the measurement
   * otherwise.
   *
   * `balanceStatus` is a remark held for a moment — a correction landing, a
   * voicing change rebuilding the layer, a run finishing — and outranks the rest
   * because somebody is waiting to hear about it. Underneath is the running
   * measurement, which is the truth for almost all of the time and is worth
   * saying: the capture really is open, the pet really is nodding along to it,
   * and the percentage moving is the difference between a mode working quietly
   * and a mode that has stopped.
   */
  const bubbleText =
    balanceStatus?.text || (isContinuousRunning ? listeningFor : '');
  // The bubble is the only thing that shows a flash, and its animation is the
  // only thing that ends one. A correction landing after the mode was stopped
  // finds no bubble, so nothing would ever end it, and the next bubble would
  // arrive green over a write minutes old. Nothing can show it, so it is over.
  const flashId = correctionFlash?.id;
  useEffect(() => {
    if (flashId !== undefined && !bubbleText) {
      endCorrectionFlash(flashId);
    }
  }, [bubbleText, flashId]);
  // Somewhere free around the button, chosen from what the header holds at
  // this width: see `eq/bubblePlacement.ts`.
  const bubbleRef = useRef<HTMLSpanElement>(null);
  const bubbleSpot = useBubblePlacement(modeMenuHolder, bubbleRef, bubbleText);
  const modeLabel = (entry: TSmartEqMode) => t(SMART_EQ_MODE_NAME[entry]);
  const modeNote = (entry: TSmartEqMode) => t(SMART_EQ_MODE_NOTE[entry]);

  // Closes on a click elsewhere and on Escape, like every other menu here.
  useEffect(() => {
    if (!isModeMenuOpen) {
      return undefined;
    }
    const onPointerDown = (event: MouseEvent) => {
      // The menu itself is not inside the trigger any more — it is portalled
      // out of the panel that clips — so it has to be asked about separately.
      if (
        !modeMenuHolder.current?.contains(event.target as Node) &&
        !isInsideAnchoredMenu(event.target)
      ) {
        setIsModeMenuOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsModeMenuOpen(false);
      }
    };
    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isModeMenuOpen]);

  const frequencySortedFilters = useMemo(
    () => Object.values(filters).sort(sortHelper),
    [filters],
  );

  const density = useMemo(() => {
    if (frequencySortedFilters.length <= 6) {
      return 'full';
    }
    if (frequencySortedFilters.length <= 15) {
      return 'compact';
    }
    return 'dense';
  }, [frequencySortedFilters.length]);
  const bandLayout = frequencySortedFilters.length <= 10 ? 'centered' : 'wide';

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
    document.addEventListener('pointerdown', onPointerDown, true);
    return () =>
      document.removeEventListener('pointerdown', onPointerDown, true);
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
   * Each band under its point on the graph (layout A, Ivan 2026-09-25) —
   * only while the graph stands directly above the row, which is exactly
   * when the title has gone up above the graph (`titleSlot`). Placed from the
   * axis the handles are placed on (`plotGeometry.ts`), measured against
   * where the plot and the row actually are; too close together for that,
   * the bands stay evenly spaced.
   *
   * Keyed on the frequencies alone: a gain drag changes `filters` twenty
   * times a second and moves no band sideways, and reading two boxes on
   * every one of those would be layout work for nothing.
   */
  const plotGeometry = usePlotGeometry();
  const bandFrequencies = frequencySortedFilters
    .map((filter) => filter.frequency)
    .join(',');
  const [bandPlacement, setBandPlacement] = useState<IBandPlacement>();
  useLayoutEffect(() => {
    const bands = bandsElement;
    if (!titleSlot || !plotGeometry || !bands || !bandFrequencies) {
      setBandPlacement(undefined);
      return undefined;
    }
    const frequencies = bandFrequencies.split(',').map(Number);
    // Measured, not derived: the row sits inside the page's padding and the
    // plot does not, and the row's own left edge moves when it goes from even
    // to placed. Its size changes with it, which is what calls this again.
    // What the page shows of the row: the inside of the scroller it stands
    // in, between that box's scrollbar gutters, which is where the bands are
    // clipped.
    const scroller = bands.closest('.workspace-tab-panel__scroll');
    const place = () => {
      const row = bands.getBoundingClientRect().left;
      const offset = plotGeometry.element.getBoundingClientRect().left - row;
      let visible: { left: number; right: number } | undefined;
      if (scroller instanceof HTMLElement) {
        const left =
          scroller.getBoundingClientRect().left + scroller.clientLeft - row;
        visible = { left, right: left + scroller.clientWidth };
      }
      const next = placeBandsUnderPlot(
        frequencies,
        plotGeometry,
        offset,
        visible,
      );
      setBandPlacement((previous) =>
        isSamePlacement(previous, next) ? previous : next,
      );
    };
    place();
    if (typeof ResizeObserver === 'undefined') {
      return undefined;
    }
    const observer = new ResizeObserver(place);
    observer.observe(bands);
    return () => observer.disconnect();
  }, [titleSlot, plotGeometry, bandsElement, bandFrequencies]);
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

  /**
   * Move one parameter across everything selected.
   *
   * The value handed in is the one the control shows, which belongs to the
   * primary band; every other band in the selection moves by the same amount
   * rather than to the same value, so a selection keeps its shape. Bands that
   * would run past an end of the range stop there — which does mean a group
   * pushed to the top and then pulled back spreads out, and that is the only
   * behaviour that does not silently discard the rest of the selection.
   *
   * The edit is shown immediately and written one write at a time. Both
   * halves matter: showing it immediately is what makes the next delta measure
   * from where the band actually is, and one write at a time is what stops a
   * drag queueing a config rewrite per frame. They are absolute values, so an
   * edit folded into a newer one mid-drag loses nothing — the one that lands
   * last is complete.
   */
  const updateSelectedGroup = useCallback(
    async (field: 'frequency' | 'gain' | 'quality', newValue: number) => {
      const primary = selectedFilterRef.current;
      if (!primary) {
        return;
      }
      const liveFilters = filtersRef.current;
      const ids = selectedFilterIdsRef.current.includes(primary.id)
        ? selectedFilterIdsRef.current
        : [primary.id];
      const delta = newValue - primary[field];
      const bounds = {
        frequency: [MIN_FREQUENCY, MAX_FREQUENCY],
        gain: [MIN_GAIN, MAX_GAIN],
        quality: [MIN_QUALITY, MAX_QUALITY],
      }[field];

      const edits: IFilterEdit[] = [];
      ids.forEach((id) => {
        const filter = liveFilters[id];
        if (
          !filter ||
          (field === 'gain' && NO_GAIN_FILTER_TYPES.includes(filter.type))
        ) {
          return;
        }
        const nextValue = clamp(filter[field] + delta, bounds[0], bounds[1]);
        if (nextValue !== filter[field]) {
          edits.push({ id, [field]: nextValue });
        }
      });

      if (edits.length === 0) {
        return;
      }
      dispatchFilter({ type: FilterActionEnum.EDITS, edits });
      await groupFlush(edits);
    },
    [dispatchFilter, groupFlush],
  );

  const handleBandGainChange = useCallback(
    (filterId: string, newValue: number) => {
      const source = filters[filterId];
      if (!source) {
        return Promise.resolve();
      }
      const primaryValue = selectedFilter?.gain ?? source.gain;
      return updateSelectedGroup(
        'gain',
        primaryValue + (newValue - source.gain),
      );
    },
    [filters, selectedFilter?.gain, updateSelectedGroup],
  );

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
  const bandMenuFilter = bandMenu ? filters[bandMenu.filterId] : undefined;
  // The bands the menu acts on: the whole selection when the clicked band is
  // in it, otherwise just the clicked band.
  let bandMenuFilters: IFilter[] = [];
  if (bandMenuFilter) {
    bandMenuFilters = selectedFilterIds.includes(bandMenuFilter.id)
      ? selectedFilterIds.map((id) => filters[id]).filter(Boolean)
      : [bandMenuFilter];
  }

  return isLoading ? (
    <div className="center full row">
      <Spinner />
    </div>
  ) : (
    <>
      {bandMenu && bandMenuFilter && (
        // Keyed on where it was asked for, so a right-click on the same band
        // somewhere else closes this one and opens a fresh one there rather
        // than leaving the old one where it was.
        <BandMenu
          key={`${bandMenu.filterId}:${bandMenu.x}:${bandMenu.y}`}
          filter={bandMenuFilter}
          filters={bandMenuFilters}
          x={bandMenu.x}
          y={bandMenu.y}
          onReset={resetFilters}
          onSetEnabled={setFiltersEnabled}
          onAddBeside={addFilterBeside}
          onClose={() => setBandMenu(undefined)}
        />
      )}
      {placeTitle(
        <div className="main-content-title">
          <div>
            <span className="eyebrow">{t('eq.eyebrow')}</span>
            <div className="main-content-title__heading">
              <h2>
                {t('eq.title')}
                <OutputRate />
              </h2>
            </div>
          </div>
          <div className="eq-toolbar">
            <VoicingQuickPick />
            {/* One button, and it is whichever way of measuring is chosen.
              The two do the same job by different means and only one can be
              running, so a row offering both at once invited pressing both. The
              caret is where the other one lives; picking it changes what this
              button is, and a press then does it. */}
            <span
              className={`eq-mode${isModeMenuOpen ? ' is-open' : ''}`}
              ref={modeMenuHolder}
            >
              <Button
                ariaLabel={
                  isContinuousMode(smartEqMode) ? continuousLabel : smartLabel
                }
                // Never greyed out: the measurement opens its own tap on the
                // source and says in the bubble if it cannot. It used to wait
                // on the graph's loopback, which is not what it listens to.
                isDisabled={false}
                // Running gets the breathing outline and nothing else. It keeps
                // the Smart EQ button's own look, because it is that button.
                className={`small eq-mode__main${isContinuousRunning ? ' is-running' : ''}`}
                isPressed={
                  isContinuousMode(smartEqMode) ? isContinuousOn : undefined
                }
                // Nothing here runs the measurement — it asks the host that owns
                // it to. That indirection is what lets a run outlive this panel:
                // the button is a way of reaching the measurement, not the place
                // it lives.
                handleChange={() => {
                  if (isContinuousMode(smartEqMode)) {
                    toggleContinuousEq();
                    return;
                  }
                  if (isBalancing) {
                    // The button is a Cancel while a measurement is running.
                    cancelSmartEq();
                    return;
                  }
                  runSmartEq();
                }}
              >
                {isContinuousRunning ? (
                  // A pause bar while it runs, because that is what pressing it
                  // does next.
                  <svg
                    className="eq-toolbar__icon eq-toolbar__pause"
                    viewBox="0 0 16 16"
                    aria-hidden
                  >
                    <path d="M5 3h2.2v10H5zM8.8 3H11v10H8.8z" />
                  </svg>
                ) : (
                  <MenuIcon name="smart" className="eq-toolbar__icon" />
                )}
                {isContinuousMode(smartEqMode)
                  ? modeLabel(smartEqMode)
                  : (isBalancing && t('eq.smart.cancel')) || t('eq.smart')}
              </Button>
              <button
                type="button"
                className="eq-mode__caret"
                aria-label={t('eq.smart.modeAria')}
                aria-expanded={isModeMenuOpen}
                onClick={() => setIsModeMenuOpen((wasOpen) => !wasOpen)}
              >
                <svg viewBox="0 0 16 16" aria-hidden>
                  <path d="M4 6.5l4 4 4-4" />
                </svg>
              </button>
              {/* Rendered outside the panel, because the panel clips. Only the
                modes this button is not: a menu listing what you are already
                looking at is a row that does nothing. */}
              <AnchoredMenu
                anchor={modeMenuHolder.current}
                isOpen={isModeMenuOpen}
                className="eq-mode__menu"
              >
                {SMART_EQ_MODES.filter((entry) => entry !== smartEqMode).map(
                  (entry) => (
                    <button
                      key={entry}
                      type="button"
                      onClick={() => {
                        setSmartEqMode(entry);
                        setIsModeMenuOpen(false);
                      }}
                    >
                      <MenuIcon name="smart" className="eq-toolbar__icon" />
                      <span className="eq-mode__menu-name">
                        {modeLabel(entry)}
                      </span>
                      {/* Each says what it overrides, because the names alone
                        cannot: three of them do the same job to three different
                        depths, and which depth is the whole choice being made
                        here. */}
                      <span className="eq-mode__menu-note">
                        {modeNote(entry)}
                      </span>
                    </button>
                  ),
                )}
              </AnchoredMenu>
              {/* What it is doing, said by the pet, from the button itself.
                It was a bare run of text sitting in the row, which put a
                sentence that changes among a line of controls that do not and
                made the toolbar reflow every time the wording changed. Hung off
                the button it belongs to, it is obviously about that button —
                and the creature saying it is the same one that reacts to the
                music everywhere else in the app, so the app has one voice
                rather than a label here and a character there. */}
              {bubbleText && (
                <span
                  // Green for a moment after a write reaches Equalizer APO, which
                  // is the moment the sound changes. It is the one thing in here
                  // that is not a sentence about what will happen: it means it
                  // just did.
                  className={`eq-mode__bubble${
                    correctionFlash ? ' is-applied' : ''
                  }${bubbleSpot?.isBelow ? ' is-below' : ''}`}
                  role="status"
                  ref={bubbleRef}
                  style={
                    bubbleSpot
                      ? ({
                          left: bubbleSpot.offsetLeft,
                          top: bubbleSpot.offsetTop,
                          right: 'auto',
                          bottom: 'auto',
                          '--bubble-tail': `${bubbleSpot.tailX}px`,
                        } as React.CSSProperties)
                      : undefined
                  }
                >
                  <span className="eq-mode__bubble-pet" aria-hidden>
                    <PetArt />
                  </span>
                  {/* Keyed on the landing, so a second correction arriving
                      while the first is still green holds the colour for its
                      own full moment rather than for what the first had left.
                      The text's hold (`eq-bubble-applied`) is that moment, and
                      its end is what ends the flash. */}
                  <span
                    key={correctionFlash?.id ?? 'resting'}
                    className="eq-mode__bubble-text"
                    onAnimationEnd={(event) => {
                      if (
                        correctionFlash &&
                        isOwnAnimationEnd(event, 'eq-bubble-applied')
                      ) {
                        endCorrectionFlash(correctionFlash.id);
                      }
                    }}
                  >
                    {balanceStatus ? (
                      // Keyed on the remark, so each new one is held for its
                      // own full moment; the hold's end is what ends it.
                      <span
                        key={balanceStatus.id}
                        className="eq-mode__bubble-status"
                        onAnimationEnd={(event) => {
                          if (
                            isOwnAnimationEnd(event, 'smart-eq-status-hold')
                          ) {
                            endSmartEqStatus(balanceStatus.id);
                          }
                        }}
                      >
                        {balanceStatus.text}
                      </span>
                    ) : (
                      bubbleText
                    )}
                  </span>
                </span>
              )}
            </span>
            {/* Only while an automatic mode is actually measuring. Saving a song
              means filing the Smart EQ layer being refined for it, and nothing
              but that measurement ever writes one — so with the loop stopped
              the switch was a promise the app had no way to keep: it could be
              ticked on, it counted out the two minutes, and it committed
              nothing at the end of them. */}
            {isContinuousRunning && <SongEqSaveSwitch id="songEqSave" />}
            <ClearEqButton />
            <EqModeSelect />
            <Button
              ariaLabel={t('eq.addBandAria')}
              isDisabled={frequencySortedFilters.length >= MAX_NUM_FILTERS}
              className="small subtle"
              handleChange={addFilter}
            >
              <MenuIcon name="plus" className="eq-toolbar__icon" />
              {t('eq.addBand')}
            </Button>
            <BandLayoutMenu />
          </div>
          {/* The delay of everything this page configures, with the switch
            that moves it: a property of the whole path, not one more verb for
            the toolbar. Under the title, facing the applied layers across
            the row (`MainContent.scss`). */}
          <ListenedLatency />
          {/* The bands below are not the whole chain, and anything else that
            is live is named here so the graph stops looking wrong. */}
          <ActiveLayers />
        </div>,
      )}
      <div
        className={`main-content main-content--${density}${
          bypassed.includes('eq') ? ' is-eq-bypassed' : ''
        }${bandPlacement ? ' is-placed' : ''}`}
      >
        <div className="eq-scale" aria-hidden="true">
          <span>+20</span>
          <span>0 dB</span>
          <span>-20</span>
        </div>
        {/* The rail scrolls when the bands stop fitting, with an arrow at
            each end — the same pair the workspace tabs use. Thirty-one bands
            in a narrow window were nine pixels each: a row of slivers with
            their frequencies overprinted on one another, and nothing anybody
            could aim at. Each band keeps a floor of its own instead and the
            row runs past the edge, which is a thing you can scroll. */}
        <div className="bands-rail">
          {/* No arrows while the bands stand under their points: every one of
              them is inside the plot's width by construction, and the few
              pixels the outermost may hang into the page's padding are not
              a row to scroll. */}
          {!bandPlacement && canScrollBands.canScrollBack && (
            <OverflowArrow
              direction="back"
              onPress={() => canScrollBands.scrollBy(-1)}
            />
          )}
          <div
            className="bands-rail__viewport"
            ref={canScrollBands.ref}
            onScroll={canScrollBands.onScroll}
          >
            <div
              ref={attachBands}
              className={`bands bands--${density} bands--${bandLayout}${
                bandPlacement ? ' is-placed' : ''
              }`}
              onPointerDown={handleBandsPointerDown}
              onPointerMove={handleBandsPointerMove}
              onPointerUp={finishBandSelection}
              onPointerCancel={finishBandSelection}
              style={
                {
                  '--band-count': frequencySortedFilters.length,
                  ...(bandPlacement && {
                    '--band-slot': `${bandPlacement.slot}px`,
                  }),
                } as CSSProperties
              }
            >
              {selectionBox && (
                <div
                  className="bands__selection-box"
                  style={{
                    left: Math.min(selectionBox.startX, selectionBox.currentX),
                    top: Math.min(selectionBox.startY, selectionBox.currentY),
                    width: Math.abs(
                      selectionBox.currentX - selectionBox.startX,
                    ),
                    height: Math.abs(
                      selectionBox.currentY - selectionBox.startY,
                    ),
                  }}
                />
              )}
              {frequencySortedFilters.map((filter, index) => (
                <FrequencyBand
                  key={filter.id}
                  filter={filter}
                  colorProgress={
                    frequencySortedFilters.length > 1
                      ? index / (frequencySortedFilters.length - 1)
                      : 0
                  }
                  density={density}
                  flatLayout
                  isSelected={selectedFilterIds.includes(filter.id)}
                  onSelect={(event) =>
                    toggleFilterSelection(
                      filter.id,
                      selectionModeFromEvent(event),
                    )
                  }
                  isHovered={hoveredFilterId === filter.id}
                  onHover={(isHovered) =>
                    setHoveredFilterId(isHovered ? filter.id : '')
                  }
                  isMinSliderCount={
                    frequencySortedFilters.length <= MIN_NUM_FILTERS
                  }
                  onGainChange={handleBandGainChange}
                  lead={bandPlacement?.leads[index]}
                />
              ))}
            </div>
          </div>
          {!bandPlacement && canScrollBands.canScrollForward && (
            <OverflowArrow
              direction="forward"
              onPress={() => canScrollBands.scrollBy(1)}
            />
          )}
        </div>
        {selectedFilter && (
          <div className="eq-flat-editor">
            {/* Which band, or how many. A group edit moves everything
                selected, so naming one frequency would be a lie about what
                the controls beside it are about to do. */}
            <div className="eq-flat-editor__identity">
              <span>{t('eq.selected')}</span>
              <strong>
                {(() => {
                  if (isGroupEdit) {
                    return t('eq.selectedCount', { count: selectedCount });
                  }
                  return selectedFilter.frequency >= 1000
                    ? `${Number((selectedFilter.frequency / 1000).toFixed(1))} kHz`
                    : `${selectedFilter.frequency} Hz`;
                })()}
              </strong>
            </div>
            <div className="eq-flat-editor__control eq-flat-editor__control--wide">
              <span>{t('eq.filter')}</span>
              <Dropdown
                name="selected-band-filter-type"
                value={selectedFilter.type}
                options={filterOptions}
                isDisabled={isBlockingError}
                placement="up"
                handleChange={(newValue) =>
                  setSelectedType(newValue as FilterTypeEnum)
                }
              />
            </div>
            {/* The one parameter a group cannot share.
                Gain and Q move by the same amount and the selection keeps its
                shape, but frequency is what tells the bands apart: nudging
                every one of them by the same number of hertz squeezes the top
                of the range flat and lets bands land on top of each other, and
                a single box cannot express what was actually wanted. Left
                visible rather than hidden so the row does not reshuffle, with
                the reason on the row itself. */}
            <div
              className="eq-flat-editor__control eq-flat-editor__control--centred"
              title={isGroupEdit ? t('eq.frequencyPerBand') : undefined}
            >
              <span>{t('eq.frequency')}</span>
              {/* A dial, like Q beside it. The knob reads a range that starts
                  above zero as a ratio and sweeps it logarithmically, which is
                  the only honest way to turn 1 Hz to 20 kHz with one hand: on
                  an even sweep everything below 2 kHz — which is most of what
                  a band is ever placed on — would sit inside a tenth of the
                  travel. */}
              <Knob
                name={t('eq.frequency')}
                value={selectedFilter.frequency}
                min={MIN_FREQUENCY}
                max={MAX_FREQUENCY}
                sensitivity={0.2}
                isDisabled={isGroupEdit}
                // Whole hertz: what a band is stored as and what Equalizer APO
                // is written in.
                step={1}
                unit="Hz"
                handleChange={(newValue) =>
                  updateSelectedGroup('frequency', newValue)
                }
              />
            </div>
            <div
              className="eq-flat-editor__control eq-flat-editor__control--centred"
              // The gesture that replaced the reset button, said out loud:
              // Ctrl+click is invisible, and the button it stands in for was
              // the only thing announcing that a band could be put back.
              title={isSelectedGainDisabled ? undefined : t('eq.gainReset')}
            >
              <span>
                {isSelectedGainDisabled ? t('eq.gainDisabled') : t('eq.gain')}
              </span>
              {/* Band pass, notch, low pass and high pass have no gain
                  parameter in Equalizer APO at all — they shape by frequency
                  and Q alone. Showing the band's stale gain in a greyed-out
                  box read as "this value is set but ignored", so the field is
                  replaced by an explicit note instead. */}
              {isSelectedGainDisabled ? (
                <div
                  className="eq-flat-editor__gain-na"
                  title={t('eq.gainNaHint')}
                >
                  {t('eq.setByQ')}
                </div>
              ) : (
                /* Bipolar, so the dial grows its arc from the centre and rests
                   with the notch straight up at flat — a boost and a cut of the
                   same size are mirror images of each other.

                   The reset button that used to stand beside it is gone: it was
                   the companion of a text box, which had no other way to say
                   "back to flat", and beside a dial it was an unlabelled square
                   parked between two circles. Its job moved onto the dial's own
                   Ctrl+click, where every other dial in the app already keeps
                   it — and got better in the move, because `onReset` flattens
                   the whole selection absolutely instead of nudging it by the
                   shown band's distance from zero. */
                <Knob
                  name={t('eq.gain')}
                  value={selectedFilter.gain}
                  min={MIN_GAIN}
                  max={MAX_GAIN}
                  isDisabled={false}
                  // The resolution the gain sliders already move in.
                  step={0.01}
                  unit="dB"
                  defaultValue={0}
                  onReset={resetSelectedGain}
                  handleChange={(newValue) =>
                    updateSelectedGroup('gain', newValue)
                  }
                />
              )}
            </div>
            <div className="eq-flat-editor__control eq-flat-editor__control--centred">
              <span>{t('eq.quality')}</span>
              <Knob
                name={t('eq.quality')}
                value={selectedFilter.quality}
                min={MIN_QUALITY}
                max={MAX_QUALITY}
                isDisabled={false}
                step={0.01}
                unit="Q"
                // Ctrl+click puts the band back to the width every band
                // starts at.
                defaultValue={DEFAULT_QUALITY}
                handleChange={(newValue) =>
                  updateSelectedGroup('quality', newValue)
                }
              />
            </div>
            {/* In or out of the chain, without losing what the band was set
                to. Next to Delete because the two are the same kind of thing —
                what happens to the band itself, rather than what shape it has
                — and in that order because this is the reversible one.

                A mixed selection reads as on and switches everything off, which
                is the only reading that makes the second press undo the first.
                Deriving it per band would make the control mean "flip each of
                these", and a switch nobody can predict the result of is worse
                than no switch. */}
            <div className="eq-flat-editor__control eq-flat-editor__control--centred">
              <span>{t('eq.active')}</span>
              <div className="eq-flat-editor__switch">
                <Switch
                  id="selected-band-enabled"
                  ariaLabel={
                    isGroupEdit
                      ? t('eq.activeGroupAria', { count: selectedCount })
                      : t('eq.activeAria')
                  }
                  isOn={isSelectionEnabled}
                  isDisabled={isBlockingError}
                  handleToggle={() =>
                    setFiltersEnabled(selectedFilters, !isSelectionEnabled)
                  }
                />
              </div>
            </div>
            {/* The title is what the icon-only form needs: once the row is
                squeezed and the label collapses, a bare glyph is the only
                thing left, and hovering has to be able to say what it does.
                It carries the full sentence rather than the button text, so
                it is worth having even when the label is showing. */}
            <div className="eq-flat-editor__delete-cell" ref={deleteCellRef}>
              <button
                type="button"
                aria-label={deleteLabel}
                title={deleteLabel}
                className={`eq-flat-editor__delete${
                  isDeleteArmed ? ' is-armed' : ''
                }`}
                disabled={frequencySortedFilters.length <= MIN_NUM_FILTERS}
                // Arms rather than deletes. There is no undo anywhere in this
                // app, and this button sits one control along from the on/off
                // switch it is easiest to have meant instead.
                onClick={() => {
                  if (isDeleteArmed) {
                    setIsDeleteArmed(false);
                    deleteSelectedFilter();
                    return;
                  }
                  setIsDeleteArmed(true);
                }}
              >
                {/* Rendered always, shown only when the row runs out of room.
                    `currentColor` so it dims with the button when there is only
                    one band left and deleting is not allowed. */}
                <TrashIcon
                  className="eq-flat-editor__delete-icon"
                  fill="currentColor"
                />
                <span className="eq-flat-editor__delete-label">
                  {isDeleteArmed ? t('eq.delete.armed') : t('eq.delete')}
                </span>
              </button>
              {/* The way out, said rather than implied. Pressing elsewhere and
                  Escape both stand the button down, but neither is on screen,
                  and a control that has turned red with no visible way back is
                  a control people press again to find out. */}
              {isDeleteArmed && (
                <button
                  type="button"
                  className="eq-flat-editor__keep"
                  aria-label={t('eq.delete.keepAria')}
                  title={t('eq.delete.keepAria')}
                  onClick={() => setIsDeleteArmed(false)}
                >
                  <span className="eq-flat-editor__keep-icon">
                    <ConfirmIcon variant="cancel" />
                  </span>
                  <span className="eq-flat-editor__delete-label">
                    {t('eq.delete.keep')}
                  </span>
                </button>
              )}
            </div>
          </div>
        )}
        {/* With nothing selected, the same row carries the whole rack instead
            of one band: Bass, Mid and Treble, the way an amplifier has them.
            It stands where the band editor stands rather than somewhere of its
            own, because it is the same question — what is being shaped, and
            with what — asked of everything instead of one thing. */}
        {!selectedFilter && (
          <div className="eq-flat-editor eq-flat-editor--tone">
            {/* The row's name where a band's frequency stands, with nothing
                over it: the band count it used to carry said the dials were
                spread across the bands, and they are a curve of their own
                now (`tone.ts`). */}
            <div className="eq-flat-editor__identity">
              <span aria-hidden="true" />
              <strong>{t('eq.tone')}</strong>
            </div>
            {/* The two cuts either side of the three tone dials, the low one
                on the left and the high one on the right, as they sit on
                the graph. */}
            <EqCutKnob cut="low" />
            {TONE_CONTROLS.map(({ knob, labelKey }) => (
              <div
                key={knob}
                className="eq-flat-editor__control eq-flat-editor__control--centred"
              >
                <span>{t(labelKey)}</span>
                <Knob
                  name={t(labelKey)}
                  value={tone[knob]}
                  min={-TONE_MAX_DB}
                  max={TONE_MAX_DB}
                  isDisabled={isToneDisabled}
                  step={0.1}
                  unit="dB"
                  defaultValue={0}
                  onReset={() => resetTone(knob)}
                  handleChange={(newValue) => turnTone(knob, newValue)}
                />
              </div>
            ))}
            <EqCutKnob cut="high" />
          </div>
        )}
      </div>
    </>
  );
};

export default MainContent;
