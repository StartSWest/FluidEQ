/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Evaluates the exact composite EQ magnitude response across every active
 * FluidEQ layer using FluidEQ's own `getResponseGainAtFrequencies` math.
 *
 * Without this, an AI assistant looking at stacked layers (main EQ + Tone +
 * Cuts + OPRA headphone + Voicing/Preset curve + Driver + Smart EQ + DSP EQ)
 * cannot see what net frequency response is actually being heard and risks
 * double-boosting or fighting an active preset curve.
 */

import {
  FilterTypeEnum,
  IFilter,
  IState,
  NO_GAIN_FILTER_TYPES,
  TApoLayer,
} from '../../common/constants';
import { getDriverFilters, getDriverGraphicEq } from '../../common/driver';
import { eqCutFilters } from '../../common/eqCuts';
import {
  ICombinedResponse,
  getResponseGainAtFrequencies,
} from '../../common/response';
import { getSmartEqFilters } from '../../common/smartEq';
import { getToneFilters } from '../../common/tone';
import { getVoicingFilters } from '../../common/voicing';

export const CURVE_PROBE_FREQUENCIES = [
  31.5, 63, 125, 250, 400, 630, 1000, 1600, 2500, 4000, 6300, 8000, 10000,
  12500, 16000,
] as const;

export type TCurveBandMap = Record<string, number>;

export interface IEffectiveCurveReport {
  frequenciesHz: readonly number[];
  totalDb: TCurveBandMap;
  byLayer: Partial<Record<string, TCurveBandMap>>;
  peakBoostDb: number;
  maxCutDb: number;
  summary: string;
}

const round1 = (value: number): number => Math.round(value * 10) / 10;

const toBandMap = (gains: readonly number[]): TCurveBandMap => {
  const out: TCurveBandMap = {};
  CURVE_PROBE_FREQUENCIES.forEach((hz, index) => {
    out[`${hz}Hz`] = round1(gains[index] ?? 0);
  });
  return out;
};

const isNonFlat = (gains: readonly number[]): boolean =>
  gains.some((gain) => Math.abs(gain) >= 0.15);

const scaleHeadphoneFilters = (
  state: IState,
): Array<Pick<IFilter, 'type' | 'frequency' | 'gain' | 'quality'>> => {
  const hp = state.headphone;
  if (!hp?.filters) {
    return [];
  }
  const intensity =
    typeof hp.intensity === 'number' && Number.isFinite(hp.intensity)
      ? Math.max(0, Math.min(1, hp.intensity))
      : 1;
  if (intensity <= 0) {
    return [];
  }
  return Object.values(hp.filters)
    .filter((f) => f.isEnabled !== false)
    .map((f) => ({
      type: f.type,
      frequency: f.frequency,
      gain: NO_GAIN_FILTER_TYPES.includes(f.type) ? f.gain : f.gain * intensity,
      quality: f.quality,
    }));
};

const dspEqFilters = (
  state: IState,
): Array<Pick<IFilter, 'type' | 'frequency' | 'gain' | 'quality'>> => {
  if (!state.dsp?.enabled || !state.dsp.eq.enabled) {
    return [];
  }
  return state.dsp.eq.bands
    .filter((b) => b.enabled)
    .map((b) => ({
      type: b.type as FilterTypeEnum,
      frequency: b.frequency,
      gain: b.gainDb,
      quality: b.quality,
    }));
};

const averageBand = (gains: readonly number[], indices: readonly number[]) =>
  round1(
    indices.reduce((sum, idx) => sum + (gains[idx] ?? 0), 0) / indices.length,
  );

export const evaluateEffectiveCurve = (
  state: IState,
): IEffectiveCurveReport => {
  const bypassed = new Set<TApoLayer>(state.bypassed ?? []);
  const active = (layer: TApoLayer) => state.isEnabled && !bypassed.has(layer);

  const layerResponses: Record<string, ICombinedResponse> = {
    mainEq: active('eq')
      ? {
          filters: [
            ...Object.values(state.filters).filter(
              (f) => f.isEnabled !== false,
            ),
            ...eqCutFilters(state.eqCuts),
          ],
        }
      : {},
    tone: active('tone') ? { filters: getToneFilters(state.tone) } : {},
    headphone: active('headphone')
      ? {
          filters: scaleHeadphoneFilters(state),
          curves: state.headphone?.graphicEq ? [state.headphone.graphicEq] : [],
        }
      : {},
    voicing: active('voicing')
      ? { filters: getVoicingFilters(state.voicing) }
      : {},
    driver: active('driver')
      ? {
          filters: getDriverFilters(state.driver),
          curves: [getDriverGraphicEq(state.driver)],
        }
      : {},
    smartEq: active('smart')
      ? { filters: getSmartEqFilters(state.smartEq) }
      : {},
    dspEq: { filters: dspEqFilters(state) },
  };

  const totals = new Array<number>(CURVE_PROBE_FREQUENCIES.length).fill(0);
  const byLayer: Partial<Record<string, TCurveBandMap>> = {};

  Object.entries(layerResponses).forEach(([name, spec]) => {
    const gains = getResponseGainAtFrequencies(spec, CURVE_PROBE_FREQUENCIES);
    if (isNonFlat(gains)) {
      byLayer[name] = toBandMap(gains);
      gains.forEach((value, idx) => {
        totals[idx] += value;
      });
    }
  });

  const peakBoostDb = round1(Math.max(0, ...totals));
  const maxCutDb = round1(Math.min(0, ...totals));
  const signed = (n: number) => `${n >= 0 ? '+' : ''}${n}`;
  const summary = [
    `sub ${signed(averageBand(totals, [0, 1]))} dB`,
    `bass ${signed(averageBand(totals, [2]))} dB`,
    `lowMid ${signed(averageBand(totals, [3, 4]))} dB`,
    `mid ${signed(averageBand(totals, [5, 6, 7]))} dB`,
    `upperMid ${signed(averageBand(totals, [8, 9]))} dB`,
    `presence ${signed(averageBand(totals, [10, 11]))} dB`,
    `air ${signed(averageBand(totals, [12, 13, 14]))} dB`,
  ].join(', ');

  return {
    frequenciesHz: CURVE_PROBE_FREQUENCIES,
    totalDb: toBandMap(totals),
    byLayer,
    peakBoostDb,
    maxCutDb,
    summary,
  };
};
