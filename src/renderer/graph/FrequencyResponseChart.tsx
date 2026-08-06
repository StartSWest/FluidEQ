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
  IFiltersMap,
  IFilter,
  MAX_FREQUENCY,
  MAX_GAIN,
  MAX_QUALITY,
  MIN_FREQUENCY,
  MIN_GAIN,
  MIN_QUALITY,
} from 'common/constants';
import { ErrorDescription } from 'common/errors';
import {
  CSSProperties,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import Spinner from 'renderer/icons/Spinner';
import {
  FilterActionEnum,
  useFluidEqContext,
} from 'renderer/utils/FluidEqContext';
import {
  setFrequency,
  setGain,
  setMainPreAmp,
  setQuality,
} from 'renderer/utils/equalizerApi';
import { clamp, useThrottleAndExecuteLatest } from 'renderer/utils/utils';
import Chart, { ChartDimensions } from './Chart';
import {
  GRAPH_END,
  GRAPH_START,
  IChartCurveData,
  IChartLineDataPointsById,
  IChartPointData,
  IEditableChartPoint,
} from './ChartController';
import {
  getFilterLineData,
  getCombinedLineData,
  getLineGainAtFrequency,
} from './utils';
import { ColorEnum, SecondaryColorEnum } from '../styles/color';
import { useLiveAudioFrame } from '../audio/LiveAudioContext';
import { getBandColor } from '../utils/bandColors';
import {
  cycleGraphLook,
  cycleWaveOrientation,
  exitGraphFullScreen,
  getSelectableLooks,
  setGraphLook,
  setGraphView,
  toggleGraphExpanded,
  toggleGraphFullScreen,
  toggleGraphGrid,
  toggleGraphStretch,
  toggleFullScreenTopBar,
  toggleLiveOutputSolo,
  useGraphFullScreen,
  useGraphGridHidden,
  useGraphWaveHidden,
  toggleGraphWave,
  useGraphStretched,
  useWaveOrientation,
  useGraphView,
  useFullScreenTopBar,
  useLiveOutputSolo,
  useSelectedLookId,
} from '../utils/graphStyle';
import { useIsChromeIdle } from '../utils/idleChrome';
import { useBypassedLayers } from '../utils/layerBypass';
import {
  MAX_OVERLAY_BLUR,
  MIN_OVERLAY_OPACITY,
  setOverlayBlur,
  setOverlayOpacity,
  useOverlayBlur,
  useOverlayOpacity,
} from '../utils/graphOverlay';
import { useCustomLooks } from '../utils/customLooks';
import LookDesigner from '../components/LookDesigner';
import Dropdown from '../widgets/Dropdown';
import GraphViewMenu from './GraphViewMenu';
import { getVoicingFilters } from '../../common/voicing';
import { getDriverFilters } from '../../common/driver';
import { getSmartEqFilters, hasSmartEqLayer } from '../../common/smartEq';
import '../styles/MultiSelect.scss';
import '../styles/GraphTheme.scss';

const isFilterEqual = (f1: IFilter, f2: IFilter) => {
  if (!f1 || !f2) {
    return false;
  }

  return (
    f1.frequency === f2.frequency &&
    f1.gain === f2.gain &&
    f1.quality === f2.quality &&
    f1.type === f2.type
  );
};

interface IGraphData {
  chartData: IChartCurveData[];
  autoPreAmpValue: number;
}

type PendingPointEdit = Partial<
  Pick<IFilter, 'frequency' | 'gain' | 'quality'>
>;

/**
 * How present the layers under the response are.
 *
 * Voicing, driver compensation, a measured correction and the live output are
 * all context for reading the curve being edited, not the subject of the
 * graph. At full strength five curves of similar weight read as a tangle with
 * no obvious answer in it.
 */
const SUPPORTING_CURVE_OPACITY = 0.5;

/**
 * How long silence has to last before the graph believes the music stopped.
 *
 * Long enough to ride out a track change or a stream stalling, short enough
 * that pausing something and looking back at the EQ does not feel like waiting.
 */
const SILENCE_GRACE_MS = 2000;

// The look list is no longer a module constant: it now depends on the looks the
// user has saved, so it is built inside the component from `getSelectableLooks`
// and memoised on that list instead.
const FrequencyResponseChart = () => {
  const liveOutput = useLiveAudioFrame();
  // The selection, not the resolved look: while the designer is open the chart
  // is drawing an unsaved draft whose id is in no list, and a picker handed
  // that id would show nothing.
  const selectedLookId = useSelectedLookId();
  const customLooks = useCustomLooks();
  const [isDesignerOpen, setIsDesignerOpen] = useState(false);
  const isSolo = useLiveOutputSolo();
  const graphView = useGraphView();
  const isGridHidden = useGraphGridHidden();
  const isWaveHidden = useGraphWaveHidden();
  const isStretched = useGraphStretched();
  const waveOrientation = useWaveOrientation();

  /**
   * The whole picker: what ships, then what the user made.
   *
   * The order comes from `getSelectableLooks` rather than being assembled here,
   * because clicking the plot walks that same list. Two places building "the
   * looks, in order" is two places to disagree, and the symptom would be the
   * plot click skipping an entry the menu shows.
   *
   * Rebuilt only when their list changes — a save or a delete — rather than per
   * render, which would hand the dropdown a new array twenty-two times a second
   * while the live curve is updating.
   */
  const graphLookOptions = useMemo(
    () =>
      getSelectableLooks(customLooks).map((look) => ({
        value: look.id,
        label: look.label,
        // The name is wrapped rather than handed over as a bare string, because
        // the dropdown renders `display` straight into the trigger — a loose
        // text node with nothing to hang a rule on. Styling the closed control
        // needs an element.
        //
        // A look the user made is marked on the row rather than in the label,
        // so the search still matches the name they typed instead of the word
        // "custom".
        display: (
          <span
            className={`graph-look-name${
              look.isCustom ? ' graph-look-name--custom' : ''
            }`}
          >
            {look.label}
          </span>
        ),
      })),
    [customLooks],
  );
  const isFullScreen = useGraphFullScreen();
  const isChromeIdle = useIsChromeIdle();
  const hasTopBar = useFullScreenTopBar();
  const bypassed = useBypassedLayers();
  const overlayOpacity = useOverlayOpacity();
  const overlayBlur = useOverlayBlur();
  const {
    filters,
    isGraphViewOn,
    isEngineUsable,
    isLoading,
    globalError,
    isAutoPreAmpOn,
    convolution,
    preAmp,
    setGlobalError,
    setPreAmp,
    dispatchFilter,
    selectedFilterIds,
    setSelectedFilterIds,
    hoveredFilterId,
    setHoveredFilterId,
    voicing,
    driver,
    smartEq,
  } = useFluidEqContext();
  const prevFilters = useRef<IFiltersMap>({});
  const prevFilterLines = useRef<IChartLineDataPointsById>({});
  const pendingPointEdits = useRef<Record<string, PendingPointEdit>>({});
  const pointEditTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>(
    {},
  );
  const pointDragState = useRef<
    | {
        sourceId: string;
        ids: string[];
        origins: Record<
          string,
          Pick<IFilter, 'frequency' | 'gain'> & { curveGain: number }
        >;
      }
    | undefined
  >(undefined);

  const handlePointSelect = useCallback(
    (filterId: string, additive: boolean) => {
      let ids = [filterId];
      if (additive) {
        ids = selectedFilterIds.includes(filterId)
          ? selectedFilterIds.filter((id) => id !== filterId)
          : [...selectedFilterIds, filterId];
      } else if (selectedFilterIds.includes(filterId)) {
        ids = selectedFilterIds;
      }
      const currentEqCurve = getCombinedLineData(
        preAmp,
        prevFilterLines.current,
      );
      pointDragState.current = {
        sourceId: filterId,
        ids,
        origins: Object.fromEntries(
          ids
            .map((id) => filters[id])
            .filter(Boolean)
            .map((filter) => [
              filter.id,
              {
                frequency: filter.frequency,
                gain: filter.gain,
                curveGain:
                  currentEqCurve.length > 0
                    ? getLineGainAtFrequency(currentEqCurve, filter.frequency)
                    : filter.gain + preAmp,
              },
            ]),
        ),
      };
      setSelectedFilterIds(ids);
    },
    [filters, preAmp, selectedFilterIds, setSelectedFilterIds],
  );

  const flushPointEdit = useCallback(
    async (filterId: string) => {
      const timer = pointEditTimers.current[filterId];
      if (timer) {
        clearTimeout(timer);
        delete pointEditTimers.current[filterId];
      }
      const edit = pendingPointEdits.current[filterId];
      if (!edit) {
        return;
      }
      delete pendingPointEdits.current[filterId];

      try {
        // Send the latest values in one ordered batch so APO never sees a
        // half-updated point while it is being dragged.
        if (edit.frequency !== undefined) {
          await setFrequency(filterId, edit.frequency);
        }
        if (edit.gain !== undefined) {
          await setGain(filterId, edit.gain);
        }
        if (edit.quality !== undefined) {
          await setQuality(filterId, edit.quality);
        }
      } catch (error) {
        setGlobalError(error as ErrorDescription);
      }
    },
    [setGlobalError],
  );

  const queuePointEdit = useCallback(
    (filterId: string, edit: PendingPointEdit) => {
      pendingPointEdits.current[filterId] = {
        ...pendingPointEdits.current[filterId],
        ...edit,
      };
      if (!pointEditTimers.current[filterId]) {
        pointEditTimers.current[filterId] = setTimeout(() => {
          flushPointEdit(filterId);
        }, 90);
      }
    },
    [flushPointEdit],
  );

  const handlePointMove = useCallback(
    (filterId: string, point: IChartPointData) => {
      // Dots are placed on the complete EQ response at their frequency. Move
      // the filter by the delta between the pointer and that curve value so
      // dragging still edits the band's own gain, not the rendered response.
      const sourceFilter = filters[filterId];
      if (!sourceFilter) {
        return;
      }
      const sourceFrequency = Math.max(
        MIN_FREQUENCY,
        Math.min(MAX_FREQUENCY, Math.round(point.x)),
      );
      const targetCurveGain =
        Math.round(Math.max(MIN_GAIN, Math.min(MAX_GAIN, point.y)) * 100) / 100;
      const drag = pointDragState.current;
      const ids = drag?.sourceId === filterId ? drag.ids : [filterId];
      const sourceOrigin = drag?.origins[filterId] || {
        frequency: sourceFilter.frequency,
        gain: sourceFilter.gain,
        curveGain: getLineGainAtFrequency(
          getCombinedLineData(preAmp, prevFilterLines.current),
          sourceFilter.frequency,
        ),
      };
      const frequencyDelta = sourceFrequency - sourceOrigin.frequency;
      const gainDelta = targetCurveGain - sourceOrigin.curveGain;
      ids.forEach((id) => {
        const filter = filters[id];
        const origin =
          drag?.origins[id] ||
          (filter && {
            frequency: filter.frequency,
            gain: filter.gain,
            curveGain: getLineGainAtFrequency(
              getCombinedLineData(preAmp, prevFilterLines.current),
              filter.frequency,
            ),
          });
        if (!filter || !origin) {
          return;
        }
        const frequency = Math.round(
          Math.max(
            MIN_FREQUENCY,
            Math.min(MAX_FREQUENCY, origin.frequency + frequencyDelta),
          ),
        );
        const gain =
          Math.round(
            Math.max(MIN_GAIN, Math.min(MAX_GAIN, origin.gain + gainDelta)) *
              100,
          ) / 100;
        dispatchFilter({
          type: FilterActionEnum.FREQUENCY,
          id,
          newValue: frequency,
        });
        dispatchFilter({
          type: FilterActionEnum.GAIN,
          id,
          newValue: gain,
        });
        queuePointEdit(id, { frequency, gain });
      });
    },
    [dispatchFilter, filters, preAmp, queuePointEdit],
  );

  const handlePointQualityWheel = useCallback(
    (filterId: string, direction: number) => {
      const filter = filters[filterId];
      if (!filter) {
        return;
      }
      let step = 1;
      if (filter.quality < 1) {
        step = 0.05;
      } else if (filter.quality < 10) {
        step = 0.1;
      }
      const ids = selectedFilterIds.includes(filterId)
        ? selectedFilterIds
        : [filterId];
      ids.forEach((id) => {
        const selectedFilter = filters[id];
        if (!selectedFilter) {
          return;
        }
        const quality =
          Math.round(
            Math.max(
              MIN_QUALITY,
              Math.min(MAX_QUALITY, selectedFilter.quality + direction * step),
            ) * 100,
          ) / 100;
        dispatchFilter({
          type: FilterActionEnum.QUALITY,
          id,
          newValue: quality,
        });
        queuePointEdit(id, { quality });
      });
    },
    [dispatchFilter, filters, queuePointEdit, selectedFilterIds],
  );

  const { chartData, autoPreAmpValue }: IGraphData = useMemo(() => {
    const updatedFilterLines: IChartLineDataPointsById = {};

    // Update filter lines that have changed
    Object.values(filters).forEach((filter) => {
      // New filters have no previous data
      if (!(filter.id in prevFilters.current)) {
        updatedFilterLines[filter.id] = getFilterLineData(filter);
        return;
      }

      // Recompute filter line if it has been adjusted
      if (!isFilterEqual(filter, prevFilters.current[filter.id])) {
        updatedFilterLines[filter.id] = getFilterLineData(filter);
      } else {
        // Otherwise, reuse previous data
        updatedFilterLines[filter.id] = prevFilterLines.current[filter.id];
      }
    });

    // Update past state
    prevFilterLines.current = updatedFilterLines;
    prevFilters.current = filters;

    // The voicing is a real APO layer, so it gets a real curve rather than a
    // note in the UI. Its filters run through the same biquad code as the
    // bands, which is what makes "EQ + voicing" an honest sum rather than an
    // approximation of one.
    const voicingFilterLines: IChartLineDataPointsById = {};
    // Nothing is drawn for a layer that is switched off.
    //
    // Bypass keeps the layer in state so the chip can put it back, which means
    // the graph would happily go on drawing a curve for something that is no
    // longer in the config — and a graph that disagrees with what you hear is
    // worse than one that shows less. This is what makes the A/B honest.
    (bypassed.voicing !== undefined ? [] : getVoicingFilters(voicing)).forEach(
      (filter, index) => {
        const id = `voicing-${index}`;
        voicingFilterLines[id] = getFilterLineData({
          id,
          frequency: filter.frequency,
          gain: filter.gain,
          quality: filter.quality,
          type: filter.type,
        });
      },
    );
    const hasVoicing = Object.keys(voicingFilterLines).length > 0;

    // Driver compensation is a third APO layer, so it gets the same treatment:
    // its own curve, from the same biquad code, rather than an invisible
    // correction the user has to take on trust.
    const driverFilterLines: IChartLineDataPointsById = {};
    (bypassed.driver !== undefined ? [] : getDriverFilters(driver)).forEach(
      (filter, index) => {
        const id = `driver-${index}`;
        driverFilterLines[id] = getFilterLineData({
          id,
          frequency: filter.frequency,
          gain: filter.gain,
          quality: filter.quality,
          type: filter.type,
        });
      },
    );
    const hasDriver = Object.keys(driverFilterLines).length > 0;

    // What the measurement decided, drawn like any other layer. This one has
    // the strongest claim to a curve of its own: nobody chose its shape, so the
    // graph is the only place it can be inspected at all.
    const smartFilterLines: IChartLineDataPointsById = {};
    (bypassed.smart !== undefined ? [] : getSmartEqFilters(smartEq)).forEach(
      (filter, index) => {
        const id = `smart-eq-${index}`;
        smartFilterLines[id] = getFilterLineData({
          id,
          frequency: filter.frequency,
          gain: filter.gain,
          quality: filter.quality,
          type: filter.type,
        });
      },
    );
    const hasSmartEq = Object.keys(smartFilterLines).length > 0;

    const convolutionFilterLines: IChartLineDataPointsById = {};
    Object.values(convolution?.filters || {}).forEach((filter) => {
      convolutionFilterLines[filter.id] = getFilterLineData(filter);
    });

    // Keep the complete chain for auto-headroom calculation only. The graph
    // renders convolution and editable EQ as separate curves so the white EQ
    // line never includes the convolution response.
    // Auto-headroom has to see every layer, voicing included, or its reserve
    // is short by exactly the voicing's boost.
    const processedCurveData = getCombinedLineData(preAmp, {
      ...convolutionFilterLines,
      ...updatedFilterLines,
      ...voicingFilterLines,
      ...driverFilterLines,
      ...smartFilterLines,
    });
    const convolutionCurveData = getCombinedLineData(0, convolutionFilterLines);
    const eqCurveData = getCombinedLineData(preAmp, updatedFilterLines);
    const voicingCurveData = hasVoicing
      ? getCombinedLineData(0, voicingFilterLines)
      : [];
    const driverCurveData = hasDriver
      ? getCombinedLineData(0, driverFilterLines)
      : [];
    const smartCurveData = hasSmartEq
      ? getCombinedLineData(0, smartFilterLines)
      : [];
    // What actually reaches the ears once every layer is applied. Worth its own
    // curve because the layers are written separately but heard together, and
    // two gentle corrections in the same region are not obviously gentle once
    // they add up.
    const hasExtraLayers = hasVoicing || hasDriver || hasSmartEq;
    const totalCurveData = hasExtraLayers
      ? getCombinedLineData(preAmp, {
          ...updatedFilterLines,
          ...voicingFilterLines,
          ...driverFilterLines,
          ...smartFilterLines,
        })
      : [];
    const totalCurveName = [
      'EQ',
      hasVoicing ? 'voicing' : '',
      hasDriver ? 'driver' : '',
      hasSmartEq ? 'Smart EQ' : '',
    ]
      .filter(Boolean)
      .join(' + ');
    const sortedFilters = Object.values(filters).sort(
      (a, b) => a.frequency - b.frequency,
    );
    const logSpan = Math.log(GRAPH_END / GRAPH_START);
    const eqGradientStops = [
      { offset: 0, color: getBandColor(0).color },
      ...sortedFilters.map((filter, index) => ({
        offset: Math.log(filter.frequency / GRAPH_START) / logSpan,
        color: getBandColor(
          sortedFilters.length > 1 ? index / (sortedFilters.length - 1) : 0,
        ).color,
      })),
      { offset: 1, color: getBandColor(1).color },
    ];

    // Compute preAmp line data
    // const preAmpLine = getPreAmpLine(preAmp);

    const highestPoint = processedCurveData.reduce(
      (previousValue, currentValue) => {
        return previousValue.y < currentValue.y ? currentValue : previousValue;
      },
    );

    const calculatedAutoPreAmpValue =
      Math.round(
        clamp(-1 * (highestPoint.y - preAmp), MIN_GAIN, MAX_GAIN) * 100,
      ) / 100;

    return {
      chartData: [
        ...(convolution
          ? [
              {
                id: 'Headphone Convolution',
                name: `Convolution · ${convolution.name}`,
                line: {
                  color: ColorEnum.COMPLEMENTARY,
                  strokeWidth: 2,
                  opacity: SUPPORTING_CURVE_OPACITY,
                  points: convolutionCurveData,
                },
              } as IChartCurveData,
            ]
          : []),
        // The voicing layer on its own, so its shape is readable next to the
        // bands rather than hidden inside their sum.
        ...(hasVoicing
          ? [
              {
                id: 'Voicing',
                name: 'Voicing layer',
                line: {
                  color: ColorEnum.TRIADIC1,
                  strokeWidth: 2,
                  opacity: SUPPORTING_CURVE_OPACITY,
                  points: voicingCurveData,
                },
              } as IChartCurveData,
            ]
          : []),
        // Driver compensation gets the same treatment as the voicing: its own
        // curve, so a correction applied on your behalf is visible rather than
        // taken on trust.
        ...(hasDriver
          ? [
              {
                id: 'Driver',
                name: 'Driver compensation',
                line: {
                  color: ColorEnum.DRIVER,
                  strokeWidth: 2,
                  opacity: SUPPORTING_CURVE_OPACITY,
                  points: driverCurveData,
                },
              } as IChartCurveData,
            ]
          : []),
        // Nobody chose this curve's shape, so it is the one layer that cannot
        // be inspected anywhere else. Drawn separately from the total for the
        // same reason as the other two: a correction you can see is a
        // correction you can argue with.
        ...(hasSmartEq
          ? [
              {
                id: 'Smart EQ',
                name: 'Smart EQ correction',
                line: {
                  color: ColorEnum.SMART,
                  strokeWidth: 2,
                  opacity: SUPPORTING_CURVE_OPACITY,
                  points: smartCurveData,
                },
              } as IChartCurveData,
            ]
          : []),
        ...(hasExtraLayers
          ? [
              {
                id: 'Total Response',
                name: totalCurveName,
                line: {
                  color: ColorEnum.TOTAL,
                  strokeWidth: 2,
                  opacity: SUPPORTING_CURVE_OPACITY,
                  points: totalCurveData,
                },
              } as IChartCurveData,
            ]
          : []),
        {
          id: 'EQ Response',
          name: 'EQ + preamp',
          line: {
            color: SecondaryColorEnum.DEFAULT,
            strokeWidth: 3,
            points: eqCurveData,
            gradientId: 'chart-eq-spectrum-gradient',
            gradientStops: eqGradientStops,
            glow: true,
          },
        } as IChartCurveData,
      ],
      // Rounding to two decimals. When disabled, expose the current manual
      // preamp so the graph and APO remain in sync without auto-adjusting it.
      autoPreAmpValue: isAutoPreAmpOn ? calculatedAutoPreAmpValue : preAmp,
    };
  }, [
    bypassed,
    convolution,
    driver,
    filters,
    isAutoPreAmpOn,
    preAmp,
    smartEq,
    voicing,
  ]);

  useEffect(() => {
    // Auto normalize writes Equalizer APO's Preamp headroom value. When it is
    // disabled, keep the current manual preamp untouched.
    if (isAutoPreAmpOn && !isLoading && !globalError) {
      setMainPreAmp(autoPreAmpValue)
        .then(() => setPreAmp(autoPreAmpValue))
        .catch((error: ErrorDescription) => {
          setGlobalError(error);
        });
    }
  }, [
    autoPreAmpValue,
    globalError,
    isAutoPreAmpOn,
    isLoading,
    setGlobalError,
    setPreAmp,
  ]);

  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number>(0);
  const [height, setHeight] = useState<number>(0);

  const updateDimensions = useCallback(() => {
    const newWidth = ref.current?.clientWidth;
    if (newWidth && newWidth > 0) {
      setWidth(newWidth);
    }
    const newHeight = ref.current?.clientHeight;
    if (newHeight && newHeight > 0) {
      setHeight(newHeight);
    }
  }, []);

  const throttle = useThrottleAndExecuteLatest(updateDimensions, 100);

  useEffect(() => {
    window.addEventListener('resize', throttle);
    return () => window.removeEventListener('resize', throttle);
  }, [throttle]);

  /**
   * Watch the box itself, not the things thought to change it.
   *
   * The graph takes the height the editor above it does not want, so its box
   * moves whenever that content does — folding the reference picker, switching
   * to a tab whose panel is a different size, a dropdown opening. None of those
   * resize the window and none of them change the height in the store, so every
   * trigger this had missed them, and the plot stayed the size it was while its
   * card grew underneath it.
   */
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === 'undefined') {
      return undefined;
    }
    const observer = new ResizeObserver(throttle);
    observer.observe(element);
    return () => observer.disconnect();
  }, [throttle]);

  useLayoutEffect(() => {
    // Compute dimensions on initial render, when graph view is toggled, when
    // the pane grows to fill the window, and on every step of a drag on the
    // divider above — the box changes without the window ever firing a resize,
    // so nothing else would tell it.
    updateDimensions();
  }, [isFullScreen, isGraphViewOn, updateDimensions]);

  // Ctrl+S expands, Ctrl+F fills the screen, Ctrl+W swaps between the wave and
  // the EQ curves. Space walks the looks; Ctrl or Shift with it walks back.
  // Escape comes all the way back from either size.
  //
  // Every one of them is listed in the view menu, because a shortcut bound to
  // the window is fast once known and completely invisible until then.
  //
  // Bound to the window rather than to the graph, because the graph is an SVG
  // nobody has clicked and a key handler that only works after you have found
  // the right thing to focus is a key handler nobody discovers. The guards are
  // the price of that reach: a control that already does something with Space
  // — a button, a checkbox, an open menu — keeps it, and so does anything you
  // can type into. Missing one of those turns Space into "corrupt the field
  // you were editing".
  useEffect(() => {
    if (!isGraphViewOn) {
      return undefined;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        // Not while something is open in front of it.
        //
        // These are window-level handlers, so an Escape meant for the dialog on
        // screen — Report a problem, Fix audio problems, the view menu itself —
        // reached this as well and did both things at once: the dialog closed
        // and the graph dropped out of full screen behind it. Escape means
        // "close the nearest thing", and the nearest thing is whatever is over
        // the top.
        //
        // Matched on the elements that only exist while something is open, not
        // on `[role="menu"]`: the style picker puts that role on its *trigger*,
        // which is on screen the whole time, so testing for it blocked Escape
        // permanently and full screen became a mode with no way out.
        if (
          document.querySelector('.graph-view-menu__list, .dropdown--open') ||
          // Every one of these also has its own key handling, and a text field
          // in particular treats Escape as "cancel this edit".
          (event.target as HTMLElement | null)?.closest?.(
            'input, textarea, [contenteditable]',
          )
        ) {
          return;
        }
        // The look designer is a dialog of ours, so it is closed here rather
        // than left to the guard below. That guard only declines to act, which
        // for our own panel would mean Escape doing nothing at all — and it is
        // the innermost thing on screen, so it is what Escape means. Closing it
        // rather than the mode also matters because it holds an unsaved draft.
        if (isDesignerOpen) {
          setIsDesignerOpen(false);
          return;
        }
        if (document.querySelector('[role="dialog"]')) {
          return;
        }
        exitGraphFullScreen();
        return;
      }

      // The modified trio. Alt held is somebody reaching for a menu, and a
      // repeat is a key being leant on — neither should toggle a mode twice.
      if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.repeat) {
        const key = event.key.toLowerCase();
        if (
          key === 's' ||
          key === 'f' ||
          key === 'w' ||
          key === 'g' ||
          key === 'b' ||
          key === 'i'
        ) {
          // Ctrl+S is Save and Ctrl+W is Close Window everywhere else, and
          // Chromium will do both from a renderer given the chance. There is
          // nothing to save here and closing the window is the titlebar's
          // business, so both are taken.
          event.preventDefault();
          if (key === 's') {
            toggleGraphExpanded();
          } else if (key === 'f') {
            toggleGraphFullScreen();
          } else if (key === 'g') {
            toggleGraphGrid();
          } else if (key === 'b') {
            toggleGraphStretch();
          } else if (key === 'i') {
            cycleWaveOrientation();
          } else {
            toggleLiveOutputSolo();
          }
          return;
        }
      }

      if (event.code !== 'Space' || event.altKey || event.repeat) {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (
        target?.isContentEditable ||
        target?.closest(
          'input, textarea, select, button, [role="menu"], [role="menuitem"], [contenteditable]',
        )
      ) {
        return;
      }
      // Space scrolls by default, and the graph is the whole point of the pane
      // being looked at.
      event.preventDefault();
      cycleGraphLook(event.ctrlKey || event.metaKey || event.shiftKey ? -1 : 1);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isGraphViewOn, isDesignerOpen]);

  const dimensions: ChartDimensions = {
    width,
    height,
    margins: {
      // Headroom above the plot, so a curve at +20 dB is not shaved off by the
      // top of the viewport and the legend strip has something to float over.
      //
      // Stretching gives it up. That thirty pixels is most of the gap between
      // the top of the card and the top of the wave — which is exactly the
      // space this mode exists to reclaim, and there is no band handle up there
      // to clip once the drawing is the point rather than the measurement.
      top: isStretched ? 4 : 30,
      // Air at the sides, so a curve running off the edge of the plot is not
      // cut flush against the card. With the grid hidden there is nothing to
      // read at the edges and the wave is better for having them.
      right: isGridHidden ? 0 : 30,
      // The frequency labels live down here, and with the grid hidden there is
      // nothing to leave room for.
      bottom: isStretched && isGridHidden ? 0 : 10,
      left: isGridHidden ? 0 : 30,
    },
  };

  // The live curve, eased toward each new frame rather than snapping to it.
  //
  // The analyser publishes about twenty-two times a second, and at that rate
  // every frame lands as a visible step — the trace jitters instead of
  // flowing. Easing each point costs one multiply-add per bin, against a curve
  // d3 is about to re-path anyway.
  //
  // Done here rather than in the analyser because the game's beat detection
  // reads the same frames and needs its transients sharp; rounding them off at
  // the source would blunt the edges it exists to find.
  // No smoothing here. The live curve is eased inside `Line`, on animation
  // frames, and doing it in both places stacked two lags on top of each other
  // — the points arrived already softened, then got softened again, and the
  // curve swelled after the music instead of with it.

  /**
   * Whether audio was playing recently enough to still count as playing.
   *
   * Silence empties the frame, and an empty frame brings the EQ curves back —
   * which is the right thing to do when the music has stopped and a blink when
   * it merely dipped. Tracks change, a stream buffers, a passage goes quiet for
   * a fifth of a second; every one of those flashed the whole EQ across the
   * graph and took it away again.
   *
   * So silence has to persist before it is believed. Coming back is immediate:
   * the moment there is a frame there is a trace, and delaying *that* would be
   * a graph that lags the music.
   */
  const [hasRecentAudio, setHasRecentAudio] = useState(false);
  const silenceTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  useEffect(() => {
    if (liveOutput.points.length > 0) {
      if (silenceTimer.current !== undefined) {
        clearTimeout(silenceTimer.current);
        silenceTimer.current = undefined;
      }
      setHasRecentAudio(true);
      return;
    }
    if (silenceTimer.current === undefined) {
      silenceTimer.current = setTimeout(() => {
        silenceTimer.current = undefined;
        setHasRecentAudio(false);
      }, SILENCE_GRACE_MS);
    }
  }, [liveOutput.points.length]);

  useEffect(
    () => () => {
      if (silenceTimer.current !== undefined) {
        clearTimeout(silenceTimer.current);
      }
    },
    [],
  );

  /**
   * What to draw when there is no frame.
   *
   * Outside solo the EQ curves were never away, so this is simply them. In solo
   * they are what silence brings back — after a couple of seconds of it, not
   * immediately, or a track change flashes the whole EQ across the graph and
   * takes it away again.
   */
  const silentData = useMemo(
    () => (isSolo && hasRecentAudio ? [] : chartData),
    [chartData, hasRecentAudio, isSolo],
  );

  const displayData = useMemo(
    () =>
      // Hidden means gone, not transparent. The live curve is the one thing
      // here redrawn between measurements rather than when something is
      // dragged, so leaving it in the tree at zero opacity would keep every bit
      // of that work and show nothing for it.
      liveOutput.points.length > 0 && !isWaveHidden
        ? [
            // Soloing drops the EQ layers rather than hiding them with an
            // opacity: a curve at zero alpha is still a path being rebuilt
            // whenever a band moves, and the point of this mode is to be left
            // with the one drawing and nothing else.
            ...(isSolo ? [] : chartData),
            // Hanging from the top, or mirrored below as well.
            //
            // Negating the gain mirrors about 0 dB, which is the vertical
            // centre of a scale running -20 to +20 — so this is a true
            // reflection rather than an offset that happens to look like one.
            ...(waveOrientation === 'mirrored' || waveOrientation === 'centred'
              ? [
                  {
                    id: 'Live Output Mirror',
                    name: 'Live processed output, mirrored',
                    isContinuous: true,
                    isFlipped: true,
                    isHalfHeight: true,
                    isFromCentre: waveOrientation === 'centred',
                    line: {
                      color: ColorEnum.ANALOGOUS2,
                      strokeWidth: isSolo ? 2.6 : 2,
                      opacity: isSolo ? 1 : SUPPORTING_CURVE_OPACITY,
                      points: liveOutput.points,
                    },
                  } as IChartCurveData,
                ]
              : []),
            {
              id: 'Live Output',
              name: 'Live processed output',
              isContinuous: true,
              isFlipped: waveOrientation === 'down',
              isHalfHeight:
                waveOrientation === 'mirrored' || waveOrientation === 'centred',
              isFromCentre: waveOrientation === 'centred',
              line: {
                color: ColorEnum.ANALOGOUS2,
                // Heavier as well as brighter when it is the only thing drawn.
                // Two pixels is a supporting weight, chosen so five curves of
                // similar thickness do not read as a tangle; alone on the grid
                // it just looks thin.
                strokeWidth: isSolo ? 2.6 : 2,
                // Held back only while there is something to hold it back for.
                //
                // The live trace is dimmed because it is context for the curve
                // being edited — one of four layers under the response, and at
                // full strength they fight. Solo removes every one of them, so
                // the reason to dim it goes with them: what was left was the
                // one drawing on screen, drawn at half strength for the benefit
                // of curves that are no longer there.
                opacity: isSolo ? 1 : SUPPORTING_CURVE_OPACITY,
                points: liveOutput.points,
              },
            } as IChartCurveData,
          ]
        : silentData,
    [
      silentData,
      chartData,
      isSolo,
      isWaveHidden,
      liveOutput.points,
      waveOrientation,
    ],
  );

  const editablePoints: IEditableChartPoint[] = useMemo(() => {
    // Sliders are ordered by frequency, so use the exact same ordering when
    // assigning the spectrum palette to graph points. The point and its
    // corresponding slider therefore always share one color.
    const sortedFilters = Object.values(filters).sort(
      (a, b) => a.frequency - b.frequency,
    );
    const colorsById = new Map(
      sortedFilters.map((filter, index) => {
        const progress =
          sortedFilters.length > 1 ? index / (sortedFilters.length - 1) : 0;
        return [filter.id, getBandColor(progress)] as const;
      }),
    );
    const eqCurve = chartData.find((curve) => curve.id === 'EQ Response')?.line
      .points;

    return Object.values(filters).map((filter) => {
      const bandColor = colorsById.get(filter.id) || getBandColor(0);
      const curveGain = eqCurve
        ? getLineGainAtFrequency(eqCurve, filter.frequency)
        : filter.gain + preAmp;
      return {
        id: filter.id,
        name: `${filter.type} band`,
        color: bandColor.color,
        mutedColor: bandColor.muted,
        // Place each dot on the rendered EQ response at its frequency. This
        // keeps dots aligned after converting between 6/10/15/31-band layouts.
        data: { x: filter.frequency, y: curveGain },
        selected: selectedFilterIds.includes(filter.id),
        hovered: hoveredFilterId === filter.id,
        onSelect: (additive: boolean) => handlePointSelect(filter.id, additive),
        onHover: (isHovered: boolean) =>
          setHoveredFilterId(isHovered ? filter.id : ''),
        onChange: (point: IChartPointData) => handlePointMove(filter.id, point),
        onCommit: () => {
          const drag = pointDragState.current;
          const ids = drag?.sourceId === filter.id ? drag.ids : [filter.id];
          ids.forEach((id) => flushPointEdit(id));
          if (drag?.sourceId === filter.id) {
            pointDragState.current = undefined;
          }
        },
        onQualityWheel: (direction: number) =>
          handlePointQualityWheel(filter.id, direction),
      };
    });
  }, [
    filters,
    chartData,
    flushPointEdit,
    handlePointMove,
    handlePointQualityWheel,
    handlePointSelect,
    hoveredFilterId,
    preAmp,
    selectedFilterIds,
    setHoveredFilterId,
  ]);

  return isGraphViewOn ? (
    <div
      className={`graph-wrapper${!isEngineUsable ? ' is-engine-disabled' : ''}${
        isGridHidden ? ' is-gridless' : ''
      }${isStretched ? ' is-stretched' : ''}${
        isDesignerOpen ? ' is-designing' : ''
      }`}
      aria-disabled={!isEngineUsable}
      // Read by the full-screen rules only. Handed down as variables rather
      // than as a style on the card itself, because what they actually apply to
      // is the surface layer behind the drawing — see GraphTheme.
      style={
        {
          // The euphoria border used to be handed down here as a custom
          // property, because the trace was a path and its attributes were
          // rewritten every frame. The trace draws itself now and reads the
          // width straight off the look, so there is nothing left to inherit.
          '--graph-overlay-opacity': overlayOpacity,
          // The whole filter, so that no blur is the keyword `none` rather than
          // `blur(0px)` — which is still a filter, and still costs a
          // compositing layer re-composited every frame to change nothing.
          '--graph-overlay-filter':
            overlayBlur > 0 ? `blur(${overlayBlur}px)` : 'none',
        } as CSSProperties
      }
    >
      {/* `is-idle` only ever does anything in full screen — the store that sets
          it is not watching in any other mode, so the class is simply never on
          elsewhere. Kept unconditional here rather than gated on the mode as
          well, because two things deciding the same question is how they come
          to disagree. */}
      <div className={`live-output-controls${isChromeIdle ? ' is-idle' : ''}`}>
        {/* One pane for the whole right-hand cluster.

            The card used to be on the style picker alone, which left the
            legends naming the curves — EQ response, Voicing, Driver — floating
            on the grid beside it, so half the row had a surface and half did
            not. They belong together: they are all captions and controls for
            the same drawing. */}
        <span className="graph-legend-group">
          {/* First in the cluster rather than alone at the left of the strip.

              Out there it shared the corner with the creature in full screen
              and the two were drawn over each other — and pushing one or the
              other around by a fixed amount is a fix that lasts until something
              else changes width. In the group it travels with the controls and
              cannot collide with anything that is not in the group.

              Only while there is something to drag: solo takes the band handles
              off the plot, so every one of these gestures does nothing, and
              instructions for controls that are not on screen read as controls
              that have stopped working. */}
          {!isSolo && (
            <span className="graph-edit-hint">
              Drag points · Ctrl/Shift select · Ctrl+scroll: Q
            </span>
          )}
          {!isSolo && convolution && (
            <span className="graph-legend graph-legend--convolution">
              Headset convolution
            </span>
          )}
          {!isSolo && (
            <span className="graph-legend graph-legend--eq">EQ response</span>
          )}
          {!isSolo && voicing?.profileId && bypassed.voicing === undefined ? (
            <span className="graph-legend graph-legend--voicing">Voicing</span>
          ) : null}
          {!isSolo && driver?.profileId && bypassed.driver === undefined ? (
            <span className="graph-legend graph-legend--driver">Driver</span>
          ) : null}
          {!isSolo &&
          hasSmartEqLayer(smartEq) &&
          bypassed.smart === undefined ? (
            <span className="graph-legend graph-legend--smart">Smart EQ</span>
          ) : null}
          {!isSolo &&
          ((voicing?.profileId && bypassed.voicing === undefined) ||
            (driver?.profileId && bypassed.driver === undefined) ||
            (hasSmartEqLayer(smartEq) && bypassed.smart === undefined)) ? (
            <span className="graph-legend graph-legend--total">
              {[
                'EQ',
                voicing?.profileId ? 'voicing' : '',
                driver?.profileId ? 'driver' : '',
                hasSmartEqLayer(smartEq) ? 'Smart EQ' : '',
              ]
                .filter(Boolean)
                .join(' + ')}
            </span>
          ) : null}
          {/* The legend is the control.
            
            Clicking the plot itself drags bands, so the picker needed its own
            place — and the label that already names the live output is the
            honest one, because it says what the choice changes. Forty looks is
            more than a cycle can reasonably walk, hence a searchable list. */}
          <span className="graph-legend graph-legend--live graph-legend--picker">
            {/* Named separately from the value so the two can look like what
              they are: a caption, and the thing it captions. Run together they
              read as one long legend nobody realises is clickable. */}
            <span className="graph-legend__label">Live output</span>
            {/* Arrows either side of the name, so walking the looks never
                depends on where the keyboard is pointing.

                Space and Ctrl+Space still do it, and stop the moment somebody
                clicks the video: the guest takes focus and every key after that
                belongs to the page, so Space pauses the video instead of
                changing the drawing. That is exactly when somebody is most
                likely to want a different one, and a mouse is already in their
                hand. */}
            <button
              type="button"
              className="graph-look-step"
              aria-label="Previous style"
              title="Previous style (Ctrl+Space)"
              disabled={isWaveHidden}
              onClick={() => cycleGraphLook(-1)}
            >
              <svg viewBox="0 0 16 16" aria-hidden>
                <path d="M10 3.5l-4 4.5 4 4.5" />
              </svg>
            </button>
            {/* The selection, not the resolved look: while the designer is open
                the chart draws an unsaved draft whose id is in no list, and a
                picker handed that id would go blank. */}
            <Dropdown
              name="live-output-style"
              options={graphLookOptions}
              value={selectedLookId}
              isDisabled={isWaveHidden}
              isFilterable
              filterPlaceholder="Search styles"
              placement="down"
              handleChange={setGraphLook}
            />
            <button
              type="button"
              className="graph-look-step"
              aria-label="Next style"
              title="Next style (Space)"
              disabled={isWaveHidden}
              onClick={() => cycleGraphLook(1)}
            >
              <svg viewBox="0 0 16 16" aria-hidden>
                <path d="M6 3.5l4 4.5-4 4.5" />
              </svg>
            </button>
            {/* Make one of your own.

                Next to the picker because it is the same decision carried one
                step further: the list answers "which of these", and this answers
                "none of these, quite". The label says which of the two things it
                will do, since opening it on a look somebody made edits that look
                rather than starting another. */}
            <button
              type="button"
              className={`graph-solo${isDesignerOpen ? ' is-on' : ''}`}
              // There is nothing to design against with the wave switched off:
              // every control in the panel is judged by what it does to a
              // drawing that is not there.
              disabled={isWaveHidden}
              onClick={() => setIsDesignerOpen((open) => !open)}
              aria-pressed={isDesignerOpen}
              title={(() => {
                if (isWaveHidden) {
                  return 'Show the wave first — there is nothing to design against';
                }
                return isDesignerOpen
                  ? 'Close the look designer (Esc)'
                  : 'Build a look of your own from this one';
              })()}
            >
              {(() => {
                if (isDesignerOpen) {
                  return 'Close';
                }
                return customLooks.some((look) => look.id === selectedLookId)
                  ? 'Edit look'
                  : 'New look';
              })()}
            </button>
            {/* Everything else off, so the drawing has the grid to itself.
              Sits inside the live-output legend because that is the only
              thing it leaves behind. */}
            <button
              type="button"
              className={`graph-solo${isSolo ? ' is-on' : ''}`}
              onClick={toggleLiveOutputSolo}
              aria-pressed={isSolo}
              title={
                isSolo
                  ? 'Show the EQ curves again'
                  : 'Hide the EQ curves and watch only the live output'
              }
            >
              {isSolo ? 'Show EQ' : 'Wave only'}
            </button>
            {/* The see-through and blur sliders used to sit here, between this
              and the menu. They are in the menu now — they only exist in full
              screen, they are the widest things the row ever held, and the row
              is right-aligned, so arriving in the mode shoved everything else
              left and on a narrow window pushed it under the waveform. */}
            {/* Last, at the right-hand end of the row, in every mode. Both sizes
              live here, and every shortcut that reaches them; Escape gets back
              from either. */}
            <GraphViewMenu
              view={graphView}
              isSolo={isSolo}
              onChangeView={setGraphView}
              onToggleSolo={toggleLiveOutputSolo}
              onCycleLook={cycleGraphLook}
              isWaveHidden={isWaveHidden}
              onToggleWave={toggleGraphWave}
              isGridHidden={isGridHidden}
              onToggleGrid={toggleGraphGrid}
              isStretched={isStretched}
              onToggleStretch={toggleGraphStretch}
              waveOrientation={waveOrientation}
              onCycleOrientation={cycleWaveOrientation}
              overlayOpacity={overlayOpacity}
              onChangeOverlayOpacity={setOverlayOpacity}
              overlayBlur={overlayBlur}
              onChangeOverlayBlur={setOverlayBlur}
              minOverlayOpacity={MIN_OVERLAY_OPACITY}
              maxOverlayBlur={MAX_OVERLAY_BLUR}
              hasTopBar={hasTopBar}
              onToggleTopBar={toggleFullScreenTopBar}
            />
          </span>
        </span>
        {liveOutput.isClipping && (
          <span className="graph-clip-warning" role="status">
            CLIPPING - reduce preamp
          </span>
        )}
      </div>
      {/* The measured box, and the card around it are now two different things.
          They used to be one, which is fine while the plot fills the card and
          wrong the moment it should not: in full screen the card covers the
          whole column so the frosting sits over all of the video, while the
          drawing keeps a sensible height in the middle of it. Measuring the
          card there would stretch the plot to the full height of the window,
          which is the one thing a frequency response should not do. */}
      <div className="graph-plot" ref={ref}>
        {isLoading ? (
          <div className="center full row">
            <Spinner />
          </div>
        ) : (
          <Chart
            data={displayData}
            // The band curves, without the live trace appended below. Their
            // identity survives a live frame, which is what keeps the y-extent
            // memos from rescanning every point 22 times a second.
            scaleData={chartData}
            dimensions={dimensions}
            editablePoints={isSolo ? [] : editablePoints}
            coverage={liveOutput.balanceProgress?.regions}
            onMarqueeSelect={(ids, additive) =>
              setSelectedFilterIds(
                additive ? [...new Set([...selectedFilterIds, ...ids])] : ids,
              )
            }
          />
        )}
      </div>
      {/* Inside the graph card, alongside the plot rather than over in a
          dialog of its own — what the panel is for is watching this chart
          change while the sliders move. Unmounted when closed, so the draft it
          holds is dropped with it. */}
      {isDesignerOpen && (
        <LookDesigner onClose={() => setIsDesignerOpen(false)} />
      )}
    </div>
  ) : null;
};

export default FrequencyResponseChart;
