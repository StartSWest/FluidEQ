/* FluidEQ — GPL-3.0-or-later */
import { FilterTypeEnum, IFiltersMap, IVoicingSettings } from '../constants';
import { getVoicingFilters } from '../voicing';
import { DSP_DEFAULTS, clampDspSettings, IEqSettings } from './chain';

/** What a Preset layer's id starts with; the preset's own id follows. */
export const DSP_VOICING_PREFIX = 'dsp:';

/**
 * A preset's tone as the Preset layer of the main EQ.
 *
 * The same filters on both engines, written where each applies its layers —
 * after the rack under the FluidEQ Engine, and alone under Equalizer APO,
 * which has no rack. See `presetCurve.ts` for why the tone lives here.
 */
export const dspPresetVoicing = (
  id: string,
  eq: IEqSettings,
): IVoicingSettings => {
  const clamped = clampDspSettings({ eq }).eq;
  const filters: IFiltersMap = {};
  if (clamped.enabled) {
    // A dynamic band acts only above its threshold, which a static filter
    // cannot; applied here it would be its full gain all the time.
    clamped.bands
      .filter((band) => band.enabled && !band.dynamic)
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
  return {
    profileId: `${DSP_VOICING_PREFIX}${id}`,
    intensity: 1,
    apoOverride: { filters },
  };
};

/** Which preset a Preset layer plays, or undefined for any other voicing. */
export const dspVoicingPresetId = (
  voicing: IVoicingSettings | undefined,
): string | undefined =>
  voicing?.profileId.startsWith(DSP_VOICING_PREFIX)
    ? voicing.profileId.slice(DSP_VOICING_PREFIX.length)
    : undefined;

/**
 * The curve a Preset layer is playing, as bands, at the strength it plays at.
 *
 * For a chain saved while a preset's tone plays: the rack alone would come
 * back without it, and "my Pop" would not sound like Pop. Read from what is
 * playing rather than from the preset it came from, so a curve turned down on
 * its chip is saved as it was heard. The subsonic filter comes back as the
 * high-pass band it was written as.
 */
export const dspVoicingCurve = (
  voicing: IVoicingSettings | undefined,
): IEqSettings | undefined => {
  if (dspVoicingPresetId(voicing) === undefined) {
    return undefined;
  }
  const filters = getVoicingFilters(voicing);
  if (filters.length === 0) {
    return undefined;
  }
  const bands = filters.map((filter) => ({
    enabled: true,
    type: filter.type,
    frequency: filter.frequency,
    gainDb: filter.gain,
    quality: filter.quality,
    dynamic: false,
    thresholdDb: -24,
  }));
  return clampDspSettings({
    eq: {
      ...DSP_DEFAULTS.eq,
      enabled: true,
      presetId: '',
      bands,
      sourceBands: bands.map((band) => ({ ...band })),
    },
  }).eq;
};
