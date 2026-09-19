import { FilterTypeEnum } from 'common/constants';
import { DSP_DEFAULTS } from 'common/dsp/chain';
import { DSP_PRESETS } from 'common/dsp/presets';
import { dspPresetVoicing } from 'common/dsp/presetVoicing';

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
    const layer = dspPresetVoicing(preset.id, preset.settings.eq);
    Object.values(layer.apoOverride?.filters ?? {}).forEach((filter) => {
      expect(Number.isFinite(filter.frequency)).toBe(true);
      expect(Number.isFinite(filter.gain)).toBe(true);
      expect(filter.frequency).toBeGreaterThan(0);
      expect(filter.frequency).toBeLessThanOrEqual(22000);
    });
  });
});
