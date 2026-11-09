/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The chat's accounts close back to the chat (Ivan, 2026-11-09: "a close
 * button there so we can close the pane and back to chat"): by their ×, or
 * Escape, with focus handed back to what opened them. Escape inside ⋯'s own
 * menu shuts the menu alone.
 */

import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { IStudioProject } from '../../../main/ipc/studioProjectTypes';
import StudioChat from '../../../renderer/studio/chat/StudioChat';
import { resetStudioChatStore } from '../../../renderer/studio/chat/studioChatStore';
import studioChatBridge from '../../utils/studioChatBridge';

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({ locale: 'en', t: (key: string) => key }),
}));
jest.mock('../../../renderer/studio/StudioStartHere', () => () => null);
jest.mock('../../../renderer/studio/chat/StudioChatThread', () => () => null);

const project: IStudioProject = {
  id: '11111111-2222-4333-8444-555555555555',
  folderName: 'ring',
  path: 'C:\\Scenes\\ring',
};

beforeEach(() => {
  resetStudioChatStore();
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: {
      ipcRenderer: {
        ...studioChatBridge(project.id),
        studioChatLimits: jest.fn(async () => undefined),
        studioChatDraft: jest.fn(async () => undefined),
        studioChatDraftChange: jest.fn(async () => undefined),
      },
    },
  });
});

const accountsShown = () => screen.queryByText('studioChat.accounts.title');
const closeButton = () =>
  screen.getByRole('button', { name: 'studioChat.backToChat' });
const planLine = () => screen.getByTitle('studioChat.accounts.open');
const more = () => screen.getByRole('button', { name: 'studioChat.menu' });

/** Lets the accounts' asks to main (who is signed in, the plan) answer. */
const settle = () => act(async () => undefined);

/** The pane on its chat, with the message box drawn. */
const renderChat = async () => {
  render(<StudioChat project={project} />);
  await screen.findByRole('textbox', { name: 'studioChat.label' });
};

it('closes by its × and gives focus back to the plan line', async () => {
  await renderChat();
  planLine().focus();
  fireEvent.click(planLine());
  await settle();
  expect(accountsShown()).toBeInTheDocument();

  fireEvent.click(closeButton());

  expect(accountsShown()).toBeNull();
  expect(
    screen.getByRole('textbox', { name: 'studioChat.label' }),
  ).toBeInTheDocument();
  expect(planLine()).toHaveFocus();
});

it('opened from ⋯, starts on its × and Escape gives focus back to ⋯', async () => {
  await renderChat();
  fireEvent.click(more());
  fireEvent.click(
    screen.getByRole('button', { name: 'studioChat.accounts.title' }),
  );
  await settle();
  expect(closeButton()).toHaveFocus();

  fireEvent.keyDown(closeButton(), { key: 'Escape' });

  expect(accountsShown()).toBeNull();
  expect(more()).toHaveFocus();
});

it("leaves the accounts open when Escape only shuts ⋯'s menu", async () => {
  await renderChat();
  fireEvent.click(planLine());
  await settle();
  // ⋯ pressed keeps focus on ⋯, inside the pane the accounts listen on.
  more().focus();
  fireEvent.click(more());
  expect(screen.getByText('studioChat.zoom.label')).toBeInTheDocument();
  fireEvent.keyDown(more(), { key: 'Escape' });
  await settle();

  expect(accountsShown()).toBeInTheDocument();
  expect(screen.queryByText('studioChat.zoom.label')).toBeNull();
  // And from inside the menu itself.
  fireEvent.click(more());
  fireEvent.keyDown(screen.getByText('studioChat.zoom.label'), {
    key: 'Escape',
  });
  await settle();
  expect(accountsShown()).toBeInTheDocument();
  expect(screen.queryByText('studioChat.zoom.label')).toBeNull();
  // The control: the same key on the pane itself does close them.
  fireEvent.keyDown(closeButton(), { key: 'Escape' });
  expect(accountsShown()).toBeNull();
});
