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

import { PointerEvent, useMemo, useRef, useState } from 'react';
import { levelAxisSuitsLook } from 'common/graphAnalysis';
import Axis from './Axis';
import GridLine from './GridLine';
import useController, {
  GRAPH_END,
  GRAPH_START,
  graphFrequencyRange,
  IChartCurveData,
  IChartGradientStop,
  IChartLiveOffset,
  IEditableChartPoint,
  ILiveCurveData,
  IMarginLike,
  OUTPUT_CURVE_ID,
} from './ChartController';
import LiveOutputCurve from './LiveOutputCurve';
import {
  getGraphView,
  setGraphView,
  useGraphGridHidden,
  useGraphLook,
  useSceneLook,
} from '../utils/graphStyle';
import viewAfterPlotDoubleClick from './plotDoubleClick';
import { toggleChromeNow } from '../utils/idleChrome';
import CoverageOverlay from './CoverageOverlay';
import Curve from './Curve';
import EditablePoint from './EditablePoint';
import BandLabels from './BandLabels';
import type { ILabelBox } from './bandLabelLayout';
import GenrePins, { useGenrePinSpots } from './GenrePins';
import { useFluidEqContext } from '../utils/FluidEqContext';
import LiveTraceCanvas from './LiveTraceCanvas';
import ScenePlot from './ScenePlot';
import {
  FREQUENCY_MAJOR_TICKS,
  FREQUENCY_MINOR_TICKS,
  frequencyLabelTicksFor,
  gainAxisTicksFor,
  GAIN_GRID_TICKS,
  getAxisPadding,
  getDrawingPadding,
  levelTickFormat,
  liveLevelScaleFor,
  liveLevelTicksFor,
  MINOR_RULE_INK,
  sceneSpectrumRectFor,
  UNITY_RULE_INK,
  UNITY_TICKS,
} from './graphPaper';
import { graphLevelTickFormat } from './liveGraphBand';

export interface ChartDimensions {
  height: number;
  width: number;
  margins: IMarginLike;
}

/**
 * The live curve a Plus visualizer's band is measured from: its height and
 * position, standing up. A scene is built around its own band, and the
 * wave's orientation - hanging, mirrored, centred - turned one upside down
 * or halved it, so for a scene there is no orientation to take (and the View
 * menu offers none).
 */
const orientedForScene = (
  curve: ILiveCurveData | undefined,
  hasScene: boolean,
): ILiveCurveData | undefined =>
  curve && hasScene
    ? { ...curve, isFlipped: false, isHalfHeight: false, isFromCentre: false }
    : curve;

interface IChartProps {
  data: IChartCurveData[];
  dimensions: ChartDimensions;
  editablePoints?: IEditableChartPoint[];
  /**
   * How to draw the live trace, in draw order, or nothing when the wave is
   * hidden. Configuration only — the measurement never comes through here; see
   * `LiveTraceCanvas`, which subscribes to it directly.
   */
  liveCurves?: ILiveCurveData[];
  /** The live output owns the plot instead of supporting response curves. */
  isLiveOutputForeground: boolean;
  onMarqueeSelect?: (ids: string[], additive: boolean) => void;
  /**
   * A gain the output curve is moved by after it is built: the FluidEQ
   * Engine's automatic preamp, which moves at display rate on loud passages.
   * Absent when the preamp is already in the curve's points.
   */
  outputOffset?: IChartLiveOffset;
  /**
   * Whether this plot is one part of the window, so a Plus visualizer may be
   * drawn on a layer of the window with the plot as its frame
   * (`graphScenePlace.ts`).
   */
  isPlotPartOfWindow?: boolean;
}

