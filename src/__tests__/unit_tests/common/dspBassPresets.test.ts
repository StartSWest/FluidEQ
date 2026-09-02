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
  IBassForgePresetSettings,
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
   * No profile may be quiet enough to be indistinguishable from bypass.
   *
   * Both amounts are multiplied by `mix` before they reach the band, so depth
   * is their sum against it and not either one alone — which is how `subtle`
   * and `dry` came to ship at 0.09 by this measure. Measured through the
   * engine's own Isolate against a 55 Hz bass note, that was a contribution
   * 30 dB under the programme: below where anything can be told from nothing,
   * on a stage whose whole difficulty is that it changes timbre rather than
   * level. The floor here is 0.2, which the quietest two now clear at 0.22 and
   * measure at -22 dB — quiet, which is what they are named for, but present.
   *
   * A proxy rather than the measurement: the dB figure needs the C++ engine,
   * and `bassForgePresets.ts` carries the whole table it was solved against.
   */
  it('ships no profile that cannot be told apart from bypass', () => {
    BASS_FORGE_PRESETS.forEach((preset) => {
      const { subAmount, presenceAmount, mix } = preset.settings;
      const depth = (subAmount + presenceAmount) * mix;
      expect({ id: preset.id, tooQuiet: depth < 0.2 }).toEqual({
        id: preset.id,
        tooQuiet: false,
      });
    });
  });

  /**
   * The two ordering claims the profile comments make in prose.
   *
   * `laptop` says it pushes presence hardest of anything in the catalogue and
   * `dub` says it carries the most real sub; both are the reason those two
   * profiles exist, and both are one careless edit from becoming false while
   * the comment still asserts them.
   */
  it('keeps laptop the deepest phantom and dub the deepest real sub', () => {
    const highest = (pick: (of: IBassForgePresetSettings) => number) =>
      BASS_FORGE_PRESETS.reduce((best, preset) =>
        pick(preset.settings) > pick(best.settings) ? preset : best,
      ).id;
    expect(highest((of) => of.presenceAmount)).toBe('laptop');
    expect(highest((of) => of.subAmount)).toBe('dub');
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
