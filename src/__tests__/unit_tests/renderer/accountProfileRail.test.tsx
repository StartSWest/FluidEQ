/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import type { IAccountState } from '../../../main/account/session';
import AccountDialog from '../../../renderer/account/AccountDialog';

// The account panel signed in, as Ivan asked for it on 2026-11-13 ("improve
// account a bit"): under the name the @handle and, on a line of its own, the
// address; the two actions as links each with its glyph; and a foot that
// keeps the terms without the "signing in is optional" paragraph, which
// says nothing to somebody signed in.
let mockAccountState: IAccountState = {
  status: 'signed-in',
  identity: { id: 'ada', email: 'ada@example.com', name: 'Ada' },
};

jest.mock('../../../renderer/account/CreditsCard', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../../renderer/account/AccountCover', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../../renderer/account/AccountScenes', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../../renderer/account/AccountPublished', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../../renderer/plus/myScenes', () => ({
  loadMyScenes: () =>
    new Promise(() => {
      // Never answered.
    }),
}));
jest.mock('../../../renderer/plus/sceneStore', () => ({
  useSceneStore: () => ({ owner: '', loading: true }),
}));
jest.mock('../../../renderer/plus/profileStore', () => ({
  useProfile: () => ({
    loaded: true,
    profile: { handle: 'ada', displayName: 'Ada Lovelace' },
  }),
  loadProfile: async () => undefined,
  forgetProfile: () => undefined,
  createProfile: async () => undefined,
  updateProfile: async () => undefined,
}));
jest.mock('../../../common/accountConfig', () => ({
  isAccountConfigured: () => true,
}));
jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({
    locale: 'en',
    t: (key: string, vars?: Record<string, string | number>) =>
      vars ? `${key}:${Object.values(vars).join(',')}` : key,
  }),
}));
jest.mock('../../../renderer/account/accountStore', () => ({
  useAccount: () => mockAccountState,
  getAccountSnapshot: () => mockAccountState,
  subscribeAccount: () => () => undefined,
  signOutAccount: jest.fn(async () => undefined),
}));

it('puts the handle and the address on lines of their own under the name', () => {
  mockAccountState = {
    status: 'signed-in',
    identity: { id: 'ada', email: 'ada@example.com', name: 'Ada' },
  };
  const { container } = render(<AccountDialog onClose={jest.fn()} />);
  const contact = container.querySelector('.account-contact');
  expect(contact?.children).toHaveLength(2);
  expect(contact?.children[0]).toHaveTextContent('@ada');
  expect(contact?.children[1]).toHaveTextContent('ada@example.com');
  expect(container.querySelector('.account__dot')).toBeNull();
});

it('offers the two actions as links, each with its glyph', () => {
  render(<AccountDialog onClose={jest.fn()} />);
  ['account.name.change', 'account.signOut'].forEach((name) => {
    const link = screen.getByRole('button', { name });
    expect(link).toHaveClass('account-link');
    expect(link).not.toHaveClass('button');
    expect(link.querySelector('svg')).not.toBeNull();
  });
});

it('keeps the terms in the foot and leaves the optional paragraph out', () => {
  render(<AccountDialog onClose={jest.fn()} />);
  expect(
    screen.getByRole('button', { name: 'terms.link' }),
  ).toBeInTheDocument();
  expect(screen.queryByText('account.optional')).toBeNull();
});
