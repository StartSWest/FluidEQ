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

import { toColumns } from 'common/graphShapes';
import { invaderUnit } from 'common/graphInvaders';
import createGraphTerrace from 'common/graphTerrace';
import { type Projected } from 'common/graphStyles';
import { type RefObject } from 'react';
import { advanceTrussBridge } from './trussBridge';
import { createTrussBridgePaths } from './trussBridgeLayout';
import {
  advanceCaveDrips,
  type CaveDrips,
  createCaveDripsPaths,
} from './caveDrips';
import {
  advanceSpaceInvasion,
  createSpaceInvasion,
  SHIP_LANE,
  type SpaceInvasion,
} from './spaceInvasion';
import {
  createCabinetFramePaths,
  createInvaderCabinet,
  createShelterPaths,
  type IChromeBox,
  type InvaderCabinet,
  readoutFloor,
} from './invaderCabinet';
import { getWaveTransform } from './liveTracePaint';
import { createSpaceInvasionPaths } from './spaceInvasionLayout';
import {
  advanceWarpTunnel,
  createWarpTunnelPaths,
  type WarpTunnel,
} from './warpTunnel';
import {
  advanceStoneArcade,
  createStoneArcadePaths,
  type StoneArcade,
} from './stoneArcade';
import { advanceBonfire, type Bonfire, createBonfirePaths } from './bonfire';
import {
  advanceRainstorm,
  createRainstormPaths,
  type Rainstorm,
} from './rainstorm';
import {
  advanceCountryFence,
  type CountryFence,
  createCountryFencePaths,
} from './countryFence';
import {
  advanceBraidStage,
  type BraidStage,
  createBraidStagePaths,
} from './braidStage';
import {
  advanceCrystalSpikes,
  createCrystalSpikesPaths,
  type CrystalSpikes,
} from './crystalSpikes';
import {
  advanceTerraceValley,
  createTerraceValleyPaths,
  type TerraceValley,
} from './terraceValley';
import {
  advanceCitySkyline,
  type CitySkyline,
  createCitySkylinePaths,
} from './citySkyline';
import { advanceRoadTrip, createRoadTripPaths, ROAD_COLUMNS } from './roadTrip';
import {
  advanceSlopeField,
  createSlopeFieldPaths,
  type SlopeField,
  smoothSlopeColumns,
} from './slopeField';
import {
  advanceBubbleMotes,
  type BubbleMotes,
  createBubbleMotePaths,
} from './bubbleMotes';
import { type IRocket } from './bridgeFireworks';
import { type ILiveCurveData } from './ChartController';
import { type IGraphMotionState } from './graphMotion';
import { type ILookTuning } from '../../common/customLooks';

// Where every scene of the live graph stands this frame: each scene's
// columns from the figure, its clock advanced while music plays, its state
// stepped, and its paths built — the bridge, the cave, the space fight,
// the warp tunnel, the arcade, the bonfire, the storm, the fence, the
// stage, the crystals, the valley, the city, the road and the field.

interface ILayOutScenesInput {
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
  sceneSpace: (points: readonly Projected[]) => Projected[];
  projected: [number, number][];
  tuning: ILookTuning;
  playingRef: RefObject<boolean>;
  trussClockRef: RefObject<number>;
  motionDeltaMs: number;
  moving: boolean;
  trussBridgeRef: RefObject<{
    beatLevel: number;
    trebleLevel: number;
    bass: number;
    trackedAt: number;
    blinkAt: number;
    blinkParity: number;
    glow: number;
    rockets: IRocket[];
    launched: number;
    deck: number[];
  }>;
  liveProjected: [number, number][];
  sceneTop: number;
  sceneBase: number;
  depth: number;
  skyFrame: { left: number; right: number; top: number; bottom: number };
  caveClockRef: RefObject<number>;
  caveDripsRef: RefObject<CaveDrips>;
  wasInvadersRef: RefObject<boolean>;
  invasionRef: RefObject<SpaceInvasion>;
  invaderCabinetRef: RefObject<InvaderCabinet>;
  invasionClockRef: RefObject<number>;
  curves: ILiveCurveData[];
  baseline: number;
  plot: { left: number; right: number; top: number; bottom: number };
  height: number;
  chromeRef: RefObject<readonly IChromeBox[]>;
  width: number;
  frameWaveform: readonly number[];
  warpClockRef: RefObject<number>;
  warpRef: RefObject<WarpTunnel>;
  arcadeClockRef: RefObject<number>;
  arcadeRef: RefObject<StoneArcade>;
  bonfireClockRef: RefObject<number>;
  bonfireRef: RefObject<Bonfire>;
  stormClockRef: RefObject<number>;
  stormRef: RefObject<Rainstorm>;
  fenceClockRef: RefObject<number>;
  fenceRef: RefObject<CountryFence>;
  braidClockRef: RefObject<number>;
  braidStageRef: RefObject<BraidStage>;
  crystalClockRef: RefObject<number>;
  crystalRef: RefObject<CrystalSpikes>;
  valleyClockRef: RefObject<number>;
  valleyRef: RefObject<TerraceValley>;
  cityClockRef: RefObject<number>;
  cityRef: RefObject<CitySkyline>;
  roadTripRef: RefObject<{
    beatLevel: number;
    trackedAt: number;
    flashAt: number;
    glow: number;
    hill: number[];
  }>;
  motionRef: RefObject<IGraphMotionState>;
  slopeClockRef: RefObject<number>;
  slopeFieldRef: RefObject<SlopeField>;
  bubbleMotesClockRef: RefObject<number>;
  bubbleMotesRef: RefObject<BubbleMotes>;
}

