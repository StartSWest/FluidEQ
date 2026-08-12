/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.
*/

import { parseEqText } from './apoText';
import {
  AutoEqFormat,
  IApoLayerOverride,
  IFiltersMap,
  IState,
  TApoFeature,
} from './constants';

const overrideFromParsed = (
  parsed: ReturnType<typeof parseEqText>,
): IApoLayerOverride => ({
  filters: parsed.filters,
  ...(parsed.eqFormat === AutoEqFormat.GRAPHIC && parsed.graphicEq?.length
    ? { graphicEq: parsed.graphicEq }
    : {}),
});

const twoPlaces = (value: number) => Math.round(value * 100) / 100;

const overrideSignature = (override: IApoLayerOverride) => {
  if (override.graphicEq?.length) {
    // Point order is audible: APO interpolates between neighbouring entries.
    return `graphic=${override.graphicEq
      .map(({ frequency, gain }) => `${frequency}:${twoPlaces(gain)}`)
      .join(',')}`;
  }
  // Biquads commute for magnitude response, so text order is deliberately not
  // part of the comparison. Two decimal places is the writer's precision; a
  // 0.04 dB hand edit must not be rounded away as if FluidEQ wrote it.
  return `bands=${Object.values(override.filters)
    .map(
      ({ type, frequency, gain, quality }) =>
        `${type}@${frequency}/${twoPlaces(gain)}/${twoPlaces(quality)}`,
    )
    .sort()
    .join(',')}`;
};

/** Comparable audible contents of one generated feature file. */
export const describeApoFeatureText = (contents: string): string => {
  const parsed = parseEqText(contents);
  return parsed.unsupported > 0
    ? `unsupported=${parsed.unsupported}|${contents.replace(/\s+/g, ' ').trim()}`
    : overrideSignature(overrideFromParsed(parsed));
};

export interface IApoFeatureAdoption {
  changed: boolean;
  unsupported: number;
}

const hasOverrideContent = (override: IApoLayerOverride) =>
  Object.keys(override.filters).length > 0 ||
  Boolean(override.graphicEq?.length);

const clearEqBands = (filters: IFiltersMap): IFiltersMap =>
  Object.fromEntries(
    Object.entries(filters).map(([id, filter]) => [id, { ...filter, gain: 0 }]),
  );

/**
 * Adopt one externally edited generated feature file into live state.
 *
 * Unsupported APO filter types are refused instead of being silently erased
 * by the next FluidEQ write. The caller compares file signatures first, so a
 * FluidEQ-originated write never arrives here and cannot form a feedback loop.
 */
export const adoptApoFeatureText = (
  state: IState,
  feature: TApoFeature,
  contents: string,
): IApoFeatureAdoption => {
  const parsed = parseEqText(contents);
  if (parsed.unsupported > 0) {
    return { changed: false, unsupported: parsed.unsupported };
  }
  const override = overrideFromParsed(parsed);
  const hasContent = hasOverrideContent(override);

  if (feature === 'eq') {
    state.filters = hasContent ? override.filters : clearEqBands(state.filters);
    state.eqFormat = hasContent ? parsed.eqFormat : AutoEqFormat.PARAMETRIC;
    state.graphicEq = hasContent ? override.graphicEq : undefined;
    state.isFlat = !hasContent;
    state.eqImport = undefined;
    return { changed: true, unsupported: 0 };
  }

  if (feature === 'driver') {
    state.driver = hasContent
      ? {
          profileId: state.driver?.profileId || 'apo-custom',
          intensity: 1,
          apoOverride: override,
        }
      : undefined;
  } else if (feature === 'headphone') {
    state.headphone = hasContent
      ? {
          filters: state.headphone?.filters ?? {},
          intensity: 1,
          apoOverride: override,
        }
      : undefined;
    state.headset = undefined;
    state.headsetTarget = undefined;
    state.headsetSource = undefined;
    state.headsetSignature = undefined;
  } else if (feature === 'voicing') {
    state.voicing = hasContent
      ? {
          profileId: state.voicing?.profileId || 'apo-custom',
          intensity: 1,
          apoOverride: override,
        }
      : undefined;
  } else if (feature === 'smart') {
    state.smartEq = hasContent
      ? {
          ...(state.smartEq ?? { filters: {} }),
          intensity: 1,
          apoOverride: override,
        }
      : undefined;
  }

  return { changed: true, unsupported: 0 };
};
