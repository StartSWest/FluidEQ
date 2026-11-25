/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { useMemo, type ReactNode } from 'react';
import { getDefaultState, isBandEnabled } from 'common/constants';
import { resolveBuiltInLook } from 'common/customLooks';
import { DEFAULT_GRAPH_LOOK } from 'common/graphStyles';
import Chart from '../../graph/Chart';
import type { IEditableChartPoint } from '../../graph/ChartController';
import { buildChartData } from '../../graph/buildChartData';
import { SUPPORTING_CURVE_OPACITY } from '../../graph/chartCurves';
import liveTraceCurves from '../../graph/liveTraceCurves';
import { GRID_BOTTOM_MARGIN, plotTopMargin } from '../../graph/plotMargins';
import { getLineGainAtFrequency } from '../../graph/utils';
import { getBandColor } from '../../utils/bandColors';
import FILTER_TYPE_NAME_KEYS from '../../utils/filterTypeNames';
import { useTranslation } from '../../utils/I18nContext';
import { useRainbowStops } from '../../utils/rainbowPalette';
import HelpMusic from './HelpMusic';
import { HELP_EQ_FILTERS } from './helpEqState';

/**
 * The EQ page's graph as a picture: `Chart`, the graph's own drawing, fed the
 * curves `buildChartData` builds from the made-up bands (`helpEqState`), with
 * a handle on each band as `FrequencyResponseChart` places them, and around
 * it the graph card's corner legend and its View and full-screen keys,
 * markup class for class (`GraphCornerLegend`, `GraphGalleryKeys`): those
 * read and switch the reader's own graph settings.
 *
 * The live wave behind the curves moves with made-up music (`HelpMusic`),
 * never the reader's own sound, and is drawn in the look the window opens
 * on rather than the reader's look or scene (`livePicture`). `children` is
 * what else the card's options row carries — the gallery, in the graph
 * chapter's figure.
 */

const nothing = () => undefined;
const DEFAULT_STATE = getDefaultState();
const OPENING_LOOK = resolveBuiltInLook(DEFAULT_GRAPH_LOOK);
/** The wave as the graph draws it behind the curves, as the window opens. */
const LIVE_CURVES = liveTraceCurves({
  orientation: 'up',
  height: 1,
  position: 0,
  opacity: SUPPORTING_CURVE_OPACITY,
});

/** The plot's size in the figure, in its own pixels. */
export interface IHelpGraphSize {
  width: number;
  height: number;
}

const Legend = () => {
  const { t } = useTranslation();
  return (
    <div className="graph-corner-legend" role="group">
      <div className="graph-corner-legend__list">
        <button
          type="button"
          className="graph-legend graph-legend--eq"
          aria-pressed="true"
        >
          {t('graph.curve.eq')}
        </button>
        <button
          type="button"
          className="graph-legend graph-legend--total"
          aria-pressed="true"
        >
          {t('graph.curve.total')}
        </button>
        <button
          type="button"
          className="graph-legend graph-legend--live graph-corner-legend__live"
          aria-pressed="true"
        >
          <svg className="graph-corner-legend__wave" viewBox="0 0 16 12">
            <path d="M1 6c1.4 0 1.4-4 2.8-4s1.4 8 2.8 8 1.4-8 2.8-8 1.4 4 2.8 4" />
          </svg>
          {t('graph.liveOutput')}
        </button>
      </div>
    </div>
  );
};

/** View and full screen, as `GraphViewMenu`'s trigger and `FullScreenToggles`. */
export const HelpGraphKeys = () => {
  const { t } = useTranslation();
  return (
    <span className="graph-gallery-keys">
      <div className="graph-view-menu">
        <button type="button" className="graph-solo" aria-haspopup="menu">
          {t('graph.view.normal')}
          <svg className="arrow" viewBox="0 0 10 6">
            <path d="M1 1l4 4 4-4" />
          </svg>
        </button>
      </div>
      <span className="view-bar__toggles" role="group">
        <button
          type="button"
          className="view-bar__icon"
          aria-label={t('graph.view.fullscreen')}
        >
          <svg className="view-bar__glyph" viewBox="0 0 24 24">
            <path d="M9 4H4v5m11-5h5v5M9 20H4v-5m11 5h5v-5" />
          </svg>
        </button>
      </span>
    </span>
  );
};

