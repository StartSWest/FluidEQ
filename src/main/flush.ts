/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import fs from 'fs';
import path from 'path';
import {
  AutoEqFormat,
  FilterTypeEnum,
  APO_LAYERS,
  TApoFeature,
  TApoLayer,
  clampFrequency,
  clampGain,
  clampQuality,
  IFilter,
  getDefaultState,
  IConvolutionProfile,
  IFiltersMap,
  IGraphicEqPoint,
  IPresetV1,
  IPresetV2,
  IState,
  NO_GAIN_FILTER_TYPES,
  AUTOMATIC_PRESET_PREFIX,
} from '../common/constants';
import { PRODUCT_NAME } from '../common/branding';
import { getVoicingFilters } from '../common/voicing';
import { getDriverFilters } from '../common/driver';
import { getSmartEqFilters, sanitizeSmartEqSettings } from '../common/smartEq';
import { getChainPeakGain } from '../common/response';
import {
  validatePresetV1,
  validatePresetV2,
  validateState,
} from '../common/validator';

/**
 * Whether a band can be written as a filter Equalizer APO can actually build.
 *
 * A NaN or Infinity anywhere in a band survives every numeric clamp and lands
 * in the config as text APO cannot parse into biquad coefficients. Dropping
 * the band costs one filter; writing it can take out the whole chain.
 */
const isRenderableFilter = ({
  frequency,
  gain,
  quality,
}: {
  frequency: number;
  gain: number;
  quality: number;
}) =>
  Number.isFinite(frequency) &&
  Number.isFinite(gain) &&
  Number.isFinite(quality);

/**
 * The single preamp value for a chain, in dB.
 *
 * Auto normalize reserves exactly the headroom the written filters need and
 * no more. Deriving it from the filters themselves — rather than trusting a
 * number computed elsewhere and saved — is what makes it self-correcting: the
 * response graph only recalculates while it is mounted, so a voicing or driver
 * change made on another tab used to leave the preamp describing a chain that
 * was no longer there.
 */
const resolvePreAmp = (
  state: IState,
  writtenFilters: Array<
    Pick<IFilter, 'type' | 'frequency' | 'gain' | 'quality'>
  >,
  hasConvolution: boolean,
) => {
  if (!state.isAutoPreAmpOn) {
    return state.preAmp;
  }

  // Everything that boosts has to be counted, not just the parametric bands.
  //
  // A GraphicEQ profile writes no Filter lines at all, and a convolution is a
  // single Convolution line rather than a filter list — so a chain built from
  // either contributes nothing to `writtenFilters` and would reserve no
  // headroom whatsoever. A +9 dB graphic curve would then be handed to APO
  // with Preamp: 0 dB and clip.
  const graphicPeak =
    state.eqFormat === AutoEqFormat.GRAPHIC && state.graphicEq?.length
      ? state.graphicEq.reduce(
          (highest, { gain }) =>
            Number.isFinite(gain) ? Math.max(highest, gain) : highest,
          0,
        )
      : 0;

  // A downloaded impulse response is already normalised by whoever published
  // it — the filter set stored alongside it is only a sketch for the graph, so
  // treating it as real gain reserves headroom nothing is using and makes the
  // output quieter than it needs to be. Only an impulse FluidEQ generated
  // itself, which has no file of its own, is worth counting.
  const convolutionFilters =
    hasConvolution && state.convolution && !state.convolution.fileName
      ? Object.values(state.convolution.filters || {})
      : [];

  // One combined peak over everything, not a sum of separate peaks. Boosts at
  // different frequencies never coincide, and adding their peaks would throw
  // away volume for headroom that is never needed — the same reasoning the
  // band chain already uses.
  const filterPeak = getChainPeakGain([
    ...writtenFilters,
    ...convolutionFilters,
  ]);

  /*
   * BOTH DIRECTIONS, WHICH IS WHAT "NORMALISE" MEANS.
   *
   * This used to be `-Math.max(0, peak)`: reserve for a boost, and do nothing
   * at all for a cut. Half a job, and the missing half was the audible one — a
   * chain that only cuts made everything quieter and nothing put it back, so
   * switching a voicing on cost volume with no way to see where it went.
   *
   * The correct amount in either direction is the same number: whatever brings
   * the chain's loudest point back to unity. Positive when the chain cuts,
   * negative when it boosts, and it cannot clip in either case — by
   * construction the loudest point lands at 0 dB and everything else below it.
   *
   * Raising also lifts whatever noise the chain had attenuated, by exactly the
   * amount it had attenuated it, so the signal-to-noise ratio is unchanged.
   * What changes is only that the listener is not silently taxed for using a
   * feature.
   *
   * The graphic curve is a separate APO stage, so its contribution stacks on
   * top rather than sharing the peak.
   */
  return -(filterPeak + graphicPeak);
};

