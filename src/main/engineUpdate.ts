/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Whether the FluidEQ Engine installed on this PC is the one this app carries.
 *
 * An app update replaces the app and never the engine. Setup runs silently
 * then, often with nobody at the machine, and putting an engine in place
 * takes a Windows permission prompt — so `installer.nsh` leaves it alone, and
 * every engine fix (the owner pipe that turns the EQ off on End task, the
 * finite-sample guard, the status files the engine notice reads) stopped at
 * the machines that installed it fresh. The comparison runs after launch
 * instead, and the window offers the update where somebody is there to
 * answer the prompt (`EngineUpdateNotice`).
 *
 * By content, because nothing else tells two builds apart: the version
 * resource says which of the app's expectations an engine meets (`engine.rc`),
 * not which build it is, and it stays put across every fix that adds none.
 * `pnpm dev` asks the same question of the engine it just compiled
 * (`.erb/scripts/sync-dev-engine.ts`).
 *
 * "Differs", never "is older": the engine to run is the one built with this
 * app, whichever way the two moved apart. The DSP rack's file is a layout the
 * two sides share and neither can ask the other about (`chainWire.ts`), and
 * an engine from another build refuses it.
 *
 * No Electron here, and nothing that spawns: the dev script imports this from
 * plain Node, and the unit suite runs it against two scratch folders.
 */
import { createHash } from 'crypto';
import { existsSync } from 'fs';
import { readdir, readFile } from 'fs/promises';
import path from 'path';

export const ENGINE_DLL = 'FluidEQ-Engine.dll';

export type TEngineUpdatePlan =
  /** This app carries no engine — a source checkout with no native build. */
  | { kind: 'no-bundle' }
  | { kind: 'not-installed' }
  | { kind: 'current' }
  | { kind: 'stale'; files: string[] };

const sha256 = async (file: string): Promise<string> =>
  createHash('sha256')
    .update(await readFile(file))
    .digest('hex');

/**
 * Every DLL the helper's `install` would copy — all of them beside it, the
 * runtime included, because an engine linked against a newer toolset than the
 * installed `msvcp140.dll` fails to load inside audiodg.exe with nothing to
 * say why — whose installed copy is missing or holds other bytes.
 *
 * Files only, as the helper's own `files_matching` lists them, and never the
 * helper or the other programs beside it, which `install` does not copy.
 */
export const differingFiles = async (
  bundleDir: string,
  installDir: string,
): Promise<string[]> => {
  const names = (await readdir(bundleDir, { withFileTypes: true }))
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => name.toLowerCase().endsWith('.dll'));
  const differs = await Promise.all(
    names.map(async (name) => {
      const installed = path.join(installDir, name);
      if (!existsSync(installed)) {
        return true;
      }
      const [was, is] = await Promise.all([
        sha256(installed),
        sha256(path.join(bundleDir, name)),
      ]);
      return was !== is;
    }),
  );
  return names.filter((_, at) => differs[at]).sort();
};

/**
 * Nothing to offer unless this app carries an engine and one is installed:
 * installing it is a choice made in the engine dialog or the installer, never
 * a side effect of starting the app — or of starting development.
 *
 * `bundleDir` is the folder the helper copies from, which is its own;
 * `installDir` the folder Windows loads the engine from.
 */
export const planEngineUpdate = async (
  bundleDir: string,
  installDir: string,
): Promise<TEngineUpdatePlan> => {
  if (!existsSync(path.join(bundleDir, ENGINE_DLL))) {
    return { kind: 'no-bundle' };
  }
  if (!existsSync(path.join(installDir, ENGINE_DLL))) {
    return { kind: 'not-installed' };
  }
  const files = await differingFiles(bundleDir, installDir);
  return files.length === 0 ? { kind: 'current' } : { kind: 'stale', files };
};
