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
import log from 'electron-log';
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
  IApoLayerOverride,
  IPresetV1,
  IPresetV2,
  IState,
  NO_GAIN_FILTER_TYPES,
  AUTOMATIC_PRESET_PREFIX,
} from '../common/constants';
import { PRODUCT_NAME } from '../common/branding';
import { getVoicingFilters, getVoicingGraphicEq } from '../common/voicing';
import { getDriverFilters, getDriverGraphicEq } from '../common/driver';
import {
  getHeadphoneFilters,
  getHeadphoneGraphicEq,
} from '../common/headphone';
import {
  getSmartEqFilters,
  getSmartEqGraphicEq,
  sanitizeSmartEqSettings,
} from '../common/smartEq';
import { getAutoPreAmpGain } from '../common/response';
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
  layers: IApoLayer[],
  hasConvolution: boolean,
) => {
  if (!state.isAutoPreAmpOn) {
    return state.preAmp;
  }

  const writtenFilters = layers.reduce<TChainFilter[]>(
    (written, layer) => written.concat(layer.filters),
    [],
  );

  // Native GraphicEQ stages have to be measured alongside the biquads at the
  // same frequencies. Adding each stage's independent maximum is safe but not
  // normalized: it reserves volume for boosts that never occur together.
  const curves = layers
    .map((layer) => layer.graphicPoints)
    .filter((points): points is IGraphicEqPoint[] => Boolean(points?.length));

  // The custom file is applied after FluidEQ's generated Preamp line, but its
  // parsed EQ commands still contribute to the level the output finally sees.
  // parseCustomFx removes editor-only GraphicEQ projections while retaining
  // explicit Filter commands from a mixed file. Unknown Plugin/Copy/Delay
  // commands remain outside this calculation because their gain cannot be
  // inferred safely.
  const customFx =
    state.customFx && !(state.bypassed ?? []).includes('custom')
      ? state.customFx
      : undefined;
  const customFilters = Object.values(customFx?.filters ?? {});
  if (customFx?.graphicEq?.length) {
    curves.push(customFx.graphicEq);
  }

  // A generated impulse is represented by the filters that created it. A
  // downloaded/imported WAV is represented by its measured response instead;
  // companion ParametricEQ filters omit the gain baked into the file and are
  // therefore unsuitable for absolute headroom.
  const convolutionFilters =
    hasConvolution && state.convolution && !state.convolution.fileName
      ? Object.values(state.convolution.filters || {})
      : [];
  if (
    hasConvolution &&
    state.convolution?.fileName &&
    state.convolution.response?.length
  ) {
    curves.push(state.convolution.response);
  } else if (
    hasConvolution &&
    state.convolution?.fileName &&
    Number.isFinite(state.convolution.peakGainDb)
  ) {
    // Legacy metadata with only a peak cannot say where that peak occurs. A
    // flat curve at that value is conservative until the WAV is re-analyzed.
    const peak = state.convolution.peakGainDb as number;
    curves.push([
      { frequency: 10, gain: peak },
      { frequency: 20000, gain: peak },
    ]);
  }

  return getAutoPreAmpGain({
    filters: [...writtenFilters, ...convolutionFilters, ...customFilters],
    curves,
    constantGain: customFx?.preAmp ?? 0,
  });
};

/** A filter stripped to the four things a config line is made of. */
type TChainFilter = Pick<IFilter, 'type' | 'frequency' | 'gain' | 'quality'>;

/** What one feature contributes to a device's chain. */
interface IApoLayer {
  feature: TApoFeature;
  /** The filters it writes, in order. Empty for a GraphicEQ profile. */
  filters: TChainFilter[];
  /** The `GraphicEQ:` command it writes instead of filters, if any. */
  graphicEq?: string;
  /**
   * The points that command was built from.
   *
   * Kept beside the rendered line so the preamp can measure the curve's peak
   * without parsing the text back out of it — see `resolvePreAmp`.
   */
  graphicPoints?: IGraphicEqPoint[];
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

