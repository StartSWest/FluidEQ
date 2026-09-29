/*
<FluidEQ: System-wide parametric audio equalizer interface>
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
  canGraphGlow,
  type Projected,
  resolveGraphPalette,
} from 'common/graphStyles';
import { getEaseFactor } from 'common/smoothing';
import {
  createGraphAccent,
  type createGraphScatter,
  createGraphShape,
  createSkylineTowers,
  getGlowStyle,
  getGraphPeaks,
  toColumns,
} from 'common/graphShapes';
import { DEFAULT_GLOW } from 'common/customLooks';
import { type RefObject } from 'react';
import {
  GLOW_ATTACK_MS,
  GLOW_FLOOR,
  GLOW_REACH,
  GLOW_RELEASE_MS,
  GLOW_WIDTH_FLOOR,
  GLOW_WIDTH_REACH,
  OPACITY_EPSILON,
  PRESENTATION_SETTLE_MS,
  setAlpha,
  STROKE_WIDTH_EPSILON,
  TRACE_BLUR_RAINBOW,
  TRACE_GLOW_RAINBOW,
  TRACE_WIDTH_CYAN,
  TRACE_WIDTH_RAINBOW,
  traceGlowCyan,
} from './liveTraceStyle';
import { hasGraphMotion, type IGraphMotionState } from './graphMotion';
import { advanceBubbleStorm, type IBolt } from './bubbleStorm';
import {
  advanceGraphAccent,
  createAccentState,
  type IAccentState,
  paintGraphAccent,
} from './graphAccents';
import {
  getWaveTransform,
  type IEuphoriaPaint,
  isEuphoriaFigureStroke,
  isSelfColouredLook,
  resolveAccentStroke,
  resolveFigureStrokeWidth,
  resolvePresentedStrokeWidth,
  TracePaint,
} from './liveTracePaint';
import { lookPaintColours } from '../utils/windowInk';
import { CAVE_ROCK_COLOURS, type createCaveDripsPaths } from './caveDrips';
import { ARCADE_SKY_COLOURS, type createStoneArcadePaths } from './stoneArcade';
import { type createBonfirePaths, FIRE_COLOURS } from './bonfire';
import { type createRainstormPaths, STORM_CLOUD_COLOURS } from './rainstorm';
import {
  type createCountryFencePaths,
  FENCE_WOOD_COLOURS,
} from './countryFence';
import { cityTowerColours, type createCitySkylinePaths } from './citySkyline';
import { designedSceneOf } from './engineLooks/designed/designedLooks';
import { bubbleLayout } from './bubblePaths';
import {
  type createCabinetFramePaths,
  type InvaderCabinet,
  shelterRects,
} from './invaderCabinet';
import { SHIP_LANE, type SpaceInvasion } from './spaceInvasion';
import { heatColour } from './lookColours';
import {
  type createPulsePaths,
  type IEcho,
  pulseGridCell,
} from './pulseMonitor';
import { type createEchoWavePaths } from './echoWaves';
import { type createRoadTripPaths } from './roadTrip';
import { type createTrussBridgePaths } from './trussBridgeLayout';
import { type createWarpTunnelPaths } from './warpTunnel';
import { type createSpaceInvasionPaths } from './spaceInvasionLayout';
import { type ILiveCurveData } from './ChartController';
import { type ILookTuning, type IResolvedLook } from '../../common/customLooks';
import { type createBubbleMotePaths } from './bubbleMotes';
import { type createTerraceValleyPaths } from './terraceValley';
import { type createSlopeFieldPaths } from './slopeField';
import createSlopeFlow from './slopeFlow';

// How the live graph's figure is presented this frame: how much of it is
// filled, the halo's beat, the accent's peaks, the opacity and weight
// eased toward where they belong, the palette and each scene's own
// colours, the stroke, the lit peaks and a designed look's layers.

interface IPresentFigureInput {
  projected: [number, number][];
  baseline: number;
  depth: number;
  tuning: ILookTuning;
  chosen:
    | 'line'
    | 'area'
    | 'bars'
    | 'dots'
    | 'steps'
    | 'blocks'
    | 'spikes'
    | 'ridge'
    | 'stems'
    | 'terrace'
    | 'dashes'
    | 'scatter'
    | 'caps'
    | 'ribs'
    | 'pillars'
    | 'crown'
    | 'weave'
    | 'contour'
    | 'hatch'
    | 'matrix'
    | 'skyline'
    | 'bezier'
    | 'ribbon'
    | 'feather'
    | 'truss'
    | 'zipper'
    | 'slope'
    | 'stalactites'
    | 'bubbles'
    | 'diamonds'
    | 'sawtooth'
    | 'ecg'
    | 'echo'
    | 'racer'
    | 'invaders'
    | 'starfield'
    | 'candles'
    | 'arches'
    | 'flames'
    | 'barcode'
    | 'rain'
    | 'honeycomb'
    | 'fence'
    | 'braid'
    | 'stitch'
    | 'canyon'
    | 'fluid'
    | 'wave-line'
    | 'wave-filled'
    | 'wave-bars'
    | 'wave-mirror'
    | 'wave-dots'
    | 'wave-ribbon'
    | 'wave-spikes'
    | 'wave-blocks'
    | 'wave-outline'
    | 'wave-lattice';
  pumpRef: RefObject<number>;
  motionDeltaMs: number;
  moving: boolean;
  pulsePaths: ReturnType<typeof createPulsePaths> | undefined;
  echoPaths: ReturnType<typeof createEchoWavePaths> | undefined;
  roadPaths: ReturnType<typeof createRoadTripPaths> | undefined;
  trussPaths: ReturnType<typeof createTrussBridgePaths> | undefined;
  shape: string;
  isFilled: boolean;
  isFluidForm: boolean;
  figure: Path2D;
  fluidWaveRef: RefObject<number[]>;
  plot: { left: number; right: number; top: number; bottom: number };
  warpPaths: ReturnType<typeof createWarpTunnelPaths> | undefined;
  firePaths: ReturnType<typeof createBonfirePaths> | undefined;
  arcadePaths: ReturnType<typeof createStoneArcadePaths> | undefined;
  invasionPaths: ReturnType<typeof createSpaceInvasionPaths> | undefined;
  cavePaths: ReturnType<typeof createCaveDripsPaths> | undefined;
  stormPaths: ReturnType<typeof createRainstormPaths> | undefined;
  fencePaths: ReturnType<typeof createCountryFencePaths> | undefined;
  bubbleStormRef: RefObject<{
    levels: number[];
    beatLevel: number;
    trackedAt: number;
    pops: Map<number, number>;
    bolts: IBolt[];
    shakeAt: number;
    shakeStrength: number;
  }>;
  motionRef: RefObject<IGraphMotionState>;
  playingRef: RefObject<boolean>;
  figurePoints: Projected[];
  sceneBase: number;
  sceneTop: number;
  blinkingSatellites: boolean | undefined;
  scatter: ReturnType<typeof createGraphScatter> | undefined;
  accentStateRef: RefObject<IAccentState>;
  deltaMs: number;
  curves: ILiveCurveData[];
  shownOpacityRef: RefObject<number>;
  isForegroundRef: RefObject<boolean>;
  shownStrokeWidthRef: RefObject<number>;
  lookRef: RefObject<IResolvedLook>;
  isEuphoric: boolean;
  euphoria: IEuphoriaPaint;
  context: CanvasRenderingContext2D;
  isEngineTaking: boolean;
  motePaths: ReturnType<typeof createBubbleMotePaths> | undefined;
  cabinetFrame: ReturnType<typeof createCabinetFramePaths> | undefined;
  invaderCabinetRef: RefObject<InvaderCabinet>;
  invasionRef: RefObject<SpaceInvasion>;
  invasionClockRef: RefObject<number>;
  valleyPaths: ReturnType<typeof createTerraceValleyPaths> | undefined;
  valleyColumns: Projected[] | undefined;
  terraceJumper: { x: number; y: number; direction: number } | undefined;
  cityPaths: ReturnType<typeof createCitySkylinePaths> | undefined;
  piecePaths: { path: Path2D; energy: number }[] | undefined;
  fieldPaths: ReturnType<typeof createSlopeFieldPaths> | undefined;
  slopeFlow: ReturnType<typeof createSlopeFlow> | undefined;
  fieldColumns: Projected[] | undefined;
  pulseMonitorRef: RefObject<{
    beatLevel: number;
    trackedAt: number;
    thumpAt: number;
    thumpStrength: number;
    echoes: IEcho[];
  }>;
  pulseGrid: { fine: Path2D; heavy: Path2D } | undefined;
  width: number;
  height: number;
}

/**
 * Everything the curve pass paints the figure with, worked out for this
 * frame; `moving` stays raised while the opacity or weight is still easing.
 */
