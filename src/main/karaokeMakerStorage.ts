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

const draftPath = (userDataDir: string, projectId: string): string =>
  path.join(userDataDir, DRAFT_DIRECTORY, draftName(projectId));

export const saveKaraokeMakerDraft = (
  userDataDir: string,
  value: unknown,
): IKaraokeMakerProject => {
  const project = safeProject(value);
  const directory = path.join(userDataDir, DRAFT_DIRECTORY);
  fs.mkdirSync(directory, { recursive: true });
  const target = draftPath(userDataDir, project.id);
  const temporary = `${target}.tmp`;
  fs.writeFileSync(temporary, serializeKaraokeMakerProject(project), 'utf8');
  fs.renameSync(temporary, target);
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

export const deleteKaraokeMakerDraft = (
  userDataDir: string,
  projectId: unknown,
): void => {
  if (typeof projectId !== 'string' || !projectId || projectId.length > 2_048) {
    return;
  }
  try {
    fs.rmSync(draftPath(userDataDir, projectId), { force: true });
  } catch {
    // A locked profile must not make closing the editor fail.
  }
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