  /**
   * A graphic curve as the one line APO reads it from, or nothing.
   *
   * Shared by the EQ and the headphone layer because they are the same command
   * with the same rules: non-finite points dropped, gains clamped, order kept.
   * Order matters — APO interpolates between neighbouring points, so sorting
   * them would be redrawing the curve rather than tidying it.
   */
  const graphicEqCommand = (points: IGraphicEqPoint[]): string | undefined => {
    const written = points
      .filter(
        ({ frequency, gain }) =>
          Number.isFinite(frequency) && Number.isFinite(gain),
      )
      .map(({ frequency, gain }) => `${frequency} ${clampGain(gain)}`)
      .join('; ');
    return written ? `GraphicEQ: ${written}` : undefined;
  };

  // Outside the isFlat check, like the voicing: clearing the EQ resets the
  // bands somebody tuned, not the correction for what they are listening on.
  const driverCurve = graphicEqCommand(getDriverGraphicEq(state.driver));
  if (driverCurve && !isBypassed('driver')) {
    layers.push({
      feature: 'driver',
      filters: [],
      graphicEq: driverCurve,
      graphicPoints: getDriverGraphicEq(state.driver),
    });
  } else {
    addLayer('driver', layerFilters(getDriverFilters(state.driver)));
  }

  // Ahead of the user's bands, like the driver, and outside the isFlat check
  // for the same reason: clearing the EQ resets the tuning somebody made, not
  // the published correction for the headphones they are wearing. That it used
  // to live inside those bands is exactly why clearing took it with it.
  //
  // A profile published as a graphic curve is written as one, not as the
  // peaking filters the parser fits to it for the editor's benefit. Those exist
  // so there is something to draw and something to drag; handing them to APO in
  // place of the curve substitutes a smoothed approximation for the
  // measurement, which is a downgrade nobody chose.
  const headphoneCurve = graphicEqCommand(
    getHeadphoneGraphicEq(state.headphone),
  );
  if (headphoneCurve && !isBypassed('headphone')) {
    layers.push({
      feature: 'headphone',
      filters: [],
      graphicEq: headphoneCurve,
      graphicPoints: getHeadphoneGraphicEq(state.headphone),
    });
  } else {
    addLayer('headphone', layerFilters(getHeadphoneFilters(state.headphone)));
  }

