/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>

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
import {
  blendSmartEqTarget,
  buildSmartEqSettings,
  describeSmartEqLayer,
  getSmartEqBands,
  hasSmartEqLayer,
  stepSmartEqGains,
} from 'common/smartEq';
import FrequencyBand from './components/FrequencyBand';
import { FilterActionEnum, useFluidEqContext } from './utils/FluidEqContext';
import './styles/MainContent.scss';
import './styles/MultiSelect.scss';
import Spinner from './icons/Spinner';
import { clamp, sortHelper, useThrottleAndExecuteLatest } from './utils/utils';
import Button from './widgets/Button';
import {
  addEqualizerSlider,
  clearGains,
  removeEqualizerSlider,
  setFilterValues,
  setFixedBand,
  setSmartEq as setSmartEqApi,
} from './utils/equalizerApi';
import Dropdown from './widgets/Dropdown';
import NumberInput from './widgets/NumberInput';
import Knob from './widgets/Knob';
import { LABELLED_FILTER_OPTIONS } from './icons/FilterTypeIcon';
import { useLiveAudioControl } from './audio/LiveAudioContext';
import { toggleContinuousEq, useContinuousEq } from './utils/continuousEq';
import {
  TSmartEqMode,
  setSmartEqMode,
  useSmartEqMode,
} from './utils/smartEqMode';
import {
  IBalanceReport,
  buildBalancedGains,
  buildRegionSpectrum,
  describeBalanceProgress,
  describeBalanceResult,
} from './utils/autoBalance';
import { buildLayerTargetCurve } from './utils/layerTargetCurve';
import { planBandReveal, revealBands } from './utils/bandReveal';
import VoicingQuickPick from './components/VoicingQuickPick';
import ActiveLayers from './components/ActiveLayers';
import MenuIcon from './icons/MenuIcon';
import TrashIcon from './icons/TrashIcon';
import { useTranslation } from './utils/I18nContext';

/**
 * How many times a measurement will restart itself.
 *
 * Changing the sound mid-capture restarts rather than cancels. Bounded so that
 * someone fiddling with sliders while it listens eventually gets an answer
 * instead of an endless loop.
 */
const MAX_BALANCE_ATTEMPTS = 3;

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
const SMART_EQ_MODES: TSmartEqMode[] = ['smart', 'continuous'];

/**
 * How long after a correction lands before the analyser is believed again.
 *
 * Equalizer APO reloads its config when the file changes, and what comes out
 * while it does is neither the old chain nor the new one. Averaging that in is
 * how a correction ends up measured against half of itself — and the regions
 * that were just corrected are exactly the ones freshly cleared and listening,
 * so they are exactly the ones that would swallow it.
 *
 * Three quarters of a second is comfortably longer than a reload and shorter
 * than the gap between two checkpoints, so in the ordinary case it costs
 * nothing at all: the window has closed again before the next one is due.
 */
const CONTINUOUS_SETTLE_MS = 750;

