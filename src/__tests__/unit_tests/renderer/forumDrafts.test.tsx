/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import {
  NEW_TOPIC_DRAFT,
  clearDraft,
  commentDraftKey,
  readDraft,
  threadDraftKey,
  writeDraft,
} from '../../../renderer/forum/forumDrafts';
import PostComposer from '../../../renderer/forum/PostComposer';

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({
    locale: 'en',
    t: (key: string) => key,
  }),
}));

/**
 * What is being written in the Forum stays where it was written while the
 * page is left (Ivan, 2026-11-02), and goes when it is posted or emptied.
 */

beforeEach(() => window.localStorage.clear());

describe('a draft', () => {
  it('is kept for its own box alone', () => {
    writeDraft(threadDraftKey('42'), 'On the thread');
    writeDraft(commentDraftKey('42', 'c7'), 'Under one comment');
    writeDraft(NEW_TOPIC_DRAFT, 'A new topic');
    expect(readDraft(threadDraftKey('42'))).toBe('On the thread');
    expect(readDraft(commentDraftKey('42', 'c7'))).toBe('Under one comment');
    expect(readDraft(NEW_TOPIC_DRAFT)).toBe('A new topic');
    expect(readDraft(threadDraftKey('43'))).toBe('');
  });

  it('goes when its box is emptied, or cleared once posted', () => {
    writeDraft(threadDraftKey('42'), 'Something');
    writeDraft(threadDraftKey('42'), '   ');
    expect(readDraft(threadDraftKey('42'))).toBe('');
    writeDraft(NEW_TOPIC_DRAFT, 'Something');
    clearDraft(NEW_TOPIC_DRAFT);
    expect(window.localStorage.length).toBe(0);
  });

  it('costs nothing but itself when storage cannot be used', () => {
    const blocked = jest
      .spyOn(Storage.prototype, 'getItem')
      .mockImplementation(() => {
        throw new Error('locked profile');
      });
    const full = jest
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new Error('quota');
      });
    expect(readDraft(NEW_TOPIC_DRAFT)).toBe('');
    expect(() => writeDraft(NEW_TOPIC_DRAFT, 'Text')).not.toThrow();
    blocked.mockRestore();
    full.mockRestore();
  });
});

describe('the reply box', () => {
  const composer = (
    onSubmit: (body: string) => Promise<boolean>,
    initialBody = '',
  ) => (
    <PostComposer
      label="Reply"
      placeholder="Write"
      submitLabel="Post"
      onSubmit={onSubmit}
      draftKey={threadDraftKey('42')}
      initialBody={initialBody}
    />
  );

  const type = (text: string) =>
    fireEvent.change(screen.getByLabelText('Reply'), {
      target: { value: text },
    });

  it('finds what was being written after the page was left', () => {
    const first = render(composer(async () => true));
    type('Half a reply');
    first.unmount();
    render(composer(async () => true));
    expect(screen.getByLabelText('Reply')).toHaveValue('Half a reply');
  });

  it('keeps the text through a failed post, and forgets it once posted', async () => {
    const onSubmit = jest
      .fn<Promise<boolean>, [string]>()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    render(composer(onSubmit));
    type('A reply');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Post/ }));
    });
    expect(readDraft(threadDraftKey('42'))).toBe('A reply');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Post/ }));
    });
    expect(onSubmit).toHaveBeenLastCalledWith('A reply');
    expect(readDraft(threadDraftKey('42'))).toBe('');
  });

  it('keeps nothing for a reply’s prefilled name alone', () => {
    render(composer(async () => true, '@someone '));
    expect(screen.getByLabelText('Reply')).toHaveValue('@someone ');
    expect(readDraft(threadDraftKey('42'))).toBe('');
  });
});