  if (!state.isFlat && !isBypassed('eq')) {
    if (state.eqFormat === AutoEqFormat.GRAPHIC && state.graphicEq?.length) {
      const eqCurve = graphicEqCommand(state.graphicEq);
      if (eqCurve) {
        layers.push({
          feature: 'eq',
          filters: [],
          graphicEq: eqCurve,
          graphicPoints: state.graphicEq,
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
  const voicingCurve = graphicEqCommand(getVoicingGraphicEq(state.voicing));
  if (voicingCurve && !isBypassed('voicing')) {
    layers.push({
      feature: 'voicing',
      filters: [],
      graphicEq: voicingCurve,
      graphicPoints: getVoicingGraphicEq(state.voicing),
    });
  } else {
    addLayer('voicing', layerFilters(getVoicingFilters(state.voicing)));
  }

  // Outside the isFlat check for the same reason as the other two layers —
  // clearing the bands the user tuned does not un-measure what came out of the
  // speakers.
  const smartCurve = graphicEqCommand(getSmartEqGraphicEq(state.smartEq));
  if (smartCurve && !isBypassed('smart')) {
    layers.push({
      feature: 'smart',
      filters: [],
      graphicEq: smartCurve,
      graphicPoints: getSmartEqGraphicEq(state.smartEq),
    });
  } else {
    addLayer('smart', layerFilters(getSmartEqFilters(state.smartEq)));
  }

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
) => `Preamp: ${clampGain(resolvePreAmp(state, layers, hasConvolution))} dB`;

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
 * The effective root preamp for the final generated chain.
 *
 * Exported for main-process state synchronization. The APO writer has always
 * derived this value at the last possible moment, but keeping it private meant
 * `state.preAmp` could still hold the manual value after automatic mode was
 * enabled. The sound and the slider then described different roots, and an
 * attached profile could be saved with the stale manual number.
 */
export const getResolvedPreAmp = (
  state: IState,
  convolutionFileName = state.convolution
    ? (state.convolution.fileName ?? 'generated-convolution.wav')
    : undefined,
) =>
  clampGain(
    resolvePreAmp(
      state,
      buildLayers(state),
      isConvolutionApplied(state, convolutionFileName),
    ),
  );

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
  /** Whether the user-owned custom file should remain in the chain. */
  custom?: boolean;
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
    // The custom file is deliberately not part of `layers`: FluidEQ cannot
    // inspect arbitrary Plugin/Copy/Delay commands when reserving headroom.
    // It can still switch its Include line for an A/B comparison.
    custom: !(state.bypassed ?? []).includes('custom'),
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

/**
 * A profile name is a filename, and it comes from the user.
 *
 * It arrives as `arg[0]` on four IPC channels and is joined straight onto a
 * directory, so without this every one of those channels is an invitation to
 * write, read, rename or delete somewhere else entirely. Refused rather than
 * sanitised: a name that has to be rewritten to be safe is not the name anybody
 * asked for, and quietly saving to a different file than the one requested is
 * its own kind of wrong.
 *
 * The separator tests are spelled out rather than left to `basename`, which is
 * platform-specific — a backslash is a legal filename character on POSIX, so a
 * test run anywhere but Windows would otherwise be checking a weaker rule than
 * the one that ships. `.` and `..` are named because they are the two values
 * that need no separator to escape.
 *
 * This lived here already, guarding the baselines directory alone under the
 * name `safeBaselineName`. The presets half — the one reachable from IPC — was
 * the half it never covered.
 */
const safePresetFileName = (presetName: string): string | undefined =>
  presetName &&
  !presetName.includes('/') &&
  !presetName.includes('\\') &&
  presetName === path.basename(presetName) &&
  presetName !== '.' &&
  presetName !== '..'
    ? presetName
    : undefined;

/**
 * The path a profile is allowed to occupy, or an exception.
 *
 * Throwing is the point. Every caller already sits inside a `try` that reports
 * a preset file error, so a refused name surfaces to the user as a save that
 * did not happen — which is the truth — instead of a save that landed somewhere
 * they will never find it.
 */
const presetFilePath = (presetsDir: string, presetName: string) => {
  const safeName = safePresetFileName(presetName);
  if (!safeName) {
    throw new Error(
      `Refused a profile name that is not a plain file name: ${presetName}`,
    );
  }
  return path.join(presetsDir, safeName);
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
  const response = Array.isArray(value.response)
    ? value.response
        .map((point) => {
          if (!isObject(point)) {
            return undefined;
          }
          const frequency = toFiniteNumber(point.frequency);
          const gain = toFiniteNumber(point.gain);
          return frequency !== undefined && frequency > 0 && gain !== undefined
            ? { frequency, gain }
            : undefined;
        })
        .filter((point): point is IGraphicEqPoint => point !== undefined)
    : undefined;
  const peakGainDb = toFiniteNumber(value.peakGainDb);

  return {
    name: value.name,
    filters,
    fileName: optionalString(value.fileName),
    ...(response?.length ? { response } : {}),
    ...(peakGainDb !== undefined ? { peakGainDb } : {}),
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
const normalizeApoOverride = (
  value: unknown,
): IApoLayerOverride | undefined => {
  if (!isObject(value)) {
    return undefined;
  }
  const filters = normalizeFilters(value.filters);
  const graphicEq = Array.isArray(value.graphicEq)
    ? value.graphicEq
        .map((point) => {
          if (!isObject(point)) {
            return undefined;
          }
          const frequency = toFiniteNumber(point.frequency);
          const gain = toFiniteNumber(point.gain);
          return frequency !== undefined && gain !== undefined
            ? { frequency, gain }
            : undefined;
        })
        .filter((point): point is IGraphicEqPoint => point !== undefined)
    : undefined;
  return Object.keys(filters).length || graphicEq?.length
    ? { filters, ...(graphicEq?.length ? { graphicEq } : {}) }
    : undefined;
};

const normalizeLayerSelection = (value: unknown) => {
  if (!isObject(value) || typeof value.profileId !== 'string') {
    return undefined;
  }
  const intensity = toFiniteNumber(value.intensity);
  const apoOverride = normalizeApoOverride(value.apoOverride);
  return {
    profileId: value.profileId,
    intensity:
      intensity === undefined ? 1 : Math.min(1, Math.max(0, intensity)),
    ...(apoOverride ? { apoOverride } : {}),
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
      log.error(
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
    log.error(`Failed to save to ${settingsPath}`);
    throw ex;
  }
};

export const fetchPreset = (presetName: string, presetsDir: string) => {
  try {
    const presetPath = presetFilePath(presetsDir, presetName);
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
    log.error('Failed to get presets!!');
    log.error(ex);
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
  log.info(`Wrote preset for: ${presetName}`);
};

export const savePreset = (
  presetName: string,
  presetInfo: IPresetV2,
  presetsDir: string,
) => {
  try {
    const presetPath = presetFilePath(presetsDir, presetName);
    fs.writeFileSync(presetPath, serializePreset(presetInfo), {
      encoding: 'utf8',
    });
  } catch (ex) {
    log.error('Failed to save to preset %d', presetName);
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

export const savePresetBaseline = (
  presetName: string,
  presetInfo: IPresetV2,
  baselineDir: string,
) => {
  const safeName = safePresetFileName(presetName);
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
    log.error(`Failed to write the baseline for ${presetName}`);
  }
};

/** The last manually saved copy, or undefined when there is nothing to go back to. */
export const fetchPresetBaseline = (
  presetName: string,
  baselineDir: string,
): IPresetV2 | undefined => {
  const safeName = safePresetFileName(presetName);
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
  const safeName = safePresetFileName(presetName);
  return safeName ? fs.existsSync(path.join(baselineDir, safeName)) : false;
};

export const deletePresetBaseline = (
  presetName: string,
  baselineDir: string,
) => {
  const safeName = safePresetFileName(presetName);
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
  const safeOld = safePresetFileName(oldName);
  const safeNew = safePresetFileName(newName);
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
    const presetPath = presetFilePath(presetsDir, presetName);
    fs.unlinkSync(presetPath);
  } catch (ex) {
    log.error('Failed to delete preset');
    throw ex;
  }
  log.info(`Deleted preset: ${presetName}`);
};

export const doesPresetExist = (presetName: string, presetsDir: string) => {
  // The one that answers rather than throws. A name that cannot name a profile
  // is a name no profile is stored under, and the callers are asking whether it
  // is taken — "no" is both true and the answer that keeps them working.
  const safeName = safePresetFileName(presetName);
  if (!safeName) {
    return false;
  }
  const testPath = addFileToPath(presetsDir, safeName);
  try {
    return fs.existsSync(testPath);
  } catch (ex) {
    log.error('Failed to check whether preset %d exists', presetName);
    throw ex;
  }
};

export const renamePreset = (
  oldName: string,
  newName: string,
  presetsDir: string,
) => {
  // Both ends checked. A rename is a read and a write, and the destination is
  // the one an attacker would choose.
  const oldPath = presetFilePath(presetsDir, oldName);
  const newPath = presetFilePath(presetsDir, newName);
  try {
    fs.renameSync(oldPath, newPath);
  } catch (ex) {
    log.error('Failed to rename preset %d to preset %d', oldName, newName);
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
