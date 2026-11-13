/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import '@testing-library/jest-dom';
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SignInForms from 'renderer/account/SignInForms';
import { signInAccount, signInWithGoogle } from 'renderer/account/accountStore';
import en from 'common/i18n/en';

// Ivan, 2026-11-13: pressing Continue with Google put "That does not look
// like an email address." under an email box he never typed in, and the
// Sign in button said "One moment…". The box has the caret when the form
// opens, so the press blurred it, and a blur alone marked it as attempted.
jest.mock('renderer/account/accountStore', () => ({
  abandonAccountPending: jest.fn(async () => undefined),
  cancelAccountAttempt: jest.fn(async () => undefined),
  confirmAccountCode: jest.fn(async () => undefined),
  forgotAccountPassword: jest.fn(async () => undefined),
  isGoogleSignInAvailable: jest.fn(async () => true),
  resendAccountCode: jest.fn(async () => undefined),
  resetAccountPassword: jest.fn(async () => undefined),
  signInAccount: jest.fn(async () => undefined),
  signInWithGoogle: jest.fn(async () => undefined),
  signUpAccount: jest.fn(async () => undefined),
}));

afterEach(() => {
  cleanup();
  jest.clearAllMocks();
});

const invalidEmail = en['account.error.invalidEmail'];

it('pressing Google leaves the untouched email box without an error', async () => {
  const user = userEvent.setup();
  const view = render(<SignInForms account={{ status: 'signed-out' }} />);
  const email = screen.getByRole('textbox', {
    name: en['account.field.email'],
  });
  expect(email).toHaveFocus();

  await user.click(
    await screen.findByRole('button', { name: en['account.google'] }),
  );
  expect(signInWithGoogle).toHaveBeenCalled();
  expect(email).not.toHaveFocus();
  // Main answers that Google's page is open in the browser.
  view.rerender(
    <SignInForms account={{ status: 'busy', waiting: 'google' }} />,
  );
  await act(async () => undefined);

  expect(screen.queryByText(invalidEmail)).toBeNull();
  expect(email).toHaveAttribute('aria-invalid', 'false');
  // The email form waits, quietly: held, not "One moment…".
  const signIn = screen.getByRole('button', { name: en['account.signIn'] });
  expect(signIn).toBeDisabled();
  expect(screen.queryByText(en['account.working'])).toBeNull();
  expect(signInAccount).not.toHaveBeenCalled();
});

it('still names an empty email on a real submit', async () => {
  const user = userEvent.setup();
  render(<SignInForms account={{ status: 'signed-out' }} />);
  await user.click(screen.getByRole('button', { name: en['account.signIn'] }));

  expect(screen.getByText(invalidEmail)).toBeInTheDocument();
  expect(
    screen.getByRole('textbox', { name: en['account.field.email'] }),
  ).toHaveAttribute('aria-invalid', 'true');
  expect(signInAccount).not.toHaveBeenCalled();
});

it('still names a typed address that is wrong once the box is left', async () => {
  const user = userEvent.setup();
  render(<SignInForms account={{ status: 'signed-out' }} />);
  await user.type(
    screen.getByRole('textbox', { name: en['account.field.email'] }),
    'not-an-address',
  );
  await user.tab();

  expect(screen.getByText(invalidEmail)).toBeInTheDocument();
});

it('says One moment… while the form itself is sending', async () => {
  render(<SignInForms account={{ status: 'busy' }} />);
  await act(async () => undefined);

  expect(
    screen.getByRole('button', { name: en['account.working'] }),
  ).toBeDisabled();
});
