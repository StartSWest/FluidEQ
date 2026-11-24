/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Hard-coded ear-safety guardrails for AI-driven audio tuning.
 *
 * Prompt instructions alone are never sufficient when an automated caller can
 * change live system audio on headphones. Every write from the Tuning MCP Door
 * passes through these clamps before touching state or engine files:
 *
 * - Manual preamp is capped at 0 dB (never positive boost).
 * - AI-authored main EQ bands stay within [-18, +12] dB; large boosts without
 *   Auto Normalize automatically pull manual preamp down to cover peak gain.
 * - Every stage `isolate` flag is stripped, so an AI cannot leave the listener
 *   stuck hearing wet-difference or harmonics-only solo audio.
 * - Master `outputTrimDb` is capped at 0 dB and maximizing ceiling at -0.3 dBTP.
 */

import {
  FilterTypeEnum,
  IFilter,
  IFiltersMap,
  MAX_FREQUENCY,
  MIN_FREQUENCY,
  MAX_QUALITY,
  MIN_QUALITY,
  NO_GAIN_FILTER_TYPES,
  clampFrequency,
  clampPreAmp,
  clampQuality,
  isBandChannel,
  isBandEnabled,
} from '../../common/constants';
import {
  DSP_DEFAULTS,
  IDspSettings,
  clampDspSettings,
} from '../../common/dsp/chain';
import { clampMicSettings } from '../../common/micSound';

/** Hard ceiling for AI-set manual preamp: never amplify above unity. */
export const AI_MAX_MANUAL_PREAMP_DB = 0;

/** Safe per-band boost ceiling for AI-authored main EQ filters. */
export const AI_MAX_BAND_GAIN_DB = 12;

/** Safe per-band cut floor for AI-authored main EQ filters. */
export const AI_MIN_BAND_GAIN_DB = -18;

/** Hard ceiling for AI-set Master output trim (dB). */
export const AI_MAX_MASTER_TRIM_DB = 0;

/** Hard true-peak ceiling when Master LUFS maximize is enabled by AI (dBTP). */
export const AI_MAX_MASTER_CEILING_DB = -0.3;

/** Hard ceiling for Maximizer ceiling when tuned by AI (dBTP). */
export const AI_MAX_MAXIMIZER_CEILING_DB = -0.3;

export const DSP_STAGE_NAMES = [
  'normalizer',
  'denoise',
  'deEsser',
  'eq',
  'footsteps',
  'dynamics',
  'exciter',
  'bassForge',
  'bassPunch',
  'dimension',
  'maximizer',
  'master',
  'room',
  'surround',
] as const;

export type TDspStageName = (typeof DSP_STAGE_NAMES)[number];

const DSP_STAGE_SET: ReadonlySet<string> = new Set(DSP_STAGE_NAMES);

export const isDspStageName = (value: unknown): value is TDspStageName =>
  typeof value === 'string' && DSP_STAGE_SET.has(value);

const VALID_FILTER_TYPES: ReadonlySet<string> = new Set(
  Object.values(FilterTypeEnum),
);

export const isFilterType = (value: unknown): value is FilterTypeEnum =>
  typeof value === 'string' && VALID_FILTER_TYPES.has(value);

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Clamp manual preamp so AI can only attenuate or leave at unity. */
export const clampAiManualPreAmp = (gainDb: number): number => {
  const finite = Number.isFinite(gainDb) ? gainDb : 0;
  return clampPreAmp(Math.min(AI_MAX_MANUAL_PREAMP_DB, finite));
};

/** Clamp one AI-authored main EQ band gain inside ear-safe limits. */
export const clampAiBandGain = (gainDb: number): number => {
  if (!Number.isFinite(gainDb)) {
    return 0;
  }
  return Math.max(AI_MIN_BAND_GAIN_DB, Math.min(AI_MAX_BAND_GAIN_DB, gainDb));
};

