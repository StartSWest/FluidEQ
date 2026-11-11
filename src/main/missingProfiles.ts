/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import fs from 'fs';
import path from 'path';
import log from 'electron-log';
import {
  AUTOMATIC_PRESET_PREFIX,
  type IDeviceProfileSettings,
  type IPresetV2,
} from '../common/constants';
import type { IRecoveredProfile } from '../common/recoveredProfiles';
import { doesPresetExist, fetchPreset, savePreset } from './flush';
import { isGameCopyName } from './gameSound';
import neutralProfileSound from './neutralProfileSound';
import freeUntitledProfileName from './untitledProfile';

/** The paths that exist as files, the most recently written first. */
const newestFirst = (paths: readonly string[]): string[] =>
  paths
    .flatMap((file) => {
      try {
        const stat = fs.statSync(file);
        return stat.isFile() ? [{ file, at: stat.mtimeMs }] : [];
      } catch {
        return [];
      }
    })
    .sort((a, b) => b.at - a.at)
    .map(({ file }) => file);

/** The file called `name` in every profile folder but `ownDir`, and the root. */
const copiesElsewhere = (
  presetsRoot: string,
  ownDir: string,
  name: string,
): string[] => {
  let folders: string[];
  try {
    folders = fs
      .readdirSync(presetsRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(presetsRoot, entry.name))
      .filter((folder) => path.resolve(folder) !== path.resolve(ownDir));
  } catch {
    return [];
  }
  return newestFirst([
    path.join(presetsRoot, name),
    ...folders.map((folder) => path.join(folder, name)),
  ]);
};

/** The files directly in one output's folder; none where it is not. */
const ownProfiles = (dir: string): string[] => {
  try {
    return newestFirst(
      fs
        .readdirSync(dir, { withFileTypes: true })
        .filter((entry) => entry.isFile())
        .map((entry) => path.join(dir, entry.name)),
    );
  } catch {
    return [];
  }
};

/** The first of `files` that reads as a profile: an unreadable one is no rescue. */
const firstReadable = (
  files: readonly string[],
): { name: string; preset: IPresetV2 } | undefined => {
  for (let index = 0; index < files.length; index += 1) {
    const name = path.basename(files[index]);
    try {
      return { name, preset: fetchPreset(name, path.dirname(files[index])) };
    } catch {
      // `fetchPreset` has said why in the log; the next one may read.
    }
  }
  return undefined;
};

/**
 * Every output attached to a profile its folder does not hold, given one it
 * can play.
 *
 * An output whose profile cannot be read is left out of the config
 * (`deviceProfilesToFiles`): no EQ, no rack, nothing. A 2.4.0 report had an
 * unplugged Razer Base Station attached to "Kraken V3 Pro", a file its folder
 * did not hold, and nothing was ever going to repair it — the app gives an
 * output a profile only when somebody switches to that output, and nobody
 * switches to one that is unplugged.
 *
 * How an output gets there, as far as the code can say:
 * - the move to a folder per output (2026-08-19) gave a name several outputs
 *   shared to the first of them only (`migrateNamedFilesToOutputFolders`);
 * - before that move a rename repointed every output with the old name, and
 *   those assignments are still on disk;
 * - a launch after a game's sound was on gives the music profile back by
 *   name, and one deleted meanwhile is not there (`returnGameLoans`);
 * - a file deleted outside the app.
 *
 * So, in order:
 * 1. The same name in another output's folder, or still at the root where
 *    the move left it: the newest copy that reads is copied into this
 *    output's folder, and the tuning the output was attached to is back.
 *    Never for a hidden name — an automatic profile or a game's copy belongs
 *    to its own output only.
 * 2. The output's own newest profile, games' copies aside.
 * 3. A new empty profile, as deleting an attached profile gives the output
 *    being edited.
 *
 * Runs at launch, after the games' loans are given back and before anything
 * reads a profile. Returns what it did, for the window to say once.
 */
const recoverMissingProfiles = (
  settings: IDeviceProfileSettings,
  presetsRoot: string,
  presetDirForDevice: (deviceId: string) => string,
): IRecoveredProfile[] =>
  Object.values(settings.assignments).flatMap((assignment) => {
    const { deviceId, deviceName, presetName } = assignment;
    if (!deviceId) {
      return [];
    }
    const dir = presetDirForDevice(deviceId);
    if (doesPresetExist(presetName, dir)) {
      return [];
    }
    const said = (
      how: IRecoveredProfile['how'],
      now: string,
    ): IRecoveredProfile[] => {
      log.info(
        `Output "${deviceName}" had lost its profile "${presetName}"; ${how}: "${now}"`,
      );
      return [{ deviceName, missing: presetName, now, how }];
    };

    const copy = presetName.startsWith(AUTOMATIC_PRESET_PREFIX)
      ? undefined
      : firstReadable(copiesElsewhere(presetsRoot, dir, presetName));
    if (copy) {
      savePreset(presetName, copy.preset, dir, 'profile-recovered');
      return said('copied', presetName);
    }

    const own = firstReadable(
      ownProfiles(dir).filter((file) => !isGameCopyName(path.basename(file))),
    );
    if (own) {
      assignment.presetName = own.name;
      return said('own', own.name);
    }

    const empty = freeUntitledProfileName(dir);
    savePreset(empty, neutralProfileSound(), dir, 'profile-recovered');
    assignment.presetName = empty;
    return said('new', empty);
  });

export default recoverMissingProfiles;
