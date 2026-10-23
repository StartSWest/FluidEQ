/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import fs from 'fs';
import path from 'path';
import type {
  TStudioChatEntry,
  TStudioChatRestore,
} from '../../common/studioChat';
import writeFileAtomically from '../atomicWrite';

/**
 * Each version a chat reply made, kept so the member can bring it back from
 * the chat: the project's own files as the reply left them, copied into
 * FluidEQ's data folder, never into the project (a project folder is
 * synced, shared and published).
 *
 * Only what makes the scene is kept. The preview picture and the notes are
 * the Studio's, rewritten as it plays; a link is never followed, so nothing
 * outside the project is copied; and a project past `MAX_SNAPSHOT_BYTES` is
 * not kept at all, rather than kept in part — a version brought back has to
 * be the whole of it.
 */

const LEFT_OUT = new Set(['preview.png', 'studio-notes.json']);
export const MAX_SNAPSHOT_BYTES = 32 * 1024 * 1024;
/** Folders a scene has no business in, and which can be enormous. */
const SKIPPED_FOLDERS = new Set(['.git', 'node_modules']);

interface IProjectFile {
  relative: string;
  size: number;
}

/** The scene's files under `folder`, or undefined when there are too many bytes. */
const filesOf = (folder: string): IProjectFile[] | undefined => {
  const found: IProjectFile[] = [];
  let total = 0;
  const walk = (dir: string, prefix: string): boolean => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    return entries.every((entry) => {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isSymbolicLink()) {
        return true;
      }
      if (entry.isDirectory()) {
        return SKIPPED_FOLDERS.has(entry.name)
          ? true
          : walk(path.join(dir, entry.name), relative);
      }
      if (!entry.isFile() || (!prefix && LEFT_OUT.has(entry.name))) {
        return true;
      }
      const { size } = fs.lstatSync(path.join(dir, entry.name));
      total += size;
      found.push({ relative, size });
      return total <= MAX_SNAPSHOT_BYTES;
    });
  };
  return walk(folder, '') ? found : undefined;
};

/** The version number pack.json gives, if it gives one. */
export const projectVersion = (folder: string): number | undefined => {
  try {
    const raw: unknown = JSON.parse(
      fs.readFileSync(path.join(folder, 'pack.json'), 'utf8'),
    );
    const version =
      typeof raw === 'object' && raw !== null
        ? (raw as Record<string, unknown>).version
        : undefined;
    return typeof version === 'number' && Number.isInteger(version)
      ? version
      : undefined;
  } catch {
    return undefined;
  }
};

/** Keeps the project as it is now under `target`; false when it could not. */
export const keepVersion = (folder: string, target: string): boolean => {
  try {
    const files = filesOf(folder);
    if (!files) {
      return false;
    }
    files.forEach(({ relative }) => {
      writeFileAtomically(
        path.join(target, ...relative.split('/')),
        fs.readFileSync(path.join(folder, ...relative.split('/'))),
      );
    });
    return true;
  } catch {
    return false;
  }
};

/**
 * Writes a kept version back into the project, file by file, each one
 * replaced whole so the Studio never reads half a scene. Files the project
 * gained since are left where they are: bringing a version back removes
 * nothing of the member's.
 */
export const bringBackVersion = (kept: string, folder: string): boolean => {
  try {
    const files = filesOf(kept);
    if (!files || files.length === 0) {
      return false;
    }
    files.forEach(({ relative }) => {
      writeFileAtomically(
        path.join(folder, ...relative.split('/')),
        fs.readFileSync(path.join(kept, ...relative.split('/'))),
      );
    });
    return true;
  } catch {
    return false;
  }
};

/**
 * The version a reply in the chat made, put back in the project: only a
 * reply the chat has, that made a version, and only a version kept for it.
 */
export const restoreReplyVersion = (
  entries: readonly TStudioChatEntry[],
  versionsDir: string,
  folder: string,
  entryId: unknown,
): TStudioChatRestore => {
  const known = entries.some(
    (entry) =>
      entry.id === entryId &&
      entry.kind === 'claude' &&
      entry.version !== undefined,
  );
  if (!known || typeof entryId !== 'string') {
    return { ok: false, reason: 'gone' };
  }
  return bringBackVersion(path.join(versionsDir, entryId), folder)
    ? { ok: true }
    : { ok: false, reason: 'failed' };
};

/**
 * The project as a reply that changed it left it, kept under the reply's id
 * so it can be brought back: the version it stands at, or undefined when
 * the reply wrote nothing or the copy could not be kept.
 */
export const keepReplyVersion = (
  reply: Extract<TStudioChatEntry, { kind: 'claude' }>,
  folder: string,
  versionsDir: string,
): number | undefined => {
  const wrote = reply.steps.some(
    (step) =>
      (step.kind === 'write' || step.kind === 'pack') && step.state === 'done',
  );
  return wrote && keepVersion(folder, path.join(versionsDir, reply.id))
    ? projectVersion(folder)
    : undefined;
};
