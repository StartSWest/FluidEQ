/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';
import {
  IKaraokeMakerProject,
  parseKaraokeMakerProject,
  serializeKaraokeMakerProject,
} from '../common/karaoke/makerProject';
import { replaceFileNow, scheduleWriteOperation } from './asyncWriter';

const MAX_PROJECT_BYTES = 16 * 1024 * 1024;
const DRAFT_DIRECTORY = 'karaoke-maker';

const safeProject = (value: unknown): IKaraokeMakerProject => {
  const contents = JSON.stringify(value);
  if (Buffer.byteLength(contents, 'utf8') > MAX_PROJECT_BYTES) {
    throw new Error('The Karaoke Maker project is too large.');
  }
  return parseKaraokeMakerProject(contents);
};

const draftName = (projectId: string): string =>
  `${createHash('sha256').update(projectId).digest('hex')}.json`;

/** Where drafts live; swept of abandoned temporaries at launch (`main.ts`). */
export const karaokeMakerDraftDir = (userDataDir: string): string =>
  path.join(userDataDir, DRAFT_DIRECTORY);

const draftPath = (userDataDir: string, projectId: string): string =>
  path.join(karaokeMakerDraftDir(userDataDir), draftName(projectId));

/**
 * Save a draft, whole or not at all, off the main process's thread.
 *
 * It was `writeFileSync` of up to 16 MB, which held every other message to
 * main — a fader, a tab's page — for as long as the disk took. Through the
 * write queue, keyed by the draft's own file, so a save and a delete of the
 * same project land in the order they were asked, the newest of either
 * superseding one still waiting, and quit waits for them.
 */
export const saveKaraokeMakerDraft = async (
  userDataDir: string,
  value: unknown,
): Promise<IKaraokeMakerProject> => {
  const project = safeProject(value);
  const contents = serializeKaraokeMakerProject(project);
  const target = draftPath(userDataDir, project.id);
  await scheduleWriteOperation(target, async () => {
    await fs.promises.mkdir(karaokeMakerDraftDir(userDataDir), {
      recursive: true,
    });
    await replaceFileNow(target, contents);
  });
  return project;
};

export const loadKaraokeMakerDraft = (
  userDataDir: string,
  projectId: unknown,
): IKaraokeMakerProject | undefined => {
  if (typeof projectId !== 'string' || !projectId || projectId.length > 2_048) {
    return undefined;
  }
  try {
    const target = draftPath(userDataDir, projectId);
    const stats = fs.statSync(target);
    if (!stats.isFile() || stats.size > MAX_PROJECT_BYTES) {
      return undefined;
    }
    return parseKaraokeMakerProject(fs.readFileSync(target, 'utf8'));
  } catch {
    return undefined;
  }
};

export const deleteKaraokeMakerDraft = async (
  userDataDir: string,
  projectId: unknown,
): Promise<void> => {
  if (typeof projectId !== 'string' || !projectId || projectId.length > 2_048) {
    return;
  }
  const target = draftPath(userDataDir, projectId);
  // Behind any save of the same draft still on its way, which would otherwise
  // land after the delete and bring the draft back.
  await scheduleWriteOperation(target, () =>
    fs.promises.rm(target, { force: true }),
  ).catch(() => {
    // A locked profile must not make closing the editor fail.
  });
};

export const normalizeKaraokeMakerExport = (
  value: unknown,
): {
  fileName: string;
  contents: string;
  formatName: string;
  extensions: string[];
} => {
  const candidate = value as {
    fileName?: unknown;
    contents?: unknown;
    formatName?: unknown;
    extensions?: unknown;
  };
  if (
    typeof candidate?.fileName !== 'string' ||
    typeof candidate.contents !== 'string' ||
    typeof candidate.formatName !== 'string' ||
    !Array.isArray(candidate.extensions)
  ) {
    throw new Error('Invalid Karaoke Maker export request.');
  }
  if (Buffer.byteLength(candidate.contents, 'utf8') > MAX_PROJECT_BYTES) {
    throw new Error('The Karaoke Maker export is too large.');
  }
  const fileName = path.basename(candidate.fileName).slice(0, 240);
  const extensions = candidate.extensions
    .filter(
      (extension): extension is string =>
        typeof extension === 'string' && /^[a-z0-9.-]+$/i.test(extension),
    )
    .slice(0, 8);
  if (!fileName || !extensions.length) {
    throw new Error('Invalid Karaoke Maker export filename.');
  }
  return {
    fileName,
    contents: candidate.contents,
    formatName: candidate.formatName.slice(0, 80),
    extensions,
  };
};
