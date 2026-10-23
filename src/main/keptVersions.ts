/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import fs from 'fs';
import path from 'path';
import writeFileAtomically from './atomicWrite';

/**
 * Earlier versions of a scene this computer has had, kept on disk so an owner
 * can play any of them again (Ivan, 2026-10-18: "they should be able to play
 * any of the versions … careful to don't waste server resources"). The server
 * keeps only a scene's current file; the copies are here, where they already
 * were.
 *
 * A version is kept by copying the file it was in aside when a newer one
 * replaces it — the encrypted file as it was, never decrypted on the way —
 * into `<scene file>.versions/<version>`, and only the newest
 * `KEPT_VERSIONS` stay. Which version a scene plays is a pin per look, in
 * one small file beside the stores (`version-pins.json`); no pin is the
 * newest.
 */

/** Earlier versions kept per scene; the oldest goes when one more is kept. */
export const KEPT_VERSIONS = 10;

const VERSION_NAME = /^[0-9]{1,9}$/;

/** The folder a scene file's earlier versions live in. */
export const keptVersionsDir = (sceneFile: string) => `${sceneFile}.versions`;

export const keptVersionFile = (sceneFile: string, version: number) =>
  path.join(keptVersionsDir(sceneFile), String(version));

/** The versions kept beside a scene file, newest first. */
export const keptVersionsOf = (sceneFile: string): number[] => {
  try {
    return fs
      .readdirSync(keptVersionsDir(sceneFile))
      .filter((name) => VERSION_NAME.test(name))
      .map(Number)
      .sort((a, b) => b - a);
  } catch {
    return [];
  }
};

/** A scene let go of takes its kept versions with it. */
export const forgetKeptVersions = (sceneFile: string) =>
  fs.rmSync(keptVersionsDir(sceneFile), { recursive: true, force: true });

/**
 * Runs `write`, which puts a newer version in `sceneFile`, keeping the file
 * as it is now as `version` (when there is one to keep). The copy is made
 * first, because `write` replaces it; a `write` that throws takes the copy
 * back, so a failed update leaves the folder as it found it and never lists
 * the version still current as an earlier one. Only once the write landed
 * are the oldest let go past `KEPT_VERSIONS`.
 */
export const replaceKeepingVersion = (
  sceneFile: string,
  version: number | undefined,
  write: () => void,
) => {
  const keeps =
    version !== undefined &&
    Number.isInteger(version) &&
    version > 0 &&
    fs.existsSync(sceneFile);
  const target = keeps ? keptVersionFile(sceneFile, version) : undefined;
  const made = target !== undefined && !fs.existsSync(target);
  if (target && made) {
    fs.mkdirSync(keptVersionsDir(sceneFile), { recursive: true });
    fs.copyFileSync(sceneFile, target);
  }
  try {
    write();
  } catch (error) {
    if (target && made) {
      fs.rmSync(target, { force: true });
      if (keptVersionsOf(sceneFile).length === 0) {
        forgetKeptVersions(sceneFile);
      }
    }
    throw error;
  }
  keptVersionsOf(sceneFile)
    .slice(KEPT_VERSIONS)
    .forEach((old) =>
      fs.rmSync(keptVersionFile(sceneFile, old), { force: true }),
    );
};

export interface IVersionPins {
  /** The earlier version this look plays, or nothing for the newest. */
  pinned(lookId: string): number | undefined;
  pin(lookId: string, version: number | undefined): void;
}

const isPinRecord = (value: unknown): value is Record<string, number> =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  Object.values(value).every(
    (version) => Number.isInteger(version) && (version as number) > 0,
  );

/** The pins, read once and written whole on every change. */
export const createVersionPins = (userDataDir: string): IVersionPins => {
  const file = path.join(userDataDir, 'version-pins.json');
  let pins: Record<string, number> = {};
  try {
    const read: unknown = JSON.parse(fs.readFileSync(file, 'utf8'));
    pins = isPinRecord(read) ? read : {};
  } catch {
    pins = {};
  }
  return {
    pinned: (lookId) => pins[lookId],
    pin: (lookId, version) => {
      const { [lookId]: _was, ...rest } = pins;
      pins = version === undefined ? rest : { ...rest, [lookId]: version };
      writeFileAtomically(file, JSON.stringify(pins));
    },
  };
};
