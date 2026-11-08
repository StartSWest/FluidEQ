/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import fs from 'fs';
import path from 'path';
import {
  parseScenePackPayload,
  type IScenePack,
} from '../../common/scenePacks';
import { canonicalPreviewPayload } from '../../common/scenePreviewPayload';
import { readProject } from './project';
import writeFileAtomically from '../atomicWrite';
import {
  folderKey,
  readFolderFingerprint,
  type TPublishedRecords,
} from './publishedRecords';

/**
 * A project published before this computer kept a record of it, recognised
 * by what it holds (Ivan, 2026-11-08: "it needs to show always if the current
 * version on the studio matches the lib one"). The record is written when a
 * publication goes out, so every scene published before records existed - and
 * every one published from another computer - had none and was never marked.
 *
 * What went out is already on this computer: a maker's own publications come
 * back to it, FluidEQ's own in the scene store and a member's in the looks.
 * A project whose `pack.json` names that version, and whose scene is that
 * version's scene, is that publication; it is recorded as if it had just gone
 * out from here. Nothing is downloaded, and a project is read whole only when
 * a copy at its own version is held.
 *
 * Both sides are compared as the signing service sees a scene
 * (`canonicalPreviewPayload`: comments and a world's editor-only node names
 * do not count) after the same parse a held copy went through, so a field the
 * parse settles one way on one side cannot differ on the other.
 */

interface IPublishedAdoptionDeps {
  records: TPublishedRecords;
  /**
   * The copies this computer holds of `sceneId` at `version`, as this account
   * may have published it: only the newest of each is looked at, and only
   * read whole once its version is the one asked for.
   */
  heldOf: (sceneId: string, version: number) => readonly IScenePack[];
  /**
   * Where the folders compared and found to differ are kept, so a scene
   * edited since it went out is read whole once, not at every launch.
   */
  differsFile?: string;
  readPack?: (folder: string) => Promise<IScenePack | undefined>;
  logger?: { info(message: string): void; warn(message: string): void };
}

const readDiffers = (file: string | undefined) => {
  const differs = new Map<string, string>();
  if (!file) {
    return differs;
  }
  try {
    const raw: unknown = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (typeof raw === 'object' && raw !== null && !Array.isArray(raw)) {
      Object.entries(raw).forEach(([key, value]) => {
        if (typeof value === 'string') {
          differs.set(key, value);
        }
      });
    }
  } catch {
    // None kept yet: every candidate is compared once.
  }
  return differs;
};

const readPackOf = async (folder: string) => {
  const build = await readProject(folder);
  return build.ok ? build.pack : undefined;
};

/** The id and version a project's `pack.json` names, read alone. */
const headOf = async (folder: string) => {
  try {
    const raw: unknown = JSON.parse(
      await fs.promises.readFile(path.join(folder, 'pack.json'), 'utf8'),
    );
    if (
      typeof raw === 'object' &&
      raw !== null &&
      'id' in raw &&
      'version' in raw &&
      typeof raw.id === 'string' &&
      typeof raw.version === 'number' &&
      Number.isSafeInteger(raw.version)
    ) {
      return { id: raw.id, version: raw.version };
    }
  } catch {
    // No `pack.json` yet, or one mid-save: not a publication.
  }
  return undefined;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** A scene as the signing service compares it; undefined if unreadable. */
const sceneOf = (pack: IScenePack) => {
  try {
    const parsed = parseScenePackPayload(JSON.stringify(pack));
    return parsed ? canonicalPreviewPayload(parsed) : undefined;
  } catch {
    return undefined;
  }
};

/**
 * The parts of a scene that differ from a copy, for the log: an edit names
 * its file's part, and anything the comparison misses names itself.
 */
const partsApart = (scene: string, copy: string | undefined) => {
  if (copy === undefined) {
    return 'unreadable copy';
  }
  const a: unknown = JSON.parse(scene);
  const b: unknown = JSON.parse(copy);
  if (!isRecord(a) || !isRecord(b)) {
    return 'whole scene';
  }
  return [...new Set([...Object.keys(a), ...Object.keys(b)])]
    .filter((part) => JSON.stringify(a[part]) !== JSON.stringify(b[part]))
    .join(', ');
};

export const createPublishedAdoption = ({
  records,
  heldOf,
  differsFile,
  readPack = readPackOf,
  logger,
}: IPublishedAdoptionDeps) => {
  /**
   * Folders already compared and found not to be a held publication, by
   * what they held then: compared again only once changed.
   */
  const differs = readDiffers(differsFile);
  const keepDiffers = () => {
    if (!differsFile) {
      return;
    }
    try {
      writeFileAtomically(
        differsFile,
        JSON.stringify(Object.fromEntries(differs)),
        0o600,
      );
    } catch (error) {
      logger?.warn(
        `The Studio's compared scenes could not be kept: ${String(error)}`,
      );
    }
  };

  const adoptOne = async (folder: string): Promise<boolean> => {
    const head = await headOf(folder);
    if (!head) {
      return false;
    }
    const known = await records.stateOf(folder);
    if (
      known?.sceneId === head.id &&
      known.version === head.version &&
      known.unchanged
    ) {
      return false;
    }
    const key = folderKey(folder);
    const before = await readFolderFingerprint(folder);
    if (!before || differs.get(key) === before) {
      return false;
    }
    const held = heldOf(head.id, head.version);
    if (held.length === 0) {
      return false;
    }
    const pack = await readPack(folder);
    const scene = pack && pack.id === head.id ? sceneOf(pack) : undefined;
    const copies = held.map(sceneOf);
    // What was read must still be what the folder holds: a save landing
    // mid-read would record a fingerprint the scene compared never had.
    if (
      scene === undefined ||
      (await readFolderFingerprint(folder)) !== before ||
      !copies.includes(scene)
    ) {
      if (scene !== undefined) {
        logger?.info(
          `The Studio's ${head.id} differs from version ${head.version} as published: ${partsApart(scene, copies[0])}.`,
        );
      }
      differs.set(key, before);
      keepDiffers();
      return false;
    }
    if (differs.delete(key)) {
      keepDiffers();
    }
    records.record(folder, head.id, head.version);
    logger?.info(
      `The Studio's ${head.id} is version ${head.version} as published.`,
    );
    return true;
  };

  return {
    /**
     * Records every folder that holds a publication held here; true when
     * one was. One folder at a time: each read is a whole scene.
     */
    adopt: (folders: readonly string[]): Promise<boolean> =>
      folders.reduce<Promise<boolean>>(async (sofar, folder) => {
        const any = await sofar;
        return (await adoptOne(folder)) || any;
      }, Promise.resolve(false)),
  };
};

export type TPublishedAdoption = ReturnType<typeof createPublishedAdoption>;
