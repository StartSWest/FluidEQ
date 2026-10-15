/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import fs from 'fs';
import path from 'path';
import type {
  IStudioChatContext,
  IStudioChatStep,
  TStudioChatEntry,
  TStudioChatFailure,
} from '../../common/studioChat';
import writeFileAtomically from '../atomicWrite';
import { readChatContext } from './chatUsage';

/**
 * A project's chat as the Studio shows it, and the Claude Code session it
 * continues: kept in FluidEQ's data folder, one file a project, so the
 * conversation is there when the project is opened again.
 *
 * Read as untrusted: a file that does not parse, or entries that are not
 * what the chat draws, start the chat afresh rather than break the Studio.
 */

export interface IChatTranscript {
  sessionId?: string;
  entries: TStudioChatEntry[];
  /** How full the session's context window was at its last message. */
  context?: IStudioChatContext;
}

/** A long chat keeps its latest entries; the session itself keeps the rest. */
export const MAX_KEPT_ENTRIES = 200;
/**
 * A picture the chat would not have made (`chatPicture.ts` keeps them to a
 * few tens of kilobytes) is not read back: the step or message goes without.
 */
const MAX_KEPT_PICTURE = 400 * 1024;

const pictureOf = (
  raw: unknown,
): { picture: string } | Record<string, never> =>
  typeof raw === 'string' &&
  /^data:image\/(jpeg|png);base64,/.test(raw) &&
  raw.length <= MAX_KEPT_PICTURE
    ? { picture: raw }
    : {};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const STEP_KINDS = new Set([
  'look',
  'hear',
  'read',
  'write',
  'search',
  'picture',
  'pack',
  'compact',
  'other',
]);
const STEP_STATES = new Set(['running', 'done', 'failed']);
const REPLY_STATES = new Set(['working', 'done', 'stopped', 'failed']);
const FAILURES: ReadonlySet<string> = new Set<TStudioChatFailure>([
  'missing',
  'signed-out',
  'limit',
  'crashed',
]);
const isFailure = (value: unknown): value is TStudioChatFailure =>
  typeof value === 'string' && FAILURES.has(value);

const tokensOf = (raw: unknown) =>
  isRecord(raw) &&
  typeof raw.before === 'number' &&
  typeof raw.after === 'number' &&
  Number.isFinite(raw.before) &&
  Number.isFinite(raw.after)
    ? { tokens: { before: raw.before, after: raw.after } }
    : {};

const readStep = (raw: unknown): IStudioChatStep | undefined => {
  if (
    !isRecord(raw) ||
    typeof raw.id !== 'string' ||
    !STEP_KINDS.has(String(raw.kind)) ||
    !STEP_STATES.has(String(raw.state))
  ) {
    return undefined;
  }
  return {
    id: raw.id,
    kind: raw.kind as IStudioChatStep['kind'],
    state: raw.state as IStudioChatStep['state'],
    ...(typeof raw.file === 'string' ? { file: raw.file } : {}),
    ...pictureOf(raw.picture),
    ...tokensOf(raw.tokens),
  };
};

export const readEntry = (raw: unknown): TStudioChatEntry | undefined => {
  if (
    !isRecord(raw) ||
    typeof raw.id !== 'string' ||
    typeof raw.text !== 'string'
  ) {
    return undefined;
  }
  if (raw.kind === 'me') {
    return {
      kind: 'me',
      id: raw.id,
      text: raw.text,
      ...pictureOf(raw.picture),
    };
  }
  if (raw.kind !== 'claude' || !REPLY_STATES.has(String(raw.state))) {
    return undefined;
  }
  const steps = Array.isArray(raw.steps)
    ? raw.steps.flatMap((step) => readStep(step) ?? [])
    : [];
  // A reply still working when the file was written was cut off by FluidEQ
  // closing: it reads as stopped.
  const state =
    raw.state === 'working'
      ? 'stopped'
      : (raw.state as 'done' | 'stopped' | 'failed');
  return {
    kind: 'claude',
    id: raw.id,
    text: raw.text,
    steps: steps.map((step) =>
      step.state === 'running' ? { ...step, state: 'failed' } : step,
    ),
    state,
    ...(isFailure(raw.failure) ? { failure: raw.failure } : {}),
    ...(typeof raw.version === 'number' && Number.isInteger(raw.version)
      ? { version: raw.version }
      : {}),
  };
};

export const createTranscripts = (root: string) => {
  const fileOf = (projectId: string) =>
    path.join(root, encodeURIComponent(projectId), 'chat.json');

  const read = (projectId: string): IChatTranscript => {
    try {
      const raw: unknown = JSON.parse(
        fs.readFileSync(fileOf(projectId), 'utf8'),
      );
      if (!isRecord(raw) || !Array.isArray(raw.entries)) {
        return { entries: [] };
      }
      const context = readChatContext(raw.context);
      return {
        ...(context ? { context } : {}),
        ...(typeof raw.sessionId === 'string' &&
        /^[A-Za-z0-9-]{8,64}$/.test(raw.sessionId)
          ? { sessionId: raw.sessionId }
          : {}),
        entries: raw.entries.flatMap((entry) => readEntry(entry) ?? []),
      };
    } catch {
      return { entries: [] };
    }
  };

  const write = (projectId: string, transcript: IChatTranscript) => {
    const entries = transcript.entries.slice(-MAX_KEPT_ENTRIES);
    writeFileAtomically(
      fileOf(projectId),
      JSON.stringify({ ...transcript, entries }),
      0o600,
    );
  };

  /** Where the versions of a project's replies are kept. */
  const versionsOf = (projectId: string) =>
    path.join(root, encodeURIComponent(projectId), 'versions');

  return { read, write, versionsOf };
};

export type TTranscripts = ReturnType<typeof createTranscripts>;
