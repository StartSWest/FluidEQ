/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The De-esser on the app's side: its profiles, how a stored one is read
 * back, and where its words stand on the rack's line — the place the engine
 * reads them from (`kDeEsserSlot` in `chain_decode.cpp`).
 */
import { DSP_DEFAULTS, clampDspSettings } from '../../../common/dsp/chain';
import {
  CHAIN_DEESSER_FIELDS,
  CHAIN_DEESSER_SIGNATURE,
  CHAIN_PARAM_LEAD,
  deEsserWords,
  encodeChainSettings,
  signedSpareWords,
} from '../../../common/dsp/chainWire';
import {
  DE_ESSER_DEFAULTS,
  DE_ESSER_MIN_SPAN,
  DE_ESSER_RANGES,
} from '../../../common/dsp/deEsser';
import clampDeEsserSettings from '../../../common/dsp/deEsserClamp';
import {
  DE_ESSER_PRESETS,
  deEsserPresetSettings,
} from '../../../common/dsp/deEsserPresets';
import { EQ_PRESETS, eqSettingsForPreset } from '../../../common/dsp/eqPresets';
import {
  presetCurve,
  withoutDeEssBands,
} from '../../../common/dsp/presetCurve';
import { DSP_PRESETS } from '../../../common/dsp/presets';
import en from '../../../common/i18n/en';

/**
 * Where the De-esser's words start: the master switch and the retired
 * guard, the Exciter's nine and its three bands of six, the EQ's eleven,
 * and the compressor's old switch.
 */
const DE_ESSER_SLOT = 2 + 9 + 18 + 11 + 1;

describe('De-esser profiles', () => {
  it('Vocal music is what switching the stage on gives', () => {
    expect(deEsserPresetSettings('vocalMusic', false)).toEqual(
      DE_ESSER_DEFAULTS,
    );
  });

  it('every one survives the rack clamp unchanged', () => {
    DE_ESSER_PRESETS.forEach((preset) => {
      const live = deEsserPresetSettings(preset.id as never, true);
      const clamped = clampDspSettings({
        ...DSP_DEFAULTS,
        deEsser: live,
      }).deEsser;
      expect({ id: preset.id, clamped }).toEqual({
        id: preset.id,
        clamped: live,
      });
    });
  });

  it('every one listens over at least a third of an octave and has a name', () => {
    DE_ESSER_PRESETS.forEach((preset) => {
      const { lowHz, highHz } = preset.settings;
      expect({
        id: preset.id,
        wide: highHz >= lowHz * DE_ESSER_MIN_SPAN,
      }).toEqual({ id: preset.id, wide: true });
      expect(Object.keys(en)).toContain(preset.labelKey);
    });
  });

  it('a profile never turns the Isolate monitor on', () => {
    DE_ESSER_PRESETS.forEach((preset) => {
      expect(deEsserPresetSettings(preset.id as never, true).isolate).toBe(
        false,
      );
    });
  });

  // Whole voice took everything under each S down with it, and the Speech
  // and Podcast chains pumped like a limiter (2026-10-14). Measured in the
  // engine: `speech_keeps_its_level_through_an_s`.
  it('every one cuts only what the S is made of', () => {
    DE_ESSER_PRESETS.forEach((preset) => {
      expect([preset.id, preset.settings.mode]).toEqual([
        preset.id,
        'spectral',
      ]);
    });
  });
});

describe('a stored De-esser read back', () => {
  it('reads nothing as the defaults, off', () => {
    expect(clampDeEsserSettings(undefined)).toEqual(DE_ESSER_DEFAULTS);
    expect(clampDeEsserSettings({}).enabled).toBe(false);
  });

  it('keeps a third of an octave between the ends of the range', () => {
    const read = clampDeEsserSettings({ lowHz: 8000, highHz: 8100 });
    expect(read.lowHz).toBe(8000);
    expect(read.highHz).toBeCloseTo(8000 * DE_ESSER_MIN_SPAN, 6);
  });

  it('brings every figure back into the engine’s range', () => {
    const read = clampDeEsserSettings({
      sensitivity: 4,
      lowHz: 100,
      highHz: 90_000,
      rangeDb: -3,
      mode: 'shout',
      releaseMs: 0,
    });
    expect(read.sensitivity).toBe(DE_ESSER_RANGES.sensitivity.max);
    expect(read.lowHz).toBe(DE_ESSER_RANGES.lowHz.min);
    expect(read.highHz).toBe(DE_ESSER_RANGES.highHz.max);
    expect(read.rangeDb).toBe(DE_ESSER_RANGES.rangeDb.min);
    expect(read.mode).toBe(DE_ESSER_DEFAULTS.mode);
    expect(read.releaseMs).toBe(DE_ESSER_RANGES.releaseMs.min);
  });

  it('reads the Podcast profile stored in Whole voice as it is now', () => {
    const stored = { ...deEsserPresetSettings('podcast', true), mode: 'whole' };
    expect(clampDeEsserSettings(stored)).toEqual(
      deEsserPresetSettings('podcast', true),
    );
    // Control: Whole voice chosen by hand, which clears the name, stays.
    expect(clampDeEsserSettings({ ...stored, presetId: '' }).mode).toBe(
      'whole',
    );
  });
});

