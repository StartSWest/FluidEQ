/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import fs from 'fs';
import os from 'os';
import path from 'path';
import { randomUUID } from 'crypto';
import type { TStudioChatEntry } from '../../common/studioChat';
import { chatPictureFromDataUrl } from './chatPicture';
import { readStreamLine } from './chatStream';
import type { IChatTranscript } from './chatTranscript';
import withEvent from './replyEvents';

/**
 * Chats about a project that Claude Code kept and FluidEQ did not: the ones
 * a "New chat" erased before past chats were kept (Ivan, 2026-10-09: "how
 * can I recover a previous chat if I create a new one"), and any the member
 * had with Claude Code in that folder on their own.
 *
 * Claude Code keeps every conversation as one JSON line per message, in a
 * folder named after the working folder with every character but letters
 * and digits turned into "-". Each line is the same message shape the chat
 * reads live (`chatStream.ts`), so a chat is rebuilt by reading its lines in
 * order: the member's words, Claude's words and the steps between, with the
 * pictures that came back. Only what Claude Code kept comes back; the
 * versions a reply could bring back were FluidEQ's and went with the chat.
 *
 * Only conversations whose own lines say they ran in this project's folder
 * are offered, and only read: nothing here writes to Claude Code's folder.
 */

const SESSION_ID = /^[A-Za-z0-9-]{8,64}$/;
/** A conversation file larger than this is not read into a chat. */
const MAX_HISTORY_BYTES = 64 * 1024 * 1024;
const TITLE_LENGTH = 80;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Where Claude Code keeps the conversations it had in `folder`. */
export const claudeHistoryDir = (
  folder: string,
  env: NodeJS.ProcessEnv = process.env,
  home: string = os.homedir(),
) =>
  path.join(
    env.CLAUDE_CONFIG_DIR ?? path.join(home, '.claude'),
    'projects',
    folder.replace(/[^A-Za-z0-9]/g, '-'),
  );

type TReply = Extract<TStudioChatEntry, { kind: 'claude' }>;

const sameFolder = (a: string, b: string) =>
  process.platform === 'win32'
    ? path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase()
    : path.resolve(a) === path.resolve(b);

/** The member's own words in a line, and the picture they attached; or none. */
const memberMessage = (
  message: Record<string, unknown>,
): { text: string; picture?: string } | undefined => {
  const content = isRecord(message.message)
    ? message.message.content
    : undefined;
  if (typeof content === 'string') {
    return content.trim() ? { text: content.trim() } : undefined;
  }
  if (!Array.isArray(content)) {
    return undefined;
  }
  const blocks = content.filter(isRecord);
  if (blocks.some((block) => block.type === 'tool_result')) {
    return undefined;
  }
  const text = blocks
    .filter((block) => block.type === 'text' && typeof block.text === 'string')
    .map((block) => String(block.text))
    .join('\n')
    .trim();
  if (!text) {
    return undefined;
  }
  const image = blocks.find(
    (block) => block.type === 'image' && isRecord(block.source),
  );
  const source = image && isRecord(image.source) ? image.source : undefined;
  const picture =
    source &&
    source.type === 'base64' &&
    (source.media_type === 'image/jpeg' || source.media_type === 'image/png') &&
    typeof source.data === 'string'
      ? chatPictureFromDataUrl(
          `data:${source.media_type};base64,${source.data}`,
        )
      : undefined;
  return picture ? { text, picture } : { text };
};

/** Claude's words in an assistant line, each block a paragraph. */
const claudeWords = (message: Record<string, unknown>): string[] => {
  const content = isRecord(message.message)
    ? message.message.content
    : undefined;
  return Array.isArray(content)
    ? content
        .filter(
          (block): block is { type: 'text'; text: string } =>
            isRecord(block) &&
            block.type === 'text' &&
            typeof block.text === 'string',
        )
        .map((block) => block.text)
    : [];
};

