/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import path from 'path';
import type {
  IStudioChatStep,
  TStudioChatFailure,
} from '../../common/studioChat';

/**
 * Claude Code's stream (`--output-format stream-json`), one JSON object a
 * line, read into the few things the Studio's chat shows: the reply's words
 * as they are written, a line for each thing Claude does, and how the reply
 * ended. Everything else in the stream — hooks, thinking, token counts,
 * usage — is not the member's to read in a chat, and is passed over.
 *
 * A line that is not what this expects is skipped, never thrown on: the
 * stream belongs to whatever Claude Code the member has installed, and a
 * newer one adding a field or a message kind must not break the chat.
 */

export type TChatStreamEvent =
  | { type: 'session'; sessionId: string }
  /** Words of the reply, to add to what is there. */
  | { type: 'text'; text: string }
  /** A new paragraph of the reply begins. */
  | { type: 'paragraph' }
  | { type: 'step'; step: IStudioChatStep }
  | {
      type: 'step-end';
      id: string;
      failed: boolean;
      /** The picture a look or make_picture returned, as a data URL. */
      picture?: string;
    }
  /** Claude Code began shrinking the conversation into a summary. */
  | { type: 'compacting'; id: string }
  /** It finished: how many tokens the conversation was, and is now. */
  | { type: 'compacted'; tokens?: { before: number; after: number } }
  /**
   * Claude Code read the oldest line it was written and has not said it read
   * (`--replay-user-messages`): one for every line, a message or /compact,
   * at the start of a turn or in the middle of one.
   */
  | {
      type: 'read';
      /** The uuid FluidEQ stamped on the line, when it carried one. */
      uuid?: string;
      /** Its words, a block each; several lines read as one hold them all. */
      texts: string[];
      /** The first picture it carried, as a data URL. */
      picture?: string;
    }
  | { type: 'end'; failure?: TStudioChatFailure };

/** Claude Code names FluidEQ's tools by the server they came from. */
export const DOOR_SERVER = 'fluideq';
const LOOK_TOOL = `mcp__${DOOR_SERVER}__look_at_scene`;
const HEAR_TOOL = `mcp__${DOOR_SERVER}__hear_the_music`;
const PICTURE_TOOL = `mcp__${DOOR_SERVER}__make_picture`;
const PACK_TOOL = `mcp__${DOOR_SERVER}__pack_artwork`;

const READ_TOOLS = new Set(['Read']);
const WRITE_TOOLS = new Set(['Write', 'Edit', 'MultiEdit', 'NotebookEdit']);
const SEARCH_TOOLS = new Set(['Glob', 'Grep', 'LS']);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** The file a tool works on, by name: a path is never shown in the chat. */
const fileOf = (input: unknown): string | undefined => {
  if (!isRecord(input)) {
    return undefined;
  }
  const target = input.file_path ?? input.notebook_path;
  return typeof target === 'string' && target
    ? path.basename(target.replace(/\\/g, '/'))
    : undefined;
};

export const stepOf = (
  id: string,
  name: string,
  input: unknown,
): IStudioChatStep => {
  if (name === LOOK_TOOL) {
    return { id, kind: 'look', state: 'running' };
  }
  if (name === HEAR_TOOL) {
    return { id, kind: 'hear', state: 'running' };
  }
  if (name === PICTURE_TOOL) {
    // Shown by the name Claude gave it, which is all it is called in art/.
    const named =
      isRecord(input) &&
      typeof input.name === 'string' &&
      /^[a-z][a-z0-9-]{0,39}$/.test(input.name)
        ? { file: input.name }
        : {};
    return { id, kind: 'picture', ...named, state: 'running' };
  }
  if (name === PACK_TOOL) {
    return { id, kind: 'pack', state: 'running' };
  }
  const file = fileOf(input);
  const withFile = file ? { file } : {};
  if (READ_TOOLS.has(name)) {
    return { id, kind: 'read', ...withFile, state: 'running' };
  }
  if (WRITE_TOOLS.has(name)) {
    return { id, kind: 'write', ...withFile, state: 'running' };
  }
  if (SEARCH_TOOLS.has(name)) {
    return { id, kind: 'search', state: 'running' };
  }
  return { id, kind: 'other', state: 'running' };
};

/** The JPEG a look returned, from a tool result's content. */
const pictureOf = (content: unknown): string | undefined => {
  if (!Array.isArray(content)) {
    return undefined;
  }
  const image = content.find(
    (block): block is { source: Record<string, unknown> } =>
      isRecord(block) && block.type === 'image' && isRecord(block.source),
  );
  if (!image) {
    return undefined;
  }
  const { media_type: mediaType, data } = image.source;
  return image.source.type === 'base64' &&
    (mediaType === 'image/jpeg' || mediaType === 'image/png') &&
    typeof data === 'string'
    ? `data:${mediaType};base64,${data}`
    : undefined;
};

/**
 * Why a reply that ended in an error ended, from the words Claude Code ends
 * it with: a plan's limit and a lost sign-in each have something the member
 * can do about them; anything else is the chat's own failure.
 */
