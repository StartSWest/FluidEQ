/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { TChatAsks } from './chatAsks';
import type { IChatProcess } from './chatProcess';
import type { TChatStreamEvent } from './chatStream';

/**
 * The member's own Claude Code tools in the Studio's chat, each asked of the
 * member before it runs (Ivan, 2026-11-07: "claude need to have access to all
 * plugins that claude has").
 *
 * The chat starts the member's Claude Code with everything they set it up
 * with — its tools, their plugins, skills and tool servers — and reading,
 * searching and writing inside the scene's folder allowed. Anything else
 * their own settings do not already allow, Claude Code asks about over its
 * stream (`--permission-prompt-tool stdio`) and waits: the chat puts the
 * question on a card (`chatAsks.ts`) and writes the member's answer back.
 * A reply stopped or ended while a card stands answers it no.
 */

/** Told to Claude with a no, so it does not try the same thing another way. */
const REFUSED =
  'The member said no to this. Do not try to do it another way: ask them in your reply if it is needed.';

/** Claude Code's answer line for one permission question. */
export const permissionAnswerLine = (
  requestId: string,
  input: Record<string, unknown>,
  allowed: boolean,
): string =>
  `${JSON.stringify({
    type: 'control_response',
    response: {
      subtype: 'success',
      request_id: requestId,
      response: allowed
        ? { behavior: 'allow', updatedInput: input }
        : { behavior: 'deny', message: REFUSED },
    },
  })}\n`;

/** Asks the member about one tool and answers the Claude Code that asked. */
export const answerPermission = (
  asks: TChatAsks,
  projectId: string,
  process: IChatProcess,
  event: Extract<TChatStreamEvent, { type: 'permission' }>,
  signal: AbortSignal,
): Promise<void> =>
  asks
    .tool(projectId, { tool: event.tool, detail: event.detail }, signal)
    .catch(() => false)
    .then((allowed) => {
      process.write(
        permissionAnswerLine(event.requestId, event.input, allowed),
      );
      return undefined;
    });
