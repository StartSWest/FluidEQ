/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import '@testing-library/jest-dom';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import GoogleSignIn from 'renderer/account/GoogleSignIn';
import {
  cancelAccountAttempt,
  isGoogleSignInAvailable,
  signInWithGoogle,
} from 'renderer/account/accountStore';
import en from 'common/i18n/en';

jest.mock('renderer/account/accountStore', () => ({
  cancelAccountAttempt: jest.fn(async () => undefined),
  isGoogleSignInAvailable: jest.fn(async () => true),
  signInWithGoogle: jest.fn(async () => undefined),
}));

afterEach(() => {
  cleanup();
  jest.clearAllMocks();
});

const signedOut = { status: 'signed-out' as const };

it('offers Google above the email form once the service has it switched on', async () => {
  render(<GoogleSignIn account={signedOut} busy={false} />);
  const button = await screen.findByRole('button', {
    name: en['account.google'],
  });
  expect(screen.getByText(en['account.or'])).toBeInTheDocument();
  fireEvent.click(button);
  // The browser tab's last page is in the window's language.
  expect(signInWithGoogle).toHaveBeenCalledWith('en');
});

it('offers nothing while the service has Google switched off', async () => {
  jest.mocked(isGoogleSignInAvailable).mockResolvedValueOnce(false);
  const { container } = render(
    <GoogleSignIn account={signedOut} busy={false} />,
  );
  // The service's answer lands.
  await act(async () => undefined);
  expect(isGoogleSignInAvailable).toHaveBeenCalled();
  expect(container).toBeEmptyDOMElement();
});

it('holds the button while another attempt is running', async () => {
  render(<GoogleSignIn account={signedOut} busy />);
  expect(
    await screen.findByRole('button', { name: en['account.google'] }),
  ).toBeDisabled();
});

it('says Google is open in the browser, with Cancel, for as long as it is', async () => {
  render(<GoogleSignIn account={{ status: 'busy', waiting: 'google' }} busy />);
  await act(async () => undefined);
  expect(screen.getByRole('status')).toHaveTextContent(
    en['account.google.waiting'],
  );
  fireEvent.click(
    screen.getByRole('button', { name: en['account.google.cancel'] }),
  );
  expect(cancelAccountAttempt).toHaveBeenCalled();
  expect(
    screen.queryByRole('button', { name: en['account.google'] }),
  ).toBeNull();
});