const presentFigure = ({
  projected,
  baseline,
  depth,
  tuning,
  chosen,
  pumpRef,
  motionDeltaMs,
  moving: movingIn,
  pulsePaths,
  echoPaths,
  roadPaths,
  trussPaths,
  shape,
  isFilled,
  isFluidForm,
  figure,
  fluidWaveRef,
  plot,
  warpPaths,
  firePaths,
  arcadePaths,
  invasionPaths,
  cavePaths,
  stormPaths,
  fencePaths,
  bubbleStormRef,
  motionRef,
  playingRef,
  figurePoints,
  sceneBase,
  sceneTop,
  blinkingSatellites,
  scatter,
  accentStateRef,
  deltaMs,
  curves,
  shownOpacityRef,
  isForegroundRef,
  shownStrokeWidthRef,
  lookRef,
  isEuphoric,
  euphoria,
  context,
  isEngineTaking,
  motePaths,
  cabinetFrame,
  invaderCabinetRef,
  invasionRef,
  invasionClockRef,
  valleyPaths,
  valleyColumns,
  terraceJumper,
  cityPaths,
  piecePaths,
  fieldPaths,
  slopeFlow,
  fieldColumns,
  pulseMonitorRef,
  pulseGrid,
  width,
  height,
}: IPresentFigureInput) => {
  let moving = movingIn;
  /**
   * How much of the plot the figure is filling, which is the loudness.
   *
   * Read from the points already projected for the drawing rather than
   * measured again, so it is one pass over an array still in cache.
   *
   * Hoisted out of the euphoria branch below because two things want it
   * now: the halo, which pumps with it, and the `heat` palette, whose
   * entire colour IS it. Left inside, heat would have been cyan forever
   * outside the mode — a palette that only works in euphoria is not a
   * palette, it is part of euphoria.
   */
  let filled = 0;
  for (let index = 0; index < projected.length; index += 1) {
    filled += baseline - projected[index][1];
  }
  const energy = Math.max(0, Math.min(1, filled / (projected.length * depth)));

  let halo: Path2D | undefined;
  let lit = 0;
  let swell = 0;
  // The glow is a look's own setting in any mode. It used to need rainbow
  // mode, which made the Glow slider a dead control everywhere else and
  // tied a light that is the figure's own colour to a mode about hue.
  if (tuning.glow > 0 && canGraphGlow(chosen)) {
    // Snap up, sag back. See the ballistics above for why the two differ by
    // two orders of magnitude.
    const gap = energy - pumpRef.current;
    pumpRef.current +=
      gap *
      getEaseFactor(motionDeltaMs, gap > 0 ? GLOW_ATTACK_MS : GLOW_RELEASE_MS);
    // Still settling counts as motion, or the loop would stop with the glow
    // halfway down and leave it stuck there until the next measurement.
    if (gap > 0.002 || gap < -0.002) {
      moving = true;
    }
    lit = (GLOW_FLOOR + pumpRef.current * GLOW_REACH) * tuning.glow;
    swell = GLOW_WIDTH_FLOOR + pumpRef.current * GLOW_WIDTH_REACH;

    // The silhouette light comes off, which for most forms is not the form
    // — see `getGlowStyle`. Reused rather than rebuilt when the two are the
    // same shape, which is the common case for the simple forms.
    // The monitor has no string to measure; its trace is simple enough
    // for the light to follow the real thing.
    const glowStyle = getGlowStyle(
      chosen,
      pulsePaths || echoPaths || roadPaths || trussPaths ? 0 : shape.length,
      isFilled,
    );
    halo =
      glowStyle === chosen || isFluidForm || hasGraphMotion(chosen)
        ? figure
        : new Path2D(
            createGraphShape(
              projected,
              glowStyle,
              baseline,
              tuning.columns,
              // The halo has to be the same figure it sits behind, which
              // includes standing in the same box.
              fluidWaveRef.current,
              tuning.gap,
              plot.top,
            ),
          );
  } else {
    // Dropped on the way out, so the halo does not come back mid-pump the
    // moment the mode returns.
    pumpRef.current = 0;
  }
  // No halo under hyperspace: its figure is a hundred and twenty
  // screen-long lines, and two wide gradient strokes over them cost more
  // than the rest of the frame — every stroke wider than 4px skipped took
  // the frame from 16-40ms to a flat 10ms. Its streaks carry their own
  // narrow glow instead.
  const haloPath =
    warpPaths ||
    firePaths ||
    arcadePaths ||
    invasionPaths ||
    cavePaths ||
    stormPaths ||
    fencePaths
      ? undefined
      : halo;
  if (chosen === 'bubbles') {
    // Once per frame, before the curves: a mirrored wave paints the same
    // storm twice and must not trigger its rays twice.
    advanceBubbleStorm(
      bubbleStormRef.current,
      toColumns(projected, tuning.columns),
      plot.top,
      baseline,
      motionRef.current.travel[0] ?? 0,
      playingRef.current,
    );
  }

  // The lit peaks. Same frame, same numbers, stroked faint-and-thick under
  // bright-and-thin — a glow made of strokes rather than of a filter,
  // because a filter over geometry that changes every frame re-rasterises
  // its whole region every frame.
  //
  // The same column count as the figure, or the beads sit between the stems
  // they are marking rather than on them.
  const accentShape = tuning.accents
    ? createGraphAccent(
        figurePoints,
        chosen,
        sceneBase,
        fluidWaveRef.current,
        tuning.accentStyle,
        sceneTop,
      )
    : '';
  const accent = accentShape ? new Path2D(accentShape) : undefined;
  // Close an explicitly filled wave to the baseline; filling the open
  // curve itself would draw a diagonal wedge between its endpoints.
  const accentFill =
    accentShape && tuning.accentFilled && tuning.accentStyle === 'wave'
      ? new Path2D(
          `${accentShape} L ${projected[projected.length - 1][0]},${sceneBase} L ${projected[0][0]},${sceneBase} Z`,
        )
      : undefined;

  /**
   * What the painted marks read: the peaks worth lighting, and every
   * column's height and position.
   *
   * Built once per frame rather than per curve — the mirrored modes draw
   * the same measurement twice and would otherwise find the peaks twice
   * and, worse, advance what they remember twice, which halves every
   * fall rate and doubles every spark.
   *
   * Only when a painted mark is on, since it is a pass over the frame.
   */
  const wantsPaintedAccent = tuning.accents && tuning.accentStyle !== 'wave';
  let accentPeaks = wantsPaintedAccent
    ? getGraphPeaks(figurePoints, chosen, sceneBase, tuning.columns, sceneTop)
    : [];
  // `scatter` named beside the flag: the flag implies it (`shapeFigure`), and
  // handed across as a boolean it no longer narrows it.
  if (blinkingSatellites && scatter) {
    accentPeaks = scatter.satellites.map(({ x, y, size, crest }) => ({
      x,
      y,
      size,
      // A satellite flashes with its own frequency band, while staying
      // at the quieter sample underneath that band's main square.
      energy: Math.max(
        0,
        Math.min(1, (sceneBase - crest) / (sceneBase - sceneTop)),
      ),
    }));
  } else if (tuning.accentStyle === 'blink') {
    // Keep a blink inside the space beneath its crest on every form.
    // The normal wave transform also puts it on the correct mirrored side.
    accentPeaks = accentPeaks.map((peak) => ({
      ...peak,
      y: peak.y + Math.max(0, sceneBase - peak.y) * 0.35,
      size: peak.size * 0.58,
    }));
  }
  const accentHeights: number[] = [];
  const accentPositions: number[] = [];
  if (wantsPaintedAccent) {
    const accentDepth = depth;
    // LED caps belong to the displayed columns, not all analyser bins.
    const accentPoints =
      chosen === 'blocks' && tuning.accentStyle !== 'live'
        ? toColumns(projected, tuning.columns)
        : projected;
    for (let index = 0; index < accentPoints.length; index += 1) {
      accentPositions.push(accentPoints[index][0]);
      accentHeights.push(
        Math.max(
          0,
          Math.min(1, (baseline - accentPoints[index][1]) / accentDepth),
        ),
      );
    }
  }

  if (tuning.accents && tuning.accentStyle !== 'wave') {
    moving =
      advanceGraphAccent({
        behaviour: tuning.accentStyle,
        peaks: accentPeaks,
        heights: accentHeights,
        state: accentStateRef.current,
        deltaMs: motionDeltaMs,
      }) || moving;
  } else if (accentStateRef.current.behaviour !== undefined) {
    accentStateRef.current = createAccentState();
  }

  // The trace's presence, eased rather than transitioned.
  const settle = getEaseFactor(deltaMs, PRESENTATION_SETTLE_MS);
  const targetOpacity = curves[0].opacity;
  const opacityGap = targetOpacity - shownOpacityRef.current;
  if (opacityGap > OPACITY_EPSILON || opacityGap < -OPACITY_EPSILON) {
    shownOpacityRef.current += opacityGap * settle;
    moving = true;
  } else {
    shownOpacityRef.current = targetOpacity;
  }
  // Heavier as well as brighter when it is the only thing drawn, and eased
  // through the same settle as the opacity so the two arrive together.
  const targetStrokeWidth = resolvePresentedStrokeWidth(
    tuning.strokeWidth,
    isForegroundRef.current,
  );
  const widthGap = targetStrokeWidth - shownStrokeWidthRef.current;
  if (widthGap > STROKE_WIDTH_EPSILON || widthGap < -STROKE_WIDTH_EPSILON) {
    shownStrokeWidthRef.current += widthGap * settle;
    moving = true;
  } else {
    shownStrokeWidthRef.current = targetStrokeWidth;
  }
  const opacity = shownOpacityRef.current;
  const strokeWidth = shownStrokeWidthRef.current;

  // Under auto a form is painted in its own palette; nothing below this
  // line reads the look's palette directly.
  const paintPalette = resolveGraphPalette(chosen, lookRef.current.palette);
  // Auto with no colours of its own is painted in the window's
  // (`windowInk.ts`); the retired pictures and the Skyline keep the
  // materials they are made of — rock, wood, fire, concrete at night —
  // where the window's cyan would light every tower brighter than its
  // windows.
  const ownColours =
    lookRef.current.palette === 'auto' && lookRef.current.colours.length === 0;
  const caveOwnColours = ownColours && chosen === 'stalactites';
  const arcadeOwnColours = ownColours && chosen === 'arches';
  const fireOwnColours = ownColours && chosen === 'flames';
  const stormOwnColours = ownColours && chosen === 'rain';
  const fenceOwnColours = ownColours && chosen === 'fence';
  const cityOwnColours = ownColours && chosen === 'skyline';
  const fluidOwnColours = ownColours && isFluidForm;
  let paintColours = lookPaintColours(paintPalette, lookRef.current.colours);
  if (caveOwnColours) {
    paintColours = CAVE_ROCK_COLOURS;
  } else if (arcadeOwnColours) {
    paintColours = ARCADE_SKY_COLOURS;
  } else if (fireOwnColours) {
    paintColours = FIRE_COLOURS;
  } else if (stormOwnColours) {
    paintColours = STORM_CLOUD_COLOURS;
  } else if (fenceOwnColours) {
    paintColours = FENCE_WOOD_COLOURS;
  } else if (cityOwnColours) {
    paintColours = cityTowerColours();
  }
  const isSelfColoured = isSelfColouredLook(paintPalette, paintColours);
  const figureStrokeWidth = resolveFigureStrokeWidth(
    strokeWidth,
    tuning.borderWidth,
    tuning.border,
    isEuphoric,
  );
  // Whose edge this is, which decides where it is allowed to sit.
  const isEuphoriaEdge = isEuphoriaFigureStroke(tuning.border, euphoria);

  /**
   * Everywhere the figure is not, for the euphoria border to be stroked in.
   *
   * A canvas stroke straddles its path, so half of every border landed
   * inside the shape and painted over the fill — which on the discrete forms
   * is most of the shape. Bars at the default sixty-four columns are about
   * six pixels wide on a full-width plot and the border goes to eight, so
   * the fill the border was decorating did not survive at all. That is the
   * bug: a rainbow or a level ramp says something, and the decoration was
   * erasing it.
   *
   * Chromium has no `stroke-alignment`, and neither SVG nor canvas offers
   * one, so the stroke is drawn at twice the weight through a clip that
   * excludes the figure — the inner half is masked away and exactly
   * `figureStrokeWidth` is left standing outside the edge. The alternatives
   * were both worse: stroking under the fill leaks through, because the fill
   * is translucent by default and `fillOpacity` goes as low as 0.15; and
   * `destination-over` leaks for the same reason, since it composites on
   * alpha rather than on geometry.
   *
   * Even-odd is what makes the figure a hole in the surrounding rectangle
   * rather than being swallowed by it. The figure itself is filled non-zero,
   * so a form whose pieces overlap each other has a small disagreement
   * between the two in the overlap — no built-in form does, and the worst it
   * could cost is a sliver of border over a fill that is already doubled.
   *
   * Built once per frame rather than per curve: it is expressed in the same
   * space as the figure, and the mirrored copy's transform is applied when
   * the clip is set rather than when it is built.
   */
  // Fluid uses the same bar path for fill and border, so the outline
  // follows the selected density and gap instead of a different figure.
  const needsOutside = isEuphoriaEdge && isFilled && figureStrokeWidth > 0;

  /**
   * The lit peaks for one copy of the drawing, painted in its scene space
   * with its own paint: by the curve loop below, and over the engine's
   * picture where the engine paints a designed scene.
   */
  const paintPeaks = (
    canvasPaint: string | CanvasGradient,
    basePaint: TracePaint,
    paintFor: (paint: TracePaint) => string | CanvasGradient,
  ) => {
    // Lit tips. Only the peaks, and only on the forms that have them — the
    // point is that the loudest few bands in the current frame catch the
    // light while the rest of the figure stays as it was.
    /**
     * Lit peaks.
     *
     * Two shapes of thing under one setting. The wave is a path — the
     * titlebar's own curve — so it is stroked like any other figure. The
     * other nine hang, sink, expand, fly or trail, none of which exists
     * inside a single frame, so they are painted by something that keeps
     * what they remember. See `graphAccents`.
     */
    if (tuning.accents) {
      if (tuning.accentStyle === 'wave' && accent) {
        /**
         * One stroke over a shadow, which is how the titlebar lights it.
         *
         * No halo pass under it: two widths of the same curve read as a
         * line with a blurrier line drawn around it, which is where the
         * grey aura came from. And no fill — filling an open curve
         * closes it, which is where the white slab came from.
         *
         * The accent shares the look's palette, so custom colours and
         * Flat remain consistent with the figure underneath it.
         */
        context.save();
        context.lineJoin = 'round';
        context.lineCap = 'round';
        if (accentFill) {
          setAlpha(context, opacity * 0.2);
          context.fillStyle = canvasPaint;
          context.fill(accentFill);
        }
        context.shadowColor = isEuphoric ? TRACE_GLOW_RAINBOW : traceGlowCyan();
        /**
         * The look's glow and thickness, as multiples of their own
         * defaults rather than as raw values — multiplying by them
         * directly would undo the shipped look, since thickness defaults
         * to 2 and would double a 4.2px line into 8.4.
         */
        context.shadowBlur =
          (isEuphoric ? TRACE_BLUR_RAINBOW : 0) * (tuning.glow / DEFAULT_GLOW);
        setAlpha(context, opacity);
        context.strokeStyle = canvasPaint;
        context.lineWidth =
          (isEuphoric ? TRACE_WIDTH_RAINBOW : TRACE_WIDTH_CYAN) *
          tuning.accentWidth;
        context.stroke(accent);
        context.restore();
      } else if (tuning.accentStyle !== 'wave') {
        setAlpha(context, opacity);
        if (
          paintGraphAccent({
            context,
            behaviour: tuning.accentStyle,
            peaks: accentPeaks,
            heights: accentHeights,
            positions: accentPositions,
            baseline: sceneBase,
            top: sceneTop,
            left: plot.left,
            right: plot.right,
            state: accentStateRef.current,
            weight: tuning.accentWidth,
            filled: tuning.accentFilled,
            paint: paintFor(
              chosen === 'blocks' || tuning.accentStyle === 'blink'
                ? basePaint
                : resolveAccentStroke(basePaint, euphoria),
            ),
          })
        ) {
          // A mote still in the air is motion, even once the music has
          // stopped — the loop has to keep drawing until it lands.
          moving = true;
        }
      }
    }
  };

  /**
   * A designed scene the engine paints: laid out above exactly as for
   * this canvas, and handed over here, where this canvas would start
   * painting it (`engineLooks/designed/`).
   */
  const designed = isEngineTaking
    ? designedSceneOf(chosen, {
        bubbles:
          chosen === 'bubbles' && motePaths
            ? {
                scene: {
                  layouts: curves.map((curve) =>
                    bubbleLayout(
                      toColumns(projected, tuning.columns),
                      plot.top,
                      baseline,
                      Math.abs(
                        getWaveTransform(curve, baseline, plot.top).scaleY,
                      ),
                      motionRef.current.travel[0] ?? 0,
                      tuning.gap,
                      bubbleStormRef.current,
                    ),
                  ),
                  motes: motePaths.layout,
                  left: toColumns(projected, tuning.columns)[0]?.[0] ?? 0,
                  figureStroke: figureStrokeWidth,
                },
                storm: bubbleStormRef.current,
                clock: motionRef.current.travel[0] ?? 0,
              }
            : undefined,
        echo: echoPaths && {
          layout: echoPaths.layout,
          figureStroke: figureStrokeWidth,
        },
        truss: trussPaths && { bridge: trussPaths.layout },
        invaders: invasionPaths &&
          cabinetFrame && {
            fight: invasionPaths.layout,
            shelters: shelterRects(
              invaderCabinetRef.current,
              sceneBase - (sceneBase - sceneTop) * SHIP_LANE,
              invasionPaths.unit,
            ),
            cabinet: cabinetFrame.layout,
            state: invasionRef.current,
            clock: invasionClockRef.current,
          },
        terrace:
          valleyPaths && valleyColumns && valleyColumns.length > 1
            ? {
                valley: valleyPaths.layout,
                columns: valleyColumns,
                jumper: terraceJumper,
                plotWidth: plot.right - plot.left,
                depth,
              }
            : undefined,
        skyline: cityPaths && {
          city: cityPaths.layout,
          towers: createSkylineTowers(
            figurePoints,
            sceneBase,
            tuning.columns,
            tuning.gap,
            sceneTop,
          ),
          heat:
            isFilled && piecePaths
              ? piecePaths.map((piece) =>
                  heatColour(paintColours, piece.energy),
                )
              : undefined,
        },
        slope: fieldPaths &&
          slopeFlow &&
          fieldColumns && {
            field: fieldPaths.layout,
            flow: slopeFlow.sets,
            columns: fieldColumns,
            gap: tuning.gap,
          },
        pulse: pulsePaths && {
          monitor: pulseMonitorRef.current,
          layout: pulsePaths.layout,
          clock: motionRef.current.travel[0] ?? 0,
          paper: pulseGrid && {
            cell: pulseGridCell(depth),
            floor: baseline,
            width,
            height,
          },
        },
      })
    : undefined;

  return {
    designed,
    paintPalette,
    paintColours,
    energy,
    isSelfColoured,
    opacity,
    strokeWidth,
    haloPath,
    lit,
    swell,
    paintPeaks,
    needsOutside,
    figureStrokeWidth,
    fenceOwnColours,
    stormOwnColours,
    fireOwnColours,
    arcadeOwnColours,
    caveOwnColours,
    fluidOwnColours,
    isEuphoriaEdge,
    moving,
  };
};

export default presentFigure;