/** A filter stripped to the four things a config line is made of. */
type TChainFilter = Pick<IFilter, 'type' | 'frequency' | 'gain' | 'quality'>;

/** What one feature contributes to a device's chain. */
interface IApoLayer {
  feature: TApoFeature;
  /** The filters it writes, in order. Empty for a GraphicEQ profile. */
  filters: TChainFilter[];
  /** The `GraphicEQ:` command the EQ writes instead of filters, if any. */
  graphicEq?: string;
}

/**
 * A layer's filters, stripped to what the config needs.
 *
 * The `isRenderableFilter` pass is the last line of defence before Equalizer
 * APO. A band whose numbers are not finite — a malformed import, a corrupt
 * preset — cannot be rendered as a filter APO can build, so it is dropped
 * rather than written out as `Fc NaN Hz` and left for APO to choke on.
 */
const layerFilters = (filters: TChainFilter[]): TChainFilter[] =>
  filters
    .filter(isRenderableFilter)
    .map(({ type, frequency, gain, quality }) => ({
      type,
      frequency,
      gain,
      quality,
    }));

/**
 * The chain a state describes, feature by feature.
 *
 * A feature with nothing to say is absent rather than empty, which is what lets
 * the writer decide "this device has no voicing" by asking whether the layer is
 * there — the same question, whether it ends up as an omitted block of lines or
 * an omitted `Include:`.
 *
 * A bypassed feature is absent for the same reason and by the same route, and
 * that is the whole implementation of the A/B switch. Its settings are
 * untouched; they simply are not written. Dropping it here rather than at the
 * `Include:` is what keeps the preamp honest — the headroom comes back the
 * moment the layer stops being applied, because it is measured over what was
 * actually written.
 */
const buildLayers = (state: IState): IApoLayer[] => {
  const layers: IApoLayer[] = [];
  const isBypassed = (layer: TApoLayer) =>
    (state.bypassed ?? []).includes(layer);
  const addLayer = (feature: TApoFeature, filters: TChainFilter[]) => {
    if (filters.length && !isBypassed(feature)) {
      layers.push({ feature, filters });
    }
  };

  // Outside the isFlat check, like the voicing: clearing the EQ resets the
  // bands somebody tuned, not the correction for what they are listening on.
  addLayer('driver', layerFilters(getDriverFilters(state.driver)));

  if (!state.isFlat && !isBypassed('eq')) {
    if (state.eqFormat === AutoEqFormat.GRAPHIC && state.graphicEq?.length) {
      const points = state.graphicEq
        .filter(
          ({ frequency, gain }) =>
            Number.isFinite(frequency) && Number.isFinite(gain),
        )
        .map(({ frequency, gain }) => `${frequency} ${clampGain(gain)}`)
        .join('; ');
      if (points) {
        layers.push({
          feature: 'eq',
          filters: [],
          graphicEq: `GraphicEQ: ${points}`,
        });
      }
    } else {
      addLayer(
        'eq',
        layerFilters(Object.values(state.filters)).filter(
          // A zero-gain PK/shelf is neutral. Do not leave inert EQ commands in
          // APO after the user presses Reset gains.
          ({ gain, type }) =>
            ![
              FilterTypeEnum.PK,
              FilterTypeEnum.LSC,
              FilterTypeEnum.HSC,
            ].includes(type) || clampGain(gain) !== 0,
        ),
      );
    }
  }

  // Deliberately outside the isFlat check: clearing the EQ resets the bands the
  // user tuned, not the target curve they chose, and switching the voicing off
  // restores their tuning untouched.
  addLayer('voicing', layerFilters(getVoicingFilters(state.voicing)));

  // Outside the isFlat check for the same reason as the other two layers —
  // clearing the bands the user tuned does not un-measure what came out of the
  // speakers.
  addLayer('smart', layerFilters(getSmartEqFilters(state.smartEq)));

  return layers;
};

