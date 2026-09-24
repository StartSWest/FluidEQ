import {
  shapeEqFilters,
  smoothEqCurve,
  TBandQ,
  TCurveSmoothing,
} from './eqShape';
import {
  clampQuality,
  FilterTypeEnum,
  IFilter,
  IGraphicEqPoint,
  IState,
  IConvolutionProfile,
  isBandEnabled,
  MAX_GAIN,
  TApoFeature,
} from './constants';
import { clampGainWithin } from './correctionRange';
import { layerGroupOf } from './filterDesign';
import { hasTone } from './tone';

import { getResponseGainAtFrequencies } from './response';

export type TEqMode = 'normal' | 'double' | 'studio';
export type TEqModeScope = 'eq' | 'curves';

export const getEqMode = (
  state: Pick<IState, 'eqMode' | 'isEqDoubleOn'>,
): TEqMode => {
  if (
    state.eqMode === 'normal' ||
    state.eqMode === 'double' ||
    state.eqMode === 'studio'
  ) {
    return state.eqMode;
  }
  return state.isEqDoubleOn === true ? 'double' : 'normal';
};

export const getBandQ = (
  state: Pick<
    IState,
    'eqBandQ' | 'curveBandQ' | 'eqMode' | 'curveEqMode' | 'isEqDoubleOn'
  >,
  scope: TEqModeScope,
): TBandQ => {
  const explicit = scope === 'eq' ? state.eqBandQ : state.curveBandQ;
  const mode = scope === 'eq' ? getEqMode(state) : getCurveEqMode(state);
  if (explicit === 'fixed') {
    return 'off';
  }
  return explicit === 'constant'
    ? 'off'
    : (explicit ?? (mode === 'studio' ? 'proportional' : 'off'));
};

const twoPlaces = (value: number) => Math.round(value * 100) / 100;

export const getCurveEqMode = (
  state: Pick<IState, 'eqMode' | 'isEqDoubleOn' | 'curveEqMode'>,
): TEqMode => state.curveEqMode ?? getEqMode(state);

export const eqModeGainScale = (mode: TEqMode): number => {
  if (mode === 'studio') {
    return 1.5;
  }
  return mode === 'double' ? 2 : 1;
};

/**
 * Whether a feature file edited outside FluidEQ can be taken back as it reads.
 *
 * Every layer is written through its group's strength and band shape, and a
 * correction through smoothing too (`layerGroupOf`), so a file only says what
 * its layer holds while those write it unchanged. Taking the bands back is the
 * exception: it resets Your EQ's row to Normal and constant Q to match
 * (`adoptApoFeatureText`), which is only safe while no other layer in that row
 * is written through it.
 */
export const canAdoptEqModeChange = (
  state: IState,
  feature: TApoFeature,
): boolean => {
  if (layerGroupOf(feature) === 'curves') {
    return (
      getBandQ(state, 'curves') === 'off' &&
      (!state.curveSmoothing || state.curveSmoothing === 'off') &&
      getCurveEqMode(state) === 'normal'
    );
  }
  const writesAsIs =
    getEqMode(state) === 'normal' && getBandQ(state, 'eq') === 'off';
  if (feature !== 'eq') {
    return writesAsIs;
  }
  return (
    writesAsIs ||
    (!hasTone(state.tone) && !state.voicing && !state.driver && !state.smartEq)
  );
};

/**
 * Studio mode's one and a half times, of gains bounded to `limit` first: a
 * slider's range unless the layer is a correction (`layerGainLimit`), which
 * is lifted whole.
 */
export const getStudioEqFilters = <
  T extends Pick<IFilter, 'type' | 'gain' | 'quality'>,
