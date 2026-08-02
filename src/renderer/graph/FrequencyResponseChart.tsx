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
  IChartCurveData,
  IChartLineDataPointsById,
  IChartPointData,
  IEditableChartPoint,
} from './ChartController';
import { getFilterLineData, getCombinedLineData } from './utils';
import { ColorEnum, GrayScaleEnum } from '../styles/color';
import { useLiveAudio } from '../audio/LiveAudioContext';

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
    isLoading,
    globalError,
    convolution,
    preAmp,
    setGlobalError,
    setPreAmp,
    dispatchFilter,
    selectedFilterId,
    setSelectedFilterId,
  } = useAquaContext();
  const prevFilters = useRef<IFiltersMap>({});
  const prevFilterLines = useRef<IChartLineDataPointsById>({});
  const pendingPointEdits = useRef<Record<string, PendingPointEdit>>({});
  const pointEditTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>(
    {},
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
      const frequency = Math.max(
        MIN_FREQUENCY,
        Math.min(MAX_FREQUENCY, Math.round(point.x)),
      );
      // Graph points include the root preamp offset so they move together
      // when the master gain changes. Convert the dragged screen value back
      // to the band's own gain before writing it to APO.
      const gain =
        Math.round(
          Math.max(MIN_GAIN, Math.min(MAX_GAIN, point.y - preAmp)) * 100,
        ) / 100;
      dispatchFilter({
        type: FilterActionEnum.FREQUENCY,
        id: filterId,
        newValue: frequency,
      });
      dispatchFilter({
        type: FilterActionEnum.GAIN,
        id: filterId,
        newValue: gain,
      });
      queuePointEdit(filterId, { frequency, gain });
    },
    [dispatchFilter, preAmp, queuePointEdit],
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
      const quality =
        Math.round(
          Math.max(
            MIN_QUALITY,
            Math.min(MAX_QUALITY, filter.quality + direction * step),
          ) * 100,
        ) / 100;
      dispatchFilter({
        type: FilterActionEnum.QUALITY,
        id: filterId,
        newValue: quality,
      });
      queuePointEdit(filterId, { quality });
    },
    [dispatchFilter, filters, queuePointEdit],
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

    const convolutionFilterLines: IChartLineDataPointsById = {};
    Object.values(convolution?.filters || {}).forEach((filter) => {
      convolutionFilterLines[filter.id] = getFilterLineData(filter);
    });

    // APO applies the headset convolution first, then the editable EQ bands,
    // and finally preamp. Mirror that exact order in the response graph.
    const totalCurveData = getCombinedLineData(preAmp, {
      ...convolutionFilterLines,
      ...updatedFilterLines,
    });
    const convolutionCurveData = getCombinedLineData(0, convolutionFilterLines);

    // Compute preAmp line data
    // const preAmpLine = getPreAmpLine(preAmp);

    const highestPoint = totalCurveData.reduce(
      (previousValue, currentValue) => {
        return previousValue.y < currentValue.y ? currentValue : previousValue;
      },
    );

    return {
      chartData: convolution
        ? [
            {
              id: 'Headphone Convolution',
              name: `Convolution · ${convolution.name}`,
              line: {
                color: GrayScaleEnum.WHITE,
                strokeWidth: 2,
                points: convolutionCurveData,
              },
            } as IChartCurveData,
            {
              id: 'Total Response',
              name: 'Convolution + EQ + preamp',
              line: {
                color: ColorEnum.COMPLEMENTARY,
                strokeWidth: 3,
                points: totalCurveData,
              },
            } as IChartCurveData,
          ]
        : [
            {
              id: 'Total Response',
              name: 'EQ + preamp',
              line: {
                color: GrayScaleEnum.WHITE,
                strokeWidth: 3,
                points: totalCurveData,
              },
            } as IChartCurveData,
          ],
      // Rounding to two decimals
      autoPreAmpValue:
        Math.round(
          clamp(-1 * (highestPoint.y - preAmp), MIN_GAIN, MAX_GAIN) * 100,
        ) / 100,
    };
  }, [convolution, filters, preAmp]);

  useEffect(() => {
    // Don't automatically adjust preamp if state hasn't been fetched yet
    if (!isLoading && !globalError) {
      setMainPreAmp(autoPreAmpValue)
        .then(() => setPreAmp(autoPreAmpValue))
        .catch((error: ErrorDescription) => {
          setGlobalError(error);
        });
    }
  }, [autoPreAmpValue, globalError, isLoading, setGlobalError, setPreAmp]);

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
                color: ColorEnum.COMPLEMENTARY,
                strokeWidth: 2,
                points: liveOutput.points,
              },
            } as IChartCurveData,
          ]
        : chartData,
    [chartData, liveOutput.points],
  );

  const editablePoints: IEditableChartPoint[] = useMemo(
    () =>
      Object.values(filters).map((filter) => ({
        id: filter.id,
        name: `${filter.type} band`,
        // Keep the editable points in the same root-gain coordinate space as
        // the response curve. Changing preamp therefore shifts every dot
        // vertically without changing any band's stored gain.
        data: { x: filter.frequency, y: filter.gain + preAmp },
        selected: selectedFilterId === filter.id,
        onSelect: () => setSelectedFilterId(filter.id),
        onChange: (point: IChartPointData) => handlePointMove(filter.id, point),
        onCommit: () => {
          flushPointEdit(filter.id);
        },
        onQualityWheel: (direction: number) =>
          handlePointQualityWheel(filter.id, direction),
      })),
    [
      filters,
      flushPointEdit,
      handlePointMove,
      handlePointQualityWheel,
      preAmp,
      selectedFilterId,
      setSelectedFilterId,
    ],
  );

  return isGraphViewOn ? (
    <div className="graph-wrapper" ref={ref}>
      <div className="live-output-controls">
        {convolution && (
          <span className="graph-legend graph-legend--convolution">
            Headset convolution
          </span>
        )}
        <span
          className={`graph-legend graph-legend--eq${
            convolution ? ' graph-legend--processed' : ''
          }`}
        >
          {convolution ? 'Convolution + EQ' : 'EQ response'}
        </span>
        <span className="graph-legend graph-legend--live">
          Live output (dBFS)
        </span>
        <span className="graph-edit-hint">Drag points · Ctrl+scroll: Q</span>
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
        />
      )}
    </div>
  ) : null;
};

export default FrequencyResponseChart;
