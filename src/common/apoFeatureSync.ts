/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.
*/

import { parseEqText } from './apoText';
import { canAdoptEqModeChange, getCurveEqMode } from './eqMode';
import {
  AutoEqFormat,
  IApoLayerOverride,
  IFiltersMap,
  IState,
  IGraphicEqPoint,
  MAX_GAIN,
  TApoFeature,
  clampQuality,
  clampFrequency,
} from './constants';
import { clampGainWithin, layerGainLimit } from './correctionRange';
import {
  FLAT_TONE,
  ITone,
  TONE_KNOBS,
  TONE_MAX_DB,
  TONE_SHAPES,
  toTone,
} from './tone';

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
  const signatures = contents.split(/\r?\n/).flatMap((rawLine) => {
    const line = rawLine.split('#')[0].trim();
    if (
      !line ||
      /^(?:Device\s*:|Channel\s*:\s*all\s*$|Preamp\s*:|Convolution\s*:)/i.test(
        line,
      )
    ) {
      return [];
    }
    if (!/^(?:Filter\b|GraphicEQ\s*:)/i.test(line)) {
      return [`unsupported=${line.replace(/\s+/g, ' ')}`];
    }
    const parsed = parseEqText(line, { preserveValues: true });
    return [
      parsed.unsupported > 0
        ? `unsupported=${line.replace(/\s+/g, ' ')}`
        : overrideSignature(overrideFromParsed(parsed)),
    ];
  });
  return signatures
    .filter((signature) => signature !== 'bands=')
    .sort()
    .join('|');
};

/**
 * A feature file as its layer would take it, and how much of it would not fit.
 * A gain past `gainLimit` counts against it: a slider's range by default, a
 * correction's for the correction layer (`layerGainLimit`).
 */
export const parseApoEqForAdoption = (
  contents: string,
  gainLimit = MAX_GAIN,
) => {
  const parsed = parseEqText(contents, { preserveValues: true });
  const lines = contents
    .split(/\r?\n/)
    .map((line) => line.split('#')[0].trim());
  const graphics = lines.filter((line) => /^GraphicEQ\s*:/i.test(line)).length;
  const hasFilters = lines.some((line) => /^Filter\b.*:\s*ON\b/i.test(line));
  const unknownCommands = lines.filter(
    (line) =>
      line &&
      !/^(?:Filter\b|GraphicEQ\s*:|Device\s*:|Channel\s*:\s*all\s*$|Preamp\s*:|Convolution\s*:)/i.test(
        line,
      ),
  ).length;
  const outOfRange =
    Object.values(parsed.filters).filter(
      (filter) =>
        filter.frequency !== clampFrequency(filter.frequency) ||
        filter.gain !== clampGainWithin(filter.gain, gainLimit) ||
        filter.quality !== clampQuality(filter.quality),
    ).length +
    (parsed.graphicEq ?? []).filter(
      (point) => point.gain !== clampGainWithin(point.gain, gainLimit),
    ).length;
  return {
    ...parsed,
    unsupported:
      parsed.unsupported +
      outOfRange +
      unknownCommands +
      (graphics > 1 || (graphics > 0 && hasFilters) ? 1 : 0),
  };
};

export interface IApoFeatureAdoption {
  changed: boolean;
  unsupported: number;
}

/**
 * How far a written Q may sit from its dial's own and still be that dial: the
 * file carries two places (a Butterworth 0.7071 is written 0.71), and the
 * engine takes a shelf this close as Butterworth.
 */
const TONE_QUALITY_TOLERANCE = 0.02;

/**
 * A hand edit of the Tone's file, taken back where it is still the three
 * dials: each filter one of `TONE_SHAPES` at its own type, frequency and
 * width, with only its gain moved and within the dials' travel. Anything
 * else has no dial to land on and is left as written, the way a filter the
 * editor cannot hold is — reading it back as something it is not would lose
 * it at the next write. Deleting every line takes the tone off.
 */
const adoptToneFilters = (
  state: IState,
  filters: IFiltersMap,
  graphicEq: IGraphicEqPoint[] | undefined,
): IApoFeatureAdoption => {
  const tone: ITone = { ...FLAT_TONE };
  const taken = new Set<keyof ITone>();
  let unsupported = graphicEq?.length ? 1 : 0;
  Object.values(filters).forEach((filter) => {
    const knob = TONE_KNOBS.find((candidate) => {
      const shape = TONE_SHAPES[candidate];
      return (
        !taken.has(candidate) &&
        shape.type === filter.type &&
        Math.abs(shape.frequency - filter.frequency) < 1 &&
        Math.abs(shape.quality - filter.quality) <= TONE_QUALITY_TOLERANCE
      );
    });
    if (knob === undefined || Math.abs(filter.gain) > TONE_MAX_DB) {
      unsupported += 1;
      return;
    }
    taken.add(knob);
    tone[knob] = filter.gain;
  });
  if (unsupported > 0) {
    return { changed: false, unsupported };
  }
  state.tone = toTone(tone);
  return { changed: true, unsupported: 0 };
};

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
  expectedContents?: string,
): IApoFeatureAdoption => {
  if (
    expectedContents !== undefined &&
    describeApoFeatureText(contents) ===
      describeApoFeatureText(expectedContents)
  ) {
    return { changed: false, unsupported: 0 };
  }
  const parsed = parseApoEqForAdoption(contents, layerGainLimit(feature));
  if (!canAdoptEqModeChange(state, feature)) {
    return { changed: false, unsupported: 1 };
  }
  if (parsed.unsupported > 0) {
    return { changed: false, unsupported: parsed.unsupported };
  }
  if (feature === 'tone') {
    return adoptToneFilters(state, parsed.filters, parsed.graphicEq);
  }
  const override = overrideFromParsed(parsed);
  const hasContent = hasOverrideContent(override);

  if (feature === 'eq') {
    state.curveEqMode = getCurveEqMode(state);
    state.isEqDoubleOn = false;
    state.eqMode = 'normal';
    state.eqBandQ = 'constant';
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
