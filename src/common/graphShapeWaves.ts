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

import { GraphStyle, Projected } from './graphStyles';
import { WaveformStyle } from './waveformStyles';

// The titlebar's wave forms as the graph draws them: which graph style is
// which titlebar figure, and the spectrum turned into the titlebar's own
// samples when no envelope has arrived.

/**
 * How many readings the wave forms are drawn from.
 *
 * The titlebar's own `WAVEFORM_POINT_COUNT`, repeated as a constant rather
 * than imported: that one lives in the renderer's capture module, and this
 * file is in `common` and draws for both. The number matters because these
 * forms size their pieces from the gap between samples — see the call site.
 */
export const WAVE_SAMPLE_COUNT = 96;

/**
 * The titlebar wave's ten forms, and which of its styles each one is.
 *
 * They are not reimplemented here. `createWaveformShape` already draws all
 * ten and is the thing they are supposed to look exactly like, so the graph
 * hands it the spectrum and an origin and gets the same figure back. Two
 * copies of a shape stop being the same shape the first time one of them is
 * improved.
 */
export const WAVE_FORMS: Partial<Record<GraphStyle, WaveformStyle>> = {
  // Its bars only. The trace over them is the accent — see `ACCENTS`.
  fluid: 'bars',
  'wave-line': 'line',
  'wave-filled': 'filled',
  'wave-bars': 'bars',
  'wave-mirror': 'mirror-bars',
  'wave-dots': 'dots',
  'wave-ribbon': 'ribbon',
  'wave-spikes': 'spikes',
  'wave-blocks': 'blocks',
  'wave-outline': 'outline',
  'wave-lattice': 'lattice',
};

/**
 * The spectrum, as the fractions of full height the wave shapes expect.
 *
 * A projected point is a pixel row and the wave shapes take amplitudes in
 * [0, 1], so this is the same reading in the units the other module speaks.
 * The mirroring is what the two have in common: a waveform straddles its
 * centre because a signal swings both ways, and a spectrum drawn this way
 * straddles it because the figure is reflected — the level is still extent
 * either way, which is why the reading survives the change of shape.
 */
export const toWaveSamples = (
  points: readonly Projected[],
  baseline: number,
  // Normalised against the plot's depth rather than the floor's distance from
  // the card, or a reading at the ceiling comes back short of full scale by
  // exactly the headroom above the plot.
  ceiling = 0,
): number[] => {
  const depth = Math.max(1, baseline - ceiling);
  const samples: number[] = [];
  for (let index = 0; index < points.length; index += 1) {
    samples.push(
      Math.max(0, Math.min(1, (baseline - points[index][1]) / depth)),
    );
  }
  return samples;
};