/** The plot: the made-up EQ's curves and a handle on every band. */
export const HelpEqPlot = ({
  size,
  selected = [],
}: {
  size: IHelpGraphSize;
  selected?: readonly string[];
}) => {
  const { t } = useTranslation();
  const rainbow = useRainbowStops();
  const data = useMemo(
    () =>
      buildChartData({
        ...DEFAULT_STATE,
        bypassed: [],
        filters: HELP_EQ_FILTERS,
        hasConvolution: false,
        hasPreAmp: false,
        isAutoPreAmpOn: true,
        isEqQuiet: false,
        matchedDesign: { eq: true, curves: true },
        preAmp: 0,
        prevFilterLines: { current: {} },
        prevFilters: { current: {} },
        rainbow,
        sampleRate: 48000,
        t,
      }).chartData,
    [rainbow, t],
  );
  const points = useMemo((): IEditableChartPoint[] => {
    const sorted = Object.values(HELP_EQ_FILTERS).sort(
      (a, b) => a.frequency - b.frequency,
    );
    const eqCurve = data.find((curve) => curve.id === 'EQ Response')?.line
      .points;
    return sorted.map((filter, index) => {
      const colour = getBandColor(index / (sorted.length - 1), rainbow);
      return {
        id: filter.id,
        name: t(FILTER_TYPE_NAME_KEYS[filter.type]),
        parameters: {
          frequency: filter.frequency,
          gain: filter.gain,
          quality: filter.quality,
        },
        color: colour.color,
        mutedColor: colour.muted,
        data: {
          x: filter.frequency,
          y: eqCurve
            ? getLineGainAtFrequency(eqCurve, filter.frequency)
            : filter.gain,
        },
        selected: selected.includes(filter.id),
        hovered: false,
        isEnabled: isBandEnabled(filter),
        isLocked: false,
        onSelect: nothing,
        onHover: nothing,
        onChange: nothing,
        onCommit: nothing,
        onQualityWheel: nothing,
        onGainStep: nothing,
      };
    });
  }, [data, rainbow, selected, t]);
  return (
    <div
      className="graph-plot is-measured"
      style={{ flex: 'none', width: size.width, height: size.height }}
    >
      <HelpMusic>
        <Chart
          data={data}
          dimensions={{
            width: size.width,
            height: size.height,
            margins: {
              top: plotTopMargin(false),
              right: 0,
              bottom: GRID_BOTTOM_MARGIN,
              left: 0,
            },
          }}
          editablePoints={points}
          liveCurves={LIVE_CURVES}
          livePicture={OPENING_LOOK}
          isLiveOutputForeground={false}
        />
      </HelpMusic>
    </div>
  );
};

/**
 * The graph's card: its options row (the legend, `children`, the keys) over
 * the plot. `isIdle` is the row as it rests, away with the pointer.
 */
export const HelpEqGraphCard = ({
  size,
  isIdle,
  selected,
  children,
}: {
  size: IHelpGraphSize;
  isIdle: boolean;
  selected?: readonly string[];
  children?: ReactNode;
}) => {
  const { t } = useTranslation();
  return (
    <div className="graph-wrapper" style={{ flex: 'none' }}>
      <div
        className={`view-bar live-output-controls${isIdle ? ' is-idle' : ''}`}
        role="toolbar"
        aria-label={t('graph.view.normal')}
      >
        <Legend />
        {children}
        <HelpGraphKeys />
      </div>
      <HelpEqPlot size={size} selected={selected} />
    </div>
  );
};