/**
 * A number as a config line should carry it.
 *
 * A fitted correction arrives as full double precision, so bands went into the
 * file reading `Gain -0.5473804429990239 dB Q 2.530281730867148` — sixteen
 * significant figures for a quantity whose smallest audible step is around a
 * tenth of a decibel. APO parses it perfectly well and nobody can read it, and
 * one of the things the split was for is a config a person can open at two in
 * the morning and understand.
 *
 * Two places is past the threshold of hearing and past what any of these
 * controls can express, so nothing is lost. Trailing zeros go with it: `3.5`
 * rather than `3.50`, and `4` rather than `4.00`.
 */
const configNumber = (value: number) => Math.round(value * 100) / 100;

const renderFilter = (filter: TChainFilter, index: number) => {
  const head = `Filter ${index}: ON ${filter.type} Fc ${clampFrequency(
    filter.frequency,
  )} Hz`;
  const quality = configNumber(clampQuality(filter.quality));
  // Band pass, notch, low pass and high pass have no Gain parameter in
  // Equalizer APO's ParametricEQ grammar — the token only belongs to the
  // peaking and shelf forms. Emitting it for the others makes APO reject the
  // line, so the band silently did nothing.
  return NO_GAIN_FILTER_TYPES.includes(filter.type)
    ? `${head} Q ${quality}`
    : `${head} Gain ${configNumber(clampGain(filter.gain))} dB Q ${quality}`;
};

/**
 * One layer's lines, numbered on from `startIndex`.
 *
 * The index is a label, not an address, and this is the assumption the whole
 * split rests on: a feature file that starts again at `Filter 1:` is only safe
 * if nothing downstream reads the number. Equalizer APO's own source settles
 * it — `BiQuadFilterFactory::createFilter` tests `command.find(L"Filter") == 0`
 * and never parses the digits at all, constructing one biquad per matching line
 * and appending it in document order.
 *
 * Written into a single file the count still runs on across the layers, because
 * a repeated index in one file reads like a mistake to anyone opening it.
 * Written into a file per feature each starts at 1, which is what makes a
 * feature file independent of every other feature — the point of splitting them.
 */
const renderLayer = (layer: IApoLayer, startIndex = 0): string[] =>
  layer.graphicEq
    ? [layer.graphicEq]
    : layer.filters.map((filter, offset) =>
        renderFilter(filter, startIndex + offset + 1),
      );

/**
 * The one `Preamp:` line for a chain.
 *
 * This line MUST be "Preamp" without a capitalized P for APO to work.
 *
 * One preamp for the whole chain, and its value is derived here rather than
 * stored. Every layer shares it, so it has to cancel the peak of all of them
 * combined — and because it is recomputed from what was just written, removing
 * a layer gives its headroom straight back instead of leaving the output
 * quietly attenuated for a boost that no longer exists.
 *
 * It is therefore the one thing that cannot move into a feature's own file: the
 * peak of a sum is not the sum of the peaks, so independent reserves would
 * under-protect. It belongs to the device, after everything it is protecting.
 */
const preAmpLine = (
  state: IState,
  layers: IApoLayer[],
  hasConvolution: boolean,
) =>
  `Preamp: ${clampGain(
    resolvePreAmp(
      state,
      layers.reduce<TChainFilter[]>(
        (written, layer) => written.concat(layer.filters),
        [],
      ),
      hasConvolution,
    ),
  )} dB`;

/**
 * Whether the impulse response is part of this chain.
 *
 * The convolution never becomes a feature file — APO applies an impulse as a
 * stage of its own, ahead of the filters, so it is one `Convolution:` line in
 * the device file. But it is switched off the same way everything else is, by
 * the line not being written, which is what lets it take the same A/B switch as
 * the layers that do get files.
 */
const isConvolutionApplied = (state: IState, convolutionFileName?: string) =>
  Boolean(state.convolution && convolutionFileName) &&
  !(state.bypassed ?? []).includes('convolution');

/**
 * A whole chain as one block of config text.
 *
 * The flat form: everything for one device between its `Device:` line and its
 * preamp. Nothing writes this to disk any more — `stateToApoFiles` does that,
 * split across files — but it is still exactly what APO ends up seeing once the
 * includes are followed, which makes it the right thing to compare a config on
 * disk against when deciding whether anything drifted while we were away.
 */
