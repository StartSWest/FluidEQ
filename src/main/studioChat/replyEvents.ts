/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { TStudioChatEntry } from '../../common/studioChat';
import { chatPictureFromDataUrl, chatPictureKeepingAlpha } from './chatPicture';
import type { TChatStreamEvent } from './chatStream';

type TReply = Extract<TStudioChatEntry, { kind: 'claude' }>;

/** The reply with one event of Claude Code's stream in it. */
const withEvent = (
  reply: TReply,
  event: Exclude<TChatStreamEvent, { type: 'session' } | { type: 'end' }>,
): TReply => {
  if (event.type === 'compacting') {
    return {
      ...reply,
      steps: [
        ...reply.steps,
        { id: event.id, kind: 'compact', state: 'running' },
      ],
    };
  }
  if (event.type === 'compacted') {
    // The compaction under way ends; one that came with no "compacting"
    // first is added as it ended.
    const running = reply.steps.find(
      (step) => step.kind === 'compact' && step.state === 'running',
    );
    const done = {
      state: 'done' as const,
      ...(event.tokens ? { tokens: event.tokens } : {}),
    };
    return {
      ...reply,
      steps: running
        ? reply.steps.map((step) =>
            step === running ? { ...step, ...done } : step,
          )
        : [
            ...reply.steps,
            { id: `compact-${reply.steps.length}`, kind: 'compact', ...done },
          ],
    };
  }
  if (event.type === 'text') {
    return { ...reply, text: reply.text + event.text };
  }
  if (event.type === 'paragraph') {
    return reply.text && !reply.text.endsWith('\n\n')
      ? { ...reply, text: `${reply.text}\n\n` }
      : reply;
  }
  if (event.type === 'step') {
    return reply.steps.some((step) => step.id === event.step.id)
      ? reply
      : { ...reply, steps: [...reply.steps, event.step] };
  }
  // A look's picture lands on its own step the moment it comes back, so the
  // chat shows what Claude is looking at as it looks; a made picture keeps
  // its transparency.
  const kind = reply.steps.find((step) => step.id === event.id)?.kind;
  let picture: string | undefined;
  if (event.picture && kind === 'look') {
    picture = chatPictureFromDataUrl(event.picture);
  } else if (event.picture && kind === 'picture') {
    picture = chatPictureKeepingAlpha(event.picture);
  }
  return {
    ...reply,
    steps: reply.steps.map((step) =>
      step.id === event.id
        ? {
            ...step,
            state: event.failed ? 'failed' : 'done',
            ...(picture ? { picture } : {}),
          }
        : step,
    ),
  };
};

export default withEvent;
