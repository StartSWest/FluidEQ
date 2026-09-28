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

import { type PointerEvent, useRef } from 'react';
import type { AxisScale, NumberValue } from 'd3';
import { MIN_GAIN } from 'common/constants';
import { balanceRangeName } from '../utils/autoBalanceNarration';
import { useSmartEqMeasurement } from '../audio/smartEqMeasurement';
import { useGraphCoverageHidden } from '../utils/graphStyle';
import {
  getPresenceLine,
  hasCustomPresenceRange,
  movePresenceRange,
  presenceAllowance,
  resetPresenceRange,
  setPresenceLine,
  usePresenceLines,
} from '../utils/presenceThreshold';
import { useSmartEqMode } from '../utils/smartEqMode';
import {
  DEFAULT_CORRECTION_LIMIT_DB,
  setCorrectionLimit,
  useCorrectionLimit,
} from '../utils/correctionLimit';
import { useTranslation } from '../utils/I18nContext';

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
  eqScale,
  top,
  plotHeight,
  isResponseHidden,
  isOverScene,
}: {
  xScale: AxisScale<NumberValue>;
  yScale: AxisScale<NumberValue>;
  /**
   * The EQ's own axis (`eqGainScale`), for the correction limit: that is a
   * band gain, drawn against the curves, where the presence lines are music
   * levels drawn against the analyser.
   */
  eqScale: AxisScale<NumberValue>;
  top: number;
  plotHeight: number;
  /** No response layers are being presented, so their listening bands go too. */
  isResponseHidden: boolean;
  /**
   * A Plus visualizer owns the plot. Its picture is the thing being watched,
   * so the shaded columns and their lines stay off it, whatever the switch
   * says — and the switch itself is taken off the strip and greyed in the
   * View menu while one is on, so nothing offers what would not appear.
   */
  isOverScene: boolean;
}) => {
  // What Smart EQ is hearing of the source, published by the measurement
  // itself rather than by the loopback the graph draws — the two are
  // different sounds now (`smartEqMeasurement.ts`).
  const {
    progress: balanceProgress,
    presenceLevels,
    presenceTypical,
  } = useSmartEqMeasurement();
  // The region labels arriving with the measurement are identifiers, not words
  // — they key the flash store and are React keys down here — so the caption
  // localises them at the point it says them, through the same lookup the
  // Smart EQ bubble uses.
  const { t } = useTranslation();
  // The shaded columns only. The bars along the foot are drawn either way — see
  // `useGraphCoverageHidden` for why the switch stops short of them.
  const isWashHidden = useGraphCoverageHidden() || isOverScene;
  const coverage = balanceProgress?.regions;
  // Read so a drag anywhere re-renders every line, since one store holds them
  // all. The values themselves are taken through `getPresenceLine`, which knows
  // where an unset edge's default goes and which mode is asking.
  usePresenceLines();
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
  /** The last ranges seen, so they can fade rather than vanish. */
  const lastCoverage = useRef<typeof coverage>(undefined);

  /**
   * Where a pointer sits, in the chart's own decibels.
   *
   * Read off the owning `<svg>` rather than the group, because the group is
   * translated by the margins and `getBoundingClientRect` on an SVG group
   * reports the union of what it draws — which changes as the lines move, so a
   * drag computed against it would chase itself.
   */
  const dbAt = (
    event: { clientY: number; currentTarget: SVGElement },
    scale: AxisScale<NumberValue> = yScale,
  ) => {
    const svg = event.currentTarget.ownerSVGElement;
    if (!svg) {
      return undefined;
    }
    const y = event.clientY - svg.getBoundingClientRect().top;
    const { invert } = scale as unknown as { invert?: (v: number) => number };
    return typeof invert === 'function' ? invert(y) : undefined;
  };

  /**
   * A drag ends when the pointer lifts, and also when the system takes the
   * pointer away: a touch turned into a scroll, a pen lifted out of range,
   * the window losing the pointer. Ended on the lift alone, a cancelled drag
   * stayed armed, and the next pass of the pointer over the same strip moved
   * the line with no button held.
   */
  const endDrag = (event: PointerEvent<SVGRectElement>) => {
    dragging.current = undefined;
    dragFrom.current = undefined;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
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
  /*
   * FADED OUT, NOT SNATCHED AWAY.
   *
   * Coverage vanishes the moment the music stops — a silent capture reports no
   * ranges — and nine full-height columns disappearing between one frame and
   * the next reads as a glitch rather than as a state changing. Pausing a track
   * should not look like the app dropping something.
   *
   * So the last ranges are held while the group fades, and only then let go.
   * Held in a ref rather than in state on purpose: this component renders at
   * frame rate, and the retained copy must not be a second reason to re-render
   * — it is read during a render that was already happening.
   */
  // Gone is also untouchable. The group fades rather than unmounting, and
  // its grab strips each declare their own pointer events — which is why a
  // limit line nobody could see was still following a drag across the wave.
  // Every strip reads this and switches its events off with the picture.
  const isGone = isResponseHidden || !coverage?.length;
  if (coverage?.length) {
    lastCoverage.current = coverage;
  }
  const shown = coverage?.length ? coverage : lastCoverage.current;
  if (!shown?.length) {
    return null;
  }
  return (
    <g
      className={`chart-coverage${isGone ? ' is-leaving' : ''}`}
      pointerEvents="none"
    >
      {shown.map((region, index) => {
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
        const resetLabel = t('eq.smart.presence.reset', {
          range: balanceRangeName(region.label, t),
        });
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
                    pointerEvents={isGone ? 'none' : 'all'}
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
                    onPointerUp={endDrag}
                    onPointerCancel={endDrag}
                    onLostPointerCapture={endDrag}
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
                      pointerEvents={isGone ? 'none' : 'all'}
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={() => resetPresenceRange(region.label)}
                      // The app's tooltip, where an SVG <title> was the
                      // system's (`utils/tooltipLayer.ts`).
                      data-tooltip={resetLabel}
                      aria-label={resetLabel}
                    >
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
                          pointerEvents={isGone ? 'none' : 'all'}
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
                          onPointerUp={endDrag}
                          onPointerCancel={endDrag}
                          onLostPointerCapture={endDrag}
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
             * ONE BAR, FILLING LEFT TO RIGHT: how much of this range has been
             * heard. It is the whole of why a correction has not landed yet —
             * a running mode solves from the source and writes the moment the
             * estimate settles, so there is no second condition and no
             * quiet period to count down. A second bar and a countdown stood
             * here while there was a loop with a deadband to wait out.
             */}
          </g>
        );
      })}
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
            Number(eqScale(side * correctionLimit)),
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
                pointerEvents={isGone ? 'none' : 'all'}
                onPointerDown={(event) => {
                  event.stopPropagation();
                  dragging.current = 'limit';
                  event.currentTarget.setPointerCapture(event.pointerId);
                }}
                onPointerMove={(event) => {
                  if (dragging.current !== 'limit') {
                    return;
                  }
                  const db = dbAt(event, eqScale);
                  if (db !== undefined) {
                    // The magnitude, whichever half was grabbed. Dragging the
                    // lower line down and the upper one up both mean "allow
                    // more", which is the only reading that survives being one
                    // symmetric number.
                    setCorrectionLimit(Math.abs(db));
                  }
                }}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                onLostPointerCapture={endDrag}
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

export default CoverageOverlay;
