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
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import Spinner from 'renderer/icons/Spinner';
import { FilterActionEnum, useAquaContext } from 'renderer/utils/AquaContext';
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
import { useLiveAudio } from '../audio/LiveAudioContext';
import { getBandColor } from '../utils/bandColors';
import { getVoicingFilters } from '../../common/voicing';
import { getDriverFilters } from '../../common/driver';
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

const FrequencyResponseChart = () => {
  const liveOutput = useLiveAudio();
  const {
    filters,
    isGraphViewOn,
    isEnabled,
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
  } = useAquaContext();
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
    getVoicingFilters(voicing).forEach((filter, index) => {
      const id = `voicing-${index}`;
      voicingFilterLines[id] = getFilterLineData({
        id,
        frequency: filter.frequency,
        gain: filter.gain,
        quality: filter.quality,
        type: filter.type,
      });
    });
    const hasVoicing = Object.keys(voicingFilterLines).length > 0;

    // Driver compensation is a third APO layer, so it gets the same treatment:
    // its own curve, from the same biquad code, rather than an invisible
    // correction the user has to take on trust.
    const driverFilterLines: IChartLineDataPointsById = {};
    getDriverFilters(driver).forEach((filter, index) => {
      const id = `driver-${index}`;
      driverFilterLines[id] = getFilterLineData({
        id,
        frequency: filter.frequency,
        gain: filter.gain,
        quality: filter.quality,
        type: filter.type,
      });
    });
    const hasDriver = Object.keys(driverFilterLines).length > 0;

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
    });
    const convolutionCurveData = getCombinedLineData(0, convolutionFilterLines);
    const eqCurveData = getCombinedLineData(preAmp, updatedFilterLines);
    const voicingCurveData = hasVoicing
      ? getCombinedLineData(0, voicingFilterLines)
      : [];
    const driverCurveData = hasDriver
      ? getCombinedLineData(0, driverFilterLines)
      : [];
    // What actually reaches the ears once every layer is applied. Worth its own
    // curve because the layers are written separately but heard together, and
    // two gentle corrections in the same region are not obviously gentle once
    // they add up.
    const hasExtraLayers = hasVoicing || hasDriver;
    const totalCurveData = hasExtraLayers
      ? getCombinedLineData(preAmp, {
          ...updatedFilterLines,
          ...voicingFilterLines,
          ...driverFilterLines,
        })
      : [];
    const totalCurveName = [
      'EQ',
      hasVoicing ? 'voicing' : '',
      hasDriver ? 'driver' : '',
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
                  points: driverCurveData,
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
  }, [convolution, driver, filters, isAutoPreAmpOn, preAmp, voicing]);

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

  useLayoutEffect(() => {
    // Compute dimensions on initial render and when graph view is toggled
    updateDimensions();
  }, [isGraphViewOn, updateDimensions]);

  const dimensions: ChartDimensions = {
    width,
    height,
    margins: {
      top: 30,
      right: 30,
      bottom: 10,
      left: 30,
    },
  };

  const displayData = useMemo(
    () =>
      liveOutput.points.length > 0
        ? [
            ...chartData,
            {
              id: 'Live Output',
              name: 'Live processed output',
              line: {
                color: ColorEnum.ANALOGOUS2,
                strokeWidth: 2,
                points: liveOutput.points,
              },
            } as IChartCurveData,
          ]
        : chartData,
    [chartData, liveOutput.points],
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
      className={`graph-wrapper${!isEnabled ? ' is-engine-disabled' : ''}`}
      ref={ref}
      aria-disabled={!isEnabled}
    >
      <div className="live-output-controls">
        {convolution && (
          <span className="graph-legend graph-legend--convolution">
            Headset convolution
          </span>
        )}
        <span className="graph-legend graph-legend--eq">EQ response</span>
        {voicing?.profileId ? (
          <span className="graph-legend graph-legend--voicing">Voicing</span>
        ) : null}
        {driver?.profileId ? (
          <span className="graph-legend graph-legend--driver">Driver</span>
        ) : null}
        {voicing?.profileId || driver?.profileId ? (
          <span className="graph-legend graph-legend--total">
            {[
              'EQ',
              voicing?.profileId ? 'voicing' : '',
              driver?.profileId ? 'driver' : '',
            ]
              .filter(Boolean)
              .join(' + ')}
          </span>
        ) : null}
        <span className="graph-legend graph-legend--live">
          Live output (0 dB = track peak)
        </span>
        {liveOutput.isClipping && (
          <span className="graph-clip-warning" role="status">
            CLIPPING - reduce preamp
          </span>
        )}
        <span className="graph-edit-hint">
          Drag points · Ctrl/Shift select · Ctrl+scroll: Q
        </span>
        {liveOutput.error && (
          <span className="live-output-error">{liveOutput.error}</span>
        )}
      </div>
      {isLoading ? (
        <div className="center full row">
          <Spinner />
        </div>
      ) : (
        <Chart
          data={displayData}
          dimensions={dimensions}
          editablePoints={editablePoints}
          coverage={liveOutput.balanceProgress?.regions}
          onMarqueeSelect={(ids, additive) =>
            setSelectedFilterIds(
              additive ? [...new Set([...selectedFilterIds, ...ids])] : ids,
            )
          }
        />
      )}
    </div>
  ) : null;
};

export default FrequencyResponseChart;