/** One conversation's lines as the chat shows them, or undefined if not this folder's. */
export const readClaudeHistory = (
  text: string,
  folder: string,
): { entries: TStudioChatEntry[]; sessionId?: string } | undefined => {
  const entries: TStudioChatEntry[] = [];
  let reply: TReply | undefined;
  let sessionId: string | undefined;
  let ours = false;
  const close = () => {
    if (reply) {
      entries.push({
        ...reply,
        state: 'done',
        steps: reply.steps.map((step) =>
          step.state === 'running' ? { ...step, state: 'done' } : step,
        ),
      });
      reply = undefined;
    }
  };
  text.split(/\r?\n/).forEach((line) => {
    if (!line) {
      return;
    }
    let message: unknown;
    try {
      message = JSON.parse(line);
    } catch {
      return;
    }
    if (!isRecord(message) || message.isSidechain === true) {
      return;
    }
    if (typeof message.cwd === 'string') {
      ours = ours || sameFolder(message.cwd, folder);
    }
    if (
      typeof message.sessionId === 'string' &&
      SESSION_ID.test(message.sessionId)
    ) {
      sessionId = message.sessionId;
    }
    if (message.type === 'user' && message.isMeta !== true) {
      const said = memberMessage(message);
      if (said) {
        close();
        entries.push({ kind: 'me', id: randomUUID(), ...said });
        return;
      }
    }
    if (message.type !== 'user' && message.type !== 'assistant') {
      return;
    }
    reply ??= {
      kind: 'claude',
      id: randomUUID(),
      text: '',
      steps: [],
      state: 'working',
    };
    claudeWords(message).forEach((words) => {
      if (reply) {
        reply = withEvent(withEvent(reply, { type: 'paragraph' }), {
          type: 'text',
          text: words,
        });
      }
    });
    readStreamLine(line).forEach((event) => {
      if (
        reply &&
        event.type !== 'session' &&
        event.type !== 'read' &&
        event.type !== 'end'
      ) {
        reply = withEvent(reply, event);
      }
    });
  });
  close();
  const said = entries.filter(
    (entry) => entry.kind === 'claude' && (entry.text || entry.steps.length),
  );
  if (!ours || said.length === 0) {
    return undefined;
  }
  return sessionId ? { entries, sessionId } : { entries };
};

export interface IClaudeHistoryItem {
  sessionId: string;
  title: string;
  savedAt: number;
}

/** A first line of the member's, short enough to name the chat by. */
export const titleOf = (entries: readonly TStudioChatEntry[]) => {
  const first = entries.find((entry) => entry.kind === 'me')?.text ?? '';
  const line = first.split(/\r?\n/)[0].trim();
  return line.length > TITLE_LENGTH
    ? `${line.slice(0, TITLE_LENGTH - 1).trimEnd()}…`
    : line;
};

/**
 * The conversations Claude Code kept in `folder` that none of `known` is,
 * newest first: each read once to be sure it is this folder's and has a
 * reply in it.
 */
export const listClaudeHistory = async (
  folder: string,
  known: ReadonlySet<string>,
): Promise<IClaudeHistoryItem[]> => {
  const dir = claudeHistoryDir(folder);
  let names: string[];
  try {
    names = await fs.promises.readdir(dir);
  } catch {
    return [];
  }
  const found = await Promise.all(
    names
      .filter((name) => name.endsWith('.jsonl'))
      .map((name) => name.slice(0, -'.jsonl'.length))
      .filter((id) => SESSION_ID.test(id) && !known.has(id))
      .map(async (sessionId): Promise<IClaudeHistoryItem | undefined> => {
        const file = path.join(dir, `${sessionId}.jsonl`);
        try {
          const stats = await fs.promises.lstat(file);
          if (!stats.isFile() || stats.size > MAX_HISTORY_BYTES) {
            return undefined;
          }
          const read = readClaudeHistory(
            await fs.promises.readFile(file, 'utf8'),
            folder,
          );
          return read
            ? {
                sessionId,
                title: titleOf(read.entries),
                savedAt: stats.mtimeMs,
              }
            : undefined;
        } catch {
          return undefined;
        }
      }),
  );
  return found
    .filter((item): item is IClaudeHistoryItem => item !== undefined)
    .sort((a, b) => b.savedAt - a.savedAt);
};

/** One conversation Claude Code kept in `folder`, as a chat; or undefined. */
export const loadClaudeHistory = async (
  folder: string,
  sessionId: string,
): Promise<IChatTranscript | undefined> => {
  if (!SESSION_ID.test(sessionId)) {
    return undefined;
  }
  const file = path.join(claudeHistoryDir(folder), `${sessionId}.jsonl`);
  try {
    const stats = await fs.promises.lstat(file);
    if (!stats.isFile() || stats.size > MAX_HISTORY_BYTES) {
      return undefined;
    }
    const read = readClaudeHistory(
      await fs.promises.readFile(file, 'utf8'),
      folder,
    );
    return read ? { sessionId, entries: read.entries } : undefined;
  } catch {
    return undefined;
  }
};
