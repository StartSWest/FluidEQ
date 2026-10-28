/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import fs from 'fs';
import path from 'path';
import { STUDIO_CHAT_MAX_TEXT } from '../../common/studioChat';
import { replaceFileNow, scheduleWriteOperation } from '../asyncWriter';
import type createChatWindow from './chatWindow';

/**
 * The message a member is writing to Claude, kept per scene until it is sent
 * (Ivan, 2026-10-26: "the app restarted and I lost the message — save it per
 * scene"). It lived in the window alone, so a restart or a crash threw the
 * words away, and every scene shared the one box.
 *
 * Each project's draft sits beside its chat (`studio-chat/<id>/`): the words
 * in `draft.json`, the stage's picture with the member's marks on it in
 * `draft-stage.jpg`. Both are written on every change, through the writer's
 * queue: a change that arrives while the last one is still landing replaces
 * whatever was waiting, so typing fast costs one write at a time and the file
 * always ends on the newest words. A draft emptied, sent or taken off with
 * its project is the file removed.
 */

export interface IStudioChatDraft {
  text: string;
  /** The stage's picture going with the message, as JPEG bytes. */
  stage?: Uint8Array;
}

export interface IStudioChatDraftChange {
  projectId: string;
  /** The words as they now stand; '' takes them off. */
  text?: string;
  /** The picture as it now stands; null takes it off. */
  stage?: Uint8Array | null;
}

const DRAFT_FILE = 'draft.json';
const STAGE_FILE = 'draft-stage.jpg';
/** A project id is a UUID (`studioProjects.ts`): nothing else names a folder. */
const PROJECT_ID = /^[a-f0-9-]{36}$/;
/** The stage is drawn at 1280x720 (`STUDIO_AGENT_SHAPES.wide`): a few hundred kB. */
const MAX_STAGE_BYTES = 4 * 1024 * 1024;
const isJpeg = (bytes: Uint8Array) =>
  bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

interface IChatDraftsDeps {
  root: string;
  handle: ReturnType<typeof createChatWindow>['handle'];
}

const createChatDrafts = ({ root, handle }: IChatDraftsDeps) => {
  const fileOf = (projectId: string, name: string) =>
    path.join(root, encodeURIComponent(projectId), name);

  /** The file made to hold `contents`, or removed for none. */
  const put = (file: string, contents: string | Uint8Array | undefined) =>
    scheduleWriteOperation(file, async () => {
      if (contents === undefined) {
        await fs.promises.rm(file, { force: true });
        return;
      }
      await fs.promises.mkdir(path.dirname(file), { recursive: true });
      await replaceFileNow(file, contents);
    });

  /** Read as untrusted, like the chat beside it: a bad file is no draft. */
  const read = async (projectId: string): Promise<IStudioChatDraft> => {
    let text = '';
    try {
      const raw: unknown = JSON.parse(
        await fs.promises.readFile(fileOf(projectId, DRAFT_FILE), 'utf8'),
      );
      if (isRecord(raw) && typeof raw.text === 'string') {
        text = raw.text.slice(0, STUDIO_CHAT_MAX_TEXT);
      }
    } catch {
      // No draft kept, or one that does not parse: the box starts empty.
    }
    try {
      const file = fileOf(projectId, STAGE_FILE);
      const { size } = await fs.promises.stat(file);
      if (size <= MAX_STAGE_BYTES) {
        const stage = new Uint8Array(await fs.promises.readFile(file));
        if (isJpeg(stage)) {
          return { text, stage };
        }
      }
    } catch {
      // No picture kept: the words come back alone.
    }
    return { text };
  };

  const change = (raw: unknown) => {
    if (!isRecord(raw) || typeof raw.projectId !== 'string') {
      return;
    }
    const { projectId, text, stage } = raw;
    if (!PROJECT_ID.test(projectId)) {
      return;
    }
    if (typeof text === 'string') {
      const kept = text.slice(0, STUDIO_CHAT_MAX_TEXT);
      put(
        fileOf(projectId, DRAFT_FILE),
        kept ? JSON.stringify({ text: kept }) : undefined,
      ).catch(() => undefined);
    }
    if (stage === null) {
      put(fileOf(projectId, STAGE_FILE), undefined).catch(() => undefined);
    } else if (
      stage instanceof Uint8Array &&
      stage.byteLength <= MAX_STAGE_BYTES &&
      isJpeg(stage)
    ) {
      put(fileOf(projectId, STAGE_FILE), stage).catch(() => undefined);
    }
  };

  handle<Promise<IStudioChatDraft | undefined>>(
    'studio-chat-draft',
    Promise.resolve(undefined),
    (projectId) =>
      typeof projectId === 'string' && PROJECT_ID.test(projectId)
        ? read(projectId)
        : Promise.resolve(undefined),
  );
  handle('studio-chat-draft-change', undefined, change);
};

export default createChatDrafts;
