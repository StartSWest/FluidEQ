/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Validated EQ, OPRA headphone, and preamp mutations for `tuningController.ts`.
 *
 * Every helper validates inputs before calling `beforeWrite()`, so rejected
 * tool calls never pollute the A/B baseline snapshot.
 */

import {
  APO_LAYERS,
  IFilter,
  IFiltersMap,
  IOpraProduct,
  IPresetV2,
  IState,
  MAX_NUM_FILTERS,
  OPRA_SOURCE_ID,
  TApoLayer,
  getDefaultFilterWithId,
  getDefaultFilters,
} from '../../common/constants';
import { MAX_CORRECTION_GAIN } from '../../common/correctionRange';
import { DEFAULT_EQ_CUTS, hasEqCut, isEqCutSlope } from '../../common/eqCuts';
import { isTrebleDesign, type TTrebleDesign } from '../../common/filterDesign';
import { toTone } from '../../common/tone';
import type { IUserDspPreset } from '../../common/userPresetsFile';
import {
  clampAiManualPreAmp,
  maxPositiveBandGain,
  sanitizeAiBand,
} from './tuningSafety';

export interface IMutationPlanOk {
  ok: true;
  warnings: string[];
  detail?: Record<string, unknown>;
}

export interface IMutationFailure {
  ok: false;
  error: string;
}

export type TMutationPlan = IMutationPlanOk | IMutationFailure;

export interface IStateMutationHooks {
  beforeWrite: () => void;
  getOpraProducts: () => readonly IOpraProduct[];
  getOpraPreset: (productId: string, curveId: string) => IPresetV2;
  getOpraLabel: (productId: string, curveId?: string) => string;
  shieldReferenceBands: (filters: IFiltersMap, limit?: number) => IFiltersMap;
  applyingLayer: (layer: TApoLayer) => void;
  switchToParametricEditing: () => void;
  loadUserPresets: () => IUserDspPreset[];
}

export interface IHeadphoneMutationArgs {
  productId?: string;
  curveId?: string;
  intensity?: number;
  clear?: boolean;
}

export interface IMainEqMutationArgs {
  enabled?: boolean;
  clearBands?: boolean;
  replaceBands?: Record<string, unknown>[];
  upsertBands?: Record<string, unknown>[];
  removeBandIds?: string[];
  tone?: { bass?: number; mid?: number; treble?: number } | null;
  eqCuts?: { low?: number; high?: number };
  eqMode?: 'normal' | 'double' | 'studio';
  mainBandQ?: 'off' | 'proportional' | 'asymmetric';
  trebleDesign?: { eq?: TTrebleDesign; curves?: TTrebleDesign };
  bypassLayers?: Partial<Record<TApoLayer, boolean>>;
}

export interface IPreampMutationArgs {
  autoNormalize?: boolean;
  manualPreAmpDb?: number;
}

