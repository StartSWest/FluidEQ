/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IStudioChat } from 'common/studioChat';
import type { TStudioChatWork } from './studioChatStore';

/**
 * Whether a project's chat has nothing in hand and its last turn ended
 * well: no reply being written, no card of its waiting on the member, and
 * the last thing in the conversation a reply that finished (Ivan,
 * 2026-11-25: Publish asks to be pressed "only when ... the chat is fully
 * done - not interrupted, not limit reached"). It lit up beside "Thinking..."
 * while the AI was still changing the scene, recommending a version that was
 * about to be replaced.
 *
 * A reply stopped by the member, or failed on a limit, a sign-in, the
 * network or anything else, is not at rest: the scene may hold half of what
 * was asked. Neither is a message of the member's with no reply after it. A
 * chat that has said nothing yet is: there is nothing pending. So is a
 * project whose chat this window has not loaded (its pane folded while
 * another project was opened): only `work` is known of it, which still says
 * whether it is answering.
 */
const studioChatAtRest = (
  chat: IStudioChat | undefined,
  work: Readonly<Record<string, TStudioChatWork>>,
  projectId: string | undefined,
): boolean => {
  if (projectId === undefined) {
    return true;
  }
  if (work[projectId] === 'working' || work[projectId] === 'waiting') {
    return false;
  }
  if (chat?.projectId !== projectId) {
    return true;
  }
  // A card's wait is told through `work` ('waiting'): the chat's own `ask`
  // is the one it was loaded with, and stays after the card is answered.
  if (chat.busy) {
    return false;
  }
  const last = chat.entries[chat.entries.length - 1];
  return (
    last === undefined || (last.kind === 'claude' && last.state === 'done')
  );
};

export default studioChatAtRest;
