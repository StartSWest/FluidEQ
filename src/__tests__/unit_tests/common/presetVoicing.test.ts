import { FilterTypeEnum } from 'common/constants';
import { DSP_DEFAULTS } from 'common/dsp/chain';
import { DSP_PRESETS } from 'common/dsp/presets';
import {
  dspPresetVoicing,
  dspVoicingCurve,
  dspVoicingPresetId,
} from 'common/dsp/presetVoicing';

it('renders the active preset EQ into an APO layer with its high-pass filter', () => {
  const eq = {
    ...DSP_DEFAULTS.eq,
    enabled: true,
    subsonicHz: 30,
    bands: [
      {
        ...DSP_DEFAULTS.eq.bands[0],
        enabled: true,
        frequency: 2500,
        gainDb: 4,
      },
      { ...DSP_DEFAULTS.eq.bands[1], enabled: false, gainDb: 12 },
    ],
  };
  const layer = dspPresetVoicing('my-preset', eq);
  expect(layer.profileId).toBe('dsp:my-preset');
  expect(layer.apoOverride?.filters).toEqual({
    '0': expect.objectContaining({ frequency: 2500, gain: 4 }),
    subsonic: expect.objectContaining({
      type: FilterTypeEnum.HPQ,
      frequency: 30,
    }),
  });
});

it('does not invent an APO curve for bypassed DSP EQ', () => {
  expect(
    dspPresetVoicing('none', { ...DSP_DEFAULTS.eq, enabled: false }).apoOverride
      ?.filters,
  ).toEqual({});
});

it('keeps every factory curve finite and APO-compatible', () => {
  DSP_PRESETS.forEach((preset) => {
    // The curve each preset plays in the main EQ, on either engine.
    if (!preset.curve) {
      return;
    }
    const layer = dspPresetVoicing(preset.id, preset.curve);
    Object.values(layer.apoOverride?.filters ?? {}).forEach((filter) => {
      expect(Number.isFinite(filter.frequency)).toBe(true);
      expect(Number.isFinite(filter.gain)).toBe(true);
      expect(filter.frequency).toBeGreaterThan(0);
      expect(filter.frequency).toBeLessThanOrEqual(22000);
    });
  });
});

/*
 * A dynamic band acts only while its own passband is over its threshold. As a
 * static filter it would be its full gain all the time — a de-esser that cuts
 * 9 dB from every cymbal — so it never reaches the Preset layer, whatever
 * EQ it is handed.
 */
it('never writes a dynamic band as a static filter', () => {
  const eq = {
    ...DSP_DEFAULTS.eq,
    enabled: true,
    bands: [
      {
        ...DSP_DEFAULTS.eq.bands[0],
        frequency: 5000,
        gainDb: -9,
        dynamic: true,
      },
      { ...DSP_DEFAULTS.eq.bands[1], frequency: 400, gainDb: 2 },
    ],
  };
  expect(
    Object.values(dspPresetVoicing('podcast', eq).apoOverride?.filters ?? {}),
  ).toEqual([expect.objectContaining({ frequency: 400, gain: 2 })]);
});

describe('the Preset layer, read back', () => {
  it('names the preset a Preset layer plays, and nothing for another voicing', () => {
    expect(dspVoicingPresetId({ profileId: 'dsp:metal', intensity: 1 })).toBe(
      'metal',
    );
    expect(
      dspVoicingPresetId({ profileId: 'dsp:user-chain:k1', intensity: 1 }),
    ).toBe('user-chain:k1');
    expect(dspVoicingPresetId({ profileId: 'music', intensity: 1 })).toBe(
      undefined,
    );
    expect(dspVoicingPresetId(undefined)).toBe(undefined);
  });

  /*
   * For a chain saved while a preset's tone plays: the curve comes back as
   * the same filters, at the strength it was heard at.
   */
  it('gives back the curve it plays, at the strength it plays at', () => {
    const metal = DSP_PRESETS.find((preset) => preset.id === 'metal');
    if (!metal?.curve) {
      throw new Error('Metal has no curve');
    }
    const layer = dspPresetVoicing('metal', metal.curve);
    const heard = (strength: number) =>
      Object.values(
        dspPresetVoicing(
          'saved',
          dspVoicingCurve({ ...layer, intensity: strength }) ?? DSP_DEFAULTS.eq,
        ).apoOverride?.filters ?? {},
      ).map((filter) => [filter.type, filter.frequency, filter.gain]);
    const original = Object.values(layer.apoOverride?.filters ?? {}).map(
      (filter) => [filter.type, filter.frequency, filter.gain],
    );
    expect(heard(1)).toEqual(original);
    // At 60% every gain is 60% of itself; the high pass has none to scale.
    expect(heard(0.6)).toEqual(
      original.map(([type, frequency, gain]) => [
        type,
        frequency,
        type === FilterTypeEnum.HPQ
          ? gain
          : Math.round(Number(gain) * 0.6 * 100) / 100,
      ]),
    );
    // POSITIVE CONTROL: the curve read back is not a flat one.
    expect(heard(1).some(([, , gain]) => Math.abs(Number(gain)) > 2)).toBe(
      true,
    );
    expect(
      dspVoicingCurve({ profileId: 'music', intensity: 1 }),
    ).toBeUndefined();
  });
});
