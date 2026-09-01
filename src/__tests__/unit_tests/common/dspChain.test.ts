/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  DSP_DEFAULTS,
  EQ_MAX_BAND_COUNT,
  EQ_RACK_SIZES,
  IDspSettings,
  buildEqRack,
  clampDspSettings,
} from '../../../common/dsp/chain';
import { compressorPresetSettings } from '../../../common/dsp/compressorPresets';
import { DSP_PRESETS, dspPresetSettings } from '../../../common/dsp/presets';

describe('dsp chain settings', () => {
  it('defaults to every module bypassed', () => {
    expect(DSP_DEFAULTS.enabled).toBe(true);
    expect(DSP_DEFAULTS.exciter.enabled).toBe(false);
    expect(DSP_DEFAULTS.compressor.enabled).toBe(false);
    expect(DSP_DEFAULTS.maximizer.enabled).toBe(false);
  });

  it('root bypass preserves every nested processor setting', () => {
    const clamped = clampDspSettings({
      ...DSP_DEFAULTS,
      enabled: false,
      eq: { ...DSP_DEFAULTS.eq, enabled: true },
      exciter: { ...DSP_DEFAULTS.exciter, enabled: true },
    });
    expect(clamped.enabled).toBe(false);
    expect(clamped.eq.enabled).toBe(true);
    expect(clamped.exciter.enabled).toBe(true);
  });

  it('migrates settings written before root bypass to enabled', () => {
    const { enabled: _removed, ...legacy } = DSP_DEFAULTS;
    expect(clampDspSettings(legacy).enabled).toBe(true);
  });

  it('clamps out-of-range values rather than rejecting them', () => {
    const clamped = clampDspSettings({
      ...DSP_DEFAULTS,
      exciter: {
        ...DSP_DEFAULTS.exciter,
        bands: [
          { ...DSP_DEFAULTS.exciter.bands[0], drive: 999 },
          ...DSP_DEFAULTS.exciter.bands.slice(1),
        ],
      },
    });
    // 3.5, because that is where the curve stops being a colour and starts
    // being a clipper. It used to stop at 10, and everything above about 3.5
    // was intermodulation rather than harmonics — so two thirds of the dial
    // made distortion, and anybody turning it up to hear what it did found
    // exactly that.
    expect(clamped.exciter.bands[0].drive).toBe(3.5);
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

  it('ships 28 uniquely named complete-chain presets', () => {
    expect(DSP_PRESETS).toHaveLength(28);
    expect(new Set(DSP_PRESETS.map((preset) => preset.id)).size).toBe(
      DSP_PRESETS.length,
    );
    DSP_PRESETS.forEach((preset) => {
      expect(preset.settings.presetId).toBe(preset.id);
    });
  });

  it('never loads an audition-only isolate state', () => {
    DSP_PRESETS.forEach((preset) => {
      expect({
        id: preset.id,
        denoise: preset.settings.denoise.isolate,
        eq: preset.settings.eq.isolate,
        exciter: preset.settings.exciter.isolate,
        bassForge: preset.settings.bassForge.isolate,
        bassPunch: preset.settings.bassPunch.isolate,
      }).toEqual({
        id: preset.id,
        denoise: false,
        eq: false,
        exciter: false,
        bassForge: false,
        bassPunch: false,
      });
    });
  });

  /** Cleanup is source repair; ordinary voicings must leave clean audio alone. */
  it('uses Denoise only in explicitly repaired chains', () => {
    DSP_PRESETS.forEach((preset) => {
      expect(preset.settings.denoise.enabled).toBe(
        preset.group === 'repair' &&
          ['vinyl-restore', 'tape-restore', 'podcast', 'audiobook'].includes(
            preset.id,
          ),
      );
    });
  });

  it('does not stack two loudness drivers in one chain', () => {
    DSP_PRESETS.forEach((preset) => {
      const drivenMaximizer =
        preset.settings.maximizer.enabled &&
        preset.settings.maximizer.driveDb > 0;
      expect({
        id: preset.id,
        doubleDriven:
          drivenMaximizer && preset.settings.master.loudnessMaximize,
      }).toEqual({ id: preset.id, doubleDriven: false });
    });
  });

  it('gives every chain at most one harmonic or transient character stage', () => {
    DSP_PRESETS.forEach((preset) => {
      const characterStages = [
        preset.settings.exciter.enabled,
        preset.settings.bassForge.enabled,
        preset.settings.bassPunch.enabled,
      ].filter(Boolean).length;
      expect({ id: preset.id, tooMany: characterStages > 1 }).toEqual({
        id: preset.id,
        tooMany: false,
      });
    });
  });

  it('keeps every chain to five intentional processors or fewer', () => {
    DSP_PRESETS.forEach((preset) => {
      const stages = [
        preset.settings.denoise.enabled,
        preset.settings.eq.enabled,
        preset.settings.exciter.enabled,
        preset.settings.bassForge.enabled,
        preset.settings.bassPunch.enabled,
        preset.settings.compressor.enabled,
        preset.settings.dimension.enabled,
        preset.settings.maximizer.enabled,
        preset.settings.master.enabled,
      ].filter(Boolean).length;
      expect({ id: preset.id, tooMany: stages > 5 }).toEqual({
        id: preset.id,
        tooMany: false,
      });
    });
  });

  it('keeps Default free of fuzz and harmonic generators', () => {
    const balanced = DSP_PRESETS.find((preset) => preset.id === 'balanced');
    expect(balanced?.settings.eq.presetId).toBe('flat');
    expect(balanced?.settings.eq.fuzzAmount).toBe(0);
    expect(balanced?.settings.exciter.enabled).toBe(false);
    expect(balanced?.settings.bassForge.enabled).toBe(false);
  });

  it('gives Punch one transient character stage instead of stacking them', () => {
    const punch = DSP_PRESETS.find((preset) => preset.id === 'punch');
    expect(punch?.settings.eq.presetId).toBe('flat');
    expect(punch?.settings.bassForge.enabled).toBe(false);
    expect(punch?.settings.bassPunch.presetId).toBe('punch');
    expect(punch?.settings.compressor).toEqual(
      compressorPresetSettings('gentle', true),
    );
    expect(punch?.settings.maximizer.presetId).toBe('transparent');
  });

  it('keeps Warm tonal instead of stacking harmonic generators', () => {
    const warm = DSP_PRESETS.find((preset) => preset.id === 'warm');
    expect(warm?.settings.eq.presetId).toBe('warm');
    expect(warm?.settings.eq.fuzzAmount).toBe(0);
    expect(warm?.settings.exciter.enabled).toBe(false);
    expect(warm?.settings.bassForge.enabled).toBe(false);
  });

  it('keeps Expansive to clean EQ and one controlled width stage', () => {
    const expansive = DSP_PRESETS.find((preset) => preset.id === 'expansive');
    expect(expansive?.settings.eq.presetId).toBe('ambient');
    expect(expansive?.settings.exciter.enabled).toBe(false);
    expect(expansive?.settings.dimension.presetId).toBe('expansive');
    expect(expansive?.settings.dimension.decorrelation).toBeLessThan(0.5);
    expect(expansive?.settings.maximizer.enabled).toBe(false);
  });

  it('uses Master only where a delivery target owns the final level', () => {
    const mastered = DSP_PRESETS.filter(
      (preset) => preset.settings.master.enabled,
    );
    expect(mastered.map((preset) => preset.id)).toEqual([
      'reference',
      'balanced',
      'vinyl-restore',
      'tape-restore',
    ]);
    mastered.forEach((preset) => {
      expect(preset.settings.maximizer.enabled).toBe(false);
    });
    expect(
      DSP_PRESETS.filter((preset) => preset.settings.maximizer.enabled),
    ).toHaveLength(23);
  });

  it('does not replace a named final profile with a generic Maximizer', () => {
    const expected = {
      'late-night': 'lateNight',
      pop: 'pop',
      rock: 'rock',
      hiphop: 'hiphop',
      electronic: 'electronic',
      jazz: 'jazz',
      classical: 'classical',
      acoustic: 'acoustic',
      metal: 'metal',
      reggae: 'reggae',
      gaming: 'gaming',
      movie: 'movie',
      podcast: 'podcast',
      audiobook: 'audiobook',
    } as const;
    Object.entries(expected).forEach(([chainId, maximizerId]) => {
      const chain = DSP_PRESETS.find((preset) => preset.id === chainId);
      expect({
        chainId,
        maximizerId: chain?.settings.maximizer.presetId,
      }).toEqual({ chainId, maximizerId });
    });
  });

  it('uses the purpose-built D&B transient profile', () => {
    const drumBass = DSP_PRESETS.find((preset) => preset.id === 'drum-bass');
    expect(drumBass?.settings.bassForge.enabled).toBe(false);
    expect(drumBass?.settings.bassPunch.presetId).toBe('dnb');
  });

  it('gain-matches Reference, and no other whole-chain preset', () => {
    DSP_PRESETS.forEach((preset) => {
      expect({
        id: preset.id,
        gainMatched: preset.settings.master.matchedBypass,
      }).toEqual({
        id: preset.id,
        gainMatched: preset.id === 'reference',
      });
    });
  });

  it('keeps Crossfade independent when a whole-chain preset is applied', () => {
    const current: IDspSettings = {
      ...DSP_DEFAULTS,
      crossfade: {
        ...DSP_DEFAULTS.crossfade,
        enabled: true,
        durationMs: 7_250,
        curve: 'smooth',
      },
    };
    const applied = dspPresetSettings('rock', current);
    expect(applied?.presetId).toBe('rock');
    expect(applied?.crossfade).toEqual(current.crossfade);
  });

  it('always returns three compressor bands whatever it was handed', () => {
    const clamped = clampDspSettings({
      ...DSP_DEFAULTS,
      compressor: { ...DSP_DEFAULTS.compressor, bands: [] },
    });
    expect(clamped.compressor.bands).toHaveLength(3);
  });
});

/**
 * The sanitiser must not eat the exciter's monitoring flag.
 *
 * Isolate is not meant to survive a restart, and the first attempt implemented
 * that by forcing it false inside `clampDspSettings`. That looked like the
 * right place and was not: this function runs on every patch AND on every
 * settings message the worklet receives, so the flag was stripped between the
 * button and the audio. The button lit, the settings object said true one line
 * earlier, and the mode did nothing whatsoever.
 *
 * Not persisting is a fact about STORAGE, so `readStored` drops it and nothing
 * else does. This is the test that tells those two apart.
 */
describe('exciter isolate survives sanitising', () => {
  it('keeps a true isolate flag', () => {
    const clamped = clampDspSettings({
      ...DSP_DEFAULTS,
      exciter: { ...DSP_DEFAULTS.exciter, isolate: true },
    });
    expect(clamped.exciter.isolate).toBe(true);
  });

  it('still defaults it off, and rejects a non-boolean', () => {
    expect(clampDspSettings(DSP_DEFAULTS).exciter.isolate).toBe(false);
    const nonsense = clampDspSettings({
      ...DSP_DEFAULTS,
      exciter: { ...DSP_DEFAULTS.exciter, isolate: 'yes' },
    });
    expect(nonsense.exciter.isolate).toBe(false);
  });
});

/**
 * The rack sizes, and the guarantee that moving between them is lossless.
 *
 * Reported as "switching bands loses the imported curve", and it was: each
 * change resampled the live rack, so every trip through a smaller size threw
 * away detail that the next larger size could not invent again.
 */
describe('EQ rack sizes', () => {
  it('offers the four sizes at their ISO centres', () => {
    expect(EQ_RACK_SIZES).toEqual([6, 10, 15, 31]);
    EQ_RACK_SIZES.forEach((size) => {
      expect(buildEqRack(size)).toHaveLength(size);
    });
  });

  /**
   * A shelf at 16 kHz delivers 3-6 dB of a requested 6, and one at 20 kHz
   * against a 44.1 kHz rate delivers almost nothing — the cookbook forces the
   * response flat at Nyquist. The graphic racks are bells throughout so no
   * control on them is a dial that moves and does nothing.
   */
  it('puts no shelf at the top of a graphic rack', () => {
    [6, 10, 31].forEach((size) => {
      expect(buildEqRack(size).every((band) => band.type === 'PK')).toBe(true);
    });
  });

  it('gives a denser rack a higher Q, as the spacing demands', () => {
    const ten = buildEqRack(10)[5].quality;
    const thirtyOne = buildEqRack(31)[15].quality;
    expect(thirtyOne).toBeGreaterThan(ten);
    // The standard octave relation: Q = 1 / (2^(n/2) - 2^(-n/2)).
    expect(ten).toBeCloseTo(1.41, 1);
    expect(thirtyOne).toBeCloseTo(4.32, 1);
  });

  it('keeps a stored rack at whatever length it was saved with', () => {
    const clamped = clampDspSettings({
      ...DSP_DEFAULTS,
      eq: { ...DSP_DEFAULTS.eq, bands: buildEqRack(31) },
    });
    expect(clamped.eq.bands).toHaveLength(31);
  });

  it('refuses to allocate past the CPU ceiling', () => {
    const clamped = clampDspSettings({
      ...DSP_DEFAULTS,
      eq: {
        ...DSP_DEFAULTS.eq,
        bands: Array.from({ length: EQ_MAX_BAND_COUNT + 40 }, () => ({
          enabled: true,
          type: 'PK',
          frequency: 1000,
          gainDb: 0,
          quality: 1,
        })),
      },
    });
    expect(clamped.eq.bands).toHaveLength(EQ_MAX_BAND_COUNT);
  });
});

describe('bass stages clamp', () => {
  it('defaults both stages off', () => {
    expect(DSP_DEFAULTS.bassForge.enabled).toBe(false);
    expect(DSP_DEFAULTS.bassPunch.enabled).toBe(false);
  });

  it('pulls out-of-range values back to the dial', () => {
    const clamped = clampDspSettings({
      bassForge: { splitHz: 5_000, texture: 4, mix: -2, driveDb: 99 },
      bassPunch: { attack: 9, sustain: -9, bloomDecayMs: 5, duck: 3 },
    });
    expect(clamped.bassForge.splitHz).toBe(200);
    expect(clamped.bassForge.texture).toBe(1);
    expect(clamped.bassForge.mix).toBe(0);
    expect(clamped.bassForge.driveDb).toBe(12);
    expect(clamped.bassPunch.attack).toBe(1);
    expect(clamped.bassPunch.sustain).toBe(-1);
    expect(clamped.bassPunch.bloomDecayMs).toBe(40);
    expect(clamped.bassPunch.duck).toBe(1);
  });

  /**
   * Settings stored before these stages existed must load, and must load with
   * both stages off. A stage that arrives switched on after an update is a
   * user's sound changing while they were not looking.
   */
  it('loads settings saved before the stages existed', () => {
    const { bassForge, bassPunch } = clampDspSettings({ eq: DSP_DEFAULTS.eq });
    expect(bassForge).toEqual(DSP_DEFAULTS.bassForge);
    expect(bassPunch).toEqual(DSP_DEFAULTS.bassPunch);
  });
});
