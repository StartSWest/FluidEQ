/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { execFile } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import {
  LIGHTING_EXECUTABLE,
  LIGHTING_IDENTITY_MANIFEST,
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
 * Without identity the helper lights nothing through Windows — not even while
 * FluidEQ is in front, since Windows gives an app in front's lamps to the
 * process owning that window and the helper owns none. A release registers
 * its signed package; a development or unsigned copy registers the bare
 * manifest beside the helper, which Windows allows only with Developer Mode
 * on. Razer devices through Razer Chroma are unaffected either way.
 */

export type TIdentityOutcome =
  'registered' | 'no-package' | 'developer-mode-off' | 'failed' | 'unsupported';

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

interface IIdentityStatus {
  registered: boolean;
  version?: string;
  location?: string;
  developerMode?: boolean;
}

const readStatus = (stdout: string): IIdentityStatus | undefined => {
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
    const { registered, version, location, developerMode } = parsed as Record<
      string,
      unknown
    >;
    if (typeof registered !== 'boolean') {
      return undefined;
    }
    return {
      registered,
      version: typeof version === 'string' ? version : undefined,
      location: typeof location === 'string' ? location : undefined,
      developerMode:
        typeof developerMode === 'boolean' ? developerMode : undefined,
    };
  } catch {
    return undefined;
  }
};

/**
 * What registering can use here: the signed package a release ships, else the
 * bare manifest every build writes beside the helper, which Windows registers
 * only with Developer Mode on.
 */
export const identitySourceOf = (
  folder: string,
  exists: (file: string) => boolean = existsSync,
): { kind: 'signed' | 'development'; file: string } | undefined => {
  const signed = path.join(folder, LIGHTING_IDENTITY_PACKAGE);
  if (exists(signed)) {
    return { kind: 'signed', file: signed };
  }
  const manifest = path.join(folder, LIGHTING_IDENTITY_MANIFEST);
  return exists(manifest) ? { kind: 'development', file: manifest } : undefined;
};

export const ensureLightingIdentity = async (
  folder: string | undefined,
  appVersion: string,
  run: TRunHelper = runHelper,
  exists: (file: string) => boolean = existsSync,
): Promise<TIdentityOutcome> => {
  if (!folder || !LIGHTING_EXECUTABLE) {
    return 'unsupported';
  }
  const source = identitySourceOf(folder, exists);
  if (!source) {
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
  if (source.kind === 'development' && current?.developerMode !== true) {
    // Nothing to register with until the member turns Developer Mode on; the
    // page says so, and the next time lighting is switched on asks again.
    return 'developer-mode-off';
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
  // URIs, not paths: Windows' Uri type does not take a bare `D:\…` path.
  const registered = await run(executable, [
    'identity',
    source.kind === 'signed' ? 'register' : 'register-dev',
    pathToFileURL(source.file).href,
    pathToFileURL(folder).href,
  ]);
  if (registered.code !== 0) {
    console.error(
      `Dynamic lighting could not register its Windows identity (exit ${registered.code}): ${registered.stdout.trim()}`,
    );
    return 'failed';
  }
  return 'registered';
};
