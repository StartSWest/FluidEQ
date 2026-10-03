/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import fs from 'fs';
import path from 'path';
import log from 'electron-log';
import type { IState } from '../common/constants';
import type { IDspSettings } from '../common/dsp/chain';
import { DEFAULT_EQ_CUTS, toEqCuts } from '../common/eqCuts';
import { isCurveComparison } from '../common/curveComparison';
import { isTrebleDesign } from '../common/filterDesign';
import {
  OUTPUT_CONFIG_BASENAMES,
  TOutputConfigFile,
} from '../common/outputConfigFiles';
import type { IOutputSound } from '../common/outputSettings';
import { validatePresetV1, validatePresetV2 } from '../common/validator';
import { peekScheduled, scheduleWrite } from './asyncWriter';
import {
  fetchPreset,
  PRESET_BASELINES_DIR,
  PRESETS_DIR,
  readPresetText,
  save,
  savePreset,
} from './flush';
import { outputDesignsOf } from './outputDesigns';
import {
  restoreOutputSound,
  sanitizeOutputSound,
} from './outputSoundPersistence';
import { getFluidEngineConfigDir } from './registry';

const DESIGN_MARKER = 'output-design-profiles-v1.json';
const DSP_MARKER = 'output-dsp-profiles-v1.json';
const running = new Map<string, Promise<void>>();
const OUTPUT_FOLDER = /^[0-9a-f]{12}$/i;
const WRITER_TEMPORARY = /\.\d+-[0-9a-f-]{36}\.tmp$/i;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const directoryEntries = (directory: string): fs.Dirent[] => {
  try {
    return fs.readdirSync(directory, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw error;
  }
};

/** Includes saved copies and unattached profiles, including old flat roots. */
const profileFiles = (userDataDir: string) =>
  [PRESETS_DIR, PRESET_BASELINES_DIR].flatMap((folder) => {
    const root = path.join(userDataDir, folder);
    const entries = directoryEntries(root);
    const directories = [
      root,
      ...entries
        .filter(
          (entry) => entry.isDirectory() && OUTPUT_FOLDER.test(entry.name),
        )
        .map((entry) => path.join(root, entry.name)),
    ];
    return directories.flatMap((directory) =>
      directoryEntries(directory)
        .filter((entry) => entry.isFile() && !WRITER_TEMPORARY.test(entry.name))
        .map((entry) => ({ directory, name: entry.name })),
    );
  });

const missingSound = (
  existing: Record<string, unknown>,
  legacy: IOutputSound,
): IOutputSound => ({
  ...(existing.dsp === undefined && legacy.dsp !== undefined
    ? { dsp: legacy.dsp }
    : {}),
  ...(existing.eqCuts === undefined && legacy.eqCuts !== undefined
    ? { eqCuts: legacy.eqCuts }
    : {}),
  ...(existing.trebleDesigns === undefined && legacy.trebleDesigns !== undefined
    ? { trebleDesigns: legacy.trebleDesigns }
    : {}),
  ...(existing.eqPhase === undefined && legacy.eqPhase !== undefined
    ? { eqPhase: legacy.eqPhase }
    : {}),
  ...(existing.curvePhase === undefined && legacy.curvePhase !== undefined
    ? { curvePhase: legacy.curvePhase }
    : {}),
});

const queueProfileMigration = (
  userDataDir: string,
  legacy: IOutputSound,
  source: string,
): Promise<void>[] => {
  const writes: Promise<void>[] = [];
  profileFiles(userDataDir).forEach(({ directory, name }) => {
    const contents = readPresetText(name, directory);
    let input: unknown;
    try {
      input = JSON.parse(contents);
    } catch (error) {
      log.warn('Skipped unreadable output profile during migration', {
        directory,
        name,
        error,
      });
      return;
    }
    if (
      !isRecord(input) ||
      (!validatePresetV1(input) && !validatePresetV2(input))
    ) {
      return;
    }
    const patch = missingSound(input, legacy);
    if (!Object.keys(patch).length) {
      return;
    }
    const preset = fetchPreset(name, directory);
    // savePreset clones/clamps the sound before queuing it. The snapshot is
    // visible to a flush immediately and a later ordinary edit wins the queue.
    writes.push(savePreset(name, { ...preset, ...patch }, directory, source));
  });
  return writes;
};

const migrateOnce = (
  userDataDir: string,
  markerName: string,
  queue: () => Promise<void>[],
): Promise<void> => {
  const markerPath = path.join(userDataDir, markerName);
  const current = running.get(markerPath);
  if (current) {
    return current;
  }
  if (peekScheduled(markerPath) !== undefined || fs.existsSync(markerPath)) {
    return Promise.resolve();
  }
  let writes: Promise<void>[];
  try {
    // No await before every snapshot is queued: startup's first flush must
    // already see the migrated profiles, even while disk writes are landing.
    writes = queue();
  } catch (error) {
    return Promise.reject(error);
  }
  const completed = Promise.all(writes)
    .then(() => scheduleWrite(markerPath, '{"version":1}\n'))
    .finally(() => running.delete(markerPath));
  running.set(markerPath, completed);
  return completed;
};

const readLegacyDesign = (
  configDirPath: string,
  kind: TOutputConfigFile,
): string | undefined => {
  try {
    return fs
      .readFileSync(
        path.join(configDirPath, OUTPUT_CONFIG_BASENAMES[kind]),
        'utf8',
      )
      .trim();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return undefined;
    }
    throw error;
  }
};

/** Called synchronously during profile folder preparation, before first flush. */
export const migrateLegacyOutputDesigns = (
  userDataDir: string,
  state: IState,
): Promise<void> =>
  migrateOnce(userDataDir, DESIGN_MARKER, () => {
    // This only computes a path; unlike getConfigPath it creates no engine
    // folder and changes no selected engine while importing the old choices.
    const configDirPath = getFluidEngineConfigDir();
    const eq = readLegacyDesign(configDirPath, 'eqTreble');
    const curves = readLegacyDesign(configDirPath, 'curveTreble');
    const eqPhase = readLegacyDesign(configDirPath, 'eqPhase');
    const curvePhase = readLegacyDesign(configDirPath, 'curvePhase');
    const defaults = outputDesignsOf(state);
    const legacy: IOutputSound = {
      trebleDesigns: {
        eq: isTrebleDesign(eq) ? eq : defaults.trebleDesigns.eq,
        curves: isTrebleDesign(curves) ? curves : defaults.trebleDesigns.curves,
      },
      eqPhase: isCurveComparison(eqPhase) ? eqPhase : defaults.eqPhase,
      curvePhase: isCurveComparison(curvePhase)
        ? curvePhase
        : defaults.curvePhase,
      eqCuts: toEqCuts(state.eqCuts) ?? { ...DEFAULT_EQ_CUTS },
    };
    const writes = queueProfileMigration(
      userDataDir,
      legacy,
      'output-design-migration',
    );
    const patch = missingSound({ ...state }, legacy);
    if (Object.keys(patch).length) {
      Object.assign(state, sanitizeOutputSound({ ...state, ...patch }));
      writes.push(save(state, userDataDir));
    }
    return writes;
  });

/** The renderer supplies its old rack once; every old saved copy gets a value. */
export const migrateLegacyOutputDsp = (
  userDataDir: string,
  legacy: IDspSettings,
): Promise<void> =>
  migrateOnce(userDataDir, DSP_MARKER, () =>
    queueProfileMigration(
      userDataDir,
      restoreOutputSound({ dsp: legacy }),
      'output-dsp-migration',
    ),
  );
