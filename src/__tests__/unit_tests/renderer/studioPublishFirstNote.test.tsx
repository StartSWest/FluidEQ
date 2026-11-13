/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Every publication takes its line, a first version included, and the
 * dialog says in the open what still holds Send (Ivan, 2026-11-13: "cant
 * publish scene is disabled", "because no notes WTF", "notes needs to be
 * exiged always", "even on first version"). Send was held with its reason
 * in the button's tooltip alone, which nobody hovers on a disabled button,
 * and a first version had no line at all.
 */

const identity = { loaded: true, missing: false };
jest.mock('../../../renderer/plus/profileStore', () => ({
  usePublicIdentity: () => identity,
  createProfile: jest.fn(() => Promise.resolve(true)),
  useProfile: () => ({ saving: false, error: undefined }),
  clearProfileError: jest.fn(),
}));
// A camera that has its clip: everything else Send waits for is there.
jest.mock('../../../renderer/studio/StudioPublishCamera', () => {
  const { useLayoutEffect } =
    jest.requireActual<typeof import('react')>('react');
  return function Camera({
    source,
    onPreview,
  }: {
    source: string;
    onPreview: (value: unknown) => void;
  }) {
    useLayoutEffect(() => {
      onPreview({
        source,
        blob: new Blob(['clip']),
        durationMs: 10000,
        width: 640,
        height: 360,
      });
      // eslint-disable-next-line react-hooks/exhaustive-deps -- one clip per mount
    }, []);
    return null;
  };
});
jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({
    locale: 'en',
    t: (key: string, vars?: Record<string, string | number>) =>
      vars ? `${key}:${Object.values(vars).join(',')}` : key,
  }),
}));

/* eslint-disable import/first -- the mocks must be installed first */
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { IScenePack } from '../../../common/scenePacks';
import { VERSION_NOTE_LOCALES } from '../../../common/sceneVersionNote';
import StudioPublishDialog from '../../../renderer/studio/StudioPublishDialog';
import type { IPublishDraft } from '../../../renderer/studio/useStudioPublish';
/* eslint-enable import/first */

const pack = {
  schema: 1,
  id: 'balloon-dawn',
  version: 1,
  contract: 1,
  names: { en: 'Balloon Dawn' },
  fallbackStyle: 'skyline',
  swatch: ['#000000', '#ffffff'],
  source: '',
  params: [],
} as unknown as IScenePack;

const draft: IPublishDraft = {
  shots: [],
  chosen: 0,
  missed: false,
  agreed: true,
};

const open = () =>
  render(
    <StudioPublishDialog
      name="Balloon Dawn"
      identity="balloon-dawn"
      pack={pack}
      tuning={{}}
      onCapture={jest.fn()}
      onChoose={jest.fn()}
      draft={draft}
      running={false}
      onPublish={jest.fn()}
      onTranslateNote={jest.fn().mockResolvedValue(false)}
      onCancel={jest.fn()}
    />,
  );

const send = () => {
  const buttons = document.querySelectorAll<HTMLButtonElement>(
    '.dialog-frame__actions button',
  );
  return buttons[buttons.length - 1];
};

// The line in every language, as the chat writes it: a press then sends.
const EVERY_LANGUAGE = Object.fromEntries(
  VERSION_NOTE_LOCALES.map((locale) => [
    locale,
    `Lanterns that rise with the bass (${locale}).`,
  ]),
) as Record<(typeof VERSION_NOTE_LOCALES)[number], string>;

const held = () =>
  document.querySelector('.studio-publish__held')?.textContent ?? '';

describe('a first publication', () => {
  it('asks for what the scene is, and says what Send still needs', async () => {
    open();
    expect(screen.getByText('studio.publish.noteFirst')).toBeInTheDocument();
    // Before anything is done: the category is what is missing, said quietly.
    expect(held()).toBe('studio.publish.pickCategory');
    expect(send()).toBeDisabled();
    fireEvent.click(
      screen.getByRole('button', { name: 'plus.category.nature' }),
    );
    await act(async () => undefined);
    // Then the line: said in the footer's quiet voice, never red yet.
    expect(held()).toBe('studio.publish.needNoteFirst');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('lands the press on the missing line, and sends nothing without one', async () => {
    const onPublish = jest.fn();
    render(
      <StudioPublishDialog
        name="Balloon Dawn"
        identity="balloon-dawn"
        pack={pack}
        tuning={{}}
        onCapture={jest.fn()}
        onChoose={jest.fn()}
        draft={draft}
        running={false}
        onPublish={onPublish}
        onTranslateNote={jest.fn().mockResolvedValue(false)}
        onCancel={jest.fn()}
      />,
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'plus.category.nature' }),
    );
    await act(async () => undefined);
    fireEvent.click(send());
    expect(onPublish).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'studio.publish.needNoteFirst',
    );
  });

  it('sends a first version with its line', async () => {
    const onPublish = jest.fn();
    render(
      <StudioPublishDialog
        name="Balloon Dawn"
        identity="balloon-dawn"
        pack={pack}
        tuning={{}}
        onCapture={jest.fn()}
        onChoose={jest.fn()}
        draft={{
          ...draft,
          suggestedNotes: EVERY_LANGUAGE,
        }}
        running={false}
        onPublish={onPublish}
        onTranslateNote={jest.fn().mockResolvedValue(false)}
        onCancel={jest.fn()}
      />,
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'plus.category.nature' }),
    );
    await act(async () => undefined);
    // The control: with the line there, nothing is said and nothing waits.
    expect(held()).toBe('');
    fireEvent.click(send());
    await act(async () => undefined);
    expect(onPublish).toHaveBeenCalledTimes(1);
    expect(onPublish.mock.calls[0][2]).toEqual(
      expect.objectContaining({ en: 'Lanterns that rise with the bass (en).' }),
    );
  });
});

describe('an update', () => {
  it('asks for what changed, under its own words', () => {
    render(
      <StudioPublishDialog
        name="Balloon Dawn"
        identity="balloon-dawn"
        pack={pack}
        tuning={{}}
        onCapture={jest.fn()}
        onChoose={jest.fn()}
        draft={{
          ...draft,
          published: {
            sceneId: 'balloon-dawn',
            version: 1,
            category: 'nature',
            names: { en: 'Balloon Dawn' },
            updatedAt: '2026-11-11T10:00:00Z',
          } as unknown as IPublishDraft['published'],
        }}
        running={false}
        onPublish={jest.fn()}
        onTranslateNote={jest.fn().mockResolvedValue(false)}
        onCancel={jest.fn()}
      />,
    );
    expect(screen.getByText('studio.publish.note')).toBeInTheDocument();
    expect(held()).toBe('studio.publish.needNote');
  });
});