const Chart = ({
  data = [],
  dimensions,
  editablePoints = [],
  liveCurves = [],
  isLiveOutputForeground,
  onMarqueeSelect,
  outputOffset,
  isPlotPartOfWindow = false,
}: IChartProps) => {
  const { width, height, margins } = dimensions;
  const svgWidth = useMemo(
    () => Math.max(width - margins.left - margins.right, 0),
    [width, margins],
  );
  const svgHeight = useMemo(
    () => Math.max(height - margins.top - margins.bottom, 0),
    [height, margins],
  );

  // Every one of these gutters exists to hold a label, so with the grid off
  // there is nothing in any of them — fifty pixels down the left for the gain
  // scale, forty-eight down the right for the level scale, thirty along the
  // bottom for the frequency marks, all empty, all taken out of the drawing.
  // The wave runs edge to edge instead.
  const isGridHidden = useGraphGridHidden();
  // The genre pins as drawn, and where a measuring view's key stands, for
  // the band labels to keep clear of.
  const genrePins = useGenrePinSpots(data, isLiveOutputForeground);
  const [legendPlace, setLegendPlace] = useState<ILabelBox | undefined>(
    undefined,
  );
  const { bandSetReplacement } = useFluidEqContext();

  const hasHandles = editablePoints.length > 0;
  const padding = getAxisPadding(isGridHidden, hasHandles);
  // The analyser's and the scenes' floor: the plot's own bottom edge when
  // the grid is off, where the handles' inset is only the handles'.
  const drawingPadding = getDrawingPadding(isGridHidden, hasHandles);
  // Where that floor is, for what is drawn over the analyser (coverage).
  const drawingFloor = Math.max(svgHeight - drawingPadding.bottom, 0);

  // Width of the plotting area itself, i.e. everything to the right of the
  // y-axis label gutter. Grid lines are drawn from that gutter, so they must
  // be measured from it too.
  const plotWidth = useMemo(
    () => Math.max(svgWidth - padding.left - padding.right, 0),
    [svgWidth, padding],
  );

  // Curves are clipped to the plot area so they never run under the y-axis
  // labels or over the frequency labels. The top is left open: a stroked line
  // sitting exactly on +20 dB would otherwise be shaved in half.
  const plotHeight = useMemo(
    () => Math.max(svgHeight - padding.bottom, 0),
    [svgHeight, padding],
  );

  // The whole spectrum with the grid on, trimmed to where records have sound
  // with it off (`graphFrequencyRange`).
  // Two gain axes: the EQ's own (`yScaleEq`), which compresses what is past
  // ±20 dB into the plot's ends so an output curve carried down by the
  // preamp is drawn whole, and the plain ±20 one the analyser and the scenes
  // are projected through (`eqGainScale`).
  const { xTickFormat, yTickFormat, xScaleFreq, yScaleGain, yScaleEq } =
    useController({
      width: svgWidth,
      height: svgHeight,
      padding,
      drawingPadding,
      frequencyRange: graphFrequencyRange(isGridHidden),
    });

  const scene = useSceneLook();
  const hasScene = Boolean(scene);
  // Only to decide whether the level scale describes what is drawn; the
  // trace subscribes to the look itself and is not re-rendered from here.
  const look = useGraphLook();
  const liveLevelScale = useMemo(
    () =>
      liveLevelScaleFor({
        gain: yScaleGain,
        spectrumRange: scene?.spectrumRange,
        liveCurve: orientedForScene(
          liveCurves[liveCurves.length - 1],
          hasScene,
        ),
        height,
        marginTop: margins.top,
      }),
    [
      liveCurves,
      yScaleGain,
      scene?.spectrumRange,
      hasScene,
      height,
      margins.top,
    ],
  );

  // On the margins' numbers, not the object: the chart is handed a new one
  // every render, and a new band every render restarts the scene's frame loop.
  const sceneSpectrumRect = useMemo(
    () =>
      sceneSpectrumRectFor({
        frequency: xScaleFreq,
        level: liveLevelScale,
        margins: { left: margins.left, top: margins.top },
        width,
        height,
      }),
    [xScaleFreq, liveLevelScale, margins.left, margins.top, width, height],
  );

  const liveLevelTickValues = useMemo(
    () => liveLevelTicksFor(liveLevelScale),
    [liveLevelScale],
  );
  const gainTickValues = useMemo(() => gainAxisTicksFor(yScaleEq), [yScaleEq]);
  const frequencyLabelTicks = useMemo(
    () => frequencyLabelTicksFor(xScaleFreq),
    [xScaleFreq],
  );
  const eqGradientStops: IChartGradientStop[] =
    data.find((curve) => curve.id === 'EQ Response')?.line.gradientStops || [];

  const svgRef = useRef<SVGSVGElement>(null);
  // Which canvas to mount for the live trace. Null is the ordinary look and
  // every way a premium scene can fail; see `useSceneLook`.
  const selectionRef = useRef<
    | { startX: number; startY: number; currentX: number; currentY: number }
    | undefined
  >(undefined);
  const [selectionBox, setSelectionBox] =
    useState<typeof selectionRef.current>(undefined);

  const getSvgPoint = (event: PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) {
      return undefined;
    }
    const bounds = svg.getBoundingClientRect();
    return {
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
    };
  };

  const handleSelectionStart = (event: PointerEvent<SVGSVGElement>) => {
    // No visible/editable EQ curve means there is nothing this gesture can
    // select. Do not even start the rubber band: an empty selection rectangle
    // over a hidden curve looks like an invisible editor is still active.
    if (!onMarqueeSelect) {
      return;
    }
    const target = event.target as Element;
    if (target.closest?.('.graph-edit-point')) {
      return;
    }
    const point = getSvgPoint(event);
    if (!point) {
      return;
    }
    const next = {
      startX: point.x,
      startY: point.y,
      currentX: point.x,
      currentY: point.y,
    };
    selectionRef.current = next;
    setSelectionBox(next);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleSelectionMove = (event: PointerEvent<SVGSVGElement>) => {
    if (!selectionRef.current) {
      return;
    }
    const point = getSvgPoint(event);
    if (!point) {
      return;
    }
    const next = {
      ...selectionRef.current,
      currentX: point.x,
      currentY: point.y,
    };
    selectionRef.current = next;
    setSelectionBox(next);
  };

  const finishSelection = (event: PointerEvent<SVGSVGElement>) => {
    const selection = selectionRef.current;
    if (!selection) {
      return;
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    const left = Math.min(selection.startX, selection.currentX);
    const right = Math.max(selection.startX, selection.currentX);
    const top = Math.min(selection.startY, selection.currentY);
    const bottom = Math.max(selection.startY, selection.currentY);
    // A click on bare plot clears the selection and nothing else.
    //
    // It used to walk the live output to its next look as well, so that styles
    // could be flicked through without taking the pointer off the graph. The
    // trade was that one gesture did two unrelated things, and the one nobody
    // asked for — a drawing that changes — happened every time somebody merely
    // wanted to deselect. Space and Ctrl+Space cycle the looks; they are listed
    // in the view menu, they work from anywhere, and they do not fire when the
    // pointer happens to land on empty graph.
    const isClick = right - left < 6 && bottom - top < 6;
    const selectedIds = isClick
      ? []
      : editablePoints
          .filter((point) => {
            const x = Number(xScaleFreq(point.data.x));
            const y = Number(yScaleEq(point.data.y));
            return x >= left && x <= right && y >= top && y <= bottom;
          })
          .map((point) => point.id);
    onMarqueeSelect?.(
      selectedIds,
      event.ctrlKey || event.metaKey || event.shiftKey,
    );
    selectionRef.current = undefined;
    setSelectionBox(undefined);
  };

  return (
    <>
      {/* The live trace, on its own canvas behind the drawing.

          A sibling of the SVG rather than a layer inside it, because that is
          the whole point: a canvas draw replaces pixels, where a path rewrites
          an attribute that the document then has to re-parse and re-rasterise.
          Both boxes are laid over the same corner of the plot, so a coordinate
          means the same thing in each — see the canvas for how it is sized.

          Handed how to draw and not what: the measurement it reads for itself,
          which is what keeps this chart still while the music plays. */}
      {liveCurves.length > 0 &&
        (scene ? (
          // A premium scene owns the whole plot and the 2D trace is not
          // drawn under it. Every way a scene can fail makes `scene` null
          // again, and the ordinary canvas below takes over with the look
          // the store already resolved for it.
          // The scene itself runs above the pages (`GraphScene`); the plot
          // says where it is and shows its loading.
          <ScenePlot
            scene={scene}
            width={width}
            height={height}
            spectrumRect={sceneSpectrumRect}
            // A plain drag is the band marquee wherever there are bands to
            // select, and turning a scene must never cost the equaliser that.
            dragTurns={!onMarqueeSelect}
            // Clear of the axes: their labels live in the padding inside the
            // drawing, not in its margins.
            inset={{
              right: margins.right + drawingPadding.right,
              bottom: margins.bottom + drawingPadding.bottom,
            }}
            isPartOfWindow={isPlotPartOfWindow}
          />
        ) : (
          <LiveTraceCanvas
            curves={liveCurves}
            xScale={xScaleFreq}
            yScale={yScaleGain}
            width={svgWidth}
            height={svgHeight}
            offsetLeft={margins.left}
            offsetTop={margins.top}
            isForeground={isLiveOutputForeground}
            // Before & after shows the music as it reached the EQ by taking
            // this back out of the reading; nothing else on the canvas uses
            // it, and no other curve on this chart is the whole chain.
            eqResponse={
              data.find((curve) => curve.id === OUTPUT_CURVE_ID)?.line.points
            }
            onLegendPlace={setLegendPlace}
          />
        ))}
      <svg
        ref={svgRef}
        width={svgWidth}
        height={svgHeight}
        // The handles may stand on the very edge of the scale, and a circle
        // centred on an edge is half outside it. The svg does not clip; the
        // plot box around it does, and it has the toolbar's gutter above the
        // svg to spend. Curves keep their own clip path.
        overflow="visible"
        // Double-click the plot to fill the screen, Ctrl+double-click to fill
        // the window, and double-click again to come back (`plotDoubleClick`).
        //
        // The gesture every video player in the world uses, on the one pane here
        // that behaves like one. It rides alongside the marquee rather than
        // fighting it: a double click is two clicks, each of which selects
        // nothing, so the selection is already empty by the time this fires.
        //
        // On a band handle it does nothing — those have their own handlers and
        // stop the event — so dragging a point and accidentally double-tapping it
        // does not throw the window into full screen.
        onDoubleClick={(event) => {
          if ((event.target as Element).closest?.('.graph-edit-point')) {
            return;
          }
          setGraphView(
            viewAfterPlotDoubleClick(
              getGraphView(),
              event.ctrlKey || event.metaKey,
            ),
          );
        }}
        // A single click on the drawing shows the chrome or puts it away.
        //
        // Only full screen is watching, so this does nothing in any other mode.
        // A toggle rather than a hide, because a control that works in one
        // direction only is one somebody presses twice and then stops trusting.
        //
        // Not on a band handle: those are for dragging, and moving the toolbar
        // every time one is touched would be a control that punishes being used.
        onClick={(event) => {
          if ((event.target as Element).closest?.('.graph-edit-point')) {
            return;
          }
          toggleChromeNow();
        }}
        onPointerDown={handleSelectionStart}
        onPointerMove={handleSelectionMove}
        onPointerUp={finishSelection}
        onPointerCancel={finishSelection}
        style={{
          margin: `${margins.top}px ${margins.right}px ${margins.bottom}px ${margins.left}px`,
        }}
      >
        <defs>
          {/* Across the whole spectrum the stops are placed in
              (`buildChartData`), wherever its ends land: past the plot's
              sides when the range is trimmed, so each colour stays over the
              band it belongs to. */}
          <linearGradient
            id="chart-eq-spectrum-gradient"
            gradientUnits="userSpaceOnUse"
            x1={xScaleFreq(GRAPH_START)}
            x2={xScaleFreq(GRAPH_END)}
            y1={0}
            y2={0}
          >
            {(eqGradientStops.length > 0
              ? eqGradientStops
              : [
                  { offset: 0, color: 'currentColor' },
                  { offset: 1, color: '#8b5cff' },
                ]
            ).map((stop) => (
              <stop
                key={`${stop.offset}-${stop.color}`}
                offset={`${Math.max(0, Math.min(1, stop.offset)) * 100}%`}
                stopColor={stop.color}
              />
            ))}
          </linearGradient>
          {/* The rainbow palette's own gradient used to sit here beside the EQ
              one, because a path could only be painted from a `<defs>` entry.
              The live trace builds its gradients against its own canvas now,
              from the look's colours or the window's (`windowInk.ts`) — see
              `resolveTracePaint`. */}
          {/*
            Red at the bottom, green at the top, and the whole point is what is
            in between: the ramp over which a range earns its correction. Object
            bounding box units rather than user space, so one definition serves
            nine bands whose ramps sit at nine different heights and widths.
          */}
          <linearGradient id="chart-presence-ramp" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#54ff8a" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#ff5a6e" stopOpacity="0.3" />
          </linearGradient>
        </defs>
        {/* The paper, as one group, so it can be taken away as one thing.
          Grouped rather than each line carrying its own class: the hiding is a
          single decision and four grid layers plus two axes agreeing about it
          is four more places for one of them to be forgotten. */}
        {/* No band past ±20 dB, where the EQ's axis is compressed
          (`eqGainScale`): a haze there read as a grey slab laid across the top
          and foot of the plot (Ivan, 2026-09-26: "remove grid bg too"). The
          ±20 rule and the compressed labels still say where the scale
          changes. */}
        <g className="chart-grid">
          <GridLine
            type="vertical"
            scale={xScaleFreq}
            tickValues={FREQUENCY_MAJOR_TICKS}
            size={svgHeight - padding.bottom}
            transform={`translate(0, ${svgHeight - padding.bottom})`}
          />
          <GridLine
            type="vertical"
            scale={xScaleFreq}
            tickValues={FREQUENCY_MINOR_TICKS}
            size={svgHeight - padding.bottom - 20}
            transform={`translate(0, ${svgHeight - padding.bottom - 10})`}
            color={MINOR_RULE_INK}
          />
          <GridLine
            type="horizontal"
            scale={yScaleEq}
            tickValues={GAIN_GRID_TICKS}
            size={plotWidth}
            transform={`translate(${padding.left}, 0)`}
          />
          <GridLine
            type="horizontal"
            scale={yScaleEq}
            tickValues={UNITY_TICKS}
            size={plotWidth}
            color={UNITY_RULE_INK}
            transform={`translate(${padding.left}, 0)`}
          />
        </g>
        {/* Drawn only while a measurement is running, and subscribed to that
          measurement itself rather than handed it — see the component.

          And only where the curves are. Somebody who has taken the response
          off the plot is watching the wave, and columns marching across it are
          measurement furniture on a drawing that is not a measurement — the
          whole point of that mode is to be left with the one thing. The
          measurement carries on regardless; it is only the picture of it that
          waits. */}
        <CoverageOverlay
          xScale={xScaleFreq}
          yScale={yScaleGain}
          eqScale={yScaleEq}
          top={drawingPadding.top}
          plotHeight={drawingFloor}
          isResponseHidden={isLiveOutputForeground}
          isOverScene={Boolean(scene)}
        />
        {selectionBox && (
          <rect
            className="chart-selection-box"
            x={Math.min(selectionBox.startX, selectionBox.currentX)}
            y={Math.min(selectionBox.startY, selectionBox.currentY)}
            width={Math.abs(selectionBox.currentX - selectionBox.startX)}
            height={Math.abs(selectionBox.currentY - selectionBox.startY)}
            pointerEvents="none"
          />
        )}
        {/* Everything the user is editing, or that made what they are editing.
          The orientations — hanging, mirrored, centred — belong to the live
          trace alone and are applied on the canvas, where the geometry they
          reflect is drawn. */}
        {data.map((e: IChartCurveData) =>
          e.id === OUTPUT_CURVE_ID && outputOffset ? (
            <LiveOutputCurve
              key={e.id}
              data={e}
              xScale={xScaleFreq}
              yScale={yScaleEq}
              offset={outputOffset}
            />
          ) : (
            <Curve key={e.id} data={e} xScale={xScaleFreq} yScale={yScaleEq} />
          ),
        )}
        {/* A genre's pins on its Preset line: over the lines, under the
          band handles, so a handle standing on a pin can still be dragged.
          With the grid off too, wherever the line itself is drawn: they
          went with the grid, and a graph kept gridless showed the preset's
          line with nothing saying what it was (Ivan, 2026-09-25: "why
          can't the preset info be seen in the graph"). */}
        <GenrePins
          data={data}
          xScale={xScaleFreq}
          yScale={yScaleEq}
          isHidden={isLiveOutputForeground}
        />
        <BandLabels
          points={editablePoints}
          pins={genrePins?.pins}
          legend={legendPlace}
          bandSetReplacement={bandSetReplacement}
          xScale={xScaleFreq}
          yScale={yScaleEq}
          bounds={{
            left: padding.left + 2,
            right: svgWidth - padding.right - 2,
            top: 4,
            bottom: plotHeight - 4,
          }}
        />
        {editablePoints.map((point) => (
          <EditablePoint
            key={point.id}
            point={point}
            svgRef={svgRef}
            xScale={xScaleFreq}
            yScale={yScaleEq}
          />
        ))}
        <clipPath id="chart-clip-path">
          <rect x={padding.left} y={0} width={plotWidth} height={plotHeight} />
        </clipPath>
        {/* The halo's clip reaches twelve pixels past the plot on each side —
          the halo's own half-width — so a curve that runs to the edge tails
          off into the gutter instead of being cut square at the axis. The
          line itself keeps the exact clip above. */}
        <clipPath id="chart-halo-clip-path">
          <rect
            x={padding.left - 12}
            y={0}
            width={plotWidth + 24}
            height={plotHeight}
          />
        </clipPath>
        {/* The scales, in the same group as the lines they label. A decibel axis
          beside a plot with no grid is a ruler with no marks on it. */}
        <g className="chart-grid">
          <Axis
            type="left"
            scale={yScaleEq}
            transform={`translate(${padding.left}, 0)`}
            tickValues={gainTickValues}
            tickFormat={yTickFormat}
          />
          {/* Same transformed pixels as the live wave it describes, and the
            same depth: a scene draws the shared forty decibels, the graph's
            own analyser eighty (`liveGraphBand.ts`).

            Absent on the two views whose vertical axis is not a level at all.
            The spectrogram runs TIME up the plot and says loudness in colour,
            and the stereo meters are their own instruments — a decibel scale
            beside either is a ruler measuring the wrong thing, which is
            exactly how it was read (Ivan, 2026-09-23: "why the espectrograma
            is bottom up ... matching those?"). */}
          {levelAxisSuitsLook(look.style) ? (
            <Axis
              type="right"
              scale={liveLevelScale}
              transform={`translate(${padding.left + plotWidth}, 0)`}
              tickValues={liveLevelTickValues}
              tickFormat={hasScene ? levelTickFormat : graphLevelTickFormat}
              disableAnimation
            />
          ) : null}
          <Axis
            type="bottom"
            scale={xScaleFreq}
            transform={`translate(0, ${svgHeight - padding.bottom})`}
            tickValues={frequencyLabelTicks}
            tickFormat={xTickFormat}
          />
        </g>
      </svg>
    </>
  );
};

export default Chart;
