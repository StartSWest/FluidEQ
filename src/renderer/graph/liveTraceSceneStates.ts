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

import { legendWords } from 'common/graphAnalysis';
import { createGraphMotionState } from './graphMotion';
import { createTerraceJumper } from './terraceJumper';
import { createTrussBridge } from './trussBridge';
import { createCaveDrips } from './caveDrips';
import { createSpaceInvasion } from './spaceInvasion';
import { createInvaderCabinet } from './invaderCabinet';
import { createWarpTunnel } from './warpTunnel';
import { createStoneArcade } from './stoneArcade';
import { createBonfire } from './bonfire';
import { createRainstorm } from './rainstorm';
import { createCountryFence } from './countryFence';
import { createBraidStage } from './braidStage';
import { createCrystalSpikes } from './crystalSpikes';
import { createTerraceValley } from './terraceValley';
import { createNightSurfaces } from './terraceNight';
import { createCitySkyline } from './citySkyline';
import { createSlopeField } from './slopeField';
import { createBubbleStorm } from './bubbleStorm';
import { createBubbleMotes } from './bubbleMotes';
import { createSawtoothScope } from './sawtoothScope';
import { createPulseMonitor } from './pulseMonitor';
import { createEchoWaves } from './echoWaves';
import { createRoadTrip } from './roadTrip';
import { createDashTrails } from './dashTrails';
import { GraphLookTransition } from './graphLookTransition';
import { createAnalysisState } from './analysis/analysisFrame';
import { createSceneViewState } from './sceneViews/drawSceneView';
import { createAccentState } from './graphAccents';

// Every scene's state as the live graph first holds it.

/**
 * Every scene's state as the drawing first holds it, built once per mount.
 *
 * Each used to be `useRef(createX())`, which calls `createX` on every render
 * and keeps only the first result. This component renders with every
 * analyser frame, so the space invasion's 340 stars and the warp tunnel's 420
 * alone were about 760 objects and 2,300 noise lookups built and thrown away
 * on each one, on the default page, whichever look was showing.
 */
const createSceneStates = () => ({
  motion: createGraphMotionState(),
  terraceJumper: createTerraceJumper(),
  trussBridge: createTrussBridge(),
  caveDrips: createCaveDrips(),
  invasion: createSpaceInvasion(),
  invaderCabinet: createInvaderCabinet(),
  warp: createWarpTunnel(),
  arcade: createStoneArcade(),
  bonfire: createBonfire(),
  storm: createRainstorm(),
  fence: createCountryFence(),
  braidStage: createBraidStage(),
  crystal: createCrystalSpikes(),
  valley: createTerraceValley(),
  night: createNightSurfaces(),
  city: createCitySkyline(),
  slopeField: createSlopeField(),
  bubbleStorm: createBubbleStorm(),
  bubbleMotes: createBubbleMotes(),
  sawtoothScope: createSawtoothScope(),
  pulseMonitor: createPulseMonitor(),
  echoWaves: createEchoWaves(),
  roadTrip: createRoadTrip(),
  dashTrails: createDashTrails(),
  transition: new GraphLookTransition(),
  analysis: createAnalysisState(),
  sceneView: createSceneViewState(),
  legend: legendWords(() => ''),
  accent: createAccentState(),
});

export default createSceneStates;
