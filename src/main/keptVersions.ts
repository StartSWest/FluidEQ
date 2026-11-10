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

/**
 * Beside a version the member saved from the server on purpose: a version
 * kept that way stays theirs whatever comes after (Ivan, 2026-11-09: "that
 * saved version stays theirs even after it leaves the server"), so the
 * oldest-first letting go never takes it. An empty file; its name is all it
 * says, and `VERSION_NAME` keeps it out of the list.
 */
const savedMark = (sceneFile: string, version: number) =>
  `${keptVersionFile(sceneFile, version)}.saved`;

const isSaved = (sceneFile: string, version: number) =>
  fs.existsSync(savedMark(sceneFile, version));

/**
 * Lets go of the oldest versions past `KEPT_VERSIONS`, counting only those
 * kept by an update: a version saved on purpose holds no place and is never
 * let go. A mark whose version is gone (a copy that stopped verifying is
 * removed by its store) goes with it.
 */
const letGoOfOldest = (sceneFile: string) => {
  const kept = keptVersionsOf(sceneFile);
  kept
    .filter((version) => !isSaved(sceneFile, version))
    .slice(KEPT_VERSIONS)
    .forEach((old) =>
      fs.rmSync(keptVersionFile(sceneFile, old), { force: true }),
    );
  try {
    fs.readdirSync(keptVersionsDir(sceneFile))
      .filter((name) => /^[0-9]{1,9}\.saved$/.test(name))
      .filter((name) => !kept.includes(Number(name.slice(0, -'.saved'.length))))
      .forEach((name) =>
        fs.rmSync(path.join(keptVersionsDir(sceneFile), name), { force: true }),
      );
  } catch {
    // No folder: nothing kept, nothing marked.
  }
};

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
  letGoOfOldest(sceneFile);
};

/**
 * Keeps `version` of the scene in `sceneFile` because the member saved it
 * from the server: `write` puts it at the path it is given, as the store
 * writes its own file. Marked first, so no update landing meanwhile can let
 * it go; a `write` that throws takes the mark back and leaves nothing.
 */
export const keepSavedVersion = (
  sceneFile: string,
  version: number,
  write: (target: string) => void,
) => {
  fs.mkdirSync(keptVersionsDir(sceneFile), { recursive: true });
  const mark = savedMark(sceneFile, version);
  fs.writeFileSync(mark, '');
  try {
    write(keptVersionFile(sceneFile, version));
  } catch (error) {
    fs.rmSync(mark, { force: true });
    if (keptVersionsOf(sceneFile).length === 0) {
      forgetKeptVersions(sceneFile);
    }
    throw error;
  }
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
