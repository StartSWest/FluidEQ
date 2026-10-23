/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The outputs a Mac has, asked of the engine that plays to them.
 *
 * The engine lists them (`FluidEQ-Engine --list-outputs`) by Core Audio's
 * device UID, which is what macOS keeps stable. Each gets two identities,
 * each where the rest of the app already expects it:
 *
 * - `guid` is a `{GUID}` made from the UID (`macOutputGuid`). The `Device:`
 *   line, the engine's status file, the display connection's handshake and
 *   every check the app makes on them were written for Windows' `{GUID}`,
 *   and a UID is free text. The engine makes the same one from the same UID
 *   (`endpoint_guid` in `output_devices.cpp`), so the two agree on which
 *   output a line or a status is about.
 * - `id` stays the UID itself, because profiles are attached by `id`.
 *
 * Until this, a Mac listed two placeholder outputs, "Demo Speakers" among
 * them. A profile attached to one was written for an output that does not
 * exist, so an engine matching real outputs found no profile for the
 * headphones and played them flat.
 */
import { execFile } from 'child_process';
import { createHash } from 'crypto';
import { promisify } from 'util';
import log from 'electron-log';
import { IAudioDevice, IDeviceProfileSettings } from '../../common/constants';
import { findMacEngineExecutable } from './enginePath';

const execFileAsync = promisify(execFile);

/**
 * `{XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX}`, upper-case, from the first half of
 * the UID's SHA-256 — the engine's `endpoint_guid`, byte for byte.
 */
export const macOutputGuid = (uid: string): string => {
  const hex = createHash('sha256')
    .update(uid, 'utf8')
    .digest('hex')
    .slice(0, 32)
    .toUpperCase();
  return `{${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(
    12,
    16,
  )}-${hex.slice(16, 20)}-${hex.slice(20, 32)}}`;
};

/**
 * The engine's list, checked at every level rather than trusted: an output
 * with no identifier is dropped, a missing name falls back to the identifier,
 * and anything that is not the expected shape is no list at all.
 *
 * Every output is one the engine processes — it follows whichever output is
 * playing — and every one can host it, which are the two answers the output
 * panels read to decide whether a profile there is heard.
 */
export const parseMacOutputs = (stdout: string): IAudioDevice[] => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) {
    return [];
  }
  return parsed.flatMap((entry: unknown): IAudioDevice[] => {
    if (typeof entry !== 'object' || entry === null) {
      return [];
    }
    const { uid, name, isDefault } = entry as Record<string, unknown>;
    if (typeof uid !== 'string' || uid === '') {
      return [];
    }
    return [
      {
        id: uid,
        name: typeof name === 'string' && name !== '' ? name : uid,
        guid: macOutputGuid(uid),
        isDefault: isDefault === true,
        isActive: true,
        isFluidEngineAttached: true,
        canHostEffects: true,
      },
    ];
  });
};

/**
 * Profiles attached before outputs had a `{GUID}`, moved onto it.
 *
 * Such a profile was stored with the UID as its GUID too — both identities
 * were the UID then — so its `Device:` line named the UID, and an engine that
 * names outputs by their `{GUID}` matched nothing: the EQ went flat on the
 * output it was attached to. Exactly those are rewritten, once, and nothing
 * else is touched. True when anything changed, for the caller to save.
 */
export const adoptMacOutputGuids = (
  settings: IDeviceProfileSettings,
): boolean => {
  let changed = false;
  Object.values(settings.assignments).forEach((assignment) => {
    if (assignment.deviceGuid === assignment.deviceId) {
      assignment.deviceGuid = macOutputGuid(assignment.deviceId);
      changed = true;
    }
  });
  return changed;
};

/**
 * Makes an output the one the Mac plays everything through — choosing it in
 * the app's output list. The engine follows the new output by itself, as it
 * does when the choice is made in System Settings. Throws when it could not
 * be done, which the output list reports.
 */
export const setMacDefaultOutput = async (uid: string): Promise<void> => {
  const executable = findMacEngineExecutable();
  if (!executable) {
    throw new Error('The macOS engine is not built, so outputs cannot change.');
  }
  await execFileAsync(executable, ['--set-default-output', uid]);
};

/** Every output, or none when the engine is not built or would not say. */
export const discoverMacOutputs = async (): Promise<IAudioDevice[]> => {
  const executable = findMacEngineExecutable();
  if (!executable) {
    log.warn('macOS outputs: the engine is not built, so no output is listed');
    return [];
  }
  try {
    const { stdout } = await execFileAsync(executable, ['--list-outputs'], {
      maxBuffer: 1024 * 1024,
    });
    return parseMacOutputs(stdout);
  } catch (error) {
    log.error(`macOS outputs could not be listed: ${String(error)}`);
    return [];
  }
};
