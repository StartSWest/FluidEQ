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
import type { AxisScale, NumberValue } from 'd3';
import { MAX_GAIN, MIN_GAIN } from 'common/constants';
import Axis from './Axis';
import GridLine from './GridLine';
import { useLiveAudioFrame } from '../audio/LiveAudioContext';
import useController, {
  IChartCurveData,
  IChartGradientStop,
  IEditableChartPoint,
  ILiveCurveData,
  IMarginLike,
} from './ChartController';
import {
  toggleGraphFullScreen,
  useGraphCoverageHidden,
  useGraphGridHidden,
  useLiveOutputSolo,
} from '../utils/graphStyle';
import { toggleChromeNow } from '../utils/idleChrome';
import {
  getPresenceLine,
  hasCustomPresenceRange,
  resetPresenceRange,
  setPresenceLine,
  usePresenceLines,
} from '../utils/presenceThreshold';
import { balanceRangeName } from '../utils/autoBalance';
import { useSmartEqMode } from '../utils/smartEqMode';
import { useTranslation } from '../utils/I18nContext';
import Curve from './Curve';
import EditablePoint from './EditablePoint';
import LiveTraceCanvas from './LiveTraceCanvas';

export interface ChartDimensions {
  height: number;
  width: number;
  margins: IMarginLike;
}

/**
 * How far either side of a presence line takes the pointer.
 *
 * The line has to be thin — it is being read against the trace it sits under,
 * and a thick one hides the very thing somebody is judging it by. So the line
 * is drawn at a couple of pixels and the thing you actually grab is this, which
 * is invisible and much taller.
 */
const PRESENCE_GRAB_PX = 9;

/**
 * Half-height of the band through the middle of a ramp that brings its reset
 * button up. Capped, because this pad swallows clicks and a tall ramp would
 * otherwise make a great deal of plot unclickable for a button wanted once.
 */
const PRESENCE_RESET_PAD_PX = 14;

/**
 * The Smart EQ coverage overlay, subscribed to the measurement itself.
 *
 * Its own component for the same reason the trace is: the regions arrive with
 * the analyser frames, and a `coverage` prop threaded through the chart woke the
 * whole chart up at frame rate to redraw seven rectangles that only exist while
 * a measurement is running — which is a few seconds in the life of the app and
 * never at all for most people. Down here the subscription costs one component
 * rendering null.
 *
 * Each frequency region lights up as it is actually heard, so the wait is
 * legible: you can see which part of the spectrum the measurement is still
 * missing rather than watching a percentage.
 */

