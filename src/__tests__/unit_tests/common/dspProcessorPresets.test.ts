/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/** Every processor-local profile must be exactly what the engine accepts. */
import { DSP_DEFAULTS, clampDspSettings } from '../../../common/dsp/chain';
import {
  COMPRESSOR_PRESETS,
  compressorPresetSettings,
  isCompressorPresetId,
} from '../../../common/dsp/compressorPresets';
import {
  DENOISE_PRESETS,
  denoisePresetSettings,
  isDenoisePresetId,
} from '../../../common/dsp/denoisePresets';
import {
  DIMENSION_PRESETS,
  dimensionPresetSettings,
  isDimensionPresetId,
} from '../../../common/dsp/dimensionPresets';
import {
  EXCITER_PRESETS,
  exciterPresetSettings,
  isExciterPresetId,
} from '../../../common/dsp/exciterPresets';
import {
  MAXIMIZER_PRESETS,
  isMaximizerPresetId,
  maximizerPresetSettings,
} from '../../../common/dsp/maximizerPresets';

describe('denoise profiles', () => {
  it('every one survives the engine clamp unchanged', () => {
    DENOISE_PRESETS.forEach((preset) => {
      expect(isDenoisePresetId(preset.id)).toBe(true);
      const live = denoisePresetSettings(preset.id as never, true);
      const clamped = clampDspSettings({
        ...DSP_DEFAULTS,
        denoise: live,
      }).denoise;
      expect({ id: preset.id, clamped }).toEqual({
        id: preset.id,
        clamped: live,
      });
    });
  });

  /** General cleanup is spectral only; destructive repairs are opt-in. */
  it('never combines hum or click repair into a general profile', () => {
    DENOISE_PRESETS.filter((preset) => preset.group !== 'repair').forEach(
      (preset) => {
        expect({
          id: preset.id,
          hum: preset.settings.hum.enabled,
          click: preset.settings.click.enabled,
          voice: preset.settings.voice.enabled,
        }).toEqual({
          id: preset.id,
          hum: false,
          click: false,
          voice: false,
        });
      },
    );
  });

  it('keeps spectral reduction conservative', () => {
    DENOISE_PRESETS.filter((preset) => preset.settings.hiss.enabled).forEach(
      (preset) => {
        expect({ id: preset.id, amount: preset.settings.hiss.amount }).toEqual({
          id: preset.id,
          amount: expect.any(Number),
        });
        expect(preset.settings.hiss.amount).toBeLessThanOrEqual(0.35);
        expect(preset.settings.hiss.floorDb).toBeGreaterThanOrEqual(-12);
      },
    );
  });
});

describe('exciter profiles', () => {
  it('every one survives the engine clamp unchanged', () => {
    EXCITER_PRESETS.forEach((preset) => {
      expect(isExciterPresetId(preset.id)).toBe(true);
      const live = exciterPresetSettings(preset.id as never, true);
      const clamped = clampDspSettings({
        ...DSP_DEFAULTS,
        exciter: live,
      }).exciter;
      expect({ id: preset.id, clamped }).toEqual({
        id: preset.id,
        clamped: live,
      });
    });
  });
});

describe('compressor profiles', () => {
  it('every one survives the engine clamp unchanged', () => {
    COMPRESSOR_PRESETS.forEach((preset) => {
      expect(isCompressorPresetId(preset.id)).toBe(true);
      const live = compressorPresetSettings(preset.id as never, true);
      const clamped = clampDspSettings({
        ...DSP_DEFAULTS,
        compressor: live,
      }).compressor;
      expect({ id: preset.id, clamped }).toEqual({
        id: preset.id,
        clamped: live,
      });
    });
  });

  /**
   * Makeup gives back what the band took, and never more.
   *
   * The rule used to be a flat 2 dB, which is the wrong shape: it let a
   * profile compressing 6 dB out of the programme hand back two and call the
   * result gentle. Measured, Late night played 6.0 dB quieter than DSP Off
   * and Voice 2.3, and both had an EQ curve above them grown into a mid hump
   * to make that back — two stages fighting, and the curves ended up over the
   * catalogue's own summed ceiling because of it.
   *
   * What is held instead is the honest version: what this band takes out of
   * ordinary programme at -12 dBFS, which is where music's peaks sit, is the
   * most it may put back. Anything above that is loudness wearing a
   * compressor's name, and the Maximizer or the Master owns loudness.
   */
  it('never hides heavy gain behind automatic makeup', () => {
    const PROGRAMME_DBFS = -12;
    COMPRESSOR_PRESETS.forEach((preset) => {
      preset.settings.bands.forEach((band) => {
        const over = Math.max(0, PROGRAMME_DBFS - band.thresholdDb);
        const taken = over * (1 - 1 / band.ratio);
        expect({
          id: preset.id,
          adds: band.makeupDb > taken,
        }).toEqual({ id: preset.id, adds: false });
      });
    });
  });
});

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
