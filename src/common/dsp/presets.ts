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
      exciter: {
        ...DSP_DEFAULTS.exciter,
        enabled: true,
        bands: [
          { ...DSP_DEFAULTS.exciter.bands[0], enabled: false },
          { ...DSP_DEFAULTS.exciter.bands[1], enabled: false },
          // What this preset was before it had bands: the same corner, drive
          // and mix, in the band those three now name. Codec damage is a
          // top-octave problem, so the two below stay off rather than being
          // invented to fill the new shape.
          {
            ...DSP_DEFAULTS.exciter.bands[2],
            enabled: true,
            freqHz: 11_800,
            range: 0.06,
            drive: 4,
            mix: 0.35,
          },
        ],
      },
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
      exciter: {
        ...DSP_DEFAULTS.exciter,
        enabled: true,
        bands: [
          { ...DSP_DEFAULTS.exciter.bands[0], enabled: false },
          { ...DSP_DEFAULTS.exciter.bands[1], enabled: false },
          {
            ...DSP_DEFAULTS.exciter.bands[2],
            enabled: true,
            freqHz: 10_000,
            range: 0.1,
            drive: 5,
            mix: 0.4,
          },
        ],
        // The one preset here whose job is to sound BIGGER, which is what the
        // organic stage is for. Modest, because it is arriving on top of a
        // compressor that is already working.
        organic: { enabled: true, amount: 0.3, focusHz: 650, range: 0.4 },
      },
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
  {
    /**
     * The whole rack, wired the way a radio station wires one.
     *
     * This exists because of a demonstration video — "Aphex Aural Exciter +
     * Aphex Dominator II in action" — and because of what watching it made
     * obvious. Nobody demonstrates an exciter on its own. The Dominator II is a
     * three-band broadcast peak limiter, and in that pairing it is doing most
     * of what people hear as the sound being impressive: density. An exciter
     * adds detail; a multiband limiter makes everything present, all the time,
     * with no peak left for anything to hide behind.
     *
     * Every piece of that already existed here and had never been switched on
     * together, because each lives behind its own tab and every one of them
     * defaults to bypassed. Which is how the rack could be correct stage by
     * stage and still never sound like the record.
     *
     * The order below IS the chain: align, excite, compress, limit.
     *
     *  1. ALIGNMENT first, because it is about when rather than what, and
     *     shifting bands after something has added to them shifts the addition
     *     along with them.
     *  2. The exciter's high band only, and modestly — 3 kHz across two
     *     octaves, so its harmonics land between 2.8 and 13 kHz where they are
     *     heard as air, rather than above hearing where they are made and then
     *     thrown away.
     *  3. Three bands of compression with the broadcast asymmetry: the low band
     *     slow to attack so a kick keeps its front, the high band fast because
     *     sibilance and cymbals become the loudest thing in a mix the moment
     *     everything below them is levelled. The makeup on each is where the
     *     density comes from.
     *  4. A true-peak ceiling under all of it, which is what makes that makeup
     *     safe to ask for.
     *
     * Loud, and deliberately. This is not a mastering chain and it is not
     * gentle — it is the sound of a processed broadcast, which is the thing
     * that was asked for.
     */
    id: 'broadcast',
    labelKey: 'dsp.preset.broadcast',
    settings: {
      eq: DSP_DEFAULTS.eq,
      exciter: {
        ...DSP_DEFAULTS.exciter,
        enabled: true,
        align: { enabled: true, amount: 0.6, crossoverHz: [150, 1_200] },
        bands: [
          { ...DSP_DEFAULTS.exciter.bands[0], enabled: false },
          { ...DSP_DEFAULTS.exciter.bands[1], enabled: false },
          {
            ...DSP_DEFAULTS.exciter.bands[2],
            enabled: true,
            freqHz: 3_000,
            range: 0.18,
            drive: 3,
            mix: 0.35,
            texture: 0.6,
          },
        ],
        organic: { enabled: true, amount: 0.35, focusHz: 320, range: 0.3 },
      },
      compressor: {
        enabled: true,
        crossoverHz: [160, 2_600],
        bands: [
          // Low: slow attack, so the front of a kick survives being levelled.
          {
            thresholdDb: -20,
            ratio: 6,
            attackMs: 18,
            releaseMs: 220,
            makeupDb: 5,
          },
          // Mid: where voice and density live, and where broadcast works
          // hardest.
          {
            thresholdDb: -22,
            ratio: 5,
            attackMs: 6,
            releaseMs: 130,
            makeupDb: 6,
          },
          // High: fast, for the reason in the note above.
          {
            thresholdDb: -24,
            ratio: 4,
            attackMs: 1.5,
            releaseMs: 80,
            makeupDb: 5,
          },
        ],
      },
      maximizer: {
        enabled: true,
        ceilingDb: -0.8,
        lookAheadMs: 6,
        releaseMs: 90,
      },
    },
  },
];
