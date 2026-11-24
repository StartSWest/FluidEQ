/** @jest-environment node */

/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  FilterTypeEnum,
  getDefaultFilterWithId,
} from '../../../common/constants';
import { DSP_DEFAULTS } from '../../../common/dsp/chain';
import { micProfileSettings } from '../../../common/mic/micProfiles';
import {
  AI_MAX_BAND_GAIN_DB,
  AI_MAX_MANUAL_PREAMP_DB,
  AI_MAX_MASTER_CEILING_DB,
  AI_MAX_MASTER_TRIM_DB,
  AI_MAX_MAXIMIZER_CEILING_DB,
  AI_MIN_BAND_GAIN_DB,
  applySafeDspStagePatch,
  applySafeMicRackPatch,
  clampAiBandGain,
  clampAiManualPreAmp,
  maxPositiveBandGain,
  sanitizeAiBand,
  sanitizeAiDspSettings,
} from '../../../main/tuningAgent/tuningSafety';

describe('tuningSafety ear-protection guardrails', () => {
  it('caps AI manual preamp at 0 dB and preserves attenuation', () => {
    expect(clampAiManualPreAmp(6)).toBe(AI_MAX_MANUAL_PREAMP_DB);
    expect(clampAiManualPreAmp(0)).toBe(0);
    expect(clampAiManualPreAmp(-7.5)).toBe(-7.5);
    expect(clampAiManualPreAmp(-120)).toBe(-60);
    expect(clampAiManualPreAmp(Number.NaN)).toBe(0);
  });

  it('bounds AI main EQ band gains within ear-safe limits and zeroes gainless types', () => {
    expect(clampAiBandGain(18)).toBe(AI_MAX_BAND_GAIN_DB);
    expect(clampAiBandGain(-25)).toBe(AI_MIN_BAND_GAIN_DB);
    expect(clampAiBandGain(3.5)).toBe(3.5);

    const base = getDefaultFilterWithId();
    const boosted = sanitizeAiBand(base, {
      type: FilterTypeEnum.PK,
      frequency: 120,
      gain: 20,
      quality: 1.2,
    });
    expect(boosted.filter.gain).toBe(AI_MAX_BAND_GAIN_DB);
    expect(boosted.warnings.length).toBeGreaterThan(0);

    const highPass = sanitizeAiBand(base, {
      type: FilterTypeEnum.HPQ,
      frequency: 40,
      gain: 6,
      quality: 0.707,
    });
    expect(highPass.filter.type).toBe(FilterTypeEnum.HPQ);
    expect(highPass.filter.gain).toBe(0);
  });

  it('computes max positive band boost across enabled bands only', () => {
    const a = { ...getDefaultFilterWithId(), frequency: 100, gain: 4.5 };
    const b = {
      ...getDefaultFilterWithId(),
      frequency: 1000,
      gain: 10,
      isEnabled: false,
    };
    const c = { ...getDefaultFilterWithId(), frequency: 4000, gain: -3 };
    expect(maxPositiveBandGain({ [a.id]: a, [b.id]: b, [c.id]: c })).toBe(4.5);
  });

  it('strips every isolate flag and caps dangerous limiter/master ceilings', () => {
    const unsafe = {
      ...DSP_DEFAULTS,
      enabled: true,
      eq: { ...DSP_DEFAULTS.eq, isolate: true },
      exciter: { ...DSP_DEFAULTS.exciter, isolate: true },
      bassForge: { ...DSP_DEFAULTS.bassForge, isolate: true },
      bassPunch: { ...DSP_DEFAULTS.bassPunch, isolate: true },
      denoise: { ...DSP_DEFAULTS.denoise, isolate: true },
      deEsser: { ...DSP_DEFAULTS.deEsser, isolate: true },
      footsteps: { ...DSP_DEFAULTS.footsteps, isolate: true },
      maximizer: { ...DSP_DEFAULTS.maximizer, ceilingDb: 0 },
      master: { ...DSP_DEFAULTS.master, outputTrimDb: 6, ceilingDb: 0 },
    };

    const result = sanitizeAiDspSettings(unsafe);
    expect(result.settings.eq.isolate).toBe(false);
    expect(result.settings.exciter.isolate).toBe(false);
    expect(result.settings.bassForge.isolate).toBe(false);
    expect(result.settings.bassPunch.isolate).toBe(false);
    expect(result.settings.denoise.isolate).toBe(false);
    expect(result.settings.deEsser.isolate).toBe(false);
    expect(result.settings.footsteps.isolate).toBe(false);
    expect(result.settings.master.outputTrimDb).toBe(AI_MAX_MASTER_TRIM_DB);
    expect(result.settings.master.ceilingDb).toBe(AI_MAX_MASTER_CEILING_DB);
    expect(result.settings.maximizer.ceilingDb).toBe(
      AI_MAX_MAXIMIZER_CEILING_DB,
    );
    expect(result.warnings.length).toBeGreaterThanOrEqual(3);
  });

  it('merges a single DSP stage patch without clobbering unrelated stages', () => {
    const start = {
      ...DSP_DEFAULTS,
      enabled: true,
      room: { ...DSP_DEFAULTS.room, enabled: true },
    };
    const patched = applySafeDspStagePatch(start, 'deEsser', {
      enabled: true,
      isolate: true,
      maxCutDb: 6,
    });
    expect(patched.settings.deEsser.enabled).toBe(true);
    expect(patched.settings.deEsser.isolate).toBe(false);
    expect(patched.settings.room.enabled).toBe(true);
    expect(patched.settings.presetId).toBe('');
  });

  it('keeps microphone racks in low-latency gameMode and strips isolate', () => {
    const mic = micProfileSettings('stream');
    const patched = applySafeMicRackPatch(mic, {
      voice: { enabled: true, lowCutHz: 90, deplosive: 0.6 },
      deEsser: { enabled: true, isolate: true },
    });
    expect(patched.settings.gameMode).toBe(true);
    expect(patched.settings.voice?.lowCutHz).toBe(90);
    expect(patched.settings.deEsser.isolate).toBe(false);
  });
});
