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

import { MAX_GAIN, MIN_GAIN } from 'common/constants';
import { createGraphStems } from 'common/graphStems';
import { toColumns } from 'common/graphShapes';
import createGraphSawtooth from 'common/graphSawtooth';
import { type RefObject } from 'react';
import { type Projected } from 'common/graphStyles';
import {
  advanceSawtoothScope,
  type IGhost,
  type ISpark,
} from './sawtoothScope';
import {
  advancePulseMonitor,
  createPulseGrid,
  createPulsePaths,
  type IEcho,
} from './pulseMonitor';
import {
  advanceEchoWaves,
  createEchoWavePaths,
  type IEchoWave,
  SNAPSHOT_COLUMNS,
} from './echoWaves';
import { type IChartPointData } from './ChartController';
import { advanceSpectrumBars, advanceWaveform } from '../waveformPaint';
import { type IGraphMotionState } from './graphMotion';
import { type ILookTuning } from '../../common/customLooks';

// The live graph's instrument looks laid out this frame: the waveform and
// the FFT through the Edit ballistics, the stems, the sawtooth scope, the
// pulse monitor and its grid, and the echo waves.

interface ILayOutInstrumentsInput {
  isWaveForm: boolean;
  isFluidForm: boolean;
  tuning: ILookTuning;
  moving: boolean;
  fluidWaveRef: RefObject<number[]>;
  frameWaveform: readonly number[];
  motionDeltaMs: number;
  fluidBarsRef: RefObject<number[]>;
  data: readonly IChartPointData[];
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
  sceneBase: number;
  motionRef: RefObject<IGraphMotionState>;
  sawtoothScopeRef: RefObject<{
    ghosts: IGhost[];
    beatLevel: number;
    trackedAt: number;
    flareAt: number;
    sparks: ISpark[];
  }>;
  sceneTop: number;
  playingRef: RefObject<boolean>;
  pulseMonitorRef: RefObject<{
    beatLevel: number;
    trackedAt: number;
    thumpAt: number;
    thumpStrength: number;
    echoes: IEcho[];
  }>;
  isGridHiddenRef: RefObject<boolean>;
  width: number;
  height: number;
  depth: number;
  baseline: number;
  echoWavesRef: RefObject<{
    waves: IEchoWave[];
    beatLevel: number;
    bass: number;
    trackedAt: number;
    pending: number;
  }>;
  isFilled: boolean;
}

/**
 * The instrument looks' paths for this frame, undefined for those not
 * showing; `moving` stays raised while any of them is still settling.
 */
