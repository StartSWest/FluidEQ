/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { TStudioChatAnswer } from '../../common/studioChat';
import type { TChatAsks } from './chatAsks';
import { needsNoCard } from './chatForeign';
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

/**
 * What an Always allow keeps (Ivan, 2026-11-10: "para cargar cada nuevo
 * plugin debe pedir permiso"): the rules Claude Code itself suggested for
 * this tool, kept in the member's own user settings, so the tool runs
 * unasked in every scene's chat and in their own Claude Code alike. Only
 * rules: never a working folder added or a mode changed, and never the
 * scene folder's settings, which the chat does not even read.
 */
export const keptRules = (suggestions: readonly Record<string, unknown>[]) =>
  suggestions
    .filter((suggestion) => suggestion.type === 'addRules')
    .map((suggestion) => ({ ...suggestion, destination: 'userSettings' }));

/** Claude Code's answer line for one permission question. */
export const permissionAnswerLine = (
  requestId: string,
  input: Record<string, unknown>,
  allowed: boolean,
  keep: readonly Record<string, unknown>[] = [],
): string =>
  `${JSON.stringify({
    type: 'control_response',
    response: {
      subtype: 'success',
      request_id: requestId,
      response: allowed
        ? {
            behavior: 'allow',
            updatedInput: input,
            ...(keep.length > 0 ? { updatedPermissions: keep } : {}),
          }
        : { behavior: 'deny', message: REFUSED },
    },
  })}\n`;

/**
 * Asks the member about one tool and answers the Claude Code that asked.
 * `careful` is the folder of a scene from outside FluidEQ
 * (`chatForeign.ts`): its own files and FluidEQ's tools need no card,
 * everything else gets one that says where the scene came from, and none
 * can be allowed for always.
 */
export const answerPermission = (
  asks: TChatAsks,
  projectId: string,
  process: IChatProcess,
  event: Extract<TChatStreamEvent, { type: 'permission' }>,
  signal: AbortSignal,
  careful?: string,
): Promise<void> => {
  if (careful !== undefined && needsNoCard(careful, event.name, event.input)) {
    process.write(permissionAnswerLine(event.requestId, event.input, true));
    return Promise.resolve();
  }
  return asks
    .tool(
      projectId,
      {
        tool: event.tool,
        detail: event.detail,
        ...(careful === undefined ? {} : { foreign: true as const }),
      },
      signal,
    )
    .catch((): TStudioChatAnswer => 'no')
    .then((answer) => {
      process.write(
        permissionAnswerLine(
          event.requestId,
          event.input,
          answer !== 'no',
          answer === 'chat' && careful === undefined
            ? keptRules(event.suggestions)
            : [],
        ),
      );
      return undefined;
    });
};
