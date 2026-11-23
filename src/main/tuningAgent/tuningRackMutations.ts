/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Validated preset, DSP rack stage, and microphone rack mutations for
 * `tuningController.ts`.
 */

import type { IFluidEngineMicrophone } from '../../common/audioEngine';
import type { IState } from '../../common/constants';
import { getDriverProfile } from '../../common/driver';
import { DSP_DEFAULTS, IDspSettings } from '../../common/dsp/chain';
import { dspPresetCurve, dspPresetSettings } from '../../common/dsp/presets';
import { dspPresetVoicing } from '../../common/dsp/presetVoicing';
import {
  MIC_PROFILE_IDS,
  isMicProfileId,
  micProfileSettings,
} from '../../common/mic/micProfiles';
import { IMicSoundEntry, IMicSoundFile, MIC_GUID } from '../../common/micSound';
import { getVoicingProfile } from '../../common/voicing';
import { summarizeActiveStages } from './tuningCatalog';
import type {
  IMutationFailure,
  IStateMutationHooks,
  TMutationPlan,
} from './tuningMutations';
import {
  DSP_STAGE_NAMES,
  applySafeDspStagePatch,
  applySafeMicRackPatch,
  isDspStageName,
  isRecord,
  sanitizeAiDspSettings,
} from './tuningSafety';

export interface IPresetMutationArgs {
  kind: 'dsp' | 'voicing' | 'driver' | 'user' | 'none';
  id?: string;
  intensity?: number;
}

export interface IDspStageMutationArgs {
  enabled?: boolean;
  gameMode?: boolean;
  stage?: string;
  patch?: Record<string, unknown>;
  resetStage?: boolean;
}

export interface IMicRackMutationArgs {
  guid?: string;
  profileId?: string;
  patch?: Record<string, unknown>;
}

export const applyPresetMutation = (
  state: IState,
  hooks: IStateMutationHooks,
  args: IPresetMutationArgs,
): TMutationPlan => {
  const warnings: string[] = [];
  const intensity =
    typeof args.intensity === 'number' && Number.isFinite(args.intensity)
      ? Math.max(0, Math.min(1, args.intensity))
      : 1;

  if (args.kind === 'none') {
    hooks.beforeWrite();
    state.voicing = { profileId: '', intensity: 0 };
    const baseDsp = state.dsp ?? DSP_DEFAULTS;
    state.dsp = { ...baseDsp, enabled: false, presetId: '' };
    return { ok: true, warnings, detail: { cleared: true } };
  }
  if (!args.id) {
    return { ok: false, error: 'Provide preset id.' };
  }
  if (args.kind === 'dsp') {
    if (!dspPresetSettings(args.id, state.dsp)) {
      return {
        ok: false,
        error: `Unknown DSP preset "${args.id}". Call list_presets(kind="dsp") first.`,
      };
    }
    hooks.beforeWrite();
    const rack = dspPresetSettings(args.id, state.dsp);
    if (!rack) {
      return { ok: false, error: `Unknown DSP preset "${args.id}".` };
    }
    const safe = sanitizeAiDspSettings(rack);
    warnings.push(...safe.warnings);
    state.dsp = safe.settings;
    const curve = dspPresetCurve(args.id);
    state.voicing = curve
      ? dspPresetVoicing(args.id, curve)
      : { profileId: '', intensity: 0 };
    hooks.applyingLayer('voicing');
    return {
      ok: true,
      warnings,
      detail: { kind: 'dsp', id: args.id, hasCurve: Boolean(curve) },
    };
  }
  if (args.kind === 'voicing') {
    if (!getVoicingProfile(args.id)) {
      return {
        ok: false,
        error: `Unknown voicing "${args.id}". Call list_presets(kind="voicing") first.`,
      };
    }
    hooks.beforeWrite();
    state.voicing = { profileId: args.id, intensity };
    hooks.applyingLayer('voicing');
    return {
      ok: true,
      warnings,
      detail: { kind: 'voicing', id: args.id, intensity },
    };
  }
  if (args.kind === 'driver') {
    if (!getDriverProfile(args.id)) {
      return {
        ok: false,
        error: `Unknown driver profile "${args.id}". Call list_presets(kind="driver") first.`,
      };
    }
    hooks.beforeWrite();
    state.driver = { profileId: args.id, intensity };
    hooks.applyingLayer('driver');
    return {
      ok: true,
      warnings,
      detail: { kind: 'driver', id: args.id, intensity },
    };
  }
  if (args.kind === 'user') {
    const found = hooks
      .loadUserPresets()
      .find((item) => item.id === args.id || item.name === args.id);
    if (!found) {
      return {
        ok: false,
        error: `Unknown user preset "${args.id}". Call list_presets(kind="user") first.`,
      };
    }
    hooks.beforeWrite();
    const safe = sanitizeAiDspSettings(found.settings);
    warnings.push(...safe.warnings);
    state.dsp = safe.settings;
    state.voicing = found.curve
      ? dspPresetVoicing(found.id, found.curve)
      : { profileId: '', intensity: 0 };
    hooks.applyingLayer('voicing');
    return {
      ok: true,
      warnings,
      detail: { kind: 'user', id: found.id, name: found.name },
    };
  }
  return {
    ok: false,
    error: `Unsupported preset kind "${String(args.kind)}".`,
  };
};

