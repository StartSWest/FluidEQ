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
  canConnectGraphMarks,
  createGraphConnector,
  createGraphPieces,
  createGraphScatter,
  createGraphShape,
  hasGraphPieces,
  toColumns,
} from 'common/graphShapes';
import { type Projected, resolveGraphPalette } from 'common/graphStyles';
import { type RefObject } from 'react';
import createGraphTerrace from 'common/graphTerrace';
import { spectrumBarsPath } from '../waveformPaint';
import createSlopeFlow from './slopeFlow';
import {
  createMovingGraphShape,
  hasGraphMotion,
  type IGraphMotionState,
} from './graphMotion';
import { advanceDashTrails, type IDashTrails } from './dashTrails';
import { advanceTerraceJumper, type ITerraceJumper } from './terraceJumper';
import { IEuphoriaPaint, readEuphoriaHue } from './liveTracePaint';
import { type createPulsePaths } from './pulseMonitor';
import { type createEchoWavePaths } from './echoWaves';
import { type createRoadTripPaths } from './roadTrip';
import { type createTrussBridgePaths } from './trussBridgeLayout';
import { type createCaveDripsPaths } from './caveDrips';
import { type createSpaceInvasionPaths } from './spaceInvasionLayout';
import { type createWarpTunnelPaths } from './warpTunnel';
import { type createStoneArcadePaths } from './stoneArcade';
import { type createBonfirePaths } from './bonfire';
import { type createRainstormPaths } from './rainstorm';
import { type createCountryFencePaths } from './countryFence';
import { type createTerraceValleyPaths } from './terraceValley';
import { type createCitySkylinePaths } from './citySkyline';
import { type createSlopeFieldPaths } from './slopeField';
import { type createBubbleMotePaths } from './bubbleMotes';
import { type ILookTuning, type IResolvedLook } from '../../common/customLooks';

// The live graph's figure as a path this frame: the scene's form or the
// plain shape, the scatter and the dashes' trails, the terrace's jumper and
// tiers, the stems' layers, the pieces, and the euphoria it is drawn in.

interface IShapeFigureInput {
  pulsePaths: ReturnType<typeof createPulsePaths> | undefined;
  echoPaths: ReturnType<typeof createEchoWavePaths> | undefined;
  roadPaths: ReturnType<typeof createRoadTripPaths> | undefined;
  trussPaths: ReturnType<typeof createTrussBridgePaths> | undefined;
  cavePaths: ReturnType<typeof createCaveDripsPaths> | undefined;
  invasionPaths: ReturnType<typeof createSpaceInvasionPaths> | undefined;
  warpPaths: ReturnType<typeof createWarpTunnelPaths> | undefined;
  arcadePaths: ReturnType<typeof createStoneArcadePaths> | undefined;
  firePaths: ReturnType<typeof createBonfirePaths> | undefined;
  stormPaths: ReturnType<typeof createRainstormPaths> | undefined;
  fencePaths: ReturnType<typeof createCountryFencePaths> | undefined;
  valleyPaths: ReturnType<typeof createTerraceValleyPaths> | undefined;
  sawTrace: Path2D | undefined;
  stems: { shape: string; tips: string; layers: string[] } | undefined;
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
  isFluidForm: boolean;
  fluidLeft: number;
  sceneTop: number;
  fluidRight: number;
  sceneBase: number;
  fluidBarsRef: RefObject<number[]>;
  tuning: ILookTuning;
  figurePoints: Projected[];
  fluidWaveRef: RefObject<number[]>;
  isFilled: boolean;
  playingRef: RefObject<boolean>;
  slopeFlowRef: RefObject<number>;
  motionDeltaMs: number;
  moving: boolean;
  fieldColumns: Projected[] | undefined;
  pulseGrid: { fine: Path2D; heavy: Path2D } | undefined;
  cityPaths: ReturnType<typeof createCitySkylinePaths> | undefined;
  fieldPaths: ReturnType<typeof createSlopeFieldPaths> | undefined;
  motePaths: ReturnType<typeof createBubbleMotePaths> | undefined;
  motionRef: RefObject<IGraphMotionState>;
  terraceScene: ReturnType<typeof createGraphTerrace> | undefined;
  sceneSpace: (points: readonly Projected[]) => Projected[];
  projected: [number, number][];
  dashTrailsRef: RefObject<IDashTrails>;
  valleyColumns: Projected[] | undefined;
  terraceJumperRef: RefObject<ITerraceJumper>;
  liveProjected: [number, number][];
  stemClockRef: RefObject<number>;
  stemLevelsRef: RefObject<number[]>;
  stemFlareRef: RefObject<number[]>;
  baseline: number;
  depth: number;
  lookRef: RefObject<IResolvedLook>;
  computedRef: RefObject<CSSStyleDeclaration | null>;
}

/**
 * The figure and what travels with it, laid out from the frame's points;
 * `moving` stays raised while any of it is still animating.
 */