const CoverageOverlay = ({
  xScale,
  yScale,
  top,
  plotHeight,
}: {
  xScale: AxisScale<NumberValue>;
  yScale: AxisScale<NumberValue>;
  top: number;
  plotHeight: number;
}) => {
  const { balanceProgress } = useLiveAudioFrame();
  // The region labels arriving with the measurement are identifiers, not words
  // — they key the flash store and are React keys down here — so the caption
  // localises them at the point it says them, through the same lookup the
  // Smart EQ bubble uses.
  const { t } = useTranslation();
  const isSolo = useLiveOutputSolo();
  // The shaded columns only. The bars along the foot are drawn either way — see
  // `useGraphCoverageHidden` for why the switch stops short of them.
  const isWashHidden = useGraphCoverageHidden();
  const coverage = balanceProgress?.regions;
  // Read so a drag anywhere re-renders every line, since one store holds them
  // all. The values themselves are taken through `getPresenceLine`, which knows
  // where an unset edge's default goes and which mode is asking.
  usePresenceLines();
  // Each mode keeps its own pair, so a mode change moves every line on screen.
  // Subscribed here rather than read once, because nothing else in this
  // component would notice.
  useSmartEqMode();
  // `range:edge`, because two lines in the same range are both grabbable and
  // the pointer has to be told which one it caught.
  const dragging = useRef<string | undefined>(undefined);

  /**
   * Where a pointer sits, in the chart's own decibels.
   *
   * Read off the owning `<svg>` rather than the group, because the group is
   * translated by the margins and `getBoundingClientRect` on an SVG group
   * reports the union of what it draws — which changes as the lines move, so a
   * drag computed against it would chase itself.
   */
  const dbAt = (event: { clientY: number; currentTarget: SVGElement }) => {
    const svg = event.currentTarget.ownerSVGElement;
    if (!svg) {
      return undefined;
    }
    const y = event.clientY - svg.getBoundingClientRect().top;
    const { invert } = yScale as unknown as { invert?: (v: number) => number };
    return typeof invert === 'function' ? invert(y) : undefined;
  };

  // Nothing while the curves are off: somebody in that mode is watching the
  // wave, and columns marching across it are measurement furniture on a drawing
  // that is not a measurement. The measurement carries on regardless; only the
  // picture of it waits.
  //
  // Drawn for the continuous modes exactly as for the one-shot, and that is a
  // deliberate reversal. It was hidden under them for a while on the argument
  // that a permanent row of full bars reports the same fact all evening — which
  // is true of a capture that keeps accumulating forever, and is no longer how
  // the continuous ones work: evidence decays on a half-life, so the bars fall
  // back when the music stops feeding a range and fill again when it returns.
  // They move, and what they say while moving is the same thing they say during
  // a measurement.
  //
  // Marking only the ranges a correction had just landed on was tried instead
  // and is worse: a block of colour laid over part of the graph reads as
  // something having been added to the chain rather than as an event.
  if (isSolo || !coverage?.length) {
    return null;
  }
  return (
    <g className="chart-coverage" pointerEvents="none">
      {coverage.map((region) => {
        const left = Number(xScale(region.lowFrequency));
        const right = Number(xScale(region.highFrequency));
        const width = Math.max(0, right - left - 2);
        const height = Math.max(0, plotHeight - top);
        // Geometric centre, which is what the range's own `centreFrequency`
        // is — recomputed here rather than carried through the progress report,
        // since only the default placement needs it.
        const centre = Math.sqrt(region.lowFrequency * region.highFrequency);
        const floorDb = getPresenceLine('floor', region.label, centre);
        const fullDb = getPresenceLine('full', region.label, centre);
        const floorY = Number(yScale(floorDb));
        const fullY = Number(yScale(fullDb));
        return (
          <g key={region.label}>
            {!isWashHidden && (
              <rect
                className="chart-coverage__column"
                x={left + 1}
                y={top}
                width={width}
                height={height}
                opacity={0.06 + region.confidence * 0.14}
              />
            )}
            {/*
             * The line under which this range is not playing, and so is not
             * boosted. It goes with the shaded columns rather than with the
             * bars along the foot: it belongs to the range it divides, it needs
             * the whole height of the plot to be dragged through, and somebody
             * who has switched the columns off has said they do not want the
             * measurement drawn over the music.
             *
             * The grab area is much taller than the line and is the only part
             * that takes a pointer, so a two-pixel rule is catchable without
             * the line itself having to be thick enough to obscure the trace it
             * is being set against.
             */}
            {!isWashHidden &&
              Number.isFinite(floorY) &&
              Number.isFinite(fullY) && (
                <g
                  className={`chart-presence${
                    dragging.current?.startsWith(`${region.label}:`)
                      ? ' is-dragging'
                      : ''
                  }`}
                >
                  {/*
                   * The dead zone, drawn rather than described.
                   *
                   * A line says where something changes but not what changes,
                   * and nobody reads a tooltip before dragging. Shading below
                   * the floor says it without words: this part of this range
                   * does not count. When the trace dips into it during a solo
                   * passage, the reason the bass is not being lifted is on
                   * screen, in the place the lifting would have happened.
                   */}
                  <rect
                    className="chart-presence__dead"
                    x={left + 1}
                    y={floorY}
                    width={width}
                    height={Math.max(0, plotHeight - floorY)}
                  />
                  {/*
                   * And the ramp between the two, which is the part that would
                   * otherwise need explaining. Trust is not a switch: the higher
                   * the trace sits in this band, the more boost the range has
                   * earned, and a gradient is what that sentence looks like.
                   */}
                  <rect
                    className="chart-presence__ramp"
                    x={left + 1}
                    y={Math.min(floorY, fullY)}
                    width={width}
                    height={Math.abs(floorY - fullY)}
                  />
                  {/*
                   * Put this range back, in this mode, where the two lines can
                   * see it.
                   *
                   * In the ramp rather than off in a toolbar: the thing being
                   * undone is right here, and a reset that lives somewhere else
                   * is a reset nobody finds after they have made a mess. Only
                   * drawn once the range has actually been moved, so it is
                   * never a button that does nothing, and only on approach, so
                   * nine of them are not sitting over the trace.
                   *
                   * This mode's copy only. The same range in another mode holds
                   * different numbers because that mode wants different things
                   * from it, and tidying one has no business undoing another.
                   */}
                  {hasCustomPresenceRange(region.label) && (
                    <g
                      className="chart-presence__reset"
                      pointerEvents="all"
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={() => resetPresenceRange(region.label)}
                    >
                      <title>
                        {t('eq.smart.presence.reset', {
                          range: balanceRangeName(region.label, t),
                        })}
                      </title>
                      {/*
                       * The gap itself is the target, not the glyph.
                       *
                       * A seven-pixel circle that is invisible until you are on
                       * it is a thing you find by accident. Opacity does not
                       * stop an element being hit, so the button was always
                       * reachable — it was just unaimable, which is the same
                       * problem from the user's side. So the whole width of the
                       * range, through the middle of the ramp, brings it up.
                       *
                       * Height capped rather than the whole ramp: this pad does
                       * swallow clicks, and a ramp fourteen decibels tall
                       * spanning a range is a lot of plot to make unclickable
                       * for a button somebody wants once.
                       */}
                      <rect
                        className="chart-presence__reset-pad"
                        x={left + 1}
                        y={
                          (floorY + fullY) / 2 -
                          Math.min(
                            PRESENCE_RESET_PAD_PX,
                            Math.abs(floorY - fullY) / 2,
                          )
                        }
                        width={width}
                        height={
                          Math.min(
                            PRESENCE_RESET_PAD_PX,
                            Math.abs(floorY - fullY) / 2,
                          ) * 2
                        }
                      />
                      <circle
                        cx={left + 1 + width / 2}
                        cy={(floorY + fullY) / 2}
                        r={8}
                      />
                      <text
                        x={left + 1 + width / 2}
                        y={(floorY + fullY) / 2 + 4}
                        textAnchor="middle"
                      >
                        ↺
                      </text>
                    </g>
                  )}
                  {(['floor', 'full'] as const).map((edge) => {
                    const db = edge === 'floor' ? floorDb : fullDb;
                    const y = edge === 'floor' ? floorY : fullY;
                    const dragKey = `${region.label}:${edge}`;
                    return (
                      <g key={edge} className={`chart-presence--${edge}`}>
                        <line
                          className="chart-presence__line"
                          x1={left + 1}
                          x2={left + 1 + width}
                          y1={y}
                          y2={y}
                        />
                        {/* Named and numbered on approach, so a drag is aimed
                            rather than guessed at. Hidden until then — eighteen
                            captions standing permanently over the trace would be
                            far worse than none. */}
                        <text
                          className="chart-presence__label"
                          x={left + 1 + width / 2}
                          y={y - 5}
                          textAnchor="middle"
                        >
                          {t(
                            edge === 'floor'
                              ? 'eq.smart.presence.ignoredBelow'
                              : 'eq.smart.presence.trustedAbove',
                            {
                              range: balanceRangeName(region.label, t),
                              db: db.toFixed(0),
                            },
                          )}
                        </text>
                        <rect
                          className="chart-presence__grab"
                          x={left + 1}
                          y={y - PRESENCE_GRAB_PX}
                          width={width}
                          height={PRESENCE_GRAB_PX * 2}
                          pointerEvents="all"
                          onPointerDown={(event) => {
                            event.stopPropagation();
                            dragging.current = dragKey;
                            event.currentTarget.setPointerCapture(
                              event.pointerId,
                            );
                          }}
                          onPointerMove={(event) => {
                            if (dragging.current !== dragKey) {
                              return;
                            }
                            const next = dbAt(event);
                            if (next !== undefined) {
                              setPresenceLine(edge, region.label, next, centre);
                            }
                          }}
                          onPointerUp={(event) => {
                            dragging.current = undefined;
                            event.currentTarget.releasePointerCapture(
                              event.pointerId,
                            );
                          }}
                          onDoubleClick={() => resetPresenceRange(region.label)}
                        />
                      </g>
                    );
                  })}
                </g>
              )}
            <rect
              className="chart-coverage__track"
              x={left + 1}
              y={plotHeight - 6}
              width={width}
              height={4}
              rx={2}
            />
            <rect
              className={`chart-coverage__fill${
                region.isCovered ? ' is-covered' : ''
              }`}
              x={left + 1}
              y={plotHeight - 6}
              width={width * Math.min(1, region.confidence)}
              height={4}
              rx={2}
            />
          </g>
        );
      })}
    </g>
  );
};