>(
  filters: T[],
  shape: TBandQ = 'proportional',
  limit = MAX_GAIN,
): T[] =>
  shapeEqFilters(filters, shape).map((filter) => {
    if (
      filter.type !== FilterTypeEnum.PK &&
      filter.type !== FilterTypeEnum.LSC &&
      filter.type !== FilterTypeEnum.HSC
    ) {
      return filter;
    }
    const gain = clampGainWithin(filter.gain, limit);
    return {
      ...filter,
      gain: twoPlaces(1.5 * gain),
      quality: twoPlaces(clampQuality(filter.quality)),
    };
  });

export const getStudioEqGraphic = (
  points: IGraphicEqPoint[],
  limit = MAX_GAIN,
): IGraphicEqPoint[] =>
  points.map((point) => ({
    ...point,
    gain: twoPlaces(1.5 * clampGainWithin(point.gain, limit)),
  }));

export const getAppliedEqFilters = <
  T extends Pick<IFilter, 'type' | 'gain' | 'quality'>,
>(
  filters: T[],
  mode: TEqMode,
  shape?: TBandQ,
): T[] => {
  if (mode === 'studio') {
    return getStudioEqFilters(filters, shape);
  }
  const shaped = shapeEqFilters(filters, shape);
  return mode === 'double' ? [...shaped, ...shaped] : shaped;
};

export const getEqModeCompensation = <
  T extends Pick<IFilter, 'type' | 'gain' | 'quality'>,
>(
  filters: T[],
  mode: TEqMode,
  shape?: TBandQ,
): T[] => {
  if (mode === 'normal' && (!shape || shape === 'off')) {
    return [];
  }
  if (mode === 'double' && (!shape || shape === 'off')) {
    return filters;
  }
  return filters.flatMap((filter) => {
    if (
      ![FilterTypeEnum.PK, FilterTypeEnum.LSC, FilterTypeEnum.HSC].includes(
        filter.type,
      )
    ) {
      return mode === 'double' ? [filter] : [];
    }
    return [
      { ...filter, gain: -filter.gain },
      ...getAppliedEqFilters([filter], mode, shape),
    ];
  });
};

export const studioConvolutionCorrection = (
  profile: IConvolutionProfile | undefined,
): IGraphicEqPoint[] => convolutionCorrection(profile, 'studio');

export const convolutionResponse = (
  profile: IConvolutionProfile | undefined,
  shape: TBandQ = 'off',
): IGraphicEqPoint[] => {
  if (!profile) {
    return [];
  }
  if (profile.response?.length) {
    return profile.response
      .filter(
        (point) =>
          Number.isFinite(point.frequency) && Number.isFinite(point.gain),
      )
      .map((point) => ({ ...point }));
  }
  if (profile.fileName) {
    return [];
  }
  const filters = Object.values(profile.filters ?? {}).filter(isBandEnabled);
  const frequencies = [
    ...new Set([
      ...Array.from(
        { length: 1024 },
        (_, index) => 20 * 1000 ** (index / 1023),
      ),
      ...filters.map((filter) => filter.frequency),
    ]),
  ].sort((first, second) => first - second);
  const gains = getResponseGainAtFrequencies(
    { filters: shapeEqFilters(filters, shape) },
    frequencies,
  );
  return frequencies.map((frequency, index) => ({
    frequency,
    gain: gains[index],
  }));
};

export const convolutionCorrection = (
  profile: IConvolutionProfile | undefined,
  mode: TEqMode,
  shape: TBandQ = 'off',
  smoothing: TCurveSmoothing = 'off',
): IGraphicEqPoint[] => {
  if (mode !== 'studio' && shape === 'off' && smoothing === 'off') {
    return [];
  }
  const original = convolutionResponse(profile);
  const desired = smoothEqCurve(convolutionResponse(profile, shape), smoothing);
  const basePasses = mode === 'double' ? 2 : 1;
  const originalGains = getResponseGainAtFrequencies(
    { curves: [original] },
    desired.map((point) => point.frequency),
  );
  return desired.map((point, index) => ({
    frequency: point.frequency,
    gain:
      point.gain * eqModeGainScale(mode) - originalGains[index] * basePasses,
  }));
};
