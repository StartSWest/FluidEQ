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

import { DSP_DEFAULTS, IDspSettings } from './chain';

export interface IDspPreset {
  id: string;
  /** i18n key for the display name; never a literal. */
  labelKey: string;
  settings: IDspSettings;
}

/**
 * Factory presets, named for the job rather than for a sound.
 *
 * `lossy-repair` is the one this whole feature was asked for. A 96 kbps file
 * loses everything above roughly 16kHz outright and leaves what survives
 * dull, so the exciter works high — 7kHz, inside the band that still exists
 * rather than above it, because a shaper fed silence generates silence. The
 * highs it produces are invented, not recovered: the encoder threw the
 * originals away and nothing brings them back.
 *
 * Every preset stays inside the ranges `clampDspSettings` enforces, and a
 * test holds them there — a shipped preset that gets clamped on load is a
 * preset that does not sound like its own name.
 */
export const DSP_PRESETS: IDspPreset[] = [
  {
    id: 'flat',
    labelKey: 'dsp.preset.flat',
    settings: DSP_DEFAULTS,
  },
  {
    id: 'lossy-repair',
    labelKey: 'dsp.preset.lossyRepair',
    settings: {
      // Left flat: this preset repairs a codec, and a tone curve on top of
      // that is a second opinion the user did not ask for.
      eq: DSP_DEFAULTS.eq,
      exciter: { enabled: true, crossoverHz: 7_000, drive: 4, mix: 0.35 },
      compressor: {
        enabled: true,
        crossoverHz: [200, 3_000],
        bands: [
          {
            thresholdDb: -20,
            ratio: 2,
            attackMs: 20,
            releaseMs: 200,
            makeupDb: 1,
          },
          {
            thresholdDb: -18,
            ratio: 2.5,
            attackMs: 10,
            releaseMs: 120,
            makeupDb: 2,
          },
          {
            thresholdDb: -16,
            ratio: 2,
            attackMs: 5,
            releaseMs: 80,
            makeupDb: 1,
          },
        ],
      },
      maximizer: {
        enabled: true,
        ceilingDb: -1,
        lookAheadMs: 5,
        releaseMs: 100,
      },
    },
  },
  {
    id: 'loud',
    labelKey: 'dsp.preset.loud',
    settings: {
      eq: DSP_DEFAULTS.eq,
      exciter: { enabled: true, crossoverHz: 5_000, drive: 5, mix: 0.4 },
      compressor: {
        enabled: true,
        crossoverHz: [150, 2_500],
        bands: [
          {
            thresholdDb: -24,
            ratio: 4,
            attackMs: 15,
            releaseMs: 150,
            makeupDb: 3,
          },
          {
            thresholdDb: -22,
            ratio: 4,
            attackMs: 8,
            releaseMs: 100,
            makeupDb: 3,
          },
          {
            thresholdDb: -20,
            ratio: 3,
            attackMs: 3,
            releaseMs: 60,
            makeupDb: 2,
          },
        ],
      },
      maximizer: {
        enabled: true,
        ceilingDb: -0.5,
        lookAheadMs: 8,
        releaseMs: 60,
      },
    },
  },
];
