/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Both bass catalogues, held to what they actually ship.
 *
 * A shipped preset that gets clamped on load does not sound like its own
 * name, and it fails silently — the picker still shows the name, the numbers
 * underneath have quietly changed. `dspProcessorPresets.test.ts` holds the
 * Exciter, Maximizer and Dimension catalogues to the same standard; this is
 * that test for the two stages this feature added.
 */
import { DSP_DEFAULTS, clampDspSettings } from '../../../common/dsp/chain';
import {
  BASS_FORGE_PRESET_BY_ID,
  BASS_FORGE_PRESETS,
  bassForgePresetSettings,
  isBassForgePresetId,
} from '../../../common/dsp/bassForgePresets';
import {
  BASS_PUNCH_PRESET_BY_ID,
  BASS_PUNCH_PRESETS,
  bassPunchPresetSettings,
  isBassPunchPresetId,
} from '../../../common/dsp/bassPunchPresets';

describe('bass forge profiles', () => {
  it('every one survives the engine clamp unchanged', () => {
    BASS_FORGE_PRESETS.forEach((preset) => {
      expect(isBassForgePresetId(preset.id)).toBe(true);
      const live = bassForgePresetSettings(preset.id as never, true);
      const clamped = clampDspSettings({
        ...DSP_DEFAULTS,
        bassForge: live,
      }).bassForge;
      expect({ id: preset.id, clamped }).toEqual({
        id: preset.id,
        clamped: live,
      });
    });
  });

  /**
   * That speaker radiates nothing at the octave below at any drive level, so
   * headroom spent on a real sub there buys nothing — the whole effect has to
   * come from the harmonics of the octave instead.
   */
  it('laptop leans on presence rather than a sub it cannot play', () => {
    expect(BASS_FORGE_PRESET_BY_ID.laptop.settings.subAmount).toBe(0);
    expect(
      BASS_FORGE_PRESET_BY_ID.laptop.settings.presenceAmount,
    ).toBeGreaterThan(0.5);
  });

  /**
   * The positive control. An empty diff above is also what a broken catalogue
   * returns if every profile were quietly identical to the defaults, so this
   * proves `hot` is a different shape from `solid` rather than the same
   * numbers scaled up.
   */
  it('POSITIVE CONTROL: hot is a different shape from solid, not louder', () => {
    const solid = BASS_FORGE_PRESET_BY_ID.solid.settings;
    const hot = BASS_FORGE_PRESET_BY_ID.hot.settings;
    expect(hot.driveDb).toBeGreaterThan(solid.driveDb);
    expect(hot.texture).toBeLessThan(solid.texture);
    expect(hot.subAmount).toBeLessThan(solid.subAmount);
  });
});

describe('bass punch profiles', () => {
  it('every one survives the engine clamp unchanged', () => {
    BASS_PUNCH_PRESETS.forEach((preset) => {
      expect(isBassPunchPresetId(preset.id)).toBe(true);
      const live = bassPunchPresetSettings(preset.id as never, true);
      const clamped = clampDspSettings({
        ...DSP_DEFAULTS,
        bassPunch: live,
      }).bassPunch;
      expect({ id: preset.id, clamped }).toEqual({
        id: preset.id,
        clamped: live,
      });
    });
  });

  /** A long decay is what wakes the room next door. */
  it('lateNight has no bloom', () => {
    expect(BASS_PUNCH_PRESET_BY_ID.lateNight.settings.bloomAmount).toBe(0);
  });

  it('dry is negative sustain with no bloom; wet is positive with real bloom', () => {
    expect(BASS_PUNCH_PRESET_BY_ID.dry.settings.sustain).toBeLessThan(0);
    expect(BASS_PUNCH_PRESET_BY_ID.dry.settings.bloomAmount).toBe(0);
    expect(BASS_PUNCH_PRESET_BY_ID.wet.settings.sustain).toBeGreaterThan(0);
    expect(BASS_PUNCH_PRESET_BY_ID.wet.settings.bloomAmount).toBeGreaterThan(0);
  });
});
