/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import ClaudeModelPick from './ClaudeModelPick';
import { setChatModel, useChatPicks } from './chatPicks';

/**
 * The Studio chat's model, in the message box's bar: the shared list
 * (`ClaudeModelPick`), each chat keeping its own pick. A pick takes effect
 * with the next message, on the same conversation.
 */
export default function StudioChatModelPick({
  chatKey,
  disabled,
}: {
  /** The chat whose model this is: each chat keeps its own. */
  chatKey?: string;
  disabled: boolean;
}) {
  const { model } = useChatPicks(chatKey);
  return (
    <ClaudeModelPick
      value={model}
      onPick={(next) => setChatModel(chatKey, next)}
      disabled={disabled}
      className="studio-chat__model"
      menuClassName="studio-chat__model-menu"
    />
  );
}
