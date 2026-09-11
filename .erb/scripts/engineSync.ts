/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What `sync-dev-engine` decides, apart from the doing of it, so the decision
 * can be tested against two scratch folders. The doing needs a UAC prompt and
 * an audio restart, and neither belongs anywhere near a test run.
 */
import { createHash } from 'crypto';
import { existsSync, readdirSync, readFileSync } from 'fs';
import path from 'path';

export const ENGINE_DLL = 'FluidEQ-Engine.dll';

export type TEngineSyncPlan =
  | { kind: 'not-installed' }
  | { kind: 'current' }
  | { kind: 'stale'; files: string[] };

const sha256 = (file: string): string =>
  createHash('sha256').update(readFileSync(file)).digest('hex');

/**
 * Every DLL the helper's `install` would copy — all of them beside it, the
 * runtime included, because an engine linked against a newer toolset than the
 * installed `msvcp140.dll` fails to load inside audiodg.exe with nothing to
 * say why — whose installed copy is missing or holds other bytes.
 */
export const differingFiles = (
  buildBin: string,
  installDir: string,
): string[] =>
  readdirSync(buildBin)
    .filter((name) => name.toLowerCase().endsWith('.dll'))
    .filter((name) => {
      const installed = path.join(installDir, name);
      return (
        !existsSync(installed) ||
        sha256(installed) !== sha256(path.join(buildBin, name))
      );
    })
    .sort();

/**
 * Nothing to do unless the engine is installed at all: installing it is a
 * choice made in the app or the installer, never a side effect of starting
 * development.
 */
export const planEngineSync = (
  buildBin: string,
  installDir: string,
): TEngineSyncPlan => {
  if (!existsSync(path.join(installDir, ENGINE_DLL))) {
    return { kind: 'not-installed' };
  }
  const files = differingFiles(buildBin, installDir);
  return files.length === 0 ? { kind: 'current' } : { kind: 'stale', files };
};

/** The helper's `error`, when its stdout is the result document it writes. */
export const helperError = (stdout: string): string | undefined => {
  try {
    const parsed: unknown = JSON.parse(stdout.trim());
    if (typeof parsed === 'object' && parsed !== null) {
      const { error } = parsed as { error?: unknown };
      return typeof error === 'string' && error.length > 0 ? error : undefined;
    }
  } catch {
    // Not the document: the helper's exit code is still the verdict.
  }
  return undefined;
};