const layOutInstruments = ({
  isWaveForm,
  isFluidForm,
  tuning,
  moving: movingIn,
  fluidWaveRef,
  frameWaveform,
  motionDeltaMs,
  fluidBarsRef,
  data,
  chosen,
  sceneSpace,
  projected,
  sceneBase,
  motionRef,
  sawtoothScopeRef,
  sceneTop,
  playingRef,
  pulseMonitorRef,
  isGridHiddenRef,
  width,
  height,
  depth,
  baseline,
  echoWavesRef,
  isFilled,
}: ILayOutInstrumentsInput) => {
  let moving = movingIn;
  // The same Edit ballistics must reach the waveform and FFT. Previously
  // the wave forms bypassed them, and Fluid's empty wave buffer never grew.
  if (
    isWaveForm ||
    isFluidForm ||
    (tuning.accents && tuning.accentStyle === 'wave')
  ) {
    moving =
      advanceWaveform(
        fluidWaveRef.current,
        frameWaveform,
        motionDeltaMs,
        tuning,
      ) || moving;
  }
  if (isFluidForm) {
    // Whatever Pieces says, like every other form. The catalogue's
    // default for this one is set near the titlebar's eleven-pixel
    // spacing — see `COLUMN_OVERRIDES`.
    const barCount = tuning.columns;
    const bars = fluidBarsRef.current;
    if (bars.length !== barCount) {
      bars.length = barCount;
      bars.fill(0);
    }
    // These are graph-relative dB, not the meter's dBFS. Using -60 as
    // their floor made a silent -20 frame produce half-height bars.
    moving =
      advanceSpectrumBars(
        bars,
        data,
        MIN_GAIN,
        motionDeltaMs,
        tuning,
        MAX_GAIN - MIN_GAIN,
      ) || moving;
  }

  /**
   * The fluid's figure is the bars it actually paints.
   *
   * Everything that traces the drawing — the border, the mask that keeps
   * that border outside its own fill — works on a path, and a painted
   * figure has none. Taking one from the shape module instead gave a
   * different count at a different width, so the rainbow border was
   * drawn around bars it had never seen. Same geometry, same rectangles.
   */
  const stems =
    chosen === 'stems'
      ? createGraphStems(
          sceneSpace(toColumns(projected, tuning.columns)),
          sceneBase,
          tuning.gap,
        )
      : undefined;
  // The scope's beam: the wave itself, stroked bright over the body.
  const sawTrace =
    chosen === 'sawtooth'
      ? new Path2D(
          createGraphSawtooth(
            sceneSpace(toColumns(projected, tuning.columns)),
            sceneBase,
            motionRef.current.travel[0] ?? 0,
          ).trace,
        )
      : undefined;
  if (sawTrace) {
    advanceSawtoothScope(
      sawtoothScopeRef.current,
      sawTrace,
      sceneSpace(toColumns(projected, tuning.columns)),
      sceneTop,
      sceneBase,
      motionRef.current.travel[0] ?? 0,
      playingRef.current,
    );
  }
  // The monitor decides its beat first and hands back its own figure,
  // pumped by the thump; the static shape is never built for it.
  if (chosen === 'ecg') {
    advancePulseMonitor(
      pulseMonitorRef.current,
      sceneSpace(toColumns(projected, tuning.columns)),
      sceneTop,
      sceneBase,
      motionRef.current.travel[0] ?? 0,
      playingRef.current,
    );
  }
  /**
   * The monitor's ruled paper, over the whole window: it is scenery,
   * so the height slider moves the trace and not the grid.
   *
   * The one thing here built in the SCREEN's space rather than the
   * scene's. Scene space is the screen stretched vertically by the
   * height slider, and a square in it is a rectangle on the glass —
   * the paper would print taller-than-wide cells at any setting below
   * full, with the horizontal rules drawn thicker than the vertical
   * ones by the same amount. Ruled on the glass instead, the squares
   * stay square and it is their count that answers the slider.
   *
   * Only when the measurement grid is off. Two sets of rules over each
   * other is two instruments arguing — the decibel scale is a reading
   * and the paper is a picture, and neither survives the other being
   * there. The grid the user asked for wins.
   */
  const pulseGrid =
    chosen === 'ecg' && isGridHiddenRef.current
      ? createPulseGrid(
          { left: 0, right: width, top: 0, bottom: height },
          depth,
          baseline,
        )
      : undefined;
  const pulsePaths =
    chosen === 'ecg'
      ? createPulsePaths(
          pulseMonitorRef.current,
          sceneSpace(toColumns(projected, tuning.columns)),
          sceneBase,
          motionRef.current.travel[0] ?? 0,
        )
      : undefined;
  // Echo keeps its own past and hands back the live wave as the figure;
  // the static stack is never built for it.
  if (chosen === 'echo') {
    advanceEchoWaves(
      echoWavesRef.current,
      sceneSpace(toColumns(projected, SNAPSHOT_COLUMNS)),
      sceneTop,
      sceneBase,
      motionRef.current.travel[0] ?? 0,
      playingRef.current,
    );
  }
  const echoPaths =
    chosen === 'echo'
      ? createEchoWavePaths(
          echoWavesRef.current,
          sceneSpace(projected),
          sceneTop,
          sceneBase,
          motionRef.current.travel[0] ?? 0,
          isFilled,
        )
      : undefined;

  return { pulsePaths, echoPaths, sawTrace, stems, pulseGrid, moving };
};

export default layOutInstruments;
