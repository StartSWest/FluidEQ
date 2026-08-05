/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>

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

/**
 * Gathering the facts a bug report needs, and nothing beyond them.
 *
 * The list is deliberately short and hand-written. It would be easy to reach
 * for everything available — the machine name, the user, the full environment,
 * every installed device — and every one of those is somebody's personal
 * information being put into a public issue tracker. What is collected is what
 * has actually helped diagnose something: which build, which Windows, and
 * whether the audio engine is there.
 *
 * The redaction itself lives in `common/bugReport.ts`, where it can be tested
 * without an Electron process.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { app } from 'electron';
import { IGatheredFacts, takeLogTail } from '../common/bugReport';
import { isEqualizerAPOInstalled } from './registry';

/** Both logs sit together, which is why the installer writes where it does. */
const getLogDirectory = () => path.join(app.getPath('userData'), 'logs');

export const getLogDirectoryPath = getLogDirectory;

const readIfPresent = (file: string): string => {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    // A log that has never been written is the normal case for a fresh
    // install, and is not worth reporting as a failure.
    return '';
  }
};

/**
 * The account name, used only to remove itself from the report.
 *
 * It is never included anywhere — it is read so that every occurrence of it can
 * be replaced. A username cannot be recognised by shape, only by knowing it.
 */
const getAccountName = (): string | undefined => {
  try {
    return os.userInfo().username;
  } catch {
    return undefined;
  }
};

export const gatherBugReportFacts = async (): Promise<IGatheredFacts> => {
  const accountName = getAccountName();
  const logs = getLogDirectory();

  let apoInstalled = false;
  try {
    apoInstalled = await isEqualizerAPOInstalled();
  } catch {
    // Unknown reads as not installed, which is the more useful direction to
    // guess in: it is the first thing anybody reading the report will check.
  }

  return {
    appVersion: app.getVersion(),
    // A version, never a machine name. `os.hostname()` is deliberately absent.
    platform: `${os.type()} ${os.release()}`,
    arch: os.arch(),
    electron: process.versions.electron,
    isEqualizerApoInstalled: apoInstalled,
    appLog: takeLogTail(
      readIfPresent(path.join(logs, 'main.log')),
      accountName,
    ),
    installLog: takeLogTail(
      readIfPresent(path.join(logs, 'install.log')),
      accountName,
    ),
  };
};