export const failureOf = (text: unknown): TStudioChatFailure => {
  const words = typeof text === 'string' ? text : '';
  if (
    /usage limit|rate limit|limit reached|out of (extra )?usage/i.test(words)
  ) {
    return 'limit';
  }
  if (/\/login|log ?in|sign ?in|oauth|api key|authenticat/i.test(words)) {
    return 'signed-out';
  }
  return 'crashed';
};

/**
 * A system line: the session it is, and Claude Code compacting the
 * conversation — asked for with /compact, or by itself when a reply ran out
 * of room — which the chat shows as a step.
 */
const systemEvents = (message: Record<string, unknown>): TChatStreamEvent[] => {
  if (message.subtype === 'init' && typeof message.session_id === 'string') {
    return [{ type: 'session', sessionId: message.session_id }];
  }
  if (
    message.subtype === 'status' &&
    message.status === 'compacting' &&
    typeof message.uuid === 'string'
  ) {
    return [{ type: 'compacting', id: message.uuid }];
  }
  if (message.subtype === 'compact_boundary') {
    const meta = isRecord(message.compact_metadata)
      ? message.compact_metadata
      : {};
    const { pre_tokens: before, post_tokens: after } = meta;
    return [
      typeof before === 'number' && typeof after === 'number'
        ? { type: 'compacted', tokens: { before, after } }
        : { type: 'compacted' },
    ];
  }
  return [];
};

/** The events one line of the stream holds; none for a line passed over. */
export const readStreamLine = (line: string): TChatStreamEvent[] => {
  let message: unknown;
  try {
    message = JSON.parse(line);
  } catch {
    return [];
  }
  if (!isRecord(message)) {
    return [];
  }
  switch (message.type) {
    case 'system':
      return systemEvents(message);
    case 'stream_event': {
      const { event } = message;
      if (!isRecord(event)) {
        return [];
      }
      if (
        event.type === 'content_block_start' &&
        isRecord(event.content_block) &&
        event.content_block.type === 'text'
      ) {
        return [{ type: 'paragraph' }];
      }
      if (
        event.type === 'content_block_delta' &&
        isRecord(event.delta) &&
        event.delta.type === 'text_delta' &&
        typeof event.delta.text === 'string'
      ) {
        return [{ type: 'text', text: event.delta.text }];
      }
      return [];
    }
    case 'assistant': {
      // The words came as they were written, above; what this whole message
      // adds is each tool with its input complete, which names the file.
      const content = isRecord(message.message)
        ? message.message.content
        : undefined;
      if (!Array.isArray(content)) {
        return [];
      }
      return content.flatMap((block): TChatStreamEvent[] =>
        isRecord(block) &&
        block.type === 'tool_use' &&
        typeof block.id === 'string' &&
        typeof block.name === 'string'
          ? [{ type: 'step', step: stepOf(block.id, block.name, block.input) }]
          : [],
      );
    }
    case 'user': {
      if (message.isReplay === true) {
        const said = isRecord(message.message)
          ? message.message.content
          : undefined;
        const texts =
          typeof said === 'string'
            ? [said.trim()]
            : (Array.isArray(said) ? said : []).flatMap((block: unknown) =>
                isRecord(block) &&
                block.type === 'text' &&
                typeof block.text === 'string' &&
                block.text.trim()
                  ? [block.text.trim()]
                  : [],
              );
        const picture = pictureOf(said);
        return [
          {
            type: 'read',
            ...(typeof message.uuid === 'string' ? { uuid: message.uuid } : {}),
            texts,
            ...(picture ? { picture } : {}),
          },
        ];
      }
      const content = isRecord(message.message)
        ? message.message.content
        : undefined;
      if (!Array.isArray(content)) {
        return [];
      }
      return content.flatMap((block): TChatStreamEvent[] => {
        if (
          !isRecord(block) ||
          block.type !== 'tool_result' ||
          typeof block.tool_use_id !== 'string'
        ) {
          return [];
        }
        const picture = pictureOf(block.content);
        return [
          {
            type: 'step-end',
            id: block.tool_use_id,
            failed: block.is_error === true,
            ...(picture ? { picture } : {}),
          },
        ];
      });
    }
    case 'result':
      return message.is_error === true || message.subtype !== 'success'
        ? [{ type: 'end', failure: failureOf(message.result) }]
        : [{ type: 'end' }];
    default:
      return [];
  }
};

/**
 * Lines out of a stream that arrives in pieces: whatever follows the last
 * newline waits for the rest of its line.
 */
export const createLineReader = (onLine: (line: string) => void) => {
  let pending = '';
  return {
    push: (chunk: string) => {
      pending += chunk;
      let newline = pending.indexOf('\n');
      while (newline !== -1) {
        const line = pending.slice(0, newline).trim();
        pending = pending.slice(newline + 1);
        if (line) {
          onLine(line);
        }
        newline = pending.indexOf('\n');
      }
    },
  };
};
