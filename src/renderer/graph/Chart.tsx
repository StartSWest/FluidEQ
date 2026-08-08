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
  movePresenceRange,
  presenceAllowance,
  resetPresenceRange,
  setPresenceLine,
  usePresenceLines,
} from '../utils/presenceThreshold';
import { balanceRangeName } from '../utils/autoBalance';
import {
  DISAGREEMENT_DEADBAND_DB,
  getSmartEqQuietUntil,
  useSmartEqDisagreement,
} from '../utils/smartEqDisagreement';
import { useSmartEqMode } from '../utils/smartEqMode';
import {
  DEFAULT_CORRECTION_LIMIT_DB,
  setCorrectionLimit,
  useCorrectionLimit,
} from '../utils/correctionLimit';
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
 * The gutters the scales live in, inside the chart's own box.
 *
 * Fifty pixels down the left for the decibel labels and thirty along the bottom
 * for the frequency marks; the ten at the top is half a line of headroom, since
 * axis labels are centred on their tick and the topmost one (+20 dB) would
 * otherwise be cut in half by the viewport.
 *
 * Named and exported because they are the plot's real edges, and the level
 * meter has to stand on the same ones — it hangs off the card rather than off
 * the chart, so without this it would be a second copy of these four numbers
 * drifting quietly out of step with the first.
 */
const GRID_AXIS_PADDING: IMarginLike = {
  left: 50,
  top: 10,
  right: 0,
  bottom: 30,
};

/**
 * With the grid off there is nothing in any of the gutters, so the wave runs
 * edge to edge instead.
 */
const NO_AXIS_PADDING: IMarginLike = {
  left: 0,
  top: 0,
  right: 0,
  bottom: 0,
};

export const getAxisPadding = (isGridHidden: boolean): IMarginLike =>
  isGridHidden ? NO_AXIS_PADDING : GRID_AXIS_PADDING;

/**
 * Red at nothing earned, green at everything, blended in between.
 *
 * The same two colours the lines are drawn in and in the same order, so the
 * column, the ramp and the two rules all read as one idea rather than three
 * decorations. Mixed here rather than in CSS because it varies per range and
 * per frame, and a class per percentage is not a thing.
 */
const PRESENCE_TINT_LOW = [255, 90, 110];
const PRESENCE_TINT_HIGH = [84, 255, 138];

/**
 * Keep a drawn y inside the plot.
 *
 * The lines themselves are held to the axis range by the store, but the live
 * level is a real measurement and goes where the music goes — several hundred
 * decibels down during silence, which puts the mark and its caption far outside
 * the plot and over whatever else is on the page. Clamping the DRAWN position
 * only: the allowance is computed from the true level, so a range below the
 * bottom of the axis still reads as earning nothing rather than as sitting on
 * the axis minimum.
 */
const clampToPlot = (y: number, top: number, bottom: number): number => {
  if (!Number.isFinite(y)) {
    return bottom;
  }
  return Math.max(top, Math.min(bottom, y));
};

