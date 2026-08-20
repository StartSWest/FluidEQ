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
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  FilterTypeEnum,
  FilterTypeToLabelMap,
  FixedBandSizeEnum,
  IFilter,
  IFilterEdit,
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
import { ErrorDescription } from 'common/errors';
import FrequencyBand from './components/FrequencyBand';
import { FilterActionEnum, useFluidEqContext } from './utils/FluidEqContext';
import './styles/MainContent.scss';
import './styles/MultiSelect.scss';
import Spinner from './icons/Spinner';
import { clamp, sortHelper, useThrottleAndExecuteLatest } from './utils/utils';
import Button from './widgets/Button';
import AnchoredMenu, { isInsideAnchoredMenu } from './widgets/AnchoredMenu';
import {
  addEqualizerSlider,
  clearGains,
  removeEqualizerSlider,
  setFilterValues,
  setFixedBand,
} from './utils/equalizerApi';
import Dropdown from './widgets/Dropdown';
import NumberInput from './widgets/NumberInput';
import Knob from './widgets/Knob';
import { LABELLED_FILTER_OPTIONS } from './icons/FilterTypeIcon';
import { useLiveAudioControl } from './audio/LiveAudioContext';
import { toggleContinuousEq, useContinuousEq } from './utils/continuousEq';
import {
  CONTINUOUS_MODES,
  TSmartEqMode,
  isContinuousMode,
  setSmartEqMode,
  useSmartEqMode,
} from './utils/smartEqMode';
import { cancelSmartEq, runSmartEq, useSmartEqRun } from './utils/smartEqRun';
import { useCorrectionFlash } from './utils/correctionFlash';
import VoicingQuickPick from './components/VoicingQuickPick';
import ActiveLayers from './components/ActiveLayers';
import MenuIcon from './icons/MenuIcon';
import TrashIcon from './icons/TrashIcon';
import { PetArt } from './SupportPet';
import { useTranslation } from './utils/I18nContext';

/**
 * How often a group edit is allowed to reach Equalizer APO, in ms.
 *
 * The same figure the individual band sliders throttle to, and for the same
 * reason: a write is an installation check, a retried config rewrite and a
 * preset save, none of which a drag needs sixty times a second. The trailing
 * call always fires, so the value that lands is the one the control ended on.
 */
const GROUP_EDIT_INTERVAL = 100;

/** In the order the picker offers them. */
const SMART_EQ_MODES: TSmartEqMode[] = ['smart', ...CONTINUOUS_MODES];