export const stateToString = (
  state: IState,
  convolutionFileName?: string,
  devicePattern = 'all',
) => {
  if (!state.isEnabled) {
    return '';
  }

  const hasConvolution = isConvolutionApplied(state, convolutionFileName);
  const layers = buildLayers(state);
  const output = [`Device: ${devicePattern}`, 'Channel: all'];

  if (hasConvolution) {
    output.push(`Convolution: ${convolutionFileName}`);
  }

  let filterIndex = 0;
  layers.forEach((layer) => {
    output.push(...renderLayer(layer, filterIndex));
    filterIndex += layer.filters.length;
  });

  output.push(preAmpLine(state, layers, hasConvolution));

  return output.join('\n\r');
};

/** A chain as the pieces the device file is assembled from. */
export interface IApoChainFiles {
  /** The `Convolution:` line, when this device has an impulse response. */
  convolution?: string;
  /** One entry per feature with anything to say, in the order APO applies them. */
  features: Array<{ feature: TApoFeature; lines: string[] }>;
  /** The `Preamp:` line, sized over every filter of every feature above. */
  preAmp: string;
}

/**
 * A chain as one file per feature, plus what has to stay with the device.
 *
 * The point is that a feature is one thing even though its filters are many.
 * Ten `Filter:` lines sharing a config with everyone else's cannot be switched
 * off atomically; one `Include:` line can simply not be written. Everything a
 * feature contributes goes in its own file and nothing else does, so a write
 * for one of them cannot reach another's.
 *
 * Two things stay behind, both because they are properties of the whole chain
 * rather than of any feature: the convolution, which APO applies before all of
 * them, and the preamp, which is sized against all of them at once.
 */
export const stateToApoFiles = (
  state: IState,
  convolutionFileName?: string,
): IApoChainFiles | undefined => {
  if (!state.isEnabled) {
    return undefined;
  }

  const hasConvolution = isConvolutionApplied(state, convolutionFileName);
  const layers = buildLayers(state);

  return {
    ...(hasConvolution
      ? { convolution: `Convolution: ${convolutionFileName}` }
      : {}),
    features: layers.map((layer) => ({
      feature: layer.feature,
      lines: renderLayer(layer),
    })),
    preAmp: preAmpLine(state, layers, hasConvolution),
  };
};

export const serializeState = (state: IState) => {
  return JSON.stringify(state);
};

export const serializePreset = (preset: IPresetV2) => {
  return JSON.stringify(preset);
};

const CONFIG_CONTENT = 'Include: fluideq.txt';
// A value on disk, not a name in code: this is what upstream AQUA wrote into
// Equalizer APO's config.txt, and it has to keep matching so an install being
// upgraded from that project is recognised rather than duplicated.
const LEGACY_CONFIG_CONTENT = /^\s*Include:\s*aqua\.txt\s*$/i;
const LOCAL_STATE_FILENAME = 'state.txt';
export const FLUIDEQ_CONFIG_FILENAME = 'fluideq.txt';
const CONFIG_FILENAME = 'config.txt';
export const PRESETS_DIR = 'presets';