interface IChartProps {
  data: IChartCurveData[];
  /**
   * The subset of `data` that is allowed to set the y-scale. The live output
   * trace is excluded: it is a reading, not part of the EQ, and letting it
   * rescale the axes would make the bands appear to move whenever the music
   * got louder.
   */
  scaleData: IChartCurveData[];
  dimensions: ChartDimensions;
  editablePoints?: IEditableChartPoint[];
  /**
   * How to draw the live trace, in draw order, or nothing when the wave is
   * hidden. Configuration only — the measurement never comes through here; see
   * `LiveTraceCanvas`, which subscribes to it directly.
   */
  liveCurves?: ILiveCurveData[];
  onMarqueeSelect?: (ids: string[], additive: boolean) => void;
}

const Chart = ({
  data = [],
  scaleData = [],
  dimensions,
  editablePoints = [],
  liveCurves = [],
  onMarqueeSelect,
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
  // there is nothing in any of them — fifty pixels down the left for the decibel
  // scale and thirty along the bottom for the frequency marks, both empty, both
  // taken out of the drawing. The wave runs edge to edge instead.
  const isGridHidden = useGraphGridHidden();

  const padding = useMemo(() => {
    return {
      left: isGridHidden ? 0 : 50,
      // Axis labels are centred on their tick, so the topmost one (+20 dB)
      // needs half a line of headroom or the SVG viewport cuts it in half.
      top: isGridHidden ? 0 : 10,
      right: 0,
      bottom: isGridHidden ? 0 : 30,
    };
  }, [isGridHidden]);

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

  const { xTickFormat, yTickFormat, xScaleFreq, yScaleGain } = useController({
    scaleData,
    width: svgWidth,
    height: svgHeight,
    padding,
  });

  const yAxisTickValues = useMemo(() => {
    return [MIN_GAIN, -10, 0, 10, MAX_GAIN];
  }, []);
  const yGridTickValues = useMemo(() => {
    return [MIN_GAIN, -10, 10, MAX_GAIN];
  }, []);
  const eqGradientStops: IChartGradientStop[] =
    data.find((curve) => curve.id === 'EQ Response')?.line.gradientStops || [];

  const svgRef = useRef<SVGSVGElement>(null);
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
            const y = Number(yScaleGain(point.data.y));
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
      {liveCurves.length > 0 && (
        <LiveTraceCanvas
          curves={liveCurves}
          xScale={xScaleFreq}
          yScale={yScaleGain}
          width={svgWidth}
          height={svgHeight}
          offsetLeft={margins.left}
          offsetTop={margins.top}
        />
      )}
      <svg
        ref={svgRef}
        width={svgWidth}
        height={svgHeight}
        // Double-click the plot to fill the screen, and again to come back.
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
          toggleGraphFullScreen();
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
          <linearGradient
            id="chart-eq-spectrum-gradient"
            gradientUnits="userSpaceOnUse"
            x1={padding.left}
            x2={svgWidth - padding.right}
            y1={0}
            y2={0}
          >
            {(eqGradientStops.length > 0
              ? eqGradientStops
              : [
                  { offset: 0, color: '#00e5cf' },
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
              The live trace builds it against its own canvas now, from the same
              `BAND_SPECTRUM_STOPS` — see `resolveTracePaint`, which also keeps
              the reason the two gradients are separate. */}
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
          <filter
            id="chart-eq-neon-glow"
            x="-30%"
            y="-120%"
            width="160%"
            height="340%"
            colorInterpolationFilters="sRGB"
          >
            <feGaussianBlur stdDeviation="5" />
          </filter>
        </defs>
        {/* The paper, as one group, so it can be taken away as one thing.
          Grouped rather than each line carrying its own class: the hiding is a
          single decision and four grid layers plus two axes agreeing about it
          is four more places for one of them to be forgotten. */}
        <g className="chart-grid">
          <GridLine
            type="vertical"
            scale={xScaleFreq}
            tickValues={[20, 100, 200, 1000, 2000, 10000, 20000]}
            size={svgHeight - padding.bottom}
            transform={`translate(0, ${svgHeight - padding.bottom})`}
          />
          <GridLine
            type="vertical"
            scale={xScaleFreq}
            tickValues={[
              40, 60, 80, 120, 140, 160, 180, 400, 600, 800, 1200, 1400, 1600,
              1800, 4000, 6000, 8000, 12000, 14000, 16000, 18000,
            ]}
            size={svgHeight - padding.bottom - 20}
            transform={`translate(0, ${svgHeight - padding.bottom - 10})`}
          />
          <GridLine
            type="horizontal"
            scale={yScaleGain}
            tickValues={yGridTickValues}
            size={plotWidth}
            transform={`translate(${padding.left}, 0)`}
          />
          <GridLine
            type="horizontal"
            scale={yScaleGain}
            tickValues={[0]}
            size={plotWidth}
            // Unity gain is a reference, not a measurement, so it reads as a
            // brighter grid line rather than as another coloured curve. It was
            // pink, which put a fourth near-identical magenta on a chart that
            // already had three.
            color="rgba(255, 255, 255, 0.22)"
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
          top={padding.top}
          plotHeight={plotHeight}
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
        {data.map((e: IChartCurveData) => (
          <Curve key={e.id} data={e} xScale={xScaleFreq} yScale={yScaleGain} />
        ))}
        {editablePoints.map((point) => (
          <EditablePoint
            key={point.id}
            point={point}
            svgRef={svgRef}
            xScale={xScaleFreq}
            yScale={yScaleGain}
          />
        ))}
        <clipPath id="chart-clip-path">
          <rect x={padding.left} y={0} width={plotWidth} height={plotHeight} />
        </clipPath>
        {/* The scales, in the same group as the lines they label. A decibel axis
          beside a plot with no grid is a ruler with no marks on it. */}
        <g className="chart-grid">
          <Axis
            type="left"
            scale={yScaleGain}
            transform={`translate(${padding.left}, 0)`}
            tickValues={yAxisTickValues}
            tickFormat={yTickFormat}
          />
          <Axis
            type="bottom"
            scale={xScaleFreq}
            transform={`translate(0, ${svgHeight - padding.bottom})`}
            tickValues={[20, 100, 200, 1000, 2000, 10000, 20000]}
            tickFormat={xTickFormat}
          />
        </g>
      </svg>
    </>
  );
};

export default Chart;