export const applyDspStageMutation = (
  state: IState,
  beforeWrite: () => void,
  args: IDspStageMutationArgs,
): TMutationPlan => {
  if (args.stage !== undefined) {
    if (!isDspStageName(args.stage)) {
      return {
        ok: false,
        error: `Unknown DSP stage "${args.stage}". Valid stages: ${DSP_STAGE_NAMES.join(', ')}.`,
      };
    }
    const { stage } = args;
    const patch = args.resetStage
      ? (DSP_DEFAULTS[stage] as unknown as Record<string, unknown>)
      : (args.patch ?? {});
    if (!isRecord(patch)) {
      return { ok: false, error: 'Stage patch must be an object.' };
    }
    beforeWrite();
    const current = state.dsp ?? DSP_DEFAULTS;
    const rootPatch = {
      ...(typeof args.enabled === 'boolean' ? { enabled: args.enabled } : {}),
      ...(typeof args.gameMode === 'boolean'
        ? { gameMode: args.gameMode }
        : {}),
    };
    const safe = applySafeDspStagePatch(current, stage, patch, rootPatch);
    state.dsp = safe.settings;
    return {
      ok: true,
      warnings: safe.warnings,
      detail: {
        stage,
        dspEnabled: safe.settings.enabled,
        activeStages: summarizeActiveStages(safe.settings),
      },
    };
  }

  if (typeof args.enabled === 'boolean' || typeof args.gameMode === 'boolean') {
    beforeWrite();
    const current = state.dsp ?? DSP_DEFAULTS;
    const safe = sanitizeAiDspSettings({
      ...current,
      ...(typeof args.enabled === 'boolean' ? { enabled: args.enabled } : {}),
      ...(typeof args.gameMode === 'boolean'
        ? { gameMode: args.gameMode }
        : {}),
    });
    state.dsp = safe.settings;
    return {
      ok: true,
      warnings: safe.warnings,
      detail: {
        dspEnabled: safe.settings.enabled,
        gameMode: safe.settings.gameMode,
      },
    };
  }
  return {
    ok: false,
    error: 'Provide stage + patch (or resetStage=true), or enabled/gameMode.',
  };
};

export const prepareMicRackUpdate = (
  micFile: IMicSoundFile,
  mics: readonly IFluidEngineMicrophone[],
  args: IMicRackMutationArgs,
):
  | { ok: true; guid: string; entry: IMicSoundEntry; warnings: string[] }
  | IMutationFailure => {
  const warnings: string[] = [];
  // `micFile.selected` defaults to '' (not undefined), so treat empty strings
  // as unset when falling back to an attached microphone.
  const rawGuid =
    args.guid?.trim() ||
    micFile.selected.trim() ||
    mics.find((item) => item.attached)?.guid ||
    mics[0]?.guid;

  if (!rawGuid || !MIC_GUID.test(rawGuid)) {
    return {
      ok: false,
      error:
        'No valid microphone GUID available. Call get_audio_context to list microphones and pass guid.',
    };
  }
  const guid = rawGuid.toUpperCase();
  const matchedMic = mics.find((item) => item.guid.toUpperCase() === guid);
  const existing = micFile.mics[guid];

  let baseSettings: IDspSettings;
  let profileId = existing?.profileId ?? 'stream';
  let tuned = existing?.tuned ?? false;

  if (args.profileId !== undefined) {
    if (!isMicProfileId(args.profileId)) {
      return {
        ok: false,
        error: `Unknown mic profile "${args.profileId}". Valid profiles: ${MIC_PROFILE_IDS.join(', ')}.`,
      };
    }
    baseSettings = micProfileSettings(args.profileId);
    profileId = args.profileId;
    tuned = false;
  } else {
    baseSettings = existing?.settings ?? micProfileSettings('stream');
  }

  let finalSettings = baseSettings;
  if (args.patch && isRecord(args.patch)) {
    const safe = applySafeMicRackPatch(baseSettings, args.patch);
    warnings.push(...safe.warnings);
    finalSettings = safe.settings;
    tuned = true;
  }

  return {
    ok: true,
    guid,
    warnings,
    entry: {
      name: matchedMic?.name ?? existing?.name ?? guid,
      profileId,
      tuned,
      settings: finalSettings,
    },
  };
};
