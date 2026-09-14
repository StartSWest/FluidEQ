/*
<FluidEQ: System-wide parametric audio equalizer interface>
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
import log from 'electron-log';
import { IGatheredFacts, redact, takeLogTail } from '../common/bugReport';
import { TAudioEngine, IFluidEngineStatus } from '../common/audioEngine';
import { IEngineHealth, NO_ENGINE_HEALTH } from '../common/engineHealth';
import { IAudioDevice } from '../common/constants';
import { describeAudioEngine } from '../common/engineReport';
import { discoverAudioDevices } from './audioDevices';
import { readEngineHealth } from './engineHealth';
import { readFluidEngineStatus } from './engineStatus';
import {
  getFluidEngineConfigDir,
  isEngineInstalled,
  isEqualizerAPOInstalled,
} from './registry';

/** Both logs sit together, which is why the installer writes where it does. */
const getLogDirectory = () => path.join(app.getPath('userData'), 'logs');

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

/**
 * What Windows, the setup helper and the engine each say about the outputs.
 *
 * Every one of the three is allowed to fail on its own: a report about a
 * crash must not be lost because the helper could not be run, and a machine
 * with no engine answers two of the three with nothing. Anything that does
 * fail is logged — this runs while the user is filing a report about exactly
 * this area, so a failure here is itself evidence.
 */
const gatherEngineReport = async (
  audioEngine: TAudioEngine | null,
): Promise<{ engineReport: string; engineLog: string }> => {
  if (process.platform !== 'win32') {
    return { engineReport: '', engineLog: '' };
  }
  const engineRoot = path.dirname(getFluidEngineConfigDir());
  const failed = (what: string) => (error: unknown) => {
    log.warn(`Bug report could not read ${what}`, error);
    return undefined;
  };

  const [devices, fluid, health] = await Promise.all([
    discoverAudioDevices().catch(failed('the output list')) as Promise<
      IAudioDevice[] | undefined
    >,
    readFluidEngineStatus().catch(failed('the engine setup helper')) as Promise<
      IFluidEngineStatus | undefined
    >,
    readEngineHealth(engineRoot).catch(
      failed("the engine's status files"),
    ) as Promise<IEngineHealth | undefined>,
  ]);

  return {
    engineReport: describeAudioEngine({
      engine: audioEngine,
      devices: devices ?? [],
      fluid,
      health: health ?? NO_ENGINE_HEALTH,
    }),
    engineLog: readIfPresent(path.join(engineRoot, 'engine.log')),
  };
};

/**
 * `audioEngine` is passed in rather than read here, because the live answer
 * is the session's and not the file's: a switch made during this launch is
 * already in memory and may not be what the preference file said at startup.
 */
const gatherBugReportFacts = async (
  audioEngine: TAudioEngine | null,
): Promise<IGatheredFacts> => {
  const accountName = getAccountName();
  const logs = getLogDirectory();

  let apoInstalled = false;
  try {
    apoInstalled = await isEqualizerAPOInstalled();
  } catch {
    // Unknown reads as not installed, which is the more useful direction to
    // guess in: it is the first thing anybody reading the report will check.
  }

  let fluidEngineInstalled = false;
  try {
    fluidEngineInstalled = await isEngineInstalled('fluid');
  } catch {
    // Same direction to guess in, and for the same reason: "which engine, and
    // is it actually there" is the first pair of questions any report about
    // silent audio has to answer.
  }

  const { engineReport, engineLog } = await gatherEngineReport(audioEngine);

  return {
    audioEngine,
    fluidEngineInstalled,
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
    // Redacted like the logs — an output can be named after whoever owns it.
    engineReport: redact(engineReport, accountName),
    // Shorter than the app's tail: the engine writes a line when something
    // about an output changes, so its last forty are usually its whole life.
    engineLog: takeLogTail(engineLog, accountName, 40),
  };
};

export default gatherBugReportFacts;
