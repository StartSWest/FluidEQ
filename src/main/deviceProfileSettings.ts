/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import path from 'path';
import fs from 'fs';
import log from 'electron-log';
import {
  IDeviceProfileAssignment,
  IDeviceProfileSettings,
} from '../common/constants';
import { scheduleWrite } from './asyncWriter';
import { safePresetFileName } from './flush';

// Which profile each output plays: the assignments file, read and written,
// the assignments changed as profiles are renamed and removed, and the move
// of old flat profile files into each output's folder.

const SETTINGS_FILENAME = 'device-profiles.json';

export const getDefaultDeviceProfileSettings = (): IDeviceProfileSettings => ({
  version: 1,
  assignments: {},
});

export const loadDeviceProfileSettings = (
  userDataDir: string,
): IDeviceProfileSettings => {
  const settingsPath = path.join(userDataDir, SETTINGS_FILENAME);
  try {
    const input = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    if (input?.version !== 1 || typeof input.assignments !== 'object') {
      throw new Error('Unsupported device profile settings');
    }
    return input as IDeviceProfileSettings;
  } catch {
    return getDefaultDeviceProfileSettings();
  }
};

export const saveDeviceProfileSettings = (
  settings: IDeviceProfileSettings,
  userDataDir: string,
): Promise<void> => {
  // Asynchronous and coalesced — see asyncWriter. Rewritten on every edit
  // that touches an assignment, which a drag does not, but the state it
  // sits beside is.
  return scheduleWrite(
    path.join(userDataDir, SETTINGS_FILENAME),
    JSON.stringify(settings, null, 2),
  );
};

export const assignDeviceProfile = (
  settings: IDeviceProfileSettings,
  assignment: IDeviceProfileAssignment,
) => {
  settings.assignments[assignment.deviceId] = assignment;
};

export const removeDeviceProfile = (
  settings: IDeviceProfileSettings,
  deviceId: string,
) => {
  delete settings.assignments[deviceId];
};

/**
 * ONE OUTPUT, BECAUSE A PROFILE NAME ONLY MEANS ANYTHING NEXT TO ONE.
 *
 * Profiles have lived in a folder per output since `presetDirForDevice`, so
 * `Untitled profile 1` is five separate profiles on a machine with five
 * outputs, and renaming one moves exactly one file. These two used to rewrite
 * every assignment that happened to share the name, which repointed the other
 * four outputs at a file that exists only in somebody else's folder.
 *
 * The failure was silent where it started and loud somewhere else.
 * `flushDeviceProfiles` swallows a profile it cannot read, so those outputs
 * dropped out of the Equalizer APO config without a word and simply stopped
 * being equalised; the error only appeared later, when something read one of
 * them by name — switching to that output, loading it, restoring its saved
 * copy — as a preset file error blaming a directory that was never at fault.
 *
 * The caller passes the output whose folder it just wrote in, which is always
 * `session.activeAudioDeviceId`: `renamePreset` and `deletePreset` are given
 * `activePresetDir()`, and that is the same output by construction.
 */
export const renameAssignedPreset = (
  settings: IDeviceProfileSettings,
  deviceId: string,
  oldName: string,
  newName: string,
) => {
  const assignment = settings.assignments[deviceId];
  if (assignment?.presetName === oldName) {
    assignment.presetName = newName;
  }
};

/**
 * Detach one output from a profile whose file has just been deleted.
 *
 * Still checks the name: the assignment may have moved on between the delete
 * being queued and this running, and an output attached to something else must
 * not be detached from it.
 */
export const removeAssignmentForPreset = (
  settings: IDeviceProfileSettings,
  deviceId: string,
  presetName: string,
) => {
  if (settings.assignments[deviceId]?.presetName === presetName) {
    delete settings.assignments[deviceId];
  }
};

/**
 * Move files saved flat, back when a name identified a profile on its own, into
 * the folder of the output that was using them.
 *
 * Two stores were laid out that way and both had to be split: the profiles
 * themselves, and the hand-saved copies behind them. One function because it is
 * one move — the only thing that differs is which directory it runs over and
 * what it calls the thing in the log.
 *
 * An assignment is the only record of who a file belonged to, so it is the only
 * thing that can answer the question. A name no assignment mentions has no
 * owner to deduce and is left exactly where it is: not deleted, not guessed at,
 * still readable on disk if it turns out to matter.
 *
 * LOSSY WHERE THE OLD LAYOUT WAS AMBIGUOUS, AND NO ARRANGEMENT IS NOT. Five
 * outputs attached to "Untitled profile 1" shared one file, and nothing on disk
 * says which of them wrote it. The first assignment to claim it gets it and the
 * rest find nothing — which is what they effectively had, since every save on
 * any of them had been overwriting the same file. Nothing is destroyed; the
 * copy survives under one owner.
 *
 * Runs once per file by construction: the second run finds the root empty of it
 * and does nothing.
 */
export const migrateNamedFilesToOutputFolders = (
  settings: IDeviceProfileSettings,
  rootDir: string,
  dirForDevice: (deviceId: string) => string,
  /** What to call the moved thing in the log — "profile", "saved copy". */
  description: string,
) => {
  Object.values(settings.assignments).forEach((assignment) => {
    // The name comes out of a file on disk, so it is asked the same question
    // every other path built from a profile name is asked before it is joined.
    const safeName = safePresetFileName(assignment.presetName);
    if (!safeName) {
      return;
    }
    const from = path.join(rootDir, safeName);
    // Directories are the new layout; only a file at the root is unmigrated.
    if (!fs.existsSync(from) || !fs.statSync(from).isFile()) {
      return;
    }
    const dir = dirForDevice(assignment.deviceId);
    const to = path.join(dir, safeName);
    // Never clobber what the new layout already holds.
    if (fs.existsSync(to)) {
      return;
    }
    try {
      fs.mkdirSync(dir, { recursive: true });
      fs.renameSync(from, to);
      log.info(
        `Moved the ${description} "${assignment.presetName}" to its output's folder`,
      );
    } catch (e) {
      // What will not move stays where it is and stays readable. For a profile
      // that means the tuning is still there; for a saved copy it costs an undo.
      log.error(`Could not move the ${description} "${assignment.presetName}"`);
      log.error(e);
    }
  });
};
