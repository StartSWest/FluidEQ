/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SignOutConfirm from '../../../renderer/account/SignOutConfirm';

/**
 * Signing out asks first, in place of the links under the name. What matters
 * here is what a slip costs: the caret starts on the answer that keeps the
 * account, Escape takes the question back rather than closing the panel under
 * it, and a second press while the first is in flight signs out once.
 */

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({
    locale: 'en',
    t: (key: string) => key,
  }),
}));

const mockSignOut = jest.fn(() => Promise.resolve());
jest.mock('../../../renderer/account/accountStore', () => ({
  signOutAccount: () => mockSignOut(),
}));

beforeEach(() => {
  mockSignOut.mockReset();
  mockSignOut.mockResolvedValue(undefined);
});

const cancel = () =>
  screen.getByRole('button', { name: 'account.name.cancel' });
const signOut = () => screen.getByRole('button', { name: /account\.signOut/ });

test('the caret starts on the answer that keeps the account', async () => {
  render(<SignOutConfirm member onCancel={jest.fn()} />);

  await waitFor(() => expect(cancel()).toHaveFocus());
  expect(mockSignOut).not.toHaveBeenCalled();
});

test('a member is told what signing out locks, and a free account is not', () => {
  const { unmount } = render(<SignOutConfirm member onCancel={jest.fn()} />);
  expect(screen.getByText('account.signOut.detailPlus')).toBeInTheDocument();
  expect(screen.getByText('account.signOut.kept')).toBeInTheDocument();
  unmount();

  render(<SignOutConfirm member={false} onCancel={jest.fn()} />);
  expect(screen.getByText('account.signOut.detail')).toBeInTheDocument();
});

test('cancelling gives the question back and signs nobody out', async () => {
  const onCancel = jest.fn();
  render(<SignOutConfirm member onCancel={onCancel} />);

  await userEvent.click(cancel());
  expect(onCancel).toHaveBeenCalledTimes(1);
  expect(mockSignOut).not.toHaveBeenCalled();
});

// The panel's own Escape closes the whole panel; this one has to be caught
// first, or taking the question back would take the panel with it.
test('Escape takes the question back before the panel hears it', async () => {
  const onCancel = jest.fn();
  const heard = jest.fn();
  document.addEventListener('keydown', heard);
  render(<SignOutConfirm member onCancel={onCancel} />);

  await userEvent.keyboard('{Escape}');
  expect(onCancel).toHaveBeenCalledTimes(1);
  expect(heard).not.toHaveBeenCalled();
  document.removeEventListener('keydown', heard);
});

test('pressed twice, it signs out once', async () => {
  render(<SignOutConfirm member onCancel={jest.fn()} />);

  await userEvent.click(signOut());
  await userEvent.click(signOut());
  expect(mockSignOut).toHaveBeenCalledTimes(1);
  // While it is leaving, the way back is not offered as if nothing happened.
  expect(cancel()).toBeDisabled();
});

test('a sign-out that failed leaves the question answerable again', async () => {
  mockSignOut.mockRejectedValue(new Error('offline'));
  render(<SignOutConfirm member onCancel={jest.fn()} />);

  await userEvent.click(signOut());
  await waitFor(() => expect(cancel()).not.toBeDisabled());
});
