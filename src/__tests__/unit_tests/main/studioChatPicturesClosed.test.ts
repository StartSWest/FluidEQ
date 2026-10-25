/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * ChatGPT pictures closed for 2.1 (`studioChatPictures.ts`; Ivan,
 * 2026-10-25: "yes turn off gpt pictures"): OpenAI's Codex documentation
 * does not permit a commercial app to run on a member's ChatGPT sign-in.
 * Closed, FluidEQ starts no Codex at all - Claude is not offered
 * make_picture, and the window's questions about Codex start nothing.
 */

import { CHATGPT_PICTURES_OPEN } from '../../../common/studioChatPictures';
import type { TAgentProject } from '../../../main/studioAgent/agentProject';
import type { IStudioLook } from '../../../main/studioAgent/studioTools';
import type { TChatAsks } from '../../../main/studioChat/chatAsks';
import { createChatPictures } from '../../../main/studioChat/chatPictures';
import { createPictureTools } from '../../../main/studioChat/pictureTools';

const mockHandlers = new Map<
  string,
  (event: unknown, ...args: unknown[]) => unknown
>();

jest.mock('electron', () => ({
  ipcMain: {
    handle: (
      name: string,
      handler: (event: unknown, ...args: unknown[]) => unknown,
    ) => mockHandlers.set(name, handler),
    removeHandler: (name: string) => mockHandlers.delete(name),
  },
}));

// Any of these running is Codex started: none may be reached while closed.
const mockCodexState = jest.fn();
const mockSignInToCodex = jest.fn();
const mockCodexAccount = jest.fn();
jest.mock('../../../main/studioChat/codexPictures', () => ({
  ...jest.requireActual('../../../main/studioChat/codexPictures'),
  codexState: (...args: unknown[]) => mockCodexState(...args),
  signInToCodex: (...args: unknown[]) => mockSignInToCodex(...args),
}));
jest.mock('../../../main/studioChat/codexAccount', () => ({
  codexAccount: (...args: unknown[]) => mockCodexAccount(...args),
}));

const door: IStudioLook = {
  look: jest.fn(),
  hear: jest.fn(),
};

const noProject = (): TAgentProject => ({ ok: false, reason: 'none-open' });

const deps = () => ({
  project: noProject,
  asks: {} as TChatAsks,
  signalOf: () => new AbortController().signal,
  packInWindow: async () => 'no-window' as const,
});

it('is closed in this release', () => {
  expect(CHATGPT_PICTURES_OPEN).toBe(false);
});

it('offers Claude no make_picture, and keeps pack_artwork', () => {
  expect(createPictureTools(deps()).map((tool) => tool.name)).toEqual([
    'pack_artwork',
  ]);
});

it("answers the window's questions about Codex without starting it", async () => {
  mockHandlers.clear();
  const pictures = createChatPictures({
    root: '',
    pageOf: () => undefined,
    fromWindow: () => true,
    project: noProject,
    signalOf: () => new AbortController().signal,
    door,
    version: '0',
  });
  const event = {};
  const asked = await Promise.all(
    [
      'studio-chat-codex',
      'studio-chat-codex-sign-in',
      'studio-chat-codex-disconnect',
    ].map(async (channel) => {
      const handler = mockHandlers.get(channel);
      if (!handler) {
        throw new Error(`${channel} is not handled`);
      }
      return handler(event);
    }),
  );
  expect(asked).toEqual([undefined, undefined, undefined]);
  expect(mockCodexState).not.toHaveBeenCalled();
  expect(mockSignInToCodex).not.toHaveBeenCalled();
  expect(mockCodexAccount).not.toHaveBeenCalled();
  await pictures.dispose();
});
