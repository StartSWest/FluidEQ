/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The chat's tool card answers (Ivan, 2026-11-07: "allow for this chat is
 * allow so remove allow for this chat and add always allow", "always allow
 * is per chat not global"): Allow once, Always allow for the rest of this
 * chat, Don't allow - three, so they share one row.
 */

import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import type { TStudioChatAsk } from '../../../common/studioChat';
import StudioChatAsk from '../../../renderer/studio/chat/StudioChatAsk';

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({
    locale: 'en',
    t: (key: string, values?: Record<string, string>) =>
      values ? `${key} ${JSON.stringify(values)}` : key,
  }),
}));

const studioChatAnswer = jest.fn(async () => undefined);

beforeEach(() => {
  studioChatAnswer.mockClear();
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: { ipcRenderer: { studioChatAnswer } },
  });
});

const card: TStudioChatAsk = {
  id: 'k-1',
  projectId: 'lake',
  kind: 'tool',
  tool: 'Bash',
  detail: 'git --version',
};

it('answers Allow, Always allow (this chat) or Don’t allow, and nothing more', () => {
  render(<StudioChatAsk ask={card} />);
  expect(
    screen.getAllByRole('button').map((button) => button.textContent),
  ).toEqual([
    'studioChat.ask.allow',
    'studioChat.ask.allowAlways',
    'studioChat.ask.deny',
  ]);
  const always = screen.getByRole('button', {
    name: 'studioChat.ask.allowAlways',
  });
  expect(always).toHaveAttribute(
    'title',
    'studioChat.ask.allowAlwaysHint {"tool":"Bash"}',
  );
  fireEvent.click(always);
  expect(studioChatAnswer).toHaveBeenCalledWith('k-1', 'chat');
});