/**
 * Every scene's paths for this frame, undefined for the scenes not showing;
 * `moving` is raised by any scene whose clock ran.
 */
const layOutScenes = ({
  chosen,
  sceneSpace,
  projected,
  tuning,
  playingRef,
  trussClockRef,
  motionDeltaMs,
  moving: movingIn,
  trussBridgeRef,
  liveProjected,
  sceneTop,
  sceneBase,
  depth,
  skyFrame,
  caveClockRef,
  caveDripsRef,
  wasInvadersRef,
  invasionRef,
  invaderCabinetRef,
  invasionClockRef,
  curves,
  baseline,
  plot,
  height,
  chromeRef,
  width,
  frameWaveform,
  warpClockRef,
  warpRef,
  arcadeClockRef,
  arcadeRef,
  bonfireClockRef,
  bonfireRef,
  stormClockRef,
  stormRef,
  fenceClockRef,
  fenceRef,
  braidClockRef,
  braidStageRef,
  crystalClockRef,
  crystalRef,
  valleyClockRef,
  valleyRef,
  cityClockRef,
  cityRef,
  roadTripRef,
  motionRef,
  slopeClockRef,
  slopeFieldRef,
  bubbleMotesClockRef,
  bubbleMotesRef,
}: ILayOutScenesInput) => {
  let moving = movingIn;
  // The bridge: the deck is its figure, the truss and the rest are scenery.
  const trussColumns =
    chosen === 'truss'
      ? sceneSpace(toColumns(projected, tuning.columns))
      : undefined;
  if (trussColumns && playingRef.current) {
    trussClockRef.current += motionDeltaMs / 1000;
    moving = true;
  }
  if (trussColumns) {
    advanceTrussBridge(
      trussBridgeRef.current,
      trussColumns,
      sceneSpace(toColumns(liveProjected, tuning.columns)),
      sceneTop,
      sceneBase,
      trussClockRef.current,
      playingRef.current,
    );
  }
  const trussPaths = trussColumns
    ? createTrussBridgePaths(
        trussBridgeRef.current,
        trussColumns,
        sceneBase,
        sceneTop,
        trussClockRef.current,
        depth,
        skyFrame,
      )
    : undefined;
  // The cave: the rock is its figure; the pool, the drips and the
  // ripples are scenery. Its clock runs only while music plays.
  const caveColumns =
    chosen === 'stalactites'
      ? sceneSpace(toColumns(projected, tuning.columns))
      : undefined;
  if (caveColumns && playingRef.current) {
    caveClockRef.current += motionDeltaMs / 1000;
    moving = true;
  }
  if (caveColumns) {
    advanceCaveDrips(
      caveDripsRef.current,
      caveColumns,
      sceneSpace(toColumns(liveProjected, tuning.columns)),
      sceneTop,
      sceneBase,
      caveClockRef.current,
      playingRef.current,
      tuning.gap,
      depth,
    );
  }
  const cavePaths = caveColumns
    ? createCaveDripsPaths(
        caveDripsRef.current,
        caveColumns,
        sceneTop,
        sceneBase,
        caveClockRef.current,
        depth,
      )
    : undefined;
  // The space fight: the formation is its figure, the rest is scenery.
  const invasionColumns =
    chosen === 'invaders'
      ? sceneSpace(toColumns(projected, tuning.columns))
      : undefined;
  // Coming back to the arcade is a new coin: a fresh fight, three ships
  // and both readouts at nothing. The hi-score is this sitting's, not a
  // record — leaving the visualizer ends the sitting.
  if (invasionColumns && !wasInvadersRef.current) {
    invasionRef.current = createSpaceInvasion();
    invaderCabinetRef.current = createInvaderCabinet();
  }
  wasInvadersRef.current = Boolean(invasionColumns);
  if (invasionColumns && playingRef.current) {
    invasionClockRef.current += motionDeltaMs / 1000;
    moving = true;
  }
  // Where the fight's sky starts: under the cabinet's readout row, so a
  // loud band's aliens and the saucer never fly through the score. The
  // row is in the window's pixels and the fight in the scene's, which
  // differ by the wave's offset — screen = translateY + scene while the
  // wave stands up. Hung down, the top of the window is the fighter's
  // side and the row is not over the formation at all.
  const invaderCeiling = (() => {
    if (!invasionColumns || invasionColumns.length < 2) {
      return sceneTop;
    }
    const span =
      invasionColumns[invasionColumns.length - 1][0] - invasionColumns[0][0];
    const unit = invaderUnit(depth, span / (invasionColumns.length - 1));
    const placed = getWaveTransform(curves[0], baseline, plot.top);
    if (placed.scaleY < 0) {
      return sceneTop;
    }
    const floor = readoutFloor(height, unit, chromeRef.current);
    return Math.max(sceneTop, floor - placed.translateY);
  })();
  if (invasionColumns) {
    advanceSpaceInvasion(
      invasionRef.current,
      invaderCabinetRef.current,
      invasionColumns,
      sceneSpace(toColumns(liveProjected, tuning.columns)),
      sceneTop,
      sceneBase,
      invasionClockRef.current,
      playingRef.current,
      depth,
      invaderCeiling,
    );
  }
  const invasionPaths = invasionColumns
    ? createSpaceInvasionPaths(
        invasionRef.current,
        invasionColumns,
        sceneTop,
        sceneBase,
        invasionClockRef.current,
        depth,
        invaderCeiling,
      )
    : undefined;
  // The cabinet the fight happens inside. The shelters stand with the
  // fight, over the fighter's lane; the ground and the readouts are the
  // machine's screen edges, in the window's own pixels — see
  // `createCabinetFramePaths` for why they never go through the wave.
  const shelterPath = invasionPaths
    ? createShelterPaths(
        invaderCabinetRef.current,
        sceneBase - (sceneBase - sceneTop) * SHIP_LANE,
        invasionPaths.unit,
      )
    : undefined;
  const cabinetFrame = invasionPaths
    ? createCabinetFramePaths(
        invaderCabinetRef.current,
        width,
        height,
        invasionPaths.unit,
        chromeRef.current,
        frameWaveform,
      )
    : undefined;
  // Hyperspace: the streaks are its figure, the sky and the rest scenery.
  const warpColumns =
    chosen === 'starfield'
      ? sceneSpace(toColumns(projected, tuning.columns))
      : undefined;
  if (warpColumns && playingRef.current) {
    warpClockRef.current += motionDeltaMs / 1000;
    moving = true;
  }
  if (warpColumns) {
    advanceWarpTunnel(
      warpRef.current,
      warpColumns,
      sceneSpace(toColumns(liveProjected, tuning.columns)),
      sceneTop,
      sceneBase,
      warpClockRef.current,
      playingRef.current,
    );
  }
  const warpPaths = warpColumns
    ? createWarpTunnelPaths(
        warpRef.current,
        warpColumns,
        sceneTop,
        sceneBase,
        warpClockRef.current,
      )
    : undefined;
  // The aqueduct: the openings are its figure, the stone is scenery.
  const arcadeColumns =
    chosen === 'arches'
      ? sceneSpace(toColumns(projected, tuning.columns))
      : undefined;
  if (arcadeColumns && playingRef.current) {
    arcadeClockRef.current += motionDeltaMs / 1000;
    moving = true;
  }
  if (arcadeColumns) {
    advanceStoneArcade(
      arcadeRef.current,
      arcadeColumns,
      sceneSpace(toColumns(liveProjected, tuning.columns)),
      sceneTop,
      sceneBase,
      arcadeClockRef.current,
      playingRef.current,
    );
  }
  const arcadePaths = arcadeColumns
    ? createStoneArcadePaths(
        arcadeRef.current,
        arcadeColumns,
        sceneTop,
        sceneBase,
        arcadeClockRef.current,
        depth,
      )
    : undefined;
  // The fire: the outer tongues are its figure, the rest is scenery.
  const fireColumns =
    chosen === 'flames'
      ? sceneSpace(toColumns(projected, tuning.columns))
      : undefined;
  if (fireColumns && playingRef.current) {
    bonfireClockRef.current += motionDeltaMs / 1000;
    moving = true;
  }
  if (fireColumns) {
    advanceBonfire(
      bonfireRef.current,
      fireColumns,
      sceneSpace(toColumns(liveProjected, tuning.columns)),
      sceneTop,
      sceneBase,
      bonfireClockRef.current,
      playingRef.current,
    );
  }
  const firePaths = fireColumns
    ? createBonfirePaths(
        bonfireRef.current,
        fireColumns,
        sceneTop,
        sceneBase,
        bonfireClockRef.current,
        depth,
      )
    : undefined;
  // The storm: the cloud is its figure, the rain and the water scenery.
  const stormColumns =
    chosen === 'rain'
      ? sceneSpace(toColumns(projected, tuning.columns))
      : undefined;
  if (stormColumns && playingRef.current) {
    stormClockRef.current += motionDeltaMs / 1000;
    moving = true;
  }
  if (stormColumns) {
    advanceRainstorm(
      stormRef.current,
      stormColumns,
      sceneSpace(toColumns(liveProjected, tuning.columns)),
      sceneTop,
      sceneBase,
      stormClockRef.current,
      playingRef.current,
    );
  }
  const stormPaths = stormColumns
    ? createRainstormPaths(
        stormRef.current,
        stormColumns,
        sceneTop,
        sceneBase,
        stormClockRef.current,
        depth,
      )
    : undefined;
  // The countryside: the pickets are its figure, the rest is scenery.
  const fenceColumns =
    chosen === 'fence'
      ? sceneSpace(toColumns(projected, tuning.columns))
      : undefined;
  if (fenceColumns && playingRef.current) {
    fenceClockRef.current += motionDeltaMs / 1000;
    moving = true;
  }
  if (fenceColumns) {
    advanceCountryFence(
      fenceRef.current,
      fenceColumns,
      sceneSpace(toColumns(liveProjected, tuning.columns)),
      sceneTop,
      sceneBase,
      fenceClockRef.current,
      playingRef.current,
    );
  }
  const fencePaths = fenceColumns
    ? createCountryFencePaths(
        fenceRef.current,
        fenceColumns,
        sceneTop,
        sceneBase,
        fenceClockRef.current,
        depth,
      )
    : undefined;
  // The braid's stage: not a scene — the braid itself is still the
  // motion module's figure in plot space — but a floor under it and
  // motes over it, built in the same plot space so the wave transform
  // carries them with the figure.
  const braidColumns =
    chosen === 'braid'
      ? sceneSpace(toColumns(projected, tuning.columns))
      : undefined;
  if (braidColumns && playingRef.current) {
    braidClockRef.current += motionDeltaMs / 1000;
    moving = true;
  }
  if (braidColumns) {
    advanceBraidStage(
      braidStageRef.current,
      braidColumns,
      sceneSpace(toColumns(liveProjected, tuning.columns)),
      sceneTop,
      sceneBase,
      braidClockRef.current,
      playingRef.current,
    );
  }
  const stagePaths = braidColumns
    ? createBraidStagePaths(
        braidStageRef.current,
        braidColumns,
        sceneTop,
        sceneBase,
        braidClockRef.current,
        depth,
      )
    : undefined;
  // The spikes' light: faces and glints over the figure, in plot space.
  const spikeColumns =
    chosen === 'spikes'
      ? sceneSpace(toColumns(projected, tuning.columns))
      : undefined;
  if (spikeColumns && playingRef.current) {
    crystalClockRef.current += motionDeltaMs / 1000;
    moving = true;
  }
  if (spikeColumns) {
    advanceCrystalSpikes(
      crystalRef.current,
      spikeColumns,
      sceneSpace(toColumns(liveProjected, tuning.columns)),
      sceneTop,
      sceneBase,
      crystalClockRef.current,
      playingRef.current,
    );
  }
  const crystalPaths = spikeColumns
    ? createCrystalSpikesPaths(
        crystalRef.current,
        spikeColumns,
        sceneTop,
        sceneBase,
        crystalClockRef.current,
        depth,
      )
    : undefined;
  // The terrace and its valley, both in scene space: the height slider
  // moves the tiers, and the sky, the moon and the jumper keep their
  // shape. The sky's frame is the whole screen, taken from the first
  // curve's placement, so it fills the canvas at any height setting.
  const valleyColumns =
    chosen === 'terrace'
      ? sceneSpace(toColumns(projected, tuning.columns))
      : undefined;
  const terraceScene = valleyColumns
    ? createGraphTerrace(valleyColumns, sceneBase)
    : undefined;
  if (valleyColumns && playingRef.current) {
    valleyClockRef.current += motionDeltaMs / 1000;
    moving = true;
  }
  if (valleyColumns) {
    advanceTerraceValley(
      valleyRef.current,
      valleyColumns,
      sceneSpace(toColumns(liveProjected, tuning.columns)),
      sceneTop,
      sceneBase,
      valleyClockRef.current,
      playingRef.current,
    );
  }
  const valleyPaths = valleyColumns
    ? createTerraceValleyPaths(
        valleyRef.current,
        valleyColumns,
        sceneTop,
        sceneBase,
        valleyClockRef.current,
        depth,
        skyFrame,
      )
    : undefined;
  // The night city: the towers are the figure, this is the light in
  // them and the sky over them. Scene space, like the terrace.
  const cityColumns =
    chosen === 'skyline'
      ? sceneSpace(toColumns(projected, tuning.columns))
      : undefined;
  if (cityColumns && playingRef.current) {
    cityClockRef.current += motionDeltaMs / 1000;
    moving = true;
  }
  if (cityColumns) {
    advanceCitySkyline(
      cityRef.current,
      cityColumns,
      sceneSpace(toColumns(liveProjected, tuning.columns)),
      sceneTop,
      sceneBase,
      cityClockRef.current,
      playingRef.current,
    );
  }
  const cityPaths = cityColumns
    ? createCitySkylinePaths(
        cityRef.current,
        cityColumns,
        sceneTop,
        sceneBase,
        cityClockRef.current,
        depth,
        tuning.gap,
        skyFrame,
      )
    : undefined;
  // The road trip likewise: the band is its figure, the rest is scenery.
  const roadPoints =
    chosen === 'racer'
      ? sceneSpace(toColumns(projected, ROAD_COLUMNS))
      : undefined;
  if (roadPoints) {
    advanceRoadTrip(
      roadTripRef.current,
      roadPoints,
      sceneTop,
      sceneBase,
      motionRef.current.travel[0] ?? 0,
      playingRef.current,
    );
  }
  const roadPaths = roadPoints
    ? createRoadTripPaths(
        roadTripRef.current,
        roadPoints,
        sceneTop,
        sceneBase,
        motionRef.current.travel[0] ?? 0,
        depth,
      )
    : undefined;
  // The field the slope's arrows live in: a grid of ticks over the
  // whole window, and motes drifting along it. Scene space, like every
  // other scene, and the window's frame because it is scenery.
  const fieldColumns =
    chosen === 'slope'
      ? smoothSlopeColumns(sceneSpace(toColumns(projected, tuning.columns)))
      : undefined;
  if (fieldColumns && playingRef.current) {
    slopeClockRef.current += motionDeltaMs / 1000;
    moving = true;
  }
  if (fieldColumns) {
    advanceSlopeField(
      slopeFieldRef.current,
      fieldColumns,
      sceneSpace(toColumns(liveProjected, tuning.columns)),
      sceneTop,
      sceneBase,
      slopeClockRef.current,
      playingRef.current,
      skyFrame,
    );
  }
  const fieldPaths = fieldColumns
    ? createSlopeFieldPaths(
        slopeFieldRef.current,
        fieldColumns,
        sceneTop,
        sceneBase,
        slopeClockRef.current,
        depth,
        skyFrame,
      )
    : undefined;
  // The specks the bubbles rise through, over the whole window: they
  // are scenery, so the height slider moves the bubbles and not them.
  const motesOn = chosen === 'bubbles';
  if (motesOn && playingRef.current) {
    bubbleMotesClockRef.current += motionDeltaMs / 1000;
    moving = true;
  }
  if (motesOn) {
    advanceBubbleMotes(
      bubbleMotesRef.current,
      sceneSpace(toColumns(liveProjected, tuning.columns)),
      sceneTop,
      sceneBase,
      bubbleMotesClockRef.current,
      playingRef.current,
    );
  }
  const motePaths = motesOn
    ? createBubbleMotePaths(
        bubbleMotesRef.current,
        bubbleMotesClockRef.current,
        depth,
        skyFrame,
      )
    : undefined;

  return {
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
    fieldColumns,
    cityPaths,
    fieldPaths,
    motePaths,
    terraceScene,
    valleyColumns,
    cabinetFrame,
    crystalPaths,
    stagePaths,
    shelterPath,
    moving,
  };
};

export default layOutScenes;