const presenceTint = (allowance: number): string => {
  const t = Math.max(0, Math.min(1, allowance));
  const channel = (index: number) =>
    Math.round(
      PRESENCE_TINT_LOW[index] +
        (PRESENCE_TINT_HIGH[index] - PRESENCE_TINT_LOW[index]) * t,
    );
  return `rgb(${channel(0)}, ${channel(1)}, ${channel(2)})`;
};

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
  const { balanceProgress, presenceLevels, presenceTypical } =
    useLiveAudioFrame();
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
  // The other half of why a correction has not landed yet. See its store.
  const disagreement = useSmartEqDisagreement();
  /*
   * Seconds until the quiet window closes, recomputed every render.
   *
   * Free to derive rather than tick on its own timer: this component already
   * re-renders on every frame the capture publishes, so the number is current
   * without a second clock to start, stop and forget to clear.
   */
  const secondsLeft = Math.max(
    0,
    Math.ceil((getSmartEqQuietUntil() - Date.now()) / 1000),
  );
  // How far Smart EQ may move any band, drawn as one symmetric pair.
  const correctionLimit = useCorrectionLimit();
  // Each mode keeps its own pair, so a mode change moves every line on screen.
  // Subscribed here rather than read once, because nothing else in this
  // component would notice.
  useSmartEqMode();
  // `range:edge`, because two lines in the same range are both grabbable and
  // the pointer has to be told which one it caught. `range:both` is the gap
  // between them, which slides the pair.
  const dragging = useRef<string | undefined>(undefined);
  /** Last pointer position of a pair drag, in decibels. See its use. */
  const dragFrom = useRef<number | undefined>(undefined);

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
      {coverage.map((region, index) => {
        const left = Number(xScale(region.lowFrequency));
        const right = Number(xScale(region.highFrequency));
        const width = Math.max(0, right - left - 2);
        const height = Math.max(0, plotHeight - top);
        // Geometric centre, which is what the range's own `centreFrequency`
        // is — recomputed here rather than carried through the progress report,
        // since only the default placement needs it.
        const centre = Math.sqrt(region.lowFrequency * region.highFrequency);
        // Where this range typically sits, which is what the lines place
        // themselves from. Fast copy first, so a drag is judged against the
        // same number the detector is using this frame.
        const typicalDb = presenceTypical?.[index] ?? region.typicalDb;
        const floorDb = getPresenceLine(
          'floor',
          region.label,
          centre,
          typicalDb,
        );
        const fullDb = getPresenceLine('full', region.label, centre, typicalDb);
        const floorY = clampToPlot(Number(yScale(floorDb)), top, plotHeight);
        const fullY = clampToPlot(Number(yScale(fullDb)), top, plotHeight);
        /*
         * The fast copy of this range's level when there is one.
         *
         * The progress report is rebuilt once a second, which is right for
         * coverage — a fact about the whole session — and far too slow for a
         * mark that is showing the music. At that rate it lurches. The frame
         * carries the same nine numbers on every tick.
         */
        const liveDb = presenceLevels?.[index] ?? region.liveDb;
        // Allowance from the true level, so a range far below the plot still
        // reads as zero rather than as whatever the bottom of the axis is.
        const allowance = presenceAllowance(liveDb, floorDb, fullDb);
        const liveY = clampToPlot(Number(yScale(liveDb)), top, plotHeight);
        /*
         * FOUR STATES, AND THE FIRST OF THEM IS DRAWING NOTHING.
         *
         * A silent range sits hundreds of decibels down. Clamping it to the
         * bottom of the plot put a mark there, and a mark is a reading — it
         * says "this range is at the axis minimum", which is not what happened.
         * Nothing playing is better said by nothing drawn.
         *
         * Below the floor it is faint: present, and not trusted to rise. Inside
         * the ramp it is solid, which is the state worth having a word for —
         * the range is being listened to and earning part of its correction.
         * Above the full line it is bright and has everything.
         *
         * It stays visible below the floor rather than disappearing there,
         * which was the other suggestion and is the one thing that would undo
         * the point of drawing it at all: if the mark vanished under the red
         * line, "not corrected because this range is quiet" and "no data"
         * would look identical, and the first of those is the answer somebody
         * came to the graph for.
         */
        const isLiveDrawn = Number.isFinite(liveDb) && liveDb >= MIN_GAIN;
        const liveState =
          // eslint-disable-next-line no-nested-ternary
          liveDb >= fullDb
            ? 'trusted'
            : liveDb > floorDb
              ? 'listening'
              : 'idle';
        return (
          <g key={region.label}>
            {/*
             * TWO CHANNELS, TWO QUESTIONS, AND THEY ARE GENUINELY DIFFERENT.
             *
             * Opacity is confidence: how much of this range we have heard over
             * the session. Hue is allowance: how much boost it has earned RIGHT
             * NOW, which is what the two lines decide. A range can be thoroughly
             * known and momentarily silent — that is a bright red column, and it
             * is exactly the guitar-intro case this exists for.
             *
             * Colouring it is what turns the rule from something to understand
             * into something to look at. The lines alone describe a rule and
             * leave somebody to imagine where the sound sits against it.
             */}
            {!isWashHidden && (
              <rect
                className="chart-coverage__column"
                x={left + 1}
                y={top}
                width={width}
                height={height}
                fill={presenceTint(allowance)}
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
                    pointerEvents="all"
                    onPointerDown={(event) => {
                      event.stopPropagation();
                      const db = dbAt(event);
                      if (db === undefined) {
                        return;
                      }
                      dragging.current = `${region.label}:both`;
                      dragFrom.current = db;
                      event.currentTarget.setPointerCapture(event.pointerId);
                    }}
                    onPointerMove={(event) => {
                      if (dragging.current !== `${region.label}:both`) {
                        return;
                      }
                      const db = dbAt(event);
                      if (db === undefined || dragFrom.current === undefined) {
                        return;
                      }
                      /*
                       * Against the last position rather than the first.
                       *
                       * A delta from where the drag started would have to be
                       * applied to the values as they were when it started, and
                       * those are not what the store holds after the first
                       * move. Stepping from the previous position keeps the
                       * pair following the pointer exactly, including through
                       * the clamp at either end of the axis.
                       */
                      movePresenceRange(
                        region.label,
                        db - dragFrom.current,
                        centre,
                        typicalDb,
                      );
                      dragFrom.current = db;
                    }}
                    onPointerUp={(event) => {
                      dragging.current = undefined;
                      dragFrom.current = undefined;
                      event.currentTarget.releasePointerCapture(
                        event.pointerId,
                      );
                    }}
                  />
                  {/*
                   * Where this range is, right now.
                   *
                   * The one thing the two lines could not say. They describe a
                   * rule and leave somebody to imagine the sound's position
                   * against it — which is the whole of why the arrangement was
                   * confusing. A mark at the live level removes the imagining:
                   * during a solo passage you watch the bass mark drop under
                   * its red line and the column go red with it, and when the
                   * band comes back in you watch it climb the ramp.
                   *
                   * Wider than the lines and drawn over them, because it is the
                   * measurement and they are only settings.
                   */}
                  {isLiveDrawn && (
                    <line
                      className={`chart-presence__live is-${liveState}`}
                      x1={left + 1}
                      x2={left + 1 + width}
                      y1={liveY}
                      y2={liveY}
                      stroke={presenceTint(allowance)}
                    />
                  )}
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
                       * No hit pad of its own any more. It had one — a wide
                       * invisible band across the middle of the ramp — for a
                       * good reason: a small circle that is transparent until
                       * you are on it is reachable but not aimable, which from
                       * the pointer's side is the same problem.
                       *
                       * The ramp now takes the pointer itself, so hovering
                       * anywhere in the gap brings the button up, and the pad
                       * had become the one part of the gap that could not be
                       * dragged — a dead stripe through the middle of the very
                       * thing it was sitting on.
                       */}
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
                      <g
                        key={edge}
                        // Its own dragging flag, so the caption that follows a
                        // drag is the dragged line's and only that one.
                        className={`chart-presence--${edge}${
                          dragging.current === dragKey ? ' is-dragging' : ''
                        }`}
                      >
                        <line
                          className="chart-presence__line"
                          x1={left + 1}
                          x2={left + 1 + width}
                          y1={y}
                          y2={y}
                        />
                        {/*
                         * Named and numbered on approach, so a drag is aimed
                         * rather than guessed at. Hidden until then — eighteen
                         * captions standing permanently over the trace would be
                         * far worse than none.
                         *
                         * TWO LINES, because SVG text does not wrap and a range
                         * is only as wide as its own slice of the spectrum. On
                         * one line the caption ran clean out of its band and
                         * across its neighbours, so the label for the treble
                         * was sitting over the mids, which is worse than
                         * useless: it attaches a number to the wrong range.
                         *
                         * The range name goes above and the rule below, since
                         * the name is what identifies the caption and the rule
                         * is what you read once you have found it.
                         */}
                        <text
                          className="chart-presence__label"
                          x={left + 1 + width / 2}
                          // Both lines above the line they describe, and not
                          // above the plot: a line dragged to the ceiling would
                          // otherwise caption itself outside the chart.
                          y={Math.max(top + 10, y - 16)}
                          textAnchor="middle"
                        >
                          <tspan x={left + 1 + width / 2}>
                            {balanceRangeName(region.label, t)}
                          </tspan>
                          <tspan x={left + 1 + width / 2} dy="1.15em">
                            {t(
                              edge === 'floor'
                                ? 'eq.smart.presence.ignoredBelow'
                                : 'eq.smart.presence.trustedAbove',
                              { db: db.toFixed(0) },
                            )}
                          </tspan>
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
                              setPresenceLine(
                                edge,
                                region.label,
                                next,
                                centre,
                                typicalDb,
                              );
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
            {/*
             * The bar fills at the rate the presence gate allows, so it is
             * tinted by that gate. Two readings of one fact rather than two
             * facts: a range under its floor teaches nothing, so its bar stops
             * growing, and now it says why by turning the same red as its
             * column and its mark.
             */}
            <rect
              className={`chart-coverage__fill${
                region.isCovered ? ' is-covered' : ''
              }`}
              x={left + 1}
              y={plotHeight - 6}
              width={width * Math.min(1, region.confidence)}
              height={4}
              rx={2}
              fill={region.isCovered ? undefined : presenceTint(allowance)}
            />
            {/*
             * TWO CONDITIONS, TWO BARS, BOTH FILLING LEFT TO RIGHT.
             *
             * The bar below says how much of this range has been heard. Alone
             * it is the misleading half of the answer: a range can be entirely
             * heard and still sit there doing nothing, because being heard is
             * not the same as having something to say. A write also needs the
             * disagreement to clear the settle deadband, and without that on
             * screen a full bar beside a correction that never comes looks like
             * a fault.
             *
             * This was a two-pixel tick sliding along the same bar, and it told
             * nobody anything — a mark whose POSITION carries the meaning needs
             * a scale to be read against, and there was none. A second bar that
             * fills has the scale built in: full is full. Two bars, both full,
             * means the only thing left to wait for is the quiet period.
             *
             * AND A COUNTDOWN ONCE BOTH ARE FULL, which was refused twice
             * before this and is right now. The objection — that evidence and
             * disagreement depend on what the music does next, so a clock
             * against either invents a schedule nobody can keep — only holds
             * while one of them is outstanding. Once both are met, time is
             * genuinely the only thing left, and saying how much of it remains
             * promises nothing that cannot be delivered.
             *
             * So the seconds appear exactly when they become true, and not one
             * moment earlier.
             */}
            <rect
              className="chart-coverage__gap-track"
              x={left + 1}
              y={plotHeight - 12}
              width={width}
              height={3}
              rx={1.5}
            />
            <rect
              className={`chart-coverage__gap${
                disagreement[region.label] >= DISAGREEMENT_DEADBAND_DB
                  ? ' is-past'
                  : ''
              }`}
              x={left + 1}
              y={plotHeight - 12}
              width={
                width *
                Math.min(
                  1,
                  (disagreement[region.label] ?? 0) / DISAGREEMENT_DEADBAND_DB,
                )
              }
              height={3}
              rx={1.5}
            >
              <title>
                {t('eq.smart.gap.title', {
                  range: balanceRangeName(region.label, t),
                })}
              </title>
            </rect>
          </g>
        );
      })}
      {/*
       * ONE COUNTDOWN, NOT ONE PER RANGE, because there is one thing being
       * waited for.
       *
       * It was drawn over every ready range and read as nine independent
       * timers that all happened to agree, which is a strange thing for a
       * picture to say. The wait is global because what it rations is global: a
       * write rewrites the whole config and Equalizer APO reloads all of it, so
       * nine windows would be nine reloads.
       *
       * What is NOT waited on is the other ranges. Only the ranges with
       * something to say are written, and a range that is ready is never held
       * back by one that is not — which the bars above already show, range by
       * range. This says the remaining thing: when the next write may happen.
       */}
      {secondsLeft > 0 &&
        coverage.some(
          (region) =>
            region.isCovered &&
            (disagreement[region.label] ?? 0) >= DISAGREEMENT_DEADBAND_DB,
        ) && (
          <text
            className="chart-coverage__countdown"
            x={Number(xScale(20000)) - 6}
            y={plotHeight - 16}
            textAnchor="end"
          >
            {t('eq.smart.gap.countdown', { seconds: secondsLeft })}
          </text>
        )}
      {/*
       * HOW MUCH, AND NO MORE THAN THIS.
       *
       * One pair across the whole plot rather than a pair per range, because it
       * is one decision: Smart EQ may move any band this far and no further.
       * The presence lines are per range because presence is a fact about a
       * range; this is a preference about the feature.
       *
       * Symmetric, and drawn that way so it cannot be misread. It used to be
       * +6 up and −9 down, which sounds prudent — a boost costs headroom and a
       * cut does not — and quietly biased every correction downward: the anchor
       * removes the mean, then the tighter side truncates first, so what is
       * applied carries a mean nobody asked for. Two hundred passes of that is
       * a record that ends the evening quieter than it started.
       *
       * Dragging either half moves both, because they are one number. A control
       * that let them differ would be offering the bias back.
       */}
      {!isWashHidden &&
        ([1, -1] as const).map((side) => {
          const y = clampToPlot(
            Number(yScale(side * correctionLimit)),
            top,
            plotHeight,
          );
          const edge = Number(xScale(20000));
          return (
            <g className="chart-limit" key={side}>
              <line
                className="chart-limit__line"
                x1={0}
                x2={edge}
                y1={y}
                y2={y}
              />
              <text
                className="chart-limit__label"
                x={edge - 6}
                y={side > 0 ? y - 4 : y + 12}
                textAnchor="end"
              >
                {t('eq.smart.limit.label', { db: correctionLimit.toFixed(0) })}
              </text>
              <rect
                className="chart-limit__grab"
                x={0}
                y={y - PRESENCE_GRAB_PX}
                width={Math.max(0, edge)}
                height={PRESENCE_GRAB_PX * 2}
                pointerEvents="all"
                onPointerDown={(event) => {
                  event.stopPropagation();
                  dragging.current = 'limit';
                  event.currentTarget.setPointerCapture(event.pointerId);
                }}
                onPointerMove={(event) => {
                  if (dragging.current !== 'limit') {
                    return;
                  }
                  const db = dbAt(event);
                  if (db !== undefined) {
                    // The magnitude, whichever half was grabbed. Dragging the
                    // lower line down and the upper one up both mean "allow
                    // more", which is the only reading that survives being one
                    // symmetric number.
                    setCorrectionLimit(Math.abs(db));
                  }
                }}
                onPointerUp={(event) => {
                  dragging.current = undefined;
                  event.currentTarget.releasePointerCapture(event.pointerId);
                }}
                onDoubleClick={() =>
                  setCorrectionLimit(DEFAULT_CORRECTION_LIMIT_DB)
                }
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

  const padding = useMemo(() => getAxisPadding(isGridHidden), [isGridHidden]);

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
