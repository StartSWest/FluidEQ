/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { execFile } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';
import {
  LIGHTING_EXECUTABLE,
  LIGHTING_IDENTITY_PACKAGE,
  LIGHTING_PACKAGE_NAME,
} from './lightingPath';

/**
 * Registering the lighting helper's package identity, so Windows lets it
 * light devices while FluidEQ is behind other windows (see
 * `native/lighting-host/src/identity.h`).
 *
 * Done by the app, per user, the first time lighting is switched on — not by
 * the installer. Registration belongs to the Windows account that runs it,
 * and an installer elevated by an administrator would register it for the
 * administrator instead of the person at the desk. No elevation is needed,
 * and a version or install folder that changed is registered again.
 *
 * A build with no identity package (development, or unsigned) skips all of
 * it: Windows then lights devices while FluidEQ is the window in front, and
 * Razer devices through Synapse are unaffected either way.
 */

export type TIdentityOutcome =
  'registered' | 'no-package' | 'failed' | 'unsupported';

interface IRun {
  code: number;
  stdout: string;
}

export type TRunHelper = (executable: string, args: string[]) => Promise<IRun>;

const runHelper: TRunHelper = (executable, args) =>
  new Promise((resolve) => {
    execFile(
      executable,
      args,
      { windowsHide: true, encoding: 'utf8' },
      (error, stdout) => {
        if (!error) {
          resolve({ code: 0, stdout });
          return;
        }
        // The helper's own exit code where it ran; -1 where it never started.
        const { code } = error as { code?: unknown };
        resolve({ code: typeof code === 'number' ? code : -1, stdout });
      },
    );
  });

/** `1.6.5` → `1.6.5.0`, the four-part version a package carries. */
export const packageVersionOf = (appVersion: string): string => {
  const [major = '0', minor = '0', patch = '0'] = appVersion
    .split(/[.+-]/)
    .slice(0, 3)
    .map((part) => String(Number.parseInt(part, 10) || 0));
  return `${major}.${minor}.${patch}.0`;
};

const sameFolder = (left: string, right: string): boolean =>
  path
    .resolve(left)
    .toLowerCase()
    .replace(/[\\/]+$/, '') ===
  path
    .resolve(right)
    .toLowerCase()
    .replace(/[\\/]+$/, '');

/** Whether what is registered already describes this install. */
export const isRegistrationCurrent = (
  status: { registered: boolean; version?: string; location?: string },
  appVersion: string,
  folder: string,
): boolean =>
  status.registered &&
  status.version === packageVersionOf(appVersion) &&
  typeof status.location === 'string' &&
  sameFolder(status.location, folder);

const readStatus = (
  stdout: string,
): { registered: boolean; version?: string; location?: string } | undefined => {
  const line = stdout
    .split('\n')
    .find((candidate) => candidate.startsWith('{"type":"identity",'));
  if (!line) {
    return undefined;
  }
  try {
    const parsed: unknown = JSON.parse(line);
    if (typeof parsed !== 'object' || parsed === null) {
      return undefined;
    }
    const { registered, version, location } = parsed as Record<string, unknown>;
    if (typeof registered !== 'boolean') {
      return undefined;
    }
    return {
      registered,
      version: typeof version === 'string' ? version : undefined,
      location: typeof location === 'string' ? location : undefined,
    };
  } catch {
    return undefined;
  }
};

export const ensureLightingIdentity = async (
  folder: string | undefined,
  appVersion: string,
  run: TRunHelper = runHelper,
): Promise<TIdentityOutcome> => {
  if (!folder || !LIGHTING_EXECUTABLE) {
    return 'unsupported';
  }
  const packagePath = path.join(folder, LIGHTING_IDENTITY_PACKAGE);
  if (!existsSync(packagePath)) {
    return 'no-package';
  }
  const executable = path.join(folder, LIGHTING_EXECUTABLE);
  const status = await run(executable, [
    'identity',
    'status',
    LIGHTING_PACKAGE_NAME,
  ]);
  const current = status.code === 0 ? readStatus(status.stdout) : undefined;
  if (current && isRegistrationCurrent(current, appVersion, folder)) {
    return 'registered';
  }
  if (current?.registered) {
    // Windows refuses a version that is already registered, even from a
    // different folder — an install moved elsewhere, or reinstalled at the
    // same version, would fail to register over its own old entry. What is
    // there is this app's and describes an exe that is not this one.
    const removed = await run(executable, [
      'identity',
      'remove',
      LIGHTING_PACKAGE_NAME,
    ]);
    if (removed.code !== 0) {
      console.error(
        `Dynamic lighting could not replace its old Windows identity (exit ${removed.code}): ${removed.stdout.trim()}`,
      );
      return 'failed';
    }
  }
  const registered = await run(executable, [
    'identity',
    'register',
    packagePath,
    folder,
  ]);
  if (registered.code !== 0) {
    console.error(
      `Dynamic lighting could not register its Windows identity (exit ${registered.code}): ${registered.stdout.trim()}`,
    );
    return 'failed';
  }
  return 'registered';
};
