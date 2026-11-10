/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IChatProcess } from './chatProcess';
import { sandboxAnswer, type TSandboxAnswer } from './chatSandbox';
import type { TChatStreamEvent } from './chatStream';

/**
 * Claude Code's permission questions in the Studio's chat, answered by
 * FluidEQ alone (`chatSandbox.ts`). Every use of a file tool is one
 * (`--permission-prompt-tool stdio`); a path inside the scene's project
 * folder is allowed and anything else refused, with the reason handed to
 * Claude so it tells the member rather than trying another way. None is put
 * to the member: what the chat may do is FluidEQ's rule, not a yes a scene
 * file or a persuasive reply can talk anybody into.
 */

/** Claude Code's answer line for one permission question. */
export const permissionAnswerLine = (
  requestId: string,
  input: Record<string, unknown>,
  answer: TSandboxAnswer,
): string =>
  `${JSON.stringify({
    type: 'control_response',
    response: {
      subtype: 'success',
      request_id: requestId,
      response: answer.allowed
        ? { behavior: 'allow', updatedInput: input }
        : { behavior: 'deny', message: answer.why },
    },
  })}\n`;

/**
 * Answers the Claude Code that asked, by the rule for the project's folder,
 * and says what the answer was.
 */
export const answerPermission = (
  process: IChatProcess,
  folder: string,
  event: Extract<TChatStreamEvent, { type: 'permission' }>,
): TSandboxAnswer => {
  const answer = sandboxAnswer(folder, event.name, event.input);
  process.write(permissionAnswerLine(event.requestId, event.input, answer));
  return answer;
};
