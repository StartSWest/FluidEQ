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

import {
  clampPreAmp,
  AutoEqFormat,
  clampFrequency,
  clampGain,
  clampQuality,
  FilterTypeEnum,
  IFilter,
  IGraphicEqPoint,
  IPresetV2,
  IState,
  NO_GAIN_FILTER_TYPES,
  TApoFeature,
  TApoLayer,
} from '../common/constants';
import { getVoicingFilters, getVoicingGraphicEq } from '../common/voicing';
import { getDriverFilters, getDriverGraphicEq } from '../common/driver';
import {
  getHeadphoneFilters,
  getHeadphoneGraphicEq,
} from '../common/headphone';
import { getSmartEqFilters, getSmartEqGraphicEq } from '../common/smartEq';
import { getSmartPreAmpGain } from '../common/smartHeadroom';

/**
 * Turning the live state into the text Equalizer APO reads.
 *
 * Four hundred and eighty-six lines, and the half of flush.ts that produces
 * rather than persists. Every layer becomes filters, every filter becomes a
 * line, and the preamp is measured from the sum of all of them — the arithmetic
 * that decides what a user actually hears.
 *
 * Separated from the file writing because the two fail differently and are
 * tested differently. This half is pure: given a state it returns a string, and
 * every invariant worth checking about the config can be checked without
 * touching a disk. The other half is paths, permissions, and JSON that may have
 * been hand-edited.
 */
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

  const response = {
    filters: [...writtenFilters, ...convolutionFilters, ...customFilters],
    curves,
    constantGain: customFx?.preAmp ?? 0,
  };

  /*
   * ONE SWITCH, AND ON MEANS BOTH HALVES OF IT.
   *
   * There is no separate adaptive mode to enable. Auto normalize on reserves
   * what the music needs — the arithmetic and the measurement together — and off
   * hands the level back to the user, which is the early return at the top of
   * this function.
   *
   * The two halves answer different questions and neither can answer the
   * other's. The arithmetic protects what happens INSIDE Equalizer APO, where a
   * boosted chain can push a full-scale input past 0 dB, and it is a proof
   * rather than a measurement, so it holds whatever is playing and wherever the
   * volume knob is. The measurement protects what happens AFTER: Windows applies
   * its volume APO downstream of us and ends the path with a limiter, so whether
   * that limiter fires depends on a number this process cannot compute. The
   * renderer can see it, and reports it.
   *
   * With nothing measured yet, `getSmartPreAmpGain` reproduces the worst case
   * exactly. So a cold start, a silent room and a machine whose loopback never
   * opens all behave precisely like the auto-normalize that shipped, by
   * construction rather than by a special case written here.
   */
  return getSmartPreAmpGain(
    response,
    state.smartHeadroomProgramme ?? [],
    state.smartHeadroomTrimDb ?? 0,
  );
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
) => `Preamp: ${clampPreAmp(resolvePreAmp(state, layers, hasConvolution))} dB`;

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
  clampPreAmp(
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
