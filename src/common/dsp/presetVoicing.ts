/* FluidEQ — GPL-3.0-or-later */
import { FilterTypeEnum, IFiltersMap, IVoicingSettings } from '../constants';
import { clampDspSettings, IEqSettings } from './chain';

/** APO receives the static tonal curve, never a promise of dynamic DSP. */
export const dspPresetVoicing = (
  id: string,
  eq: IEqSettings,
): IVoicingSettings => {
  const clamped = clampDspSettings({ eq }).eq;
  const filters: IFiltersMap = {};
  if (clamped.enabled) {
    clamped.bands
      .filter((band) => band.enabled)
      .forEach((band, index) => {
        const key = String(index);
        filters[key] = {
          id: key,
          type: band.type as FilterTypeEnum,
          frequency: band.frequency,
          gain: band.gainDb,
          quality: band.quality,
        };
      });
    if (clamped.subsonicHz > 0) {
      filters.subsonic = {
        id: 'subsonic',
        type: FilterTypeEnum.HPQ,
        frequency: clamped.subsonicHz,
        gain: 0,
        quality: 0.707,
      };
    }
  }
  return { profileId: `dsp:${id}`, intensity: 1, apoOverride: { filters } };
};