describe('the chains that de-ess', () => {
  const chain = (id: string) => {
    const found = DSP_PRESETS.find((preset) => preset.id === id);
    if (!found) {
      throw new Error(`no chain ${id}`);
    }
    return found;
  };

  it('Speech, Podcast and Audiobook switch the De-esser on', () => {
    expect(chain('speech').settings.deEsser).toMatchObject({
      enabled: true,
      presetId: 'podcast',
    });
    expect(chain('podcast').settings.deEsser).toMatchObject({
      enabled: true,
      presetId: 'podcast',
    });
    expect(chain('audiobook').settings.deEsser).toMatchObject({
      enabled: true,
      presetId: 'audiobook',
    });
  });

  it('and drop the EQ bands that de-essed before, keeping the tone', () => {
    ['podcast', 'audiobook'].forEach((id) => {
      const { settings, curve } = chain(id);
      const deEssing = settings.eq.bands.filter(
        (band) => band.dynamic && band.frequency >= 2000,
      );
      expect({ id, deEssing }).toEqual({ id, deEssing: [] });
      // The curve the main EQ plays is the EQ preset's, as before.
      const preset = EQ_PRESETS.find((one) => one.id === id);
      if (!preset) {
        throw new Error(`no EQ preset ${id}`);
      }
      expect(curve).toEqual(
        presetCurve(
          eqSettingsForPreset({ ...DSP_DEFAULTS.eq, enabled: true }, preset),
        ),
      );
    });
  });

  it('every other chain leaves the De-esser off', () => {
    DSP_PRESETS.filter(
      (preset) => !['speech', 'podcast', 'audiobook'].includes(preset.id),
    ).forEach((preset) => {
      expect({ id: preset.id, on: preset.settings.deEsser.enabled }).toEqual({
        id: preset.id,
        on: false,
      });
    });
  });

  it('control: an EQ that de-esses keeps its band without the De-esser', () => {
    const preset = EQ_PRESETS.find((one) => one.id === 'podcast');
    if (!preset) {
      throw new Error('no EQ preset podcast');
    }
    const eq = eqSettingsForPreset(
      { ...DSP_DEFAULTS.eq, enabled: true },
      preset,
    );
    expect(
      eq.bands.some((band) => band.dynamic && band.frequency >= 2000),
    ).toBe(true);
    expect(
      withoutDeEssBands(eq).bands.some(
        (band) => band.dynamic && band.frequency >= 2000,
      ),
    ).toBe(false);
  });
});

describe('the De-esser on the rack’s line', () => {
  it('fills the compressor’s retired eighteen words and signs them', () => {
    const words = [
      ...deEsserWords({ ...DE_ESSER_DEFAULTS, enabled: true }),
      ...signedSpareWords(DSP_DEFAULTS.exciter),
    ];
    expect(words).toHaveLength(18);
    // The compressor's own switch stays off for an engine from before.
    expect(words[0]).toBe(0);
    expect(words[1]).toBe(1);
    expect(words[1 + CHAIN_DEESSER_FIELDS]).toBe(CHAIN_DEESSER_SIGNATURE);
    expect(words[2 + CHAIN_DEESSER_FIELDS]).toBe(CHAIN_DEESSER_FIELDS);
    // The Exciter's oversampling, Off by default, then two free words.
    expect(words.slice(3 + CHAIN_DEESSER_FIELDS)).toEqual([1, 0, 0]);
  });

  it('runs the Exciter without oversampling unless a listener chose it', () => {
    expect(DSP_DEFAULTS.exciter.oversampling).toBe('off');
    // A rack stored before the choice existed takes the default.
    expect(clampDspSettings({ exciter: {} }).exciter.oversampling).toBe('off');
    // A choice made is kept.
    expect(
      clampDspSettings({ exciter: { oversampling: 'standard' } }).exciter
        .oversampling,
    ).toBe('standard');
  });

  it('carries the Exciter’s oversampling in the first word after the pair', () => {
    const slot = DE_ESSER_SLOT + CHAIN_DEESSER_FIELDS + 2;
    const lineFor = (oversampling: 'standard' | 'off' | 'high') =>
      encodeChainSettings(
        clampDspSettings({
          ...DSP_DEFAULTS,
          exciter: { ...DSP_DEFAULTS.exciter, oversampling },
        }),
      );
    // In `FeqExciterOversampling`'s order.
    expect(lineFor('standard')[slot]).toBe(0);
    expect(lineFor('off')[slot]).toBe(1);
    expect(lineFor('high')[slot]).toBe(2);
    // Nothing else moves.
    const standard = lineFor('standard');
    const high = lineFor('high');
    expect(high.length).toBe(standard.length);
    expect(
      high.flatMap((value, index) =>
        value === standard[index] ? [] : [index],
      ),
    ).toEqual([slot]);
  });

  it('stands where the engine reads it, and moves nothing after it', () => {
    const on = clampDspSettings({
      ...DSP_DEFAULTS,
      deEsser: { ...DE_ESSER_DEFAULTS, enabled: true, mode: 'whole' },
    });
    const line = encodeChainSettings(on);
    const off = encodeChainSettings(DSP_DEFAULTS);
    expect(line[DE_ESSER_SLOT - 1]).toBe(0);
    expect(line[DE_ESSER_SLOT]).toBe(1);
    expect(line[DE_ESSER_SLOT + 7]).toBe(2);
    expect(line[DE_ESSER_SLOT + CHAIN_DEESSER_FIELDS]).toBe(
      CHAIN_DEESSER_SIGNATURE,
    );
    // Only the De-esser's own words differ between the two lines.
    const differing = line.flatMap((value, index) =>
      value === off[index] ? [] : [index],
    );
    differing.forEach((index) => {
      expect(index).toBeGreaterThanOrEqual(DE_ESSER_SLOT);
      expect(index).toBeLessThan(DE_ESSER_SLOT + CHAIN_DEESSER_FIELDS);
    });
    expect(differing.length).toBeGreaterThan(0);
    expect(line.length).toBe(off.length);
    expect(line.length).toBeGreaterThan(CHAIN_PARAM_LEAD);
  });
});
