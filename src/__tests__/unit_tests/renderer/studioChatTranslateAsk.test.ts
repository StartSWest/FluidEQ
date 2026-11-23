/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The publish dialog's line handed to the chat to translate is always the
 * member's press (Ivan, 2026-11-23: "when there is only English note already
 * is when it happens"): main refuses an ask that is not one on a scene whose
 * chat was never opened, and the English line then went out as written in
 * every language. The dialog's own ask on opening stays unpressed, so it
 * never starts a conversation unbidden.
 */
import {
  askStudioChatForNote,
  askStudioChatToTranslateNote,
} from '../../../renderer/studio/chat/studioChatStore';

const studioChatAskNote = jest.fn((_picks: unknown) => Promise.resolve(true));

beforeEach(() => {
  studioChatAskNote.mockClear();
  (window as unknown as { electron: unknown }).electron = {
    ipcRenderer: { studioChatAskNote },
  };
});

it('asks for the translation as the member’s press', async () => {
  await expect(askStudioChatToTranslateNote('Peaks', 'en')).resolves.toBe(true);
  expect(studioChatAskNote).toHaveBeenCalledWith(
    expect.objectContaining({
      translate: { line: 'Peaks', from: 'en' },
      pressed: true,
    }),
  );
});

it('leaves the dialog’s own ask for a line unpressed', async () => {
  await askStudioChatForNote({ first: true });
  expect(studioChatAskNote).toHaveBeenCalledWith(
    expect.not.objectContaining({ pressed: true }),
  );
});
