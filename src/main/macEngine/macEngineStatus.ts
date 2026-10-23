/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What a Mac says about the FluidEQ Engine, in the shape Windows' setup
 * helper answers.
 *
 * Installed wherever the app is, because it ships inside it. Its version is
 * the Windows effect's own number (`engine.rc`, compiled into the engine by
 * its build), and the app gates every engine feature on that number — the
 * Room, Game mode, the curve comparison — so reporting it is what lets each
 * of them, and every one main adds later, switch on for a Mac without a line
 * written for the Mac.
 *
 * No outputs are listed. On Windows that list says which outputs the effect
 * is registered on, and the notices built on it offer Windows' repairs —
 * restarting its audio service, moving the effect to another slot. On a Mac
 * the engine follows whichever output is playing, so there is nothing to be
 * registered on and none of those repairs exists.
 */
import { execFile } from 'child_process';
import { promisify } from 'util';
import log from 'electron-log';
import { IFluidEngineStatus } from '../../common/audioEngine';
import { findMacEngineExecutable } from './enginePath';

const execFileAsync = promisify(execFile);

/** `1.12.0.0`, and nothing that is not four numbers. */
export const parseMacEngineVersion = (stdout: string): string | undefined => {
  const version = stdout.trim();
  return /^\d+\.\d+\.\d+\.\d+$/.test(version) ? version : undefined;
};

export const readMacEngineStatus = async (): Promise<IFluidEngineStatus> => {
  const executable = findMacEngineExecutable();
  if (!executable) {
    return { installed: false, endpoints: [] };
  }
  try {
    const { stdout } = await execFileAsync(executable, ['--version']);
    const dllVersion = parseMacEngineVersion(stdout);
    return dllVersion
      ? { installed: true, dllVersion, endpoints: [] }
      : { installed: true, endpoints: [] };
  } catch (error) {
    log.error(`The macOS engine would not say its version: ${String(error)}`);
    return { installed: true, endpoints: [] };
  }
};
