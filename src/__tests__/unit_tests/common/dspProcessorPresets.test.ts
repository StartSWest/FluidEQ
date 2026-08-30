/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Every profile of every processor, held to what it actually does.
 *
 * The EQ catalogue has had a ceiling test since five of its curves were found
 * over the line it states about itself. These three had nothing, and the
 * Exciter's went the same way for a worse reason.
 *
 * WHAT WENT WRONG, because the test only makes sense with it. The Exciter's
 * depths were set by comparing the new harmonic generator against the shaper it
 * replaced, at -6 dBFS. That comparison was fair and the conclusion was wrong:
 * the old shaper FOLLOWED the input level, so on ordinary material around
 * -20 dBFS it produced far less than it did at a peak, while the new one
 * produces the same ratio at every level. Matching at the peak therefore meant
 * about ten decibels more harmonic content than before on everything that is
 * not a peak — measured at -20 dBFS, the hottest profiles were returning a
 * tenth of the note as harmonics, constantly. Consistent, and consistently too
 * much. Reported as the effects sounding awful, which they did.
 *
 * So the measurement below is taken at -20 dBFS and not at a peak. A profile
 * that is tasteful on a transient and exhausting on a verse is a profile
 * measured in the wrong place.
 */
import {
  DSP_DEFAULTS,
  IExciterSettings,
  clampDspSettings,
} from '../../../common/dsp/chain';
import {
  DIMENSION_PRESETS,
  dimensionPresetSettings,
  isDimensionPresetId,
} from '../../../common/dsp/dimensionPresets';
import { EXCITER_PRESETS } from '../../../common/dsp/exciterPresets';
import {
  MAXIMIZER_PRESETS,
  isMaximizerPresetId,
  maximizerPresetSettings,
} from '../../../common/dsp/maximizerPresets';
import {
  createExciterChannel,
  runExciterChannel,
} from '../../../renderer/dsp/exciterStage';

const RATE = 48_000;
const FRAMES = 256;
const SETTLE = 200;
const WINDOW = 16_384;

/** Where real music sits. Deliberately not where its peaks reach. */
const TYPICAL_LEVEL = 0.1;

/**
 * The ceiling, in dB under the note being excited.
 *
 * Five per cent of the fundamental, returned constantly, is a colour. A tenth
 * is what this catalogue was doing when it was reported as sounding awful, so
 * the line sits between the two and nearer the quieter one.
 */
const LOUDEST_HARMONIC_DB = -24;

const magnitudeAt = (buffer: Float64Array, hz: number): number => {
  const omega = (2 * Math.PI * hz) / RATE;
  const cosine = Math.cos(omega);
  const coefficient = 2 * cosine;
  let previous = 0;
  let earlier = 0;
  for (let index = 0; index < buffer.length; index += 1) {
    const current = buffer[index] + coefficient * previous - earlier;
    earlier = previous;
    previous = current;
  }
  return (
    (2 * Math.hypot(previous - earlier * cosine, earlier * Math.sin(omega))) /
    buffer.length
  );
};

const render = (
  settings: IExciterSettings,
  hz: number,
  level: number,
): Float64Array => {
  const channel = createExciterChannel(FRAMES);
  const out = new Float64Array(WINDOW);
  for (let block = 0; block < SETTLE + WINDOW / FRAMES; block += 1) {
    const target = new Float32Array(FRAMES);
    for (let at = 0; at < FRAMES; at += 1) {
      target[at] =
        level * Math.sin((2 * Math.PI * hz * (block * FRAMES + at)) / RATE);
    }
    runExciterChannel(channel, target, settings, RATE);
    if (block >= SETTLE) {
      out.set(target, (block - SETTLE) * FRAMES);
    }
  }
  return out;
};

const liveExciter = (
  preset: (typeof EXCITER_PRESETS)[number],
): IExciterSettings => ({
  enabled: true,
  presetId: preset.id,
  stereo: preset.settings.stereo,
  bands: preset.settings.bands.map((band) => ({ ...band })),
  organic: { ...preset.settings.organic },
  align: { ...preset.settings.align },
  isolate: false,
});

/** The loudest generated order of one band, in dB under its fundamental. */
const loudestHarmonicDb = (
  settings: IExciterSettings,
  band: number,
): number => {
  const setup = settings.bands[band];
  const out = render(settings, setup.freqHz, TYPICAL_LEVEL);
  const fundamental = magnitudeAt(out, setup.freqHz);
  let loudest = 0;
  for (let order = 2; order <= 5; order += 1) {
    if (setup.freqHz * order < 20_000) {
      loudest = Math.max(loudest, magnitudeAt(out, setup.freqHz * order));
    }
  }
  return (
    20 * Math.log10(Math.max(loudest, 1e-12) / Math.max(fundamental, 1e-12))
  );
};

describe('exciter profiles', () => {
  it('none of them is exhausting on ordinary material', () => {
    const over: { id: string; band: number; db: number }[] = [];
    EXCITER_PRESETS.forEach((preset) => {
      const settings = liveExciter(preset);
      settings.bands.forEach((band, index) => {
        if (!band.enabled) {
          return;
        }
        const value = loudestHarmonicDb(settings, index);
        if (value > LOUDEST_HARMONIC_DB) {
          over.push({ id: preset.id, band: index, db: value });
        }
      });
    });
    expect(over).toEqual([]);
  });

  /**
   * The positive control. An empty list above is also what a broken
   * measurement returns, and a stage that generated nothing at all would pass
   * the ceiling perfectly while doing nothing — which is the other way this
   * catalogue can be wrong.
   */
  it('POSITIVE CONTROL: they are still doing something', () => {
    const loud = EXCITER_PRESETS.find((preset) => preset.id === 'loud');
    expect(loud).toBeDefined();
    const settings = liveExciter(loud!);
    const highest = settings.bands
      .map((band, index) =>
        band.enabled ? loudestHarmonicDb(settings, index) : -200,
      )
      .reduce((best, value) => Math.max(best, value), -200);
    expect(highest).toBeGreaterThan(-40);
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