/** Validate and clamp a single EQ band patch into a clean IFilter. */
export const sanitizeAiBand = (
  base: IFilter,
  patch: Record<string, unknown>,
): { filter: IFilter; warnings: string[] } => {
  const warnings: string[] = [];
  const next: IFilter = { ...base };

  if (patch.type !== undefined) {
    if (isFilterType(patch.type)) {
      next.type = patch.type;
    } else {
      warnings.push(
        `Ignored unknown filter type ${JSON.stringify(patch.type)}.`,
      );
    }
  }

  if (typeof patch.frequency === 'number' && Number.isFinite(patch.frequency)) {
    const clamped = clampFrequency(patch.frequency);
    if (patch.frequency < MIN_FREQUENCY || patch.frequency > MAX_FREQUENCY) {
      warnings.push(
        `Clamped frequency ${patch.frequency} Hz to ${clamped} Hz.`,
      );
    }
    next.frequency = clamped;
  }

  if (typeof patch.gain === 'number' && Number.isFinite(patch.gain)) {
    const clamped = clampAiBandGain(patch.gain);
    if (clamped !== patch.gain) {
      warnings.push(
        `Clamped band gain ${patch.gain} dB to ear-safe limit ${clamped} dB.`,
      );
    }
    next.gain = NO_GAIN_FILTER_TYPES.includes(next.type) ? 0 : clamped;
  } else if (NO_GAIN_FILTER_TYPES.includes(next.type)) {
    next.gain = 0;
  }

  if (typeof patch.quality === 'number' && Number.isFinite(patch.quality)) {
    const clamped = clampQuality(patch.quality);
    if (patch.quality < MIN_QUALITY || patch.quality > MAX_QUALITY) {
      warnings.push(`Clamped Q ${patch.quality} to ${clamped}.`);
    }
    next.quality = clamped;
  }

  if (typeof patch.isEnabled === 'boolean') {
    next.isEnabled = patch.isEnabled;
  }

  if (patch.channel === 'both' || patch.channel === null) {
    delete next.channel;
  } else if (isBandChannel(patch.channel)) {
    next.channel = patch.channel;
  }

  return { filter: next, warnings };
};

/**
 * Conservative upper-bound positive gain across enabled bands, used when Auto
 * Normalize is off so manual preamp is lowered enough to avoid clipping.
 */
export const maxPositiveBandGain = (filters: IFiltersMap): number => {
  let maxBoost = 0;
  Object.values(filters).forEach((filter) => {
    if (
      isBandEnabled(filter) &&
      !NO_GAIN_FILTER_TYPES.includes(filter.type) &&
      filter.gain > maxBoost
    ) {
      maxBoost = filter.gain;
    }
  });
  return maxBoost;
};

/**
 * Strip every monitoring `isolate` flag and clamp dangerous output ceilings
 * across an entire DSP rack.
 */