const MainContent = () => {
  const {
    filters,
    isLoading,
    isBlockingError,
    dispatchFilter,
    setGlobalError,
    setPreAmp,
    selectedFilterId,
    setSelectedFilterId,
    selectedFilterIds,
    setSelectedFilterIds,
    toggleFilterSelection,
    hoveredFilterId,
    setHoveredFilterId,
    bypassed,
  } = useFluidEqContext();
  const { t } = useTranslation();
  const { isActive: isLiveOutputActive } = useLiveAudioControl();
  /**
   * What Smart EQ is doing, read from where it is actually happening.
   *
   * Not this component's state any more, and that is the whole of the fix: the
   * measurements used to live here, so leaving the EQ tab unmounted them
   * mid-capture. They are hosted in `SmartEqEngine` now, above the tabs, and
   * this reads the same three values it used to own.
   */
  const {
    status: balanceStatus,
    listeningFor,
    isRunning: isBalancing,
  } = useSmartEqRun();
  const isContinuousOn = useContinuousEq();
  const isSmartBypassed = bypassed.includes('smart');
  const smartEqMode = useSmartEqMode();
  const [isModeMenuOpen, setIsModeMenuOpen] = useState(false);
  const modeMenuHolder = useRef<HTMLSpanElement>(null);
  /**
   * On, chosen, and not held up by a switch on the other side of the screen.
   *
   * The mode staying on through a bypass is right — it is a preference, and the
   * layer comes back — but a lit button over a stopped loop is the app claiming
   * to be doing something it is not.
   */
  const isContinuousRunning =
    isContinuousMode(smartEqMode) && isContinuousOn && !isSmartBypassed;
  const smartLabel = isBalancing
    ? t('eq.smart.cancelAria')
    : t('eq.smart.aria');
  const continuousLabel = t('eq.smart.continuousAria');
  /**
   * A correction landing, for a second and a half, from the store the graph
   * marks its ranges from. One source for both, so the bubble turning green and
   * the columns appearing over the frequencies that moved are the same event
   * rather than two timers that agree most of the time.
   */
  const flashedRanges = useCorrectionFlash();
  /**
   * What the bubble says: an announcement if there is one, the measurement
   * otherwise.
   *
   * `balanceStatus` is a remark with a timer on it — a correction landing, a
   * voicing change rebuilding the layer, a run finishing — and outranks the rest
   * because somebody is waiting to hear about it. Underneath is the running
   * measurement, which is the truth for almost all of the time and is worth
   * saying: the capture really is open, the pet really is nodding along to it,
   * and the percentage moving is the difference between a mode working quietly
   * and a mode that has stopped.
   */
  const bubbleText = balanceStatus || (isContinuousRunning ? listeningFor : '');
  const modeLabel = (entry: TSmartEqMode) => {
    if (entry === 'detail') {
      return t('eq.smart.mode.detail');
    }
    if (entry === 'balance') {
      return t('eq.smart.mode.balance');
    }
    if (entry === 'target') {
      return t('eq.smart.mode.target');
    }
    return t('eq.smart');
  };
  const modeNote = (entry: TSmartEqMode) => {
    if (entry === 'detail') {
      return t('eq.smart.mode.detail.note');
    }
    if (entry === 'balance') {
      return t('eq.smart.mode.balance.note');
    }
    if (entry === 'target') {
      return t('eq.smart.mode.target.note');
    }
    return t('eq.smart.mode.once.note');
  };

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

  // Read by the group edit below, which runs from a throttled timer and must
  // see the selection and the bands as they are when it fires rather than as
  // they were when the drag started.
  const selectedFilterRef = useRef(selectedFilter);
  selectedFilterRef.current = selectedFilter;
  const selectedFilterIdsRef = useRef(selectedFilterIds);
  selectedFilterIdsRef.current = selectedFilterIds;

  /**
   * Something is selected to begin with, and nothing re-selects after that.
   *
   * This used to select the first band whenever the selection was empty, for
   * any reason. That made deselecting impossible: clicking the empty part of
   * the graph cleared the selection and this put one straight back, so the
   * marquee's "select nothing" and the click-away both appeared to jump the
   * selection to a band rather than release it.
   *
   * The two cases it actually needs to cover are narrower. Nothing has ever
   * been selected — the first load, where the editor above would otherwise open
   * on no band at all. And the selection has gone stale, which happens when the
   * band it named is deleted or the layout is swapped underneath it; leaving
   * that alone would show an editor for a band that no longer exists.
   *
   * An empty selection the user asked for is neither of those, and is now left
   * exactly as they left it.
   */
  const hasSelectedOnce = useRef(false);
  useEffect(() => {
    const [firstFilter] = frequencySortedFilters;
    if (!firstFilter) {
      return;
    }
    const isStale = Boolean(selectedFilterId) && !filters[selectedFilterId];
    const isFirstEver = !hasSelectedOnce.current && !selectedFilterId;
    if (isStale || isFirstEver) {
      setSelectedFilterId(firstFilter.id);
    }
    hasSelectedOnce.current = true;
  }, [filters, frequencySortedFilters, selectedFilterId, setSelectedFilterId]);

  // The bands as they are right now, not as they were when this render's
  // closures were made. The group edit below runs from a throttled timer, so
  // everything captured in that closure is frozen at the moment the drag
  // started.
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  const bandsRef = useRef<HTMLDivElement>(null);
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

  const throttledGroupFlush = useThrottleAndExecuteLatest(
    flushGroupEdit,
    GROUP_EDIT_INTERVAL,
  );

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
   * The edit is shown immediately and written on a throttle. Both halves
   * matter: showing it immediately is what makes the next delta measure from
   * where the band actually is, and throttling the write is what stops a drag
   * queueing a config rewrite per frame. They are absolute values, so a write
   * skipped mid-drag loses nothing — the one that lands last is complete.
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
      await throttledGroupFlush(edits);
    },
    [dispatchFilter, throttledGroupFlush],
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
  const deleteSelectedFilter = async () => {
    if (selectedCount === 0) {
      return;
    }
    const deletable = selectedFilters.slice(
      0,
      Math.max(0, frequencySortedFilters.length - MIN_NUM_FILTERS),
    );
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

  // Clearing restores the default ten-band layout with every band neutral, so
  // the main process owns the new filter set and hands it back.
  const clearFilterGains = async () => {
    try {
      const newFilters = await clearGains();
      setPreAmp(0);
      setSelectedFilterIds([]);
      dispatchFilter({
        type: FilterActionEnum.INIT,
        filters: newFilters,
      });
      window.dispatchEvent(new Event('fluideq-clear-autoeq-selection'));
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

  const handleFixedBand = (size: FixedBandSizeEnum) => async () => {
    try {
      const newFilters = await setFixedBand(size);
      dispatchFilter({
        type: FilterActionEnum.INIT,
        filters: newFilters,
      });
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

    const selectedFilterIndex = frequencySortedFilters.findIndex(
      (filter) => filter.id === explicitSelectedFilter.id,
    );
    if (selectedFilterIndex === -1) {
      return;
    }

    const shouldAddToRight = explicitSelectedFilter.frequency >= 1000;
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
    } catch (e) {
      setGlobalError(e as ErrorDescription);
    }
  };

  return isLoading ? (
    <div className="center full row">
      <Spinner />
    </div>
  ) : (
    <>
      <div className="main-content-title">
        <div>
          <span className="eyebrow">{t('eq.eyebrow')}</span>
          <h2>{t('eq.title')}</h2>
        </div>
        <div className="eq-toolbar">
          <VoicingQuickPick />
          {/* One button, and it is whichever way of measuring is chosen.
              The two do the same job by different means and only one can be
              running, so a row offering both at once invited pressing both. The
              caret is where the other one lives; picking it changes what this
              button is, and a press then does it. */}
          <span
            className={`eq-mode${isModeMenuOpen ? ' is-open' : ''}${
              isLiveOutputActive ? '' : ' is-disabled'
            }`}
            ref={modeMenuHolder}
          >
            <Button
              ariaLabel={
                isContinuousMode(smartEqMode) ? continuousLabel : smartLabel
              }
              isDisabled={
                isContinuousMode(smartEqMode)
                  ? !isLiveOutputActive
                  : !isBalancing && !isLiveOutputActive
              }
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
              disabled={!isLiveOutputActive}
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
                // Green for the second and a half after a write reaches
                // Equalizer APO, which is the moment the sound changes. It is
                // the one thing in here that is not a sentence about what will
                // happen: it means it just did.
                className={`eq-mode__bubble${
                  flashedRanges.length > 0 ? ' is-applied' : ''
                }`}
                role="status"
              >
                <span className="eq-mode__bubble-pet" aria-hidden>
                  <PetArt />
                </span>
                <span className="eq-mode__bubble-text">{bubbleText}</span>
              </span>
            )}
          </span>
          <Button
            ariaLabel={t('eq.clear')}
            isDisabled={false}
            className="small subtle"
            handleChange={clearFilterGains}
          >
            <MenuIcon name="reset" className="eq-toolbar__icon" />
            {t('eq.clear')}
          </Button>
          <Button
            ariaLabel={t('eq.addBandAria')}
            isDisabled={frequencySortedFilters.length >= MAX_NUM_FILTERS}
            className="small subtle"
            handleChange={addFilter}
          >
            <MenuIcon name="plus" className="eq-toolbar__icon" />
            {t('eq.addBand')}
          </Button>
          <div className="quick-layouts">
            <span>
              <MenuIcon name="layout" className="eq-toolbar__icon" />
              {t('eq.quickLayouts')}
            </span>
            {Object.values(FixedBandSizeEnum)
              .filter((s) => !Number.isNaN(Number(s)))
              .map((size) => (
                <Button
                  key={`${size}-band`}
                  ariaLabel={t('eq.bandCount', { count: size })}
                  isDisabled={false}
                  className={
                    frequencySortedFilters.length === Number(size)
                      ? 'small'
                      : 'small subtle'
                  }
                  handleChange={handleFixedBand(size as FixedBandSizeEnum)}
                >
                  {t('eq.bandCount', { count: size })}
                </Button>
              ))}
          </div>
        </div>
        {/* Its own full-width row under the title and the toolbar. The bands
            below are not the whole chain, and anything else that is live is
            named here so the graph stops looking wrong. */}
        <ActiveLayers />
      </div>
      <div
        className={`main-content main-content--${density}${
          bypassed.includes('eq') ? ' is-eq-bypassed' : ''
        }`}
      >
        <div className="eq-scale" aria-hidden="true">
          <span>+20</span>
          <span>0 dB</span>
          <span>-20</span>
        </div>
        <div
          ref={bandsRef}
          className={`bands bands--${density} bands--${bandLayout}`}
          onPointerDown={handleBandsPointerDown}
          onPointerMove={handleBandsPointerMove}
          onPointerUp={finishBandSelection}
          onPointerCancel={finishBandSelection}
          style={
            { '--band-count': frequencySortedFilters.length } as CSSProperties
          }
        >
          {selectionBox && (
            <div
              className="bands__selection-box"
              style={{
                left: Math.min(selectionBox.startX, selectionBox.currentX),
                top: Math.min(selectionBox.startY, selectionBox.currentY),
                width: Math.abs(selectionBox.currentX - selectionBox.startX),
                height: Math.abs(selectionBox.currentY - selectionBox.startY),
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
                  event.ctrlKey || event.metaKey || event.shiftKey,
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
            />
          ))}
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
                    return `${selectedCount} bands`;
                  }
                  return selectedFilter.frequency >= 1000
                    ? `${Number((selectedFilter.frequency / 1000).toFixed(1))} kHz`
                    : `${selectedFilter.frequency} Hz`;
                })()}
              </strong>
            </div>
            <div className="eq-flat-editor__control">
              <span>{t('eq.filter')}</span>
              <Dropdown
                name="selected-band-filter-type"
                value={selectedFilter.type}
                options={LABELLED_FILTER_OPTIONS}
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
              className="eq-flat-editor__control"
              title={
                isGroupEdit
                  ? 'Frequency is per band — select a single band to change it'
                  : undefined
              }
            >
              <span>{t('eq.frequency')}</span>
              <NumberInput
                name="selected-band-frequency"
                value={selectedFilter.frequency}
                min={MIN_FREQUENCY}
                max={MAX_FREQUENCY}
                isDisabled={isGroupEdit}
                showArrows
                handleSubmit={(newValue) =>
                  updateSelectedGroup('frequency', newValue)
                }
              />
            </div>
            <div className="eq-flat-editor__control">
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
                  title={`A ${FilterTypeToLabelMap[selectedFilter.type]} has no gain in Equalizer APO. Use Frequency and Q to shape it, or switch to a Peak or Shelf filter to set a level.`}
                >
                  Set by Q
                </div>
              ) : (
                <div className="eq-flat-editor__input-row">
                  <NumberInput
                    name="selected-band-gain"
                    value={selectedFilter.gain}
                    min={MIN_GAIN}
                    max={MAX_GAIN}
                    isDisabled={false}
                    floatPrecision={2}
                    showArrows
                    handleSubmit={(newValue) =>
                      updateSelectedGroup('gain', newValue)
                    }
                  />
                  <button
                    type="button"
                    className="eq-flat-editor__reset-gain"
                    aria-label={
                      isGroupEdit
                        ? `Reset all ${selectedCount} selected gains to 0 dB`
                        : 'Reset selected gain to 0 dB'
                    }
                    title={
                      isGroupEdit
                        ? `Reset all ${selectedCount} selected gains to 0 dB`
                        : 'Reset selected gain to 0 dB'
                    }
                    // Enabled while any band in the selection is off zero, not
                    // only the primary: a group where the primary happens to
                    // sit at 0 dB still has something to reset.
                    disabled={
                      isBlockingError ||
                      !selectedFilters.some((filter) => filter.gain !== 0)
                    }
                    onClick={resetSelectedGain}
                  >
                    ↺
                  </button>
                </div>
              )}
            </div>
            <div className="eq-flat-editor__control">
              <span>{t('eq.quality')}</span>
              <Knob
                name="selected-band-quality"
                value={selectedFilter.quality}
                min={MIN_QUALITY}
                max={MAX_QUALITY}
                isDisabled={false}
                step={0.01}
                unit="Q"
                handleChange={(newValue) =>
                  updateSelectedGroup('quality', newValue)
                }
              />
            </div>
            {/* The title is what the icon-only form needs: once the row is
                squeezed and the label collapses, a bare glyph is the only
                thing left, and hovering has to be able to say what it does.
                It carries the full sentence rather than the button text, so
                it is worth having even when the label is showing. */}
            <button
              type="button"
              aria-label={
                isGroupEdit
                  ? `Delete the ${selectedCount} selected bands`
                  : t('eq.deleteAria')
              }
              title={
                isGroupEdit
                  ? `Delete the ${selectedCount} selected bands`
                  : t('eq.deleteAria')
              }
              className="eq-flat-editor__delete"
              disabled={frequencySortedFilters.length <= MIN_NUM_FILTERS}
              onClick={deleteSelectedFilter}
            >
              {/* Rendered always, shown only when the row runs out of room.
                  `currentColor` so it dims with the button when there is only
                  one band left and deleting is not allowed. */}
              <TrashIcon
                className="eq-flat-editor__delete-icon"
                fill="currentColor"
              />
              <span className="eq-flat-editor__delete-label">
                {t('eq.delete')}
              </span>
            </button>
          </div>
        )}
      </div>
    </>
  );
};

export default MainContent;
