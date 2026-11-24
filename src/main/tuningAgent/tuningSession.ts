/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Snapshot, A/B comparison, one-click revert, and user-preset persistence for
 * an AI tuning session.
 */

import { uid } from 'uid';
import type { IState } from '../../common/constants';
import { DSP_DEFAULTS } from '../../common/dsp/chain';
import type {
  IMicSoundEntry,
  IMicSoundFile,
  TMicSoundResult,
} from '../../common/micSound';
import {
  EMPTY_TUNING_SESSION,
  ITuningSessionSummary,
  TTuningAbMode,
} from '../../common/tuningAgent';
import {
  IUserDspPreset,
  USER_DSP_PRESET_PREFIX,
  cleanUserPresetName,
} from '../../common/userPresetsFile';
import { sanitizeAiDspSettings } from './tuningSafety';

export interface ITuningSessionOutcomeOk {
  ok: true;
  warnings: string[];
  session: ITuningSessionSummary;
  detail?: Record<string, unknown>;
}

export interface ITuningSessionFailure {
  ok: false;
  error: string;
}

export type TTuningSessionOutcome =
  ITuningSessionOutcomeOk | ITuningSessionFailure;

interface ISessionSnapshot {
  state: IState;
  micFile: IMicSoundFile;
}

export interface ITuningSessionDeps {
  state: IState;
  flushAudioState: (reason: string) => Promise<{ ok: boolean; error?: string }>;
  notifyOutputChanged: () => void;
  readMicSound: () => IMicSoundFile;
  writeMicSound: (
    guid: string,
    entry: IMicSoundEntry,
  ) => Promise<TMicSoundResult>;
  notifyMicChanged: () => void;
  loadUserPresets: () => IUserDspPreset[];
  saveUserPresets: (presets: IUserDspPreset[]) => void;
  onSessionChanged?: (session: ITuningSessionSummary) => void;
}

// `structuredClone` is absent in Jest's jsdom environment; fallback keeps unit
// tests portable while production Node/Electron uses the native clone.
const deepClone = <T>(value: T): T =>
  typeof structuredClone === 'function'
    ? structuredClone(value)
    : (JSON.parse(JSON.stringify(value)) as T);

const replaceStateInPlace = (target: IState, next: IState): void => {
  Object.keys(target).forEach((key) => {
    delete (target as unknown as Record<string, unknown>)[key];
  });
  Object.assign(target, deepClone(next));
};

