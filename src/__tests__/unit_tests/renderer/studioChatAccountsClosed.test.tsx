/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The chat's accounts card while ChatGPT pictures are closed
 * (`studioChatPictures.ts`; Ivan, 2026-10-25): the Claude account and its
 * usage, no ChatGPT row, and the window never asks main about Codex - an
 * ask is what starts `codex login status` and `codex app-server` there.
 */

import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import StudioChatAccounts from '../../../renderer/studio/chat/StudioChatAccounts';
import {
  checkStudioChatCodex,
  resetStudioChatStore,
} from '../../../renderer/studio/chat/studioChatStore';
import studioChatBridge from '../../utils/studioChatBridge';

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({ locale: 'en', t: (key: string) => key }),
}));

let bridge: ReturnType<typeof studioChatBridge> & {
  studioChatLimits: jest.Mock;
};

beforeEach(() => {
  resetStudioChatStore();
  bridge = {
    ...studioChatBridge(),
    studioChatLimits: jest.fn(async () => undefined),
  };
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: { ipcRenderer: bridge },
  });
});

it('shows the Claude account and no ChatGPT row', async () => {
  render(<StudioChatAccounts />);
  // The control: the card is drawn, with the Claude account on it.
  expect(
    await screen.findByLabelText('studioChat.accounts.claude'),
  ).toBeInTheDocument();
  expect(screen.queryByLabelText('studioChat.accounts.chatgpt')).toBeNull();
  expect(screen.queryByText('studioChat.ask.getCodex')).toBeNull();
  expect(screen.queryByText('studioChat.ask.signIn')).toBeNull();
});

it('never asks main about Codex', async () => {
  render(<StudioChatAccounts />);
  await screen.findByLabelText('studioChat.accounts.claude');
  await checkStudioChatCodex();
  expect(bridge.studioChatCodex).not.toHaveBeenCalled();
});