export const applyHeadphoneMutation = (
  state: IState,
  hooks: IStateMutationHooks,
  args: IHeadphoneMutationArgs,
): TMutationPlan => {
  if (args.clear) {
    hooks.beforeWrite();
    delete state.headphone;
    delete state.headset;
    delete state.headsetTarget;
    delete state.headsetSource;
    return { ok: true, warnings: [], detail: { cleared: true } };
  }
  if (args.productId) {
    const product = hooks
      .getOpraProducts()
      .find((item) => item.id === args.productId);
    if (!product) {
      return {
        ok: false,
        error: `Unknown OPRA productId "${args.productId}". Call search_headphone_correction first.`,
      };
    }
    const chosenCurveId = args.curveId ?? product.curves[0]?.id;
    if (!chosenCurveId) {
      return {
        ok: false,
        error: `OPRA product "${args.productId}" has no published curves.`,
      };
    }
    let preset: IPresetV2;
    try {
      preset = hooks.getOpraPreset(product.id, chosenCurveId);
    } catch (error) {
      return {
        ok: false,
        error: `Could not load OPRA curve "${chosenCurveId}" for "${product.id}": ${String(error)}`,
      };
    }
    const intensity =
      typeof args.intensity === 'number' && Number.isFinite(args.intensity)
        ? Math.max(0, Math.min(1, args.intensity))
        : 1;
    hooks.beforeWrite();
    state.headphone = {
      filters: hooks.shieldReferenceBands(preset.filters, MAX_CORRECTION_GAIN),
      graphicEq: undefined,
      intensity,
    };
    state.preAmp = clampAiManualPreAmp(preset.preAmp);
    state.headset = product.id;
    state.headsetTarget = chosenCurveId;
    state.headsetSource = OPRA_SOURCE_ID;
    hooks.applyingLayer('headphone');
    return {
      ok: true,
      warnings: [],
      detail: {
        productId: product.id,
        curveId: chosenCurveId,
        label: hooks.getOpraLabel(product.id, chosenCurveId),
        intensity,
      },
    };
  }
  if (typeof args.intensity === 'number' && Number.isFinite(args.intensity)) {
    if (!state.headphone) {
      return {
        ok: false,
        error: 'No headphone correction is currently loaded to adjust.',
      };
    }
    const intensity = Math.max(0, Math.min(1, args.intensity));
    hooks.beforeWrite();
    if (!state.headphone) {
      return {
        ok: false,
        error: 'No headphone correction is currently loaded to adjust.',
      };
    }
    state.headphone = { ...state.headphone, intensity };
    hooks.applyingLayer('headphone');
    return { ok: true, warnings: [], detail: { intensity } };
  }
  return {
    ok: false,
    error:
      'Provide productId (and optional curveId), intensity, or clear=true.',
  };
};

