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
import type { IChatSession } from './chatLaunch';
import type { IChatProcessEvents } from './chatProcess';
import { readStreamLine } from './chatStream';

/**
 * A chat as one FluidEQ leaves it for the next, across a restart in
 * development (`chatRelayClient.ts`): what the chat knew about its running
 * Claude Code that Claude Code's own stream does not say again - which
 * reply was being written and where in the stream it began, whether Stop
 * or Send now was pressed, and the door it reaches FluidEQ through. Written
 * once, by the FluidEQ that is restarting, and read once. Its queue is kept
 * with every project's (`chatQueueFile.ts`).
 */
export interface IKeptSession {
  projectId: string;
  folder: string;
  model: TStudioChatModel;
  effort: TStudioChatEffort;
  /** How many lines of its stream that FluidEQ had read. */
  seen: number;
  reply?: { id: string; from: number };
  stopping: boolean;
  sendingNow: boolean;
  door?: { url: string; key: string };
}

export const keepSession = (
  projectId: string,
  session: IChatSession,
): IKeptSession => ({
  projectId,
  folder: session.folder,
  model: session.model,
  effort: session.effort,
  seen: session.process.position(),
  ...(session.reply && session.replyFrom !== undefined
    ? { reply: { id: session.reply.id, from: session.replyFrom } }
    : {}),
  stopping: session.stopping,
  sendingNow: session.sendingNow,
  ...(session.door ? { door: session.door } : {}),
});

export const writeKeptSessions = (
  file: string,
  kept: readonly IKeptSession[],
) => {
  writeFileAtomically(file, JSON.stringify(kept), 0o600);
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isText = (value: unknown): value is string => typeof value === 'string';

const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

const readDoor = (raw: unknown) =>
  isRecord(raw) && isText(raw.url) && isText(raw.key)
    ? { url: raw.url, key: raw.key }
    : undefined;

const readKept = (raw: unknown): IKeptSession | undefined => {
  if (
    !isRecord(raw) ||
    !isText(raw.projectId) ||
    !isText(raw.folder) ||
    !isCount(raw.seen)
  ) {
    return undefined;
  }
  const { reply } = raw;
  const door = readDoor(raw.door);
  return {
    projectId: raw.projectId,
    folder: raw.folder,
    model: isStudioChatModel(raw.model) ? raw.model : 'default',
    effort: isStudioChatEffort(raw.effort) ? raw.effort : 'default',
    seen: raw.seen,
    ...(isRecord(reply) && isText(reply.id) && isCount(reply.from)
      ? { reply: { id: reply.id, from: reply.from } }
      : {}),
    stopping: raw.stopping === true,
    sendingNow: raw.sendingNow === true,
    ...(door ? { door } : {}),
  };
};

/** What the FluidEQ before this one left, by project; the file goes. */
export const takeKeptSessions = (file: string) => {
  const kept = new Map<string, IKeptSession>();
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return kept;
  }
  fs.rmSync(file, { force: true });
  (Array.isArray(raw) ? raw : []).forEach((entry) => {
    const one = readKept(entry);
    if (one) {
      kept.set(one.projectId, one);
    }
  });
  return kept;
};

/** The port a door's address names. */
export const doorAt = (door: { url: string; key: string }) => {
  try {
    const port = Number(new URL(door.url).port);
    return Number.isSafeInteger(port) && port > 0
      ? { port, key: door.key }
      : undefined;
  } catch {
    return undefined;
  }
};

/**
 * A held chat's events as it is taken up: the lines the FluidEQ before had
 * already read come again, and of those only a question still unanswered is
 * acted on — asked again, on a card. A reply that was being written is read
 * again from where it began, into the same reply opened empty
 * (`chatTurns.resume`), so it ends up whole whatever was or was not read
 * before the restart.
 */
export const takenUpEvents = (
  events: IChatProcessEvents,
  position: () => number,
  kept: IKeptSession,
): IChatProcessEvents => {
  const known = kept.reply ? kept.reply.from : kept.seen;
  return {
    ...events,
    line: (line) => {
      // A question's line holds the question alone.
      if (
        position() > known ||
        readStreamLine(line).some(({ type }) => type === 'permission')
      ) {
        events.line(line);
      }
    },
  };
};
