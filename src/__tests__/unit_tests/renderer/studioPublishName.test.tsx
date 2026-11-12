/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A scene goes out under a name and an @handle (Ivan, 2026-11-12: "we need
 * to force users to have a name and @username to publish", "once they
 * provide it we dont ask more"). The publish dialog asks for them across its
 * top while the account has none, and its send waits for them; an account
 * that has them is never asked.
 */

let identity = { loaded: true, missing: true };
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
      onCancel={jest.fn()}
    />,
  );

const send = () => {
  const buttons = document.querySelectorAll<HTMLButtonElement>(
    '.dialog-frame__actions button',
  );
  return buttons[buttons.length - 1];
};

const ready = async () => {
  open();
  fireEvent.click(screen.getByRole('button', { name: 'plus.category.nature' }));
  await act(async () => undefined);
};

describe('the gallery name in the publish dialog', () => {
  it('is asked for across the top while the account has none, and the send waits', async () => {
    identity = { loaded: true, missing: true };
    await ready();
    expect(screen.getByText('profile.name.handle')).toBeInTheDocument();
    expect(
      document.querySelector('.studio-publish__body--named'),
    ).not.toBeNull();
    expect(send()).toBeDisabled();
    expect(send()).toHaveAttribute('title', 'profile.name.choose');
  });

  it('is never asked of an account that has one, whose send is ready', async () => {
    identity = { loaded: true, missing: false };
    await ready();
    expect(screen.queryByText('profile.name.handle')).toBeNull();
    expect(document.querySelector('.studio-publish__body--named')).toBeNull();
    expect(send()).toBeEnabled();
  });
});