export const addFileToPath = (pathPrefix: string, fileName: string) => {
  return path.join(pathPrefix, fileName);
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const toFiniteNumber = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

const normalizeFilter = (
  filter: unknown,
  fallbackId: string,
): IFilter | undefined => {
  if (!isObject(filter)) {
    return undefined;
  }
  const rawId = filter.id;
  const id = typeof rawId === 'string' && rawId.trim() ? rawId : fallbackId;
  const frequency = toFiniteNumber(filter.frequency);
  const gain = toFiniteNumber(filter.gain);
  const quality = toFiniteNumber(filter.quality);
  const { type } = filter;
  if (
    typeof id !== 'string' ||
    id.trim() === '' ||
    typeof frequency !== 'number' ||
    typeof gain !== 'number' ||
    typeof quality !== 'number' ||
    !Object.values(FilterTypeEnum).includes(type as FilterTypeEnum)
  ) {
    return undefined;
  }
  return {
    id,
    frequency,
    gain: clampGain(gain),
    quality: clampQuality(quality),
    type: type as FilterTypeEnum,
  };
};

const normalizeFilters = (filters: IFiltersMap | unknown): IFiltersMap =>
  isObject(filters)
    ? Object.fromEntries(
        Object.entries(filters)
          .map(([id, filter]) => {
            const normalized = normalizeFilter(filter, id);
            return normalized ? [normalized.id, normalized] : undefined;
          })
          .filter((entry): entry is [string, IFilter] => Boolean(entry)),
      )
    : {};

// The persisted convolution profile comes from disk, so validate its required
// fields instead of asserting the shape. A malformed entry is dropped rather
// than handed to the APO writer as a half-built profile.
const normalizeConvolution = (
  value: unknown,
): IConvolutionProfile | undefined => {
  if (!isObject(value) || typeof value.name !== 'string' || !value.name) {
    return undefined;
  }
  const filters = normalizeFilters(value.filters);
  const optionalString = (input: unknown) =>
    typeof input === 'string' && input ? input : undefined;

  return {
    name: value.name,
    filters,
    fileName: optionalString(value.fileName),
    sourceUrl: optionalString(value.sourceUrl),
    sourceId: optionalString(value.sourceId),
  };
};

/**
 * A voicing or driver selection off disk.
 *
 * Both are `{profileId, intensity}` and both are validated the same way: an
 * unknown profile id is harmless because the layer lookup returns nothing for
 * it, but an intensity that is not a number would be scaled into every gain.
 */
const normalizeLayerSelection = (value: unknown) => {
  if (!isObject(value) || typeof value.profileId !== 'string') {
    return undefined;
  }
  const intensity = toFiniteNumber(value.intensity);
  return {
    profileId: value.profileId,
    intensity:
      intensity === undefined ? 1 : Math.min(1, Math.max(0, intensity)),
  };
};

/**
 * The list of switched-off layers, off disk.
 *
 * Anything that is not a feature name is dropped rather than carried through.
 * An unrecognised entry can only come from a hand edit or a newer FluidEQ, and
 * a layer that is off for a reason nothing in this build understands is one
 * nobody can switch back on. Filtering through APO_FEATURES also settles order
 * and duplicates, so two equivalent lists compare equal.
 */
const normalizeBypassed = (value: unknown): TApoLayer[] | undefined => {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const layers = APO_LAYERS.filter((layer) => value.includes(layer));
  return layers.length ? [...layers] : undefined;
};

const normalizeGraphicEq = (points: IGraphicEqPoint[] | undefined) =>
  Array.isArray(points)
    ? points.filter(
        ({ frequency, gain }) =>
          Number.isFinite(frequency) && Number.isFinite(gain),
      )
    : undefined;

export const fetchSettings = (settingsDir: string) => {
  const settingsPath = path.join(settingsDir, LOCAL_STATE_FILENAME);
  const fallbackState = getDefaultState();

  const isValidEqFormat = (input: unknown): input is AutoEqFormat =>
    input === AutoEqFormat.PARAMETRIC ||
    input === AutoEqFormat.FIXED_BAND ||
    input === AutoEqFormat.GRAPHIC;

  const normalizeState = (input: unknown): IState | undefined => {
    if (!isObject(input)) {
      return undefined;
    }
    const filters = normalizeFilters(input.filters);
    if (!Object.keys(filters).length) {
      return undefined;
    }

    const bypassed = normalizeBypassed(input.bypassed);
    const convolution = normalizeConvolution(input.convolution);
    // The recovery path rebuilds the state field by field, so a layer it does
    // not mention is silently thrown away — which is what used to happen to the
    // voicing and the driver every time a state file failed validation. Losing
    // a measured Smart EQ correction the same way would be worse: unlike the
    // other two it cannot be picked again from a list, only re-measured.
    const voicing = normalizeLayerSelection(input.voicing);
    const driver = normalizeLayerSelection(input.driver);
    const smartEq = sanitizeSmartEqSettings(input.smartEq);

    return {
      ...fallbackState,
      isEnabled:
        typeof input.isEnabled === 'boolean'
          ? input.isEnabled
          : fallbackState.isEnabled,
      isAutoPreAmpOn:
        typeof input.isAutoPreAmpOn === 'boolean'
          ? input.isAutoPreAmpOn
          : fallbackState.isAutoPreAmpOn,
      isGraphViewOn:
        typeof input.isGraphViewOn === 'boolean'
          ? input.isGraphViewOn
          : fallbackState.isGraphViewOn,
      isCaseSensitiveFs: false,
      preAmp: (() => {
        const preAmp = toFiniteNumber(input.preAmp);
        return preAmp === undefined ? fallbackState.preAmp : clampGain(preAmp);
      })(),
      filters,
      ...(isValidEqFormat(input.eqFormat) ? { eqFormat: input.eqFormat } : {}),
      ...(Array.isArray(input.graphicEq)
        ? { graphicEq: normalizeGraphicEq(input.graphicEq) }
        : {}),
      ...(typeof input.isFlat === 'boolean' ? { isFlat: input.isFlat } : {}),
      ...(convolution ? { convolution } : {}),
      ...(voicing ? { voicing } : {}),
      ...(driver ? { driver } : {}),
      ...(smartEq ? { smartEq } : {}),
      ...(bypassed ? { bypassed } : {}),
    } as IState;
  };

  try {
    const content = fs.readFileSync(settingsPath, {
      encoding: 'utf8',
    });
    const input = JSON.parse(content);
    if (!validateState(input)) {
      const recovered = normalizeState(input);
      if (recovered && validateState(recovered)) {
        try {
          fs.writeFileSync(settingsPath, serializeState(recovered), {
            encoding: 'utf8',
          });
        } catch {
          // Ignore write failure and continue with recovered state in memory.
        }
        return recovered;
      }
      throw new Error('Invalid state file loaded. Using default state.');
    }
    const bypassed = normalizeBypassed(input.bypassed);
    // Manually set case sensitivity as false until it is confirmed in app that it can be enabled
    return {
      ...input,
      preAmp: clampGain(input.preAmp),
      filters: normalizeFilters(input.filters),
      ...(Array.isArray(input.graphicEq)
        ? { graphicEq: normalizeGraphicEq(input.graphicEq) }
        : {}),
      // Sanitised where the file had one and left absent where it did not, so
      // a state that never switched anything off is the object it always was.
      ...(isObject(input) && 'bypassed' in input ? { bypassed } : {}),
      isCaseSensitiveFs: false,
    } as IState;
  } catch (ex) {
    if ((ex as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.error(
        `Unable to load saved ${PRODUCT_NAME} state; using defaults.`,
        ex,
      );
    }
    // if unable to fetch the state, use a default one
    return getDefaultState();
  }
};

export const save = (state: IState, settingsDir: string) => {
  const settingsPath = path.join(settingsDir, LOCAL_STATE_FILENAME);
  try {
    fs.writeFileSync(settingsPath, serializeState(state), {
      encoding: 'utf8',
    });
  } catch (ex) {
    console.log(`Failed to save to ${settingsPath}`);
    throw ex;
  }
};

export const fetchPreset = (presetName: string, presetsDir: string) => {
  try {
    const presetPath = path.join(presetsDir, presetName);
    const content = fs.readFileSync(presetPath, {
      encoding: 'utf8',
    });
    const json = JSON.parse(content);
    if (validatePresetV1(json)) {
      const oldFormat = json as IPresetV1;
      const newFormat: IPresetV2 = {
        preAmp: clampGain(oldFormat.preAmp),
        filters: {},
      };
      oldFormat.filters.forEach((filter) => {
        // Its okay to shallow copy the filter because we won't give oldFormat to anyone else.
        newFormat.filters[filter.id] = {
          ...filter,
          gain: clampGain(filter.gain),
          quality: clampQuality(filter.quality),
        };
      });
      try {
        // Try to update our file.
        savePreset(presetName, newFormat, presetsDir);
      } catch {
        // Ignore failed updates.
      }
      return newFormat;
    }
    if (!validatePresetV2(json)) {
      throw new Error('Invalid preset file');
    }
    const preset = json as IPresetV2;
    const graphicEq = normalizeGraphicEq(preset.graphicEq);
    const bypassed = normalizeBypassed(preset.bypassed);
    return {
      ...preset,
      preAmp: clampGain(preset.preAmp),
      filters: normalizeFilters(preset.filters),
      ...(graphicEq ? { graphicEq } : {}),
      ...('bypassed' in preset ? { bypassed } : {}),
    };
  } catch (ex) {
    console.log('Failed to get presets!!');
    console.log(ex);
    throw ex;
  }
};

/**
 * Throttled preset-write logging.
 *
 * Auto-save writes the attached profile on every edit, so logging each one
 * turned a single slider drag into hundreds of identical lines — noise that
 * buries anything useful and costs main-process time in the middle of an
 * interaction. One line per profile per second is enough to see it working.
 */
const lastPresetLogAt = new Map<string, number>();
const PRESET_LOG_INTERVAL_MS = 1000;

const logPresetWrite = (presetName: string) => {
  const now = Date.now();
  const previous = lastPresetLogAt.get(presetName) ?? 0;
  if (now - previous < PRESET_LOG_INTERVAL_MS) {
    return;
  }
  lastPresetLogAt.set(presetName, now);
  console.log(`Wrote preset for: ${presetName}`);
};

export const savePreset = (
  presetName: string,
  presetInfo: IPresetV2,
  presetsDir: string,
) => {
  try {
    const presetPath = path.join(presetsDir, presetName);
    fs.writeFileSync(presetPath, serializePreset(presetInfo), {
      encoding: 'utf8',
    });
  } catch (ex) {
    console.log('Failed to save to preset %d', presetName);
    throw ex;
  }
  logPresetWrite(presetName);
};

/**
 * Directory holding the last *manually* saved copy of each profile.
 *
 * It sits outside the presets directory on purpose: every edit auto-saves over
 * the live profile, so without a second copy there is nothing to go back to.
 * Keeping it out of `presets/` also means these never show up in the profile
 * catalogue, which lists that directory verbatim.
 */
export const PRESET_BASELINES_DIR = 'preset-baselines';

/**
 * Profile names come from user input and are used as filenames. A name that
 * escapes its directory is refused rather than sanitised, so a rejected write
 * can never land somewhere unexpected.
 */
const safeBaselineName = (presetName: string) =>
  presetName &&
  presetName === path.basename(presetName) &&
  !presetName.includes('..')
    ? presetName
    : undefined;

export const savePresetBaseline = (
  presetName: string,
  presetInfo: IPresetV2,
  baselineDir: string,
) => {
  const safeName = safeBaselineName(presetName);
  if (!safeName) {
    return;
  }
  try {
    fs.mkdirSync(baselineDir, { recursive: true });
    fs.writeFileSync(
      path.join(baselineDir, safeName),
      serializePreset(presetInfo),
      { encoding: 'utf8' },
    );
  } catch (ex) {
    // A missing baseline costs the user an undo, not their tuning. Never let
    // it fail the save that triggered it.
    console.log(`Failed to write the baseline for ${presetName}`);
  }
};

/** The last manually saved copy, or undefined when there is nothing to go back to. */
export const fetchPresetBaseline = (
  presetName: string,
  baselineDir: string,
): IPresetV2 | undefined => {
  const safeName = safeBaselineName(presetName);
  if (!safeName) {
    return undefined;
  }
  try {
    const json = JSON.parse(
      fs.readFileSync(path.join(baselineDir, safeName), { encoding: 'utf8' }),
    );
    if (!validatePresetV2(json)) {
      return undefined;
    }
    const preset = json as IPresetV2;
    const graphicEq = normalizeGraphicEq(preset.graphicEq);
    return {
      ...preset,
      preAmp: clampGain(preset.preAmp),
      filters: normalizeFilters(preset.filters),
      ...(graphicEq ? { graphicEq } : {}),
    };
  } catch {
    return undefined;
  }
};

export const hasPresetBaseline = (presetName: string, baselineDir: string) => {
  const safeName = safeBaselineName(presetName);
  return safeName ? fs.existsSync(path.join(baselineDir, safeName)) : false;
};

export const deletePresetBaseline = (
  presetName: string,
  baselineDir: string,
) => {
  const safeName = safeBaselineName(presetName);
  if (!safeName) {
    return;
  }
  try {
    fs.unlinkSync(path.join(baselineDir, safeName));
  } catch {
    // Nothing to remove is the normal case for a profile never saved by hand.
  }
};

export const renamePresetBaseline = (
  oldName: string,
  newName: string,
  baselineDir: string,
) => {
  const safeOld = safeBaselineName(oldName);
  const safeNew = safeBaselineName(newName);
  if (!safeOld || !safeNew) {
    return;
  }
  try {
    fs.renameSync(
      path.join(baselineDir, safeOld),
      path.join(baselineDir, safeNew),
    );
  } catch {
    // The profile may never have been saved by hand; that is not an error.
  }
};

/**
 * Undo makeup gain that a device never asked for.
 *
 * Preamp exists to reserve headroom for boosts. A profile whose EQ is cleared
 * has no boosts, so a non-zero preamp on it is not a setting — it is a leftover
 * from when switching outputs carried the previous device's state across and
 * auto-save then wrote it down. The audible result is an output that is quietly
 * several dB down for no reason.
 *
 * Deliberately limited to automatic profiles. Those are created and maintained
 * by FluidEQ, so correcting them cannot throw away a decision anybody made; a
 * profile the user named and saved is left exactly as they left it, even if it
 * looks odd.
 *
 * Returns the names it repaired, so startup can say what it did.
 */
export const repairUnusedPreamps = (presetsDir: string): string[] => {
  const repaired: string[] = [];

  let fileNames: string[];
  try {
    fileNames = fs.readdirSync(presetsDir);
  } catch {
    return repaired;
  }

  fileNames
    .filter((fileName) => fileName.startsWith(AUTOMATIC_PRESET_PREFIX))
    .forEach((fileName) => {
      const presetPath = path.join(presetsDir, fileName);
      try {
        const preset = JSON.parse(fs.readFileSync(presetPath, 'utf8'));
        // Only the unambiguous case: nothing is being boosted, yet the profile
        // still carries gain.
        //
        // isAutoPreAmpOn === false is exactly the flag that says "this number
        // is the user's", so a profile carrying it is off limits however odd
        // the value looks. A cleared EQ can still boost, too — the voicing,
        // driver and Smart EQ layers are all written outside the isFlat check —
        // so a manual preamp on a flat profile is not necessarily leftover at
        // all.
        if (
          preset?.isFlat !== true ||
          !preset.preAmp ||
          preset.isAutoPreAmpOn === false
        ) {
          return;
        }
        fs.writeFileSync(
          presetPath,
          JSON.stringify({ ...preset, preAmp: 0 }),
          'utf8',
        );
        repaired.push(fileName);
      } catch {
        // A profile we cannot read is one we must not rewrite.
      }
    });

  return repaired;
};

export const deletePreset = (presetName: string, presetsDir: string) => {
  try {
    const presetPath = path.join(presetsDir, presetName);
    fs.unlinkSync(presetPath);
  } catch (ex) {
    console.log('Failed to delete preset');
    throw ex;
  }
  console.log(`Deleted preset: ${presetName}`);
};

export const doesPresetExist = (presetName: string, presetsDir: string) => {
  const testPath = addFileToPath(presetsDir, presetName);
  try {
    return fs.existsSync(testPath);
  } catch (ex) {
    console.log('Failed to check whether preset %d exists', presetName);
    throw ex;
  }
};

export const renamePreset = (
  oldName: string,
  newName: string,
  presetsDir: string,
) => {
  const oldPath = addFileToPath(presetsDir, oldName);
  const newPath = addFileToPath(presetsDir, newName);
  try {
    fs.renameSync(oldPath, newPath);
  } catch (ex) {
    console.log('Failed to rename preset %d to preset %d', oldName, newName);
    throw ex;
  }
};

export const checkConfigFile = (configDirPath: string) => {
  const configPath = addFileToPath(configDirPath, CONFIG_FILENAME);
  try {
    const content = fs.readFileSync(configPath, {
      encoding: 'utf8',
    });
    return content
      .split(/\r?\n/)
      .some((line) => line.trim() === CONFIG_CONTENT);
  } catch (ex) {
    throw new Error(`Unable to locate config file at ${configPath}`);
  }
};

export const updateConfig = (configDirPath: string) => {
  const configPath = addFileToPath(configDirPath, CONFIG_FILENAME);
  try {
    const existing = fs.existsSync(configPath)
      ? fs.readFileSync(configPath, 'utf8')
      : '';
    const normalized = existing
      .split(/\r?\n/)
      .filter(
        (line) =>
          !LEGACY_CONFIG_CONTENT.test(line) &&
          !/^\s*Include:\s*fluideq\.txt\s*$/i.test(line),
      )
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trimEnd();
    fs.writeFileSync(configPath, `${normalized}\n${CONFIG_CONTENT}\n`, {
      encoding: 'utf8',
    });
  } catch (ex) {
    throw new Error(`Unable to locate config file at ${configPath}`);
  }
};