/** After this, an outstanding write is treated as lost rather than pending. */
const CONTINUOUS_APPLY_TIMEOUT_MS = 10000;

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
    convolution,
    voicing,
    driver,
    smartEq,
    setSmartEq,
    getBandSetGeneration,
    bypassed,
  } = useFluidEqContext();
  const { t } = useTranslation();
  const { captureBalanceProfile, isActive: isLiveOutputActive } =
    useLiveAudioControl();
  const [balanceStatus, setBalanceStatus] = useState('');
  const [isBalancing, setIsBalancing] = useState(false);
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
    smartEqMode === 'continuous' && isContinuousOn && !isSmartBypassed;
  const smartLabel = isBalancing
    ? t('eq.smart.cancelAria')
    : t('eq.smart.aria');
  const continuousLabel = t('eq.smart.continuousAria');

  // Closes on a click elsewhere and on Escape, like every other menu here.
  useEffect(() => {
    if (!isModeMenuOpen) {
      return undefined;
    }
    const onPointerDown = (event: MouseEvent) => {
      if (!modeMenuHolder.current?.contains(event.target as Node)) {
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
  /** A correction is on its way to Equalizer APO right now. */
  const isApplyingRef = useRef(false);
  /** When it set off, so a write that never returns cannot wedge the mode. */
  const applyStartedAtRef = useRef(0);
  /** When the chain can be believed again, after the last one landed. */
  const applySettledAtRef = useRef(0);
  /** Regions to clear once it has: what they heard mid-change is not evidence. */
  const pendingResetRef = useRef<number[]>([]);
  /**
   * Where the correction is heading, averaged over every window so far.
   *
   * The one thing in this loop that deliberately outlives a region being
   * cleared. See `blendSmartEqTarget` for why an average of destinations is
   * meaningful across corrections where an average of measurements is not.
   */
  const longRunTargetRef = useRef<Record<string, number>>({});
  /**
   * The running Continuous EQ capture, so the manual button can end it.
   *
   * There is only one analyser session, and starting a second is refused. The
   * effect below would tear this one down on its own — `isBalancing` is in its
   * dependencies — but that happens on React's schedule, and `autoBalance`
   * reaches for the analyser in the same tick it sets the flag. Whether the
   * teardown wins the race depends on whether there is a layer to clear first,
   * because that is what puts an `await` in front of the capture. So it is done
   * here explicitly instead: pressing Smart EQ stops the loop before it asks
   * for anything.
   */
  const continuousAbortRef = useRef<AbortController | undefined>(undefined);
  const balanceAbortRef = useRef<AbortController | undefined>(undefined);
  // Bumped whenever a run is superseded, so a late resolution from an
  // abandoned measurement cannot write gains or overwrite the status.
  const balanceRunRef = useRef(0);
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

  // Leaving the EQ tab unmounts this component; a measurement must not keep
  // running against a component that is gone.
  useEffect(
    () => () => {
      balanceRunRef.current += 1;
      balanceAbortRef.current?.abort();
    },
    [],
  );

  // The chain as it is right now, not as it was when this render's closures
  // were made. A measurement runs for tens of seconds, and everything captured
  // in that closure is frozen at the moment it started — which is how the guard
  // meant to notice the layout changing mid-capture ended up comparing the
  // measured set against itself and never firing, and how the voicing used to
  // be read for the target curve long after the user had switched it.
  const filtersRef = useRef(filters);
  filtersRef.current = filters;
  const voicingRef = useRef(voicing);
  voicingRef.current = voicing;
  const driverRef = useRef(driver);
  driverRef.current = driver;
  const convolutionRef = useRef(convolution);
  convolutionRef.current = convolution;
  const smartEqRef = useRef(smartEq);
  smartEqRef.current = smartEq;

  /**
   * Everything audible, as one comparable string.
   *
   * The accumulator averages frames from whatever chain was live, so any change
   * to that chain part-way through contaminates the result — not only the band
   * count the old guard watched, but a gain nudge, a voicing switch, a driver
   * change or a convolution appearing. All of it is read from refs, because the
   * question is what is live now, not what was live when the run started.
   *
   * The Smart EQ layer is not in here, but it is guarded — separately, against
   * what the run itself believes it wrote, rather than against a snapshot of
   * the ref. ActiveLayers' clear button and every refreshState write it too, so
   * it cannot be assumed to move only when the run moves it; and a snapshot
   * would report the run's own optimistic clear as an outside change, because
   * React owes us nothing about when the next render lands.
   */
  const describeLiveChain = () =>
    JSON.stringify([
      Object.values(filtersRef.current)
        .sort(sortHelper)
        .map(
          (filter) =>
            `${filter.type}@${filter.frequency}/${filter.gain}/${filter.quality}`,
        ),
      voicingRef.current?.profileId ?? '',
      voicingRef.current?.intensity ?? 0,
      driverRef.current?.profileId ?? '',
      driverRef.current?.intensity ?? 0,
      convolutionRef.current?.fileName ?? convolutionRef.current?.name ?? '',
    ]);

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

  /**
   * Listen to what is actually coming out of the speakers, then flatten the
   * peaks and dips it finds while leaving the music's own spectral tilt alone.
   *
   * The answer lands in the Smart EQ layer, never in the bands on screen. What
   * the measurement finds is the residual of the whole chain — the bands, the
   * voicing, the driver compensation and the last Smart EQ correction, all
   * heard together — so it belongs to none of them individually and writing it
   * into the bands meant a measurement quietly rewrote a tuning someone had
   * built by hand.
   *
   * There is no fixed duration. The measurement runs until every frequency
   * region has been heard well enough to correct — or reports which range it
   * managed to measure, and leaves the rest alone.
   */
  const autoBalance = async () => {
    if (isBalancing) {
      // The button is a Cancel while a measurement is running.
      balanceAbortRef.current?.abort();
      return;
    }

    // The analyser takes one session at a time, and Continuous EQ holds one for
    // as long as it is switched on. See `continuousAbortRef` for why waiting
    // for the effect to do this would be a race rather than an ordering.
    continuousAbortRef.current?.abort();

    balanceRunRef.current += 1;
    const runId = balanceRunRef.current;
    const isCurrentRun = () => balanceRunRef.current === runId;
    const controller = new AbortController();
    balanceAbortRef.current = controller;

    setIsBalancing(true);

    try {
      let attempt = 0;

      // Runs once normally. It goes round again only when the audible chain
      // changed while it was listening.
      // eslint-disable-next-line no-constant-condition
      while (true) {
        attempt += 1;

        // The layer this attempt is measuring against, read fresh every time
        // round. Within an attempt it is tracked locally rather than off the
        // ref, because clearing it below is optimistic and React owes us
        // nothing about when the next render lands — but carrying it *across*
        // attempts was how one profile's accumulated correction ended up
        // written into whichever profile the user had switched to, since the
        // commonest reason to go round again is that they loaded another one.
        let layer = smartEqRef.current;

        // Always from flat, and it used to be a choice.
        //
        // Measuring the already-corrected output sounds better — the loop
        // converges and self-corrects any error in the filter model — and it
        // has a blind spot that undoes all of that: a region already cut hard
        // has almost no energy left in it, so the measurement marks it
        // untrustworthy and never touches it again. The correction hides the
        // very problem it is causing, and the only way out is the thing that
        // was behind the checkbox.
        //
        // A switch whose right answer is the same every time is not a choice,
        // it is a way of being wrong. So the escape hatch became the road.
        //
        // Continuous EQ does not do this, and the difference is the point of
        // having both. It cannot afford to: clearing first would take the
        // correction off for the length of every capture, over and over, all
        // evening. So it accumulates, and inherits the blind spot — a region
        // cut so hard that nothing is left to measure stays cut, through any
        // number of updates. This button is the way back out of that, which is
        // why it is still the honest measurement and still starts from flat.
        if (hasSmartEqLayer(layer)) {
          // Only this layer. The bands, the reference they came from, the
          // voicing and the driver compensation are all somebody's deliberate
          // choice, and a measurement has no business throwing any of them away
          // to make its own job easier. (It used to zero the bands and drop the
          // headphone attribution, which is exactly that.)
          setBalanceStatus('Clearing the last correction...');
          layer = undefined;
          setSmartEq(undefined);
          await setSmartEqApi(undefined);
          if (!isCurrentRun()) {
            return;
          }
        }

        // The layer's own bands, so the solve accumulates onto what it wrote
        // last time instead of onto whatever the user's editor happens to hold.
        const bands = getSmartEqBands(layer);
        const chainBeforeCapture = describeLiveChain();
        // What this run believes the layer to be. Comparing the live layer
        // against this after the capture is what tells somebody else's write —
        // the chip's clear button, a profile load — from the run's own.
        const layerBeforeCapture = describeSmartEqLayer(layer);

        setBalanceStatus('Listening 0%');
        const result = await captureBalanceProfile({
          signal: controller.signal,
          onProgress: (progress) => {
            if (isCurrentRun()) {
              setBalanceStatus(describeBalanceProgress(progress));
            }
          },
        });

        if (!isCurrentRun()) {
          return;
        }

        // Changing anything audible mid-capture invalidates the average: the
        // frames it is built from describe two different chains. Rather than
        // throwing away the half-minute the user just spent listening, measure
        // again against what they now have — reaching for a slider part-way
        // through is a perfectly reasonable thing to do, and being told off for
        // it is not.
        //
        // The layer counts as part of that chain. Clearing it from the chip
        // while a run listens used to be silently undone, because the run went
        // on to write `the gains it started from + this residual` back over the
        // top of the clear.
        if (
          describeLiveChain() !== chainBeforeCapture ||
          describeSmartEqLayer(smartEqRef.current) !== layerBeforeCapture
        ) {
          if (attempt >= MAX_BALANCE_ATTEMPTS) {
            setBalanceStatus('The sound kept changing - stopped');
            return;
          }
          setBalanceStatus('Sound changed - measuring again');
          // eslint-disable-next-line no-continue
          continue;
        }

        // Steer toward the layers below rather than merely flattening. The
        // capture contains the user's own bands, the voicing and the driver
        // compensation, so without this Smart EQ reads all three as error and
        // quietly cancels them out.
        const gains = buildBalancedGains(result.samples, bands, {
          targetCurve: buildLayerTargetCurve(
            filtersRef.current,
            voicingRef.current,
            driverRef.current,
          ),
        });
        if (Object.keys(gains).length === 0) {
          setBalanceStatus('Not enough range to measure');
          return;
        }

        const measured = buildSmartEqSettings(bands, gains, {
          status: result.status,
          lowFrequency: result.lowFrequency,
          highFrequency: result.highFrequency,
        });

        // Compared on what will be written, not on object identity: a run that
        // moves every band by less than the rounding step has genuinely found
        // nothing left to correct.
        if (describeSmartEqLayer(measured) === describeSmartEqLayer(layer)) {
          setBalanceStatus('Already balanced');
          return;
        }

        setBalanceStatus('Applying...');

        // The same reveal the AutoEQ panel uses, pointed at the layer instead
        // of at the bands: its curve climbs onto the graph a band at a time
        // rather than appearing whole. The write below is still one message —
        // what is heard changes once, at the start — and the animation that
        // follows is only how the result is drawn.
        //
        // Revealed from the layer's previous gains rather than from silence,
        // because a run after the first is a correction to a correction, and
        // what is worth watching is where it moved.
        const generation = getBandSetGeneration();
        const isCurrent = () =>
          isCurrentRun() && getBandSetGeneration() === generation;
        const plan = measured
          ? planBandReveal(measured.filters, { from: layer?.filters })
          : undefined;

        setSmartEq(
          plan && measured ? { ...measured, filters: plan.initial } : measured,
        );
        await setSmartEqApi(measured);

        if (!isCurrent()) {
          return;
        }

        if (plan && measured) {
          const revealed = { ...plan.initial };
          await revealBands(
            plan.steps,
            (arriving) => {
              arriving.forEach(({ id, gain }) => {
                revealed[id] = { ...revealed[id], gain };
              });
              setSmartEq({ ...measured, filters: { ...revealed } });
            },
            { isCurrent },
          );
          if (!isCurrent()) {
            return;
          }
          setSmartEq(measured);
        }

        setBalanceStatus(describeBalanceResult(result));
        break;
      }
    } catch (e) {
      if (!isCurrentRun()) {
        return;
      }
      // A failed measurement is a normal outcome (nothing playing, cancelled,
      // capture unavailable); report it in place rather than as a global
      // failure that would blank the whole workspace.
      if (e instanceof DOMException && e.name === 'AbortError') {
        setBalanceStatus('Cancelled - nothing changed');
      } else {
        setBalanceStatus(
          e instanceof Error ? e.message : 'Could not measure the output.',
        );
      }
    } finally {
      if (isCurrentRun()) {
        setIsBalancing(false);
        balanceAbortRef.current = undefined;
      }
    }
  };

  /**
   * Continuous EQ: measure, move a little, measure again, for as long as there
   * is music.
   *
   * The difference from pressing the button is entirely in the size of the
   * move. A solve says where every band belongs; this goes half a decibel of
   * the way there and solves again, so the correction arrives without ever
   * announcing itself — and so that what it converges on is the system rather
   * than the song. A correction that could keep up with the content would be a
   * dynamic EQ: it would flatten a bass drop at exactly the moment the drop is
   * meant to land. This one moves far slower than the music does, so one
   * track's emphasis and the next one's cancel, and only what every track
   * agrees about survives — which is the headphones and the room, which is the
   * thing worth correcting.
   *
   * It never clears first. The from-flat rule the button follows exists for a
   * real reason, written out where the button does it, but applying it here
   * would mean the correction going away for the length of every capture, over
   * and over. Pressing Smart EQ by hand is still the way to start again, and
   * doing so suspends this loop rather than racing it: `isBalancing` is in the
   * dependencies, so the effect tears down and comes back when the manual run
   * finishes.
   *
   * ONE capture, not a series of them, and that is what makes the ranges
   * independent. Every restart would put all nine regions back to zero
   * together, so they would fill together, become ready together and be
   * corrected together — which is what a series of measurements looks like from
   * the outside and is exactly what this is not meant to be. Here each region
   * fills at its own rate, is corrected the moment it alone has been heard well
   * enough, and is cleared on its own so it can start again while its
   * neighbours carry on undisturbed.
   */
  const applyReadyRegions = (report: IBalanceReport): number[] => {
    // ONE correction at a time, and nothing measured while one is landing.
    //
    // Checkpoints arrive about once a second and a write takes an unknown
    // fraction of that: the IPC, the config rewrite, Equalizer APO noticing and
    // reloading. Two of them overlapping is not a rare race but the ordinary
    // case, and it goes wrong twice over — the second solve reads a layer React
    // has not re-rendered yet, so it starts from the pre-step gains and applies
    // the same step a second time, and the two writes reach APO in whichever
    // order they finish in.
    //
    // The window stays shut for a moment after the write lands as well. What
    // the analyser hears while APO reloads is neither the old chain nor the new
    // one, and averaging it in is how a correction gets measured against half
    // of itself.
    //
    // The in-flight flag carries a deadline, because it is cleared by a promise
    // and a promise that never settles would switch this mode off for the rest
    // of the session with nothing on screen saying so. Ten seconds is far
    // longer than a config write has ever taken; a write still outstanding then
    // is not coming back, and carrying on is a better answer than stopping
    // forever.
    const isWriteInFlight =
      isApplyingRef.current &&
      Date.now() - applyStartedAtRef.current < CONTINUOUS_APPLY_TIMEOUT_MS;
    if (isWriteInFlight || Date.now() < applySettledAtRef.current) {
      return [];
    }

    // The transitional frames, thrown away now that the settle is over. The
    // regions were cleared at the moment of the write so they could not be
    // corrected twice; this second clear is about what they heard *since*, back
    // when the chain was mid-change.
    if (pendingResetRef.current.length > 0) {
      const stale = pendingResetRef.current;
      pendingResetRef.current = [];
      return stale;
    }

    // Read fresh each time rather than carried: over an evening the user will
    // have moved a band, loaded a profile, cleared the layer. Every one of
    // those makes the gains a held copy started from wrong.
    const layer = smartEqRef.current;
    const bands = getSmartEqBands(layer);
    const ready = report.regions
      .map((region, index) => ({ region, index }))
      .filter(({ region }) => region.isCovered);
    if (ready.length === 0) {
      return [];
    }

    // The nine range levels, not the three-hundred-point curve. Each is a whole
    // range's own weighted mean over every frame that had energy in it, which
    // is what "the bass is two decibels heavy" actually means — where a point
    // of the smoothed curve is one FFT bin averaged with its neighbours and
    // wanders with the arrangement. See `buildRegionSpectrum`.
    const solved = buildBalancedGains(buildRegionSpectrum(report), bands, {
      targetCurve: buildLayerTargetCurve(
        filtersRef.current,
        voicingRef.current,
        driverRef.current,
      ),
    });
    if (Object.keys(solved).length === 0) {
      // No answer this time. The tilt fit needs a wide trusted span and a range
      // that was cleared a moment ago carries none, so a solve taken while the
      // midrange is refilling declines rather than fitting a slope through a
      // hole. A cycle skipped, not a wrong correction.
      return [];
    }

    // Only the ranges that have been heard. A band outside them has no entry
    // here at all, and `stepSmartEqGains` leaves a band it is told nothing
    // about exactly where it is.
    const scoped: Record<string, number> = {};
    bands.forEach((band) => {
      const isReady = ready.some(
        ({ region }) =>
          band.frequency >= region.lowFrequency &&
          band.frequency <= region.highFrequency,
      );
      if (isReady && Number.isFinite(solved[band.id])) {
        scoped[band.id] = solved[band.id];
      }
    });

    // Toward where every window so far agrees the band belongs, not toward
    // what this one said.
    //
    // Clearing a range after correcting it is necessary — its old average
    // describes a chain that no longer exists — but it also threw away the
    // long-run memory, so every decision rested on the music of the last minute
    // or two. That is enough for a bass-heavy album and a thin one to be
    // measured separately, agreed to separately, and corrected in opposite
    // directions one after the other, forever. The destinations are absolute
    // gains and so are comparable across corrections, which is what makes an
    // average of them meaningful where an average of raw measurements would
    // not be.
    longRunTargetRef.current = blendSmartEqTarget(
      longRunTargetRef.current,
      scoped,
    );
    const stepped = stepSmartEqGains(bands, longRunTargetRef.current);
    const measured = buildSmartEqSettings(bands, stepped, {
      status: report.status === 'ready' ? 'ready' : 'partial',
    });
    if (describeSmartEqLayer(measured) === describeSmartEqLayer(layer)) {
      // Every ready range was already inside the deadband, so nothing was
      // written and nothing has gone stale — those ranges keep accumulating,
      // which only sharpens them.
      return [];
    }

    // Exactly the ranges that moved, and only those. A range whose bands all
    // sat inside the deadband is not stale — the chain under it did not change
    // — and clearing it would throw away good evidence for nothing.
    const moved = ready.filter(({ region }) =>
      bands.some(
        (band) =>
          band.frequency >= region.lowFrequency &&
          band.frequency <= region.highFrequency &&
          stepped[band.id] !== band.gain,
      ),
    );

    // Shut before the write, not after it. `setSmartEqApi` returns a promise
    // and the checkpoint that could collide with it is a whole second away, but
    // the flag has to be set on this side of the call all the same: setting it
    // in the promise body would leave a gap between deciding to write and being
    // marked as writing, which is precisely the gap a race lives in.
    isApplyingRef.current = true;
    applyStartedAtRef.current = Date.now();
    setSmartEq(measured);
    setSmartEqApi(measured)
      .catch(() => {
        // Reported nowhere on purpose: a write that fails from a loop nobody
        // started should not raise the banner over the whole workspace. The
        // next pass writes again.
      })
      .finally(() => {
        isApplyingRef.current = false;
        applySettledAtRef.current = Date.now() + CONTINUOUS_SETTLE_MS;
        pendingResetRef.current = moved.map(({ index }) => index);
      });

    // Nothing written to the status line. This runs for hours and moves half a
    // decibel at a time, so a running commentary beside the button is noise on
    // screen permanently in exchange for saying what the button already says by
    // being lit and breathing. The status line belongs to the manual
    // measurement, which is a thing somebody is waiting on.
    return moved.map(({ index }) => index);
  };

  // Held on a ref so the capture is not torn down and restarted on every
  // render. Restarting is the one thing this must not do casually: it would
  // take every region's accumulated evidence with it.
  const applyReadyRegionsRef = useRef(applyReadyRegions);
  applyReadyRegionsRef.current = applyReadyRegions;

  useEffect(() => {
    // Switching the Smart EQ layer off stops it. Its `Include:` is not in the
    // config while it is bypassed, so every correction this loop worked out
    // would be measured against a chain that does not contain the last one —
    // it would hear its own correction missing, decide the room had changed,
    // and walk the layer somewhere arbitrary for as long as the switch was off.
    // The chip is the switch, and it is one press away.
    if (
      !isContinuousOn ||
      !isLiveOutputActive ||
      isBalancing ||
      isSmartBypassed
    ) {
      return undefined;
    }

    const controller = new AbortController();
    continuousAbortRef.current = controller;
    // Nothing carried over from the last time the mode ran: a settle window
    // that outlived its write, or a list of regions to clear in a capture that
    // no longer exists, would both be applied to the wrong session.
    isApplyingRef.current = false;
    applySettledAtRef.current = 0;
    pendingResetRef.current = [];
    // A fresh session starts with no opinion. The last one may have been
    // measuring a different output, a different headphone, or a chain the
    // manual button has since rebuilt from flat.
    longRunTargetRef.current = {};

    captureBalanceProfile({
      signal: controller.signal,
      isContinuous: true,
      onReport: (report) => applyReadyRegionsRef.current(report),
    }).catch(() => {
      // Aborting is how this ends, and an abort rejects. Nothing here is a
      // failure worth reporting.
    });
    return () => {
      controller.abort();
      if (continuousAbortRef.current === controller) {
        continuousAbortRef.current = undefined;
      }
    };
  }, [
    captureBalanceProfile,
    isBalancing,
    isContinuousOn,
    isLiveOutputActive,
    isSmartBypassed,
  ]);

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
          <h4>{t('eq.title')}</h4>
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
                smartEqMode === 'continuous' ? continuousLabel : smartLabel
              }
              isDisabled={
                smartEqMode === 'continuous'
                  ? !isLiveOutputActive
                  : !isBalancing && !isLiveOutputActive
              }
              // Running gets the breathing outline and nothing else. It keeps
              // the Smart EQ button's own look, because it is that button.
              className={`small eq-mode__main${isContinuousRunning ? ' is-running' : ''}`}
              isPressed={
                smartEqMode === 'continuous' ? isContinuousOn : undefined
              }
              handleChange={
                smartEqMode === 'continuous' ? toggleContinuousEq : autoBalance
              }
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
              {smartEqMode === 'continuous'
                ? t('eq.smart.continuous')
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
            {isModeMenuOpen && (
              // Only the ones this button is not. A menu listing the thing you
              // are already looking at is a row that does nothing.
              <span className="eq-mode__menu">
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
                      <span>
                        {entry === 'continuous'
                          ? t('eq.smart.continuous')
                          : t('eq.smart')}
                      </span>
                    </button>
                  ),
                )}
              </span>
            )}
          </span>
          {balanceStatus && (
            <span className="eq-toolbar__status" role="status">
              {balanceStatus}
            </span>
          )}
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
