/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useRef } from 'react';
import { showSceneChat } from './chat/askSceneChat';
import { useStudioChat } from './chat/studioChatStore';

/**
 * The publish dialog steps aside when the scene's chat asks the member
 * something while it is open (Ivan, 2026-11-19: "when writing the note some
 * new chats will ask for permissions and the user won't see them in the
 * publish screen"). Writing the note can be a chat's first turn, and a first
 * turn may stop on a permission card; the card stood in the chat behind the
 * dialog, so the note never came and nothing said why.
 *
 * Only an ask that arrives while the dialog is open closes it - one already
 * standing when the dialog opens was there to be seen - and never while a
 * publication is going out, which a close would cancel. The note the chat
 * goes on to write is in the scene's notes, and the dialog reads it again
 * the next time it opens.
 */
export default function usePublishMakesRoomForAsk(
  open: boolean,
  running: boolean,
  close: () => void,
) {
  const askId = useStudioChat().ask?.id;
  const seen = useRef(askId);
  useEffect(() => {
    const arrived = askId !== undefined && askId !== seen.current;
    seen.current = askId;
    if (arrived && open && !running) {
      close();
      // And the card is put in view: a folded chat column opens, a narrow
      // bench turns to the chat's tab.
      showSceneChat();
    }
  }, [askId, open, running, close]);
}
