/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  DSP_DEFAULTS,
  IDspSettings,
  clampDspSettings,
} from '../../../common/dsp/chain';
import { DSP_PRESETS } from '../../../common/dsp/presets';

describe('dsp chain settings', () => {
  it('defaults to every module bypassed', () => {
    expect(DSP_DEFAULTS.exciter.enabled).toBe(false);
    expect(DSP_DEFAULTS.compressor.enabled).toBe(false);
    expect(DSP_DEFAULTS.maximizer.enabled).toBe(false);
  });

  it('clamps out-of-range values rather than rejecting them', () => {
    const clamped = clampDspSettings({
      ...DSP_DEFAULTS,
      exciter: { ...DSP_DEFAULTS.exciter, drive: 999 },
    });
    expect(clamped.exciter.drive).toBe(10);
  });

  it('replaces an unreadable blob with the defaults', () => {
    expect(clampDspSettings('nonsense')).toEqual(DSP_DEFAULTS);
  });

  /**
   * One bad field costs one field.
   *
   * The wholesale version of this — reject the object, return the defaults —
   * looks safer and is worse: a preset written by a later build carrying a
   * single value this build has never heard of would silently reset every
   * other setting the user had made.
   */
  it('keeps the readable fields when one of them is not', () => {
    const clamped = clampDspSettings({
      ...DSP_DEFAULTS,
      maximizer: {
        ...DSP_DEFAULTS.maximizer,
        enabled: true,
        ceilingDb: 'loud',
      },
    });
    expect(clamped.maximizer.enabled).toBe(true);
    expect(clamped.maximizer.ceilingDb).toBe(DSP_DEFAULTS.maximizer.ceilingDb);
  });

  it('round-trips through JSON unchanged', () => {
    const parsed: IDspSettings = clampDspSettings(
      JSON.parse(JSON.stringify(DSP_DEFAULTS)),
    );
    expect(parsed).toEqual(DSP_DEFAULTS);
  });

  it('ships presets that all survive clamping unchanged', () => {
    DSP_PRESETS.forEach((preset) => {
      expect(clampDspSettings(preset.settings)).toEqual(preset.settings);
    });
  });

  it('always returns three compressor bands whatever it was handed', () => {
    const clamped = clampDspSettings({
      ...DSP_DEFAULTS,
      compressor: { ...DSP_DEFAULTS.compressor, bands: [] },
    });
    expect(clamped.compressor.bands).toHaveLength(3);
  });
});
