/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Every profile of these two processors, held to what the engine will accept.
 *
 * The EQ catalogue has had a ceiling test since five of its curves were found
 * over the line it states about itself. These had nothing.
 *
 * The Exciter's half of this file is GONE, and it is worth saying why so that
 * nobody restores it here. It rendered each profile through
 * `runExciterChannel` and measured the loudest generated order against the
 * fundamental, because the profiles had once been voiced at -6 dBFS against a
 * level-following shaper they replaced and came out roughly ten decibels too
 * hot on ordinary material — reported as the effects sounding awful, which they
 * did. That stage is now C++ only; the TypeScript one it drove has been
 * deleted. The measurement still matters and it belongs where the arithmetic
 * now lives: `smoke-engines.ts` and the native suite.
 *
 * What remains is a different question, and one that does not need an engine:
 * whether a profile survives `clampDspSettings` unchanged. A profile the clamp
 * edits is a profile the user never actually hears.
 */
import { DSP_DEFAULTS, clampDspSettings } from '../../../common/dsp/chain';
import {
  DIMENSION_PRESETS,
  dimensionPresetSettings,
  isDimensionPresetId,
} from '../../../common/dsp/dimensionPresets';
import {
  MAXIMIZER_PRESETS,
  isMaximizerPresetId,
  maximizerPresetSettings,
} from '../../../common/dsp/maximizerPresets';

describe('maximizer profiles', () => {
  it('every one survives the engine clamp unchanged', () => {
    MAXIMIZER_PRESETS.forEach((preset) => {
      expect(isMaximizerPresetId(preset.id)).toBe(true);
      const live = maximizerPresetSettings(preset.id as never, true);
      const clamped = clampDspSettings({
        ...DSP_DEFAULTS,
        maximizer: live,
      }).maximizer;
      expect({ id: preset.id, clamped }).toEqual({
        id: preset.id,
        clamped: live,
      });
    });
  });

  /** Drive is what makes this stage a maximizer; a catalogue of zeroes is a
   * catalogue of limiters wearing the name. */
  it('at least one profile actually drives the ceiling', () => {
    const driven = MAXIMIZER_PRESETS.filter(
      (preset) => preset.settings.driveDb > 0,
    );
    expect(driven.length).toBeGreaterThan(0);
  });
});

describe('dimension profiles', () => {
  it('every one survives the engine clamp unchanged', () => {
    DIMENSION_PRESETS.forEach((preset) => {
      expect(isDimensionPresetId(preset.id)).toBe(true);
      const live = dimensionPresetSettings(preset.id as never, true);
      const clamped = clampDspSettings({
        ...DSP_DEFAULTS,
        dimension: live,
      }).dimension;
      expect({ id: preset.id, clamped }).toEqual({
        id: preset.id,
        clamped: live,
      });
    });
  });

  /**
   * Bass is never widened by any profile.
   *
   * The processor clamps it anyway, so this is about the catalogue rather than
   * the engine: a profile asking for something the engine refuses is a profile
   * that does not sound like its own numbers.
   */
  it('no profile asks to widen the bass', () => {
    const asking = DIMENSION_PRESETS.filter(
      (preset) => preset.settings.lowWidth > 1,
    );
    expect(asking).toEqual([]);
  });
});
