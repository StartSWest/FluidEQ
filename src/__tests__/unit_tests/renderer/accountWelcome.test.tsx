/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import '@testing-library/jest-dom';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { IAccountState } from '../../../main/account/session';
import AccountDialog from '../../../renderer/account/AccountDialog';

// The account panel before signing in, as Ivan approved it on 2026-11-13
// ("I love that login"): the rail beside the form says what that form is
// for — the credit coin and the three steps when creating, what is waiting
// when signing in — and follows the tab; the emailed code is six boxes, with
// the second step lit.
let mockAccountState: IAccountState = { status: 'signed-out' };

jest.mock('../../../renderer/plus/sceneStore', () => ({
  useSceneStore: () => ({ owner: '', loading: true }),
}));
jest.mock('../../../renderer/plus/myScenes', () => ({
  loadMyScenes: () =>
    new Promise(() => {
      // Never answered.
    }),
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
  signUpAccount: jest.fn(async () => undefined),
  signInAccount: jest.fn(async () => undefined),
  confirmAccountCode: jest.fn(async () => undefined),
  resendAccountCode: jest.fn(async () => undefined),
  forgotAccountPassword: jest.fn(async () => undefined),
  resetAccountPassword: jest.fn(async () => undefined),
  abandonAccountPending: jest.fn(async () => undefined),
  signOutAccount: jest.fn(async () => undefined),
  isGoogleSignInAvailable: () =>
    new Promise<boolean>(() => {
      // Never answered.
    }),
  signInWithGoogle: jest.fn(),
  cancelAccountAttempt: jest.fn(),
}));

const rail = () => {
  const found = document.querySelector('.dialog-frame__rail');
  if (!(found instanceof HTMLElement)) {
    throw new Error('the panel has no rail');
  }
  return within(found);
};

it('opens on Create account with the coin and the three steps, the first lit', () => {
  mockAccountState = { status: 'signed-out' };
  const { container } = render(
    <AccountDialog onClose={jest.fn()} initialPage="signUp" />,
  );
  expect(
    screen.getByRole('heading', {
      name: 'account.welcome.createTitle.other:3',
    }),
  ).toBeInTheDocument();
  expect(container.querySelector('.credit-coin__badge')).toHaveTextContent('3');
  const steps = rail().getAllByRole('listitem');
  expect(steps.map((step) => step.textContent)).toEqual([
    '1account.welcome.step.create',
    '2account.welcome.step.confirm',
    '3account.welcome.step.pick.other:3',
  ]);
  expect(steps[0]).toHaveAttribute('aria-current', 'step');
  // The tabs: Create account first.
  const tabs = screen.getAllByRole('tab');
  expect(tabs.map((tab) => tab.textContent)).toEqual([
    'account.signUp',
    'account.signIn',
  ]);
});

it('says what is waiting when signing in, and follows the tabs both ways', async () => {
  mockAccountState = { status: 'signed-out' };
  const { container } = render(<AccountDialog onClose={jest.fn()} />);
  expect(
    screen.getByRole('heading', { name: 'account.welcome.backTitle' }),
  ).toBeInTheDocument();
  expect(container.querySelector('.credit-coin')).toBeNull();
  expect(rail().getByText('account.welcome.back.credits')).toBeInTheDocument();

  await userEvent.click(screen.getByRole('tab', { name: 'account.signUp' }));
  expect(
    screen.getByRole('heading', {
      name: 'account.welcome.createTitle.other:3',
    }),
  ).toBeInTheDocument();
  expect(container.querySelector('.credit-coin')).not.toBeNull();

  await userEvent.click(screen.getByRole('tab', { name: 'account.signIn' }));
  expect(
    screen.getByRole('heading', { name: 'account.welcome.backTitle' }),
  ).toBeInTheDocument();
});

it('lights the second step for the emailed code, drawn as six boxes', async () => {
  mockAccountState = {
    status: 'signed-out',
    pending: { email: 'ada@example.com', purpose: 'signup' },
  };
  const { container } = render(<AccountDialog onClose={jest.fn()} />);
  const steps = rail().getAllByRole('listitem');
  expect(steps[0]).toHaveClass('is-done');
  expect(steps[1]).toHaveAttribute('aria-current', 'step');
  expect(screen.getByText('account.code.title')).toBeInTheDocument();

  const boxes = () =>
    [...container.querySelectorAll('.code-boxes__box')].map(
      (box) => box.textContent,
    );
  expect(boxes()).toEqual(['', '', '', '', '', '']);
  await userEvent.type(screen.getByLabelText('account.field.code'), '4a81');
  expect(boxes()).toEqual(['4', '8', '1', '', '', '']);
  expect(container.querySelectorAll('.code-boxes__box')[3]).toHaveClass(
    'is-next',
  );
});
