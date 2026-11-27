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
import { type Projected } from 'common/graphStyles';
import { type RefObject } from 'react';
import {
  advanceCaveDrips,
  type CaveDrips,
  createCaveDripsPaths,
} from './caveDrips';
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
import { type IGraphMotionState } from './graphMotion';
import { type ILookTuning } from '../../common/customLooks';

// Where every scene of the live graph stands this frame: each scene's
// columns from the figure, its clock advanced while music plays, its state
// stepped, and its paths built — the cave, the warp tunnel, the arcade,
// the bonfire, the storm, the fence, the stage, the crystals, the city,
// the road and the field.

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
    | 'zipper'
    | 'slope'
    | 'stalactites'
    | 'diamonds'
    | 'sawtooth'
    | 'echo'
    | 'racer'
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
  motionDeltaMs: number;
  moving: boolean;
  liveProjected: [number, number][];
  sceneTop: number;
  sceneBase: number;
  depth: number;
  skyFrame: { left: number; right: number; top: number; bottom: number };
  caveClockRef: RefObject<number>;
  caveDripsRef: RefObject<CaveDrips>;
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
  motionDeltaMs,
  moving: movingIn,
  liveProjected,
  sceneTop,
  sceneBase,
  depth,
  skyFrame,
  caveClockRef,
  caveDripsRef,
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
  cityClockRef,
  cityRef,
  roadTripRef,
  motionRef,
  slopeClockRef,
  slopeFieldRef,
}: ILayOutScenesInput) => {
  let moving = movingIn;
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
  // The night city: the towers are the figure, this is the light in
  // them and the sky over them, in scene space: the height slider moves
  // the towers, and the sky and the moon keep their shape.
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

  return {
    roadPaths,
    cavePaths,
    warpPaths,
    arcadePaths,
    firePaths,
    stormPaths,
    fencePaths,
    fieldColumns,
    cityPaths,
    fieldPaths,
    crystalPaths,
    stagePaths,
    moving,
  };
};

export default layOutScenes;
