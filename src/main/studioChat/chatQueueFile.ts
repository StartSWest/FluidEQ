/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import fs from 'fs';
import {
  isStudioChatEffort,
  isStudioChatModel,
  type TStudioChatEffort,
  type TStudioChatModel,
} from '../../common/studioChat';
import writeFileAtomically from '../atomicWrite';
import type { IQueued } from './chatQueue';

/**
 * Every project's queued messages, kept when FluidEQ closes and put back
 * when it opens (Ivan, 2026-11-07: "queued message needs to be kept when app
 * restarts too"). A message the member queued is theirs until it is sent or
 * taken back: closing FluidEQ is neither. Across a restart in development
 * each keeps the line it was handed to Claude Code in, since that Claude
 * Code goes on (`chatRelayClient.ts`); a quit hands nothing on, so every
 * message waits again for the next message or Send now.
 */

interface IQueuedOnDisk {
  id: string;
  line?: string;
  words: string;
  picture?: string;
  brief: string;
  model: TStudioChatModel;
  effort: TStudioChatEffort;
}

const toDisk = ({ id, line, message }: IQueued): IQueuedOnDisk => ({
  id,
  ...(line === undefined ? {} : { line }),
  words: message.words,
  ...(message.picture
    ? { picture: Buffer.from(message.picture).toString('base64') }
    : {}),
  brief: message.brief,
  model: message.model,
  effort: message.effort,
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isText = (value: unknown): value is string => typeof value === 'string';

const fromDisk = (raw: unknown): IQueued | undefined => {
  if (
    !isRecord(raw) ||
    !isText(raw.id) ||
    !isText(raw.words) ||
    raw.words.trim() === '' ||
    !isText(raw.brief)
  ) {
    return undefined;
  }
  return {
    id: raw.id,
    ...(isText(raw.line) ? { line: raw.line } : {}),
    message: {
      words: raw.words,
      ...(isText(raw.picture) && raw.picture !== ''
        ? { picture: new Uint8Array(Buffer.from(raw.picture, 'base64')) }
        : {}),
      brief: raw.brief,
      model: isStudioChatModel(raw.model) ? raw.model : 'default',
      effort: isStudioChatEffort(raw.effort) ? raw.effort : 'default',
    },
  };
};

/** The queues as they stand, by project; no file when every one is empty. */
export const writeChatQueues = (
  file: string,
  queues: ReadonlyMap<string, readonly IQueued[]>,
) => {
  const kept = [...queues].filter(([, queued]) => queued.length > 0);
  if (kept.length === 0) {
    fs.rmSync(file, { force: true });
    return;
  }
  writeFileAtomically(
    file,
    JSON.stringify(
      Object.fromEntries(
        kept.map(([projectId, queued]) => [projectId, queued.map(toDisk)]),
      ),
    ),
    0o600,
  );
};

/** The queues the FluidEQ before this one kept, by project; the file goes. */
export const takeChatQueues = (file: string) => {
  const queues = new Map<string, IQueued[]>();
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return queues;
  }
  fs.rmSync(file, { force: true });
  if (!isRecord(raw)) {
    return queues;
  }
  Object.entries(raw).forEach(([projectId, queued]) => {
    const entries = Array.isArray(queued)
      ? queued.flatMap((one) => fromDisk(one) ?? [])
      : [];
    if (entries.length > 0) {
      queues.set(projectId, entries);
    }
  });
  return queues;
};
