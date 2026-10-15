/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  isStudioChatEffort,
  isStudioChatModel,
  STUDIO_CHAT_MAX_TEXT,
  type IStudioChatCompact,
  type IStudioChatMessage,
  type TStudioChatEffort,
  type TStudioChatModel,
} from '../../common/studioChat';

/** A message from the window, read and held to what the chat accepts. */
export interface IChatMessage {
  words: string;
  /** The stage as the member attached it, a JPEG. */
  picture?: Uint8Array;
  brief: string;
  model: TStudioChatModel;
  effort: TStudioChatEffort;
}

/** The picks a Claude Code process is started on, from what the window sent. */
export const readChatPicks = (
  raw: unknown,
): Pick<IChatMessage, 'brief' | 'model' | 'effort'> | undefined => {
  if (typeof raw !== 'object' || raw === null) {
    return undefined;
  }
  const { brief, model, effort } = raw as Partial<IStudioChatCompact>;
  return typeof brief === 'string'
    ? {
        brief,
        model: isStudioChatModel(model) ? model : 'default',
        effort: isStudioChatEffort(effort) ? effort : 'default',
      }
    : undefined;
};

/** What the window sent, or undefined when it is not a message the chat takes. */
export const readChatMessage = (raw: unknown): IChatMessage | undefined => {
  if (typeof raw !== 'object' || raw === null) {
    return undefined;
  }
  const { text, stage, brief, model, effort } =
    raw as Partial<IStudioChatMessage>;
  const words = typeof text === 'string' ? text.trim() : '';
  if (
    !words ||
    words.length > STUDIO_CHAT_MAX_TEXT ||
    typeof brief !== 'string'
  ) {
    return undefined;
  }
  const picture =
    stage instanceof Uint8Array && stage.byteLength > 0 ? stage : undefined;
  return {
    words,
    ...(picture ? { picture } : {}),
    brief,
    model: isStudioChatModel(model) ? model : 'default',
    effort: isStudioChatEffort(effort) ? effort : 'default',
  };
};

/**
 * The member's messages as one line of Claude Code's stream-json input: one
 * turn, each message's picture before its words, in the order they were
 * written.
 */
export const userLine = (
  ...messages: readonly Pick<IChatMessage, 'words' | 'picture'>[]
) => {
  const content = messages.flatMap(({ words, picture }) => [
    ...(picture
      ? [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/jpeg',
              data: Buffer.from(picture).toString('base64'),
            },
          },
        ]
      : []),
    { type: 'text', text: words },
  ]);
  return `${JSON.stringify({ type: 'user', message: { role: 'user', content } })}\n`;
};