export const createTuningSession = (deps: ITuningSessionDeps) => {
  let originalSnapshot: ISessionSnapshot | undefined;
  let tunedSnapshot: ISessionSnapshot | undefined;
  let sessionInfo: ITuningSessionSummary = { ...EMPTY_TUNING_SESSION };

  const emitSession = () => {
    deps.onSessionChanged?.({ ...sessionInfo });
  };

  const captureSnapshot = (): ISessionSnapshot => ({
    state: deepClone(deps.state),
    micFile: deepClone(deps.readMicSound()),
  });

  const getSession = (): ITuningSessionSummary => ({ ...sessionInfo });

  const getBaseMicFile = (): IMicSoundFile =>
    sessionInfo.mode === 'original' && tunedSnapshot
      ? tunedSnapshot.micFile
      : deps.readMicSound();

  const ensureBaseline = () => {
    if (!originalSnapshot) {
      originalSnapshot = captureSnapshot();
      sessionInfo = { hasSnapshot: true, mode: 'tuned', changeCount: 0 };
    } else if (sessionInfo.mode === 'original' && tunedSnapshot) {
      replaceStateInPlace(deps.state, tunedSnapshot.state);
      sessionInfo = { ...sessionInfo, mode: 'tuned' };
    }
  };

  const recordMutation = (toolName: string) => {
    tunedSnapshot = captureSnapshot();
    sessionInfo = {
      hasSnapshot: true,
      mode: 'tuned',
      changeCount: sessionInfo.changeCount + 1,
      lastTool: toolName,
      lastChangedAt: new Date().toISOString(),
    };
    emitSession();
  };

  const restoreSnapshot = async (
    snap: ISessionSnapshot,
    reason: string,
  ): Promise<{ ok: boolean; error?: string }> => {
    replaceStateInPlace(deps.state, snap.state);
    const flushed = await deps.flushAudioState(reason);
    if (!flushed.ok) {
      return flushed;
    }
    deps.notifyOutputChanged();

    const currentMics = deps.readMicSound().mics;
    const allGuids = new Set([
      ...Object.keys(currentMics),
      ...Object.keys(snap.micFile.mics),
    ]);
    await Promise.all(
      [...allGuids].map(async (guid) => {
        const saved = snap.micFile.mics[guid];
        if (saved) {
          await deps.writeMicSound(guid, saved);
        }
      }),
    );
    deps.notifyMicChanged();
    return { ok: true };
  };

  const abCompare = async (
    mode?: TTuningAbMode,
  ): Promise<TTuningSessionOutcome> => {
    if (!originalSnapshot) {
      return {
        ok: false,
        error: 'No AI tuning session snapshot exists yet to compare against.',
      };
    }
    const targetMode: TTuningAbMode =
      mode ?? (sessionInfo.mode === 'tuned' ? 'original' : 'tuned');
    if (targetMode === sessionInfo.mode) {
      return {
        ok: true,
        warnings: [],
        session: getSession(),
        detail: { mode: targetMode },
      };
    }
    if (targetMode === 'original') {
      tunedSnapshot = captureSnapshot();
      const restored = await restoreSnapshot(
        originalSnapshot,
        'tuning-agent:ab-original',
      );
      if (!restored.ok) {
        return {
          ok: false,
          error: restored.error ?? 'Could not switch to original.',
        };
      }
      sessionInfo = { ...sessionInfo, mode: 'original' };
      emitSession();
      return {
        ok: true,
        warnings: [],
        session: getSession(),
        detail: { mode: 'original' },
      };
    }
    if (!tunedSnapshot) {
      return { ok: false, error: 'No tuned state saved to switch back to.' };
    }
    const restored = await restoreSnapshot(
      tunedSnapshot,
      'tuning-agent:ab-tuned',
    );
    if (!restored.ok) {
      return {
        ok: false,
        error: restored.error ?? 'Could not switch to tuned.',
      };
    }
    sessionInfo = { ...sessionInfo, mode: 'tuned' };
    emitSession();
    return {
      ok: true,
      warnings: [],
      session: getSession(),
      detail: { mode: 'tuned' },
    };
  };

  const revert = async (): Promise<TTuningSessionOutcome> => {
    if (!originalSnapshot) {
      return { ok: false, error: 'Nothing to revert: no AI changes recorded.' };
    }
    const restored = await restoreSnapshot(
      originalSnapshot,
      'tuning-agent:revert',
    );
    if (!restored.ok) {
      return { ok: false, error: restored.error ?? 'Could not revert tuning.' };
    }
    originalSnapshot = undefined;
    tunedSnapshot = undefined;
    sessionInfo = { ...EMPTY_TUNING_SESSION };
    emitSession();
    return {
      ok: true,
      warnings: [],
      session: getSession(),
      detail: { reverted: true },
    };
  };

  const saveUserPreset = (rawName: string): TTuningSessionOutcome => {
    const name = cleanUserPresetName(rawName);
    if (!name) {
      return { ok: false, error: 'Provide a non-empty preset name.' };
    }
    const existing = deps.loadUserPresets();
    const dsp = sanitizeAiDspSettings(deps.state.dsp ?? DSP_DEFAULTS).settings;
    const preset: IUserDspPreset = {
      id: `${USER_DSP_PRESET_PREFIX}${uid(10)}`,
      name,
      settings: dsp,
    };
    const withoutSameName = existing.filter(
      (item) => item.name.toLowerCase() !== name.toLowerCase(),
    );
    deps.saveUserPresets([...withoutSameName, preset]);
    return {
      ok: true,
      warnings: [],
      session: getSession(),
      detail: { id: preset.id, name: preset.name },
    };
  };

  const sessionAction = async (args: {
    action: 'status' | 'snapshot' | 'ab_compare' | 'revert' | 'save_preset';
    mode?: TTuningAbMode;
    presetName?: string;
  }): Promise<TTuningSessionOutcome> => {
    switch (args.action) {
      case 'status':
        return { ok: true, warnings: [], session: getSession() };
      case 'snapshot':
        originalSnapshot = captureSnapshot();
        tunedSnapshot = undefined;
        sessionInfo = { hasSnapshot: true, mode: 'tuned', changeCount: 0 };
        emitSession();
        return {
          ok: true,
          warnings: [],
          session: getSession(),
          detail: { snapshotted: true },
        };
      case 'ab_compare':
        return abCompare(args.mode);
      case 'revert':
        return revert();
      case 'save_preset':
        return saveUserPreset(args.presetName ?? '');
      default:
        return { ok: false, error: 'Unsupported session action.' };
    }
  };

  return {
    getSession,
    getBaseMicFile,
    ensureBaseline,
    recordMutation,
    abCompare,
    revert,
    sessionAction,
  };
};