export const sanitizeAiDspSettings = (
  raw: unknown,
): { settings: IDspSettings; warnings: string[] } => {
  const warnings: string[] = [];
  const clamped = clampDspSettings(raw);

  if (
    clamped.eq.isolate ||
    clamped.exciter.isolate ||
    clamped.bassForge.isolate ||
    clamped.bassPunch.isolate ||
    clamped.denoise.isolate ||
    clamped.deEsser.isolate ||
    clamped.footsteps.isolate
  ) {
    warnings.push(
      'Disabled stage isolate monitoring flags so normal listening is preserved.',
    );
  }

  let { outputTrimDb } = clamped.master;
  if (outputTrimDb > AI_MAX_MASTER_TRIM_DB) {
    warnings.push(
      `Clamped master.outputTrimDb from ${outputTrimDb} dB to ${AI_MAX_MASTER_TRIM_DB} dB.`,
    );
    outputTrimDb = AI_MAX_MASTER_TRIM_DB;
  }

  let masterCeilingDb = clamped.master.ceilingDb;
  if (masterCeilingDb > AI_MAX_MASTER_CEILING_DB) {
    warnings.push(
      `Clamped master.ceilingDb from ${masterCeilingDb} dBTP to ${AI_MAX_MASTER_CEILING_DB} dBTP.`,
    );
    masterCeilingDb = AI_MAX_MASTER_CEILING_DB;
  }

  let maximizerCeilingDb = clamped.maximizer.ceilingDb;
  if (maximizerCeilingDb > AI_MAX_MAXIMIZER_CEILING_DB) {
    warnings.push(
      `Clamped maximizer.ceilingDb from ${maximizerCeilingDb} dBTP to ${AI_MAX_MAXIMIZER_CEILING_DB} dBTP.`,
    );
    maximizerCeilingDb = AI_MAX_MAXIMIZER_CEILING_DB;
  }

  const settings: IDspSettings = {
    ...clamped,
    eq: { ...clamped.eq, isolate: false },
    exciter: { ...clamped.exciter, isolate: false },
    bassForge: { ...clamped.bassForge, isolate: false },
    bassPunch: { ...clamped.bassPunch, isolate: false },
    denoise: { ...clamped.denoise, isolate: false },
    deEsser: { ...clamped.deEsser, isolate: false },
    footsteps: { ...clamped.footsteps, isolate: false },
    maximizer: { ...clamped.maximizer, ceilingDb: maximizerCeilingDb },
    master: {
      ...clamped.master,
      outputTrimDb,
      ceilingDb: masterCeilingDb,
    },
  };

  return { settings, warnings };
};

/**
 * Merge a partial patch into a single named DSP stage and run full clamping +
 * ear-safety validation.
 */
export const applySafeDspStagePatch = (
  current: IDspSettings | undefined,
  stage: TDspStageName,
  patch: Record<string, unknown>,
  rootPatch?: { enabled?: boolean; gameMode?: boolean },
): { settings: IDspSettings; warnings: string[] } => {
  const base = current ? clampDspSettings(current) : DSP_DEFAULTS;
  const currentStage = base[stage];
  const mergedStage = isRecord(currentStage)
    ? { ...currentStage, ...patch }
    : patch;

  const candidate: Record<string, unknown> = {
    ...base,
    presetId: '',
    ...(rootPatch?.enabled !== undefined ? { enabled: rootPatch.enabled } : {}),
    ...(rootPatch?.gameMode !== undefined
      ? { gameMode: rootPatch.gameMode }
      : {}),
    [stage]: mergedStage,
  };

  return sanitizeAiDspSettings(candidate);
};

/**
 * Merge a partial microphone rack patch (Voice stage + any DSP stage), always
 * keeping low-latency `gameMode: true` and stripping `isolate` flags.
 */
export const applySafeMicRackPatch = (
  current: IDspSettings,
  patch: Record<string, unknown>,
): { settings: IDspSettings; warnings: string[] } => {
  const base = clampMicSettings(current);
  const candidate: Record<string, unknown> = { ...base };

  if (typeof patch.enabled === 'boolean') {
    candidate.enabled = patch.enabled;
  }
  if (isRecord(patch.voice)) {
    candidate.voice = { ...(base.voice ?? {}), ...patch.voice };
  }
  DSP_STAGE_NAMES.forEach((stage) => {
    const incoming = patch[stage];
    if (isRecord(incoming)) {
      const existing = base[stage];
      candidate[stage] = isRecord(existing)
        ? { ...existing, ...incoming }
        : incoming;
    }
  });

  const safe = sanitizeAiDspSettings(candidate);
  const mic = clampMicSettings({
    ...safe.settings,
    voice: candidate.voice,
  });
  return {
    settings: {
      ...mic,
      eq: { ...mic.eq, isolate: false },
      exciter: { ...mic.exciter, isolate: false },
      bassForge: { ...mic.bassForge, isolate: false },
      bassPunch: { ...mic.bassPunch, isolate: false },
      denoise: { ...mic.denoise, isolate: false },
      deEsser: { ...mic.deEsser, isolate: false },
      footsteps: { ...mic.footsteps, isolate: false },
    },
    warnings: safe.warnings,
  };
};