export const applyMainEqMutation = (
  state: IState,
  hooks: IStateMutationHooks,
  args: IMainEqMutationArgs,
): TMutationPlan => {
  if (Array.isArray(args.replaceBands) && args.replaceBands.length === 0) {
    return {
      ok: false,
      error:
        'replaceBands cannot be empty. Pass clearBands=true to flatten the EQ.',
    };
  }
  hooks.beforeWrite();
  const warnings: string[] = [];

  if (typeof args.enabled === 'boolean') {
    state.isEnabled = args.enabled;
  }
  if (args.clearBands) {
    hooks.switchToParametricEditing();
    state.filters = getDefaultFilters();
    state.isFlat = true;
    delete state.tone;
    hooks.applyingLayer('eq');
  }
  if (Array.isArray(args.replaceBands)) {
    hooks.switchToParametricEditing();
    const nextFilters: IFiltersMap = {};
    args.replaceBands.slice(0, MAX_NUM_FILTERS).forEach((entry) => {
      const { filter, warnings: bw } = sanitizeAiBand(
        getDefaultFilterWithId(),
        entry,
      );
      warnings.push(...bw);
      nextFilters[filter.id] = filter;
    });
    if (args.replaceBands.length > MAX_NUM_FILTERS) {
      warnings.push(`Capped band count at ${MAX_NUM_FILTERS}.`);
    }
    state.filters = nextFilters;
    state.isFlat = false;
    hooks.applyingLayer('eq');
  }
  if (Array.isArray(args.removeBandIds) && args.removeBandIds.length > 0) {
    hooks.switchToParametricEditing();
    args.removeBandIds.forEach((id) => {
      if (Object.keys(state.filters).length <= 1) {
        warnings.push('Kept at least one band in the main EQ.');
        return;
      }
      delete state.filters[id];
    });
    state.isFlat = false;
  }
  if (Array.isArray(args.upsertBands) && args.upsertBands.length > 0) {
    hooks.switchToParametricEditing();
    args.upsertBands.forEach((entry) => {
      const id = typeof entry.id === 'string' ? entry.id : undefined;
      const existing: IFilter | undefined = id ? state.filters[id] : undefined;
      if (!existing && Object.keys(state.filters).length >= MAX_NUM_FILTERS) {
        warnings.push(`Reached max band count (${MAX_NUM_FILTERS}).`);
        return;
      }
      const { filter, warnings: bw } = sanitizeAiBand(
        existing ?? getDefaultFilterWithId(),
        entry,
      );
      warnings.push(...bw);
      state.filters[filter.id] = filter;
    });
    state.isFlat = false;
    hooks.applyingLayer('eq');
  }
  if (args.tone !== undefined) {
    if (args.tone === null) {
      delete state.tone;
    } else {
      const cur = state.tone ?? { bass: 0, mid: 0, treble: 0 };
      state.tone = toTone({
        bass: typeof args.tone.bass === 'number' ? args.tone.bass : cur.bass,
        mid: typeof args.tone.mid === 'number' ? args.tone.mid : cur.mid,
        treble:
          typeof args.tone.treble === 'number' ? args.tone.treble : cur.treble,
      });
      hooks.applyingLayer('tone');
    }
  }
  if (args.eqCuts) {
    const cuts = { ...(state.eqCuts ?? DEFAULT_EQ_CUTS) };
    if (args.eqCuts.low !== undefined) {
      if (isEqCutSlope(args.eqCuts.low)) {
        cuts.low = args.eqCuts.low;
      } else {
        warnings.push('eqCuts.low must be 0, 12, or 24 dB/oct.');
      }
    }
    if (args.eqCuts.high !== undefined) {
      if (isEqCutSlope(args.eqCuts.high)) {
        cuts.high = args.eqCuts.high;
      } else {
        warnings.push('eqCuts.high must be 0, 12, or 24 dB/oct.');
      }
    }
    state.eqCuts = hasEqCut(cuts) ? cuts : undefined;
  }
  if (args.eqMode) {
    state.eqMode = args.eqMode;
    state.isEqDoubleOn = args.eqMode === 'double';
  }
  if (args.mainBandQ) {
    state.mainBandQ = args.mainBandQ;
  }
  if (args.trebleDesign) {
    const cur = state.trebleDesigns ?? {
      eq: 'precise' as TTrebleDesign,
      curves: 'precise' as TTrebleDesign,
    };
    state.trebleDesigns = {
      eq: isTrebleDesign(args.trebleDesign.eq) ? args.trebleDesign.eq : cur.eq,
      curves: isTrebleDesign(args.trebleDesign.curves)
        ? args.trebleDesign.curves
        : cur.curves,
    };
  }
  if (args.bypassLayers) {
    const nextSet = new Set<TApoLayer>(state.bypassed ?? []);
    APO_LAYERS.forEach((layer) => {
      const value = args.bypassLayers?.[layer];
      if (value === true) {
        nextSet.add(layer);
      } else if (value === false) {
        nextSet.delete(layer);
      }
    });
    state.bypassed = [...nextSet];
  }

  if (!state.isAutoPreAmpOn) {
    const maxBoost = maxPositiveBandGain(state.filters);
    if (maxBoost > 0 && state.preAmp > -maxBoost) {
      const safePreAmp = clampAiManualPreAmp(-maxBoost);
      state.preAmp = safePreAmp;
      warnings.push(
        `Lowered manual preamp to ${safePreAmp} dB to cover +${maxBoost} dB peak boost while Auto Normalize is off.`,
      );
    }
  }

  return {
    ok: true,
    warnings,
    detail: {
      bandCount: Object.keys(state.filters).length,
      preAmp: state.preAmp,
      autoNormalize: state.isAutoPreAmpOn,
    },
  };
};

export const applyPreampMutation = (
  state: IState,
  beforeWrite: () => void,
  args: IPreampMutationArgs,
): TMutationPlan => {
  beforeWrite();
  const warnings: string[] = [];
  if (typeof args.autoNormalize === 'boolean') {
    state.isAutoPreAmpOn = args.autoNormalize;
  }
  if (
    typeof args.manualPreAmpDb === 'number' &&
    Number.isFinite(args.manualPreAmpDb)
  ) {
    const clamped = clampAiManualPreAmp(args.manualPreAmpDb);
    if (clamped !== args.manualPreAmpDb) {
      warnings.push(
        `Clamped manual preamp from ${args.manualPreAmpDb} dB to ear-safe limit ${clamped} dB.`,
      );
    }
    state.preAmp = clamped;
  }
  return {
    ok: true,
    warnings,
    detail: {
      autoNormalize: state.isAutoPreAmpOn,
      manualPreAmpDb: state.preAmp,
    },
  };
};