const shapeFigure = ({
  pulsePaths,
  echoPaths,
  roadPaths,
  trussPaths,
  cavePaths,
  invasionPaths,
  warpPaths,
  arcadePaths,
  firePaths,
  stormPaths,
  fencePaths,
  valleyPaths,
  sawTrace,
  stems,
  chosen,
  isFluidForm,
  fluidLeft,
  sceneTop,
  fluidRight,
  sceneBase,
  fluidBarsRef,
  tuning,
  figurePoints,
  fluidWaveRef,
  isFilled,
  playingRef,
  slopeFlowRef,
  motionDeltaMs,
  moving: movingIn,
  fieldColumns,
  pulseGrid,
  cityPaths,
  fieldPaths,
  motePaths,
  motionRef,
  terraceScene,
  sceneSpace,
  projected,
  dashTrailsRef,
  valleyColumns,
  terraceJumperRef,
  liveProjected,
  stemClockRef,
  stemLevelsRef,
  stemFlareRef,
  baseline,
  depth,
  lookRef,
  computedRef,
}: IShapeFigureInput) => {
  let moving = movingIn;
  const isSceneForm = Boolean(
    pulsePaths ||
    echoPaths ||
    roadPaths ||
    trussPaths ||
    cavePaths ||
    invasionPaths ||
    warpPaths ||
    arcadePaths ||
    firePaths ||
    stormPaths ||
    fencePaths ||
    valleyPaths ||
    sawTrace,
  );
  let shape =
    stems?.shape ??
    (isSceneForm && chosen !== 'sawtooth' ? '' : undefined) ??
    (isFluidForm
      ? spectrumBarsPath(
          {
            x: fluidLeft,
            y: sceneTop,
            width: fluidRight - fluidLeft,
            height: sceneBase - sceneTop,
          },
          fluidBarsRef.current,
          tuning.gap,
        )
      : createGraphShape(
          figurePoints,
          chosen,
          sceneBase,
          tuning.columns,
          // Read through a ref rather than closed over: this loop runs on
          // its own frames, and the envelope arrives on the pump's.
          fluidWaveRef.current,
          tuning.gap,
          sceneTop,
          isFilled,
          0,
          tuning.connectingLine,
        ));
  if (chosen === 'slope' && playingRef.current) {
    slopeFlowRef.current = (slopeFlowRef.current + motionDeltaMs / 480) % 1;
    moving = true;
  }
  const slopeFlow = fieldColumns
    ? createSlopeFlow(fieldColumns, slopeFlowRef.current, sceneBase, tuning.gap)
    : undefined;
  if (slopeFlow) {
    shape = slopeFlow.path;
  }
  /**
   * Whose drawing is allowed outside the plot's box: a scene's own, the
   * city's sky, which stands above the towers, and the slope's field,
   * which fills the window around the arrows.
   *
   * Declared here rather than with the rest of the frame's flags: it reads
   * `fieldPaths`, and asking for that above its own `const` is a temporal
   * dead zone — the canvas would throw on the first frame of every scene.
   */
  const overflowsPlot =
    isSceneForm ||
    Boolean(pulseGrid) ||
    Boolean(cityPaths) ||
    Boolean(fieldPaths) ||
    Boolean(motePaths);
  if (
    hasGraphMotion(chosen) &&
    !invasionPaths &&
    !warpPaths &&
    !firePaths &&
    !stormPaths
  ) {
    const motion = createMovingGraphShape({
      state: motionRef.current,
      points: figurePoints,
      style: chosen,
      columns: tuning.columns,
      top: sceneTop,
      bottom: sceneBase,
      deltaMs: motionDeltaMs,
      playing: playingRef.current,
      filled: isFilled,
      gap: tuning.gap,
    });
    shape = motion.path;
    moving = motion.moving || moving;
  } else {
    motionRef.current.key = '';
  }
  const scatter =
    chosen === 'scatter' || chosen === 'dots'
      ? createGraphScatter(figurePoints, tuning.columns, tuning.gap)
      : undefined;
  const blinkingSatellites =
    scatter && tuning.accents && tuning.accentStyle === 'blink';
  const figure =
    pulsePaths?.shape ??
    echoPaths?.shape ??
    roadPaths?.shape ??
    trussPaths?.shape ??
    cavePaths?.shape ??
    invasionPaths?.shape ??
    warpPaths?.shape ??
    arcadePaths?.shape ??
    firePaths?.shape ??
    stormPaths?.shape ??
    fencePaths?.shape ??
    (terraceScene
      ? new Path2D(isFilled ? terraceScene.shape : terraceScene.outline)
      : undefined) ??
    new Path2D(
      blinkingSatellites && chosen === 'scatter' ? scatter.primary : shape,
    );
  const connector =
    tuning.connectingLine && chosen !== 'dots' && canConnectGraphMarks(chosen)
      ? new Path2D(
          createGraphConnector(
            sceneSpace(toColumns(projected, tuning.columns)),
          ),
        )
      : undefined;
  const scatterPaths =
    scatter && chosen === 'scatter' && isFilled
      ? {
          primary: new Path2D(scatter.primary),
          secondary: new Path2D(scatter.secondary),
        }
      : undefined;
  const dashHistory =
    chosen === 'dashes'
      ? advanceDashTrails(
          dashTrailsRef.current,
          sceneSpace(toColumns(projected, tuning.columns)),
          sceneBase,
          tuning.gap,
          motionDeltaMs,
          playingRef.current,
        )
      : undefined;
  const dashTrails = (slopeFlow?.trails ?? dashHistory?.trails)?.map(
    (trail) => ({
      ...trail,
      path: new Path2D(trail.path),
    }),
  );
  if (dashHistory?.moving) {
    moving = true;
  }
  if (!dashHistory) {
    dashTrailsRef.current.key = '';
  }
  const terraceJumper = valleyColumns
    ? advanceTerraceJumper(
        terraceJumperRef.current,
        valleyColumns,
        motionDeltaMs,
        playingRef.current,
      )
    : undefined;
  if (terraceJumper && playingRef.current) {
    moving = true;
  }
  const terraceTiers =
    terraceScene && isFilled
      ? terraceScene.tiers.map((tier) => ({
          body: new Path2D(tier.body),
          edge: new Path2D(tier.edge),
          opacity: tier.opacity,
        }))
      : undefined;
  const stemLayers =
    isFilled && stems
      ? {
          tips: new Path2D(stems.tips),
          lines: stems.layers.map((path) => new Path2D(path)),
          // The heads on the beat: a band whose live level jumped since
          // the last frame flares for FLARE_HOLD seconds of the music's
          // clock. Read from the live frame, not the drawn one — the
          // stems' attack is one millisecond, so the drawn head is never
          // behind the live one and a comparison there fired nothing.
          hot: (() => {
            const FLARE_HOLD = 0.14;
            const eased = toColumns(projected, tuning.columns);
            const placed = sceneSpace(eased);
            const live = toColumns(liveProjected, tuning.columns);
            if (playingRef.current) {
              stemClockRef.current += motionDeltaMs / 1000;
            }
            const now = stemClockRef.current;
            if (stemLevelsRef.current.length !== live.length) {
              stemLevelsRef.current = live.map(() => 0);
              stemFlareRef.current = live.map(() => -1);
            }
            const spacing =
              eased.length > 1
                ? (eased[eased.length - 1][0] - eased[0][0]) /
                  (eased.length - 1)
                : 1;
            const size = Math.max(
              2.4,
              Math.min(12, spacing * (1 - tuning.gap)),
            );
            const hot = new Path2D();
            eased.forEach((_column, index) => {
              const [x, y] = placed[index];
              const level = Math.max(
                0,
                Math.min(
                  1,
                  (baseline - (live[index]?.[1] ?? baseline)) / depth,
                ),
              );
              if (
                level - stemLevelsRef.current[index] >= 0.05 &&
                level >= 0.1
              ) {
                stemFlareRef.current[index] = now + FLARE_HOLD;
              }
              stemLevelsRef.current[index] = level;
              if (stemFlareRef.current[index] > now) {
                hot.rect(x - size / 2, y - size / 2, size, size);
              }
            });
            return hot;
          })(),
        }
      : undefined;

  /**
   * The figure again, as one path per piece — but only when something is
   * going to colour them differently.
   *
   * It is a `Path2D` per piece and a fill call per piece, which is the
   * cost the single path exists to avoid, so it is built for the one
   * palette that cannot be expressed any other way and for nothing else.
   */
  const piecePaths =
    resolveGraphPalette(chosen, lookRef.current.palette) === 'heat' &&
    hasGraphPieces(chosen)
      ? createGraphPieces(
          figurePoints,
          chosen,
          sceneBase,
          tuning.columns,
          tuning.gap,
          sceneTop,
        ).map((piece) => ({
          path: new Path2D(piece.d),
          energy: piece.energy,
        }))
      : undefined;

  // Nothing at all unless the light is going to be seen.
  //
  // Read off the root class rather than subscribed to: that class is
  // already the single source of truth for the mode, `contains` is a token
  // lookup with no style recalculation behind it, and it keeps this
  // component out of the euphoria store entirely.
  const isEuphoric = document.documentElement.classList.contains('is-euphoric');
  const euphoria: IEuphoriaPaint = {
    isOn: isEuphoric,
    // Only read while the mode is on, because this is the one place in the
    // frame that touches computed style — and outside the mode the answer
    // is a constant nobody paints with.
    hue:
      isEuphoric && computedRef.current
        ? readEuphoriaHue(computedRef.current)
        : 0,
  };

  return {
    shape,
    figure,
    blinkingSatellites,
    scatter,
    isEuphoric,
    euphoria,
    terraceJumper,
    piecePaths,
    slopeFlow,
    overflowsPlot,
    dashTrails,
    scatterPaths,
    stemLayers,
    connector,
    terraceTiers,
    moving,
  };
};

export default shapeFigure;
