/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A picture Claude opened or made stays in sight in its reply (Ivan,
 * 2026-11-09: "shows generated images right there in the chat ... click
 * them and zoom them"): reads fold into one line, and a picture on a read
 * followed by another read used to fold away with it.
 */

import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import type { TStudioChatEntry } from '../../../common/studioChat';
import StudioChatReply from '../../../renderer/studio/chat/StudioChatReply';
import { resetStudioChatStore } from '../../../renderer/studio/chat/studioChatStore';

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({
    locale: 'en',
    t: (key: string, vars?: Record<string, string>) =>
      vars?.file ? `${key}:${vars.file}` : key,
  }),
}));

const PNG = 'data:image/png;base64,iVBORw0K';

const reply = (
  steps: Extract<TStudioChatEntry, { kind: 'claude' }>['steps'],
): Extract<TStudioChatEntry, { kind: 'claude' }> => ({
  kind: 'claude',
  id: 'reply-1',
  text: 'Here it is.',
  steps,
  state: 'done',
});

beforeEach(() => resetStudioChatStore());

it('keeps a picture Claude opened in sight, and opens it larger on a press', () => {
  const onOpenPicture = jest.fn();
  render(
    <StudioChatReply
      reply={reply([
        {
          id: 'r1',
          kind: 'read',
          file: 'reference-tubes.png',
          state: 'done',
          picture: PNG,
        },
        { id: 'r2', kind: 'read', file: 'scene.frag', state: 'done' },
        { id: 'r3', kind: 'read', file: 'pack.json', state: 'done' },
      ])}
      playing={false}
      onRestore={() => Promise.resolve({ ok: true })}
      onOpenPicture={onOpenPicture}
    />,
  );

  const picture = screen.getByAltText(
    'studioChat.step.read:reference-tubes.png',
  );
  expect(picture).toHaveAttribute('src', PNG);
  // The two plain reads still fold into one line, as before.
  expect(
    screen.getByText('studioChat.step.read:pack.json'),
  ).toBeInTheDocument();
  expect(screen.queryByText('studioChat.step.read:scene.frag')).toBeNull();
  // A PNG is shown on the checks, as a cut-out can see through.
  const button = screen.getByRole('button', { name: 'studioChat.seenLarger' });
  expect(button).toHaveClass('is-made');
  fireEvent.click(button);
  expect(onOpenPicture).toHaveBeenCalledWith('reply-1/r1');
});
