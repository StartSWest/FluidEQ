/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { IAccountState } from '../../../main/account/session';
import AccountDialog from '../../../renderer/account/AccountDialog';

let mockAccountState: IAccountState = { status: 'signed-out' };
const mockSignUp = jest.fn((_details: unknown) => Promise.resolve());
const mockSignIn = jest.fn((_credentials: unknown) => Promise.resolve());
const mockConfirm = jest.fn((_code: string) => Promise.resolve());
const mockResend = jest.fn(() => Promise.resolve());
const mockForgot = jest.fn((_email: string) => Promise.resolve());
const mockReset = jest.fn((_details: unknown) => Promise.resolve());
const mockAbandon = jest.fn(() => Promise.resolve());
const mockSignOut = jest.fn(() => Promise.resolve());

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({
    locale: 'en',
    t: (key: string, vars?: Record<string, string | number>) =>
      vars ? `${key}:${Object.values(vars).join(',')}` : key,
  }),
}));

jest.mock('../../../renderer/account/accountStore', () => ({
  useAccount: () => mockAccountState,
  signUpAccount: (details: unknown) => mockSignUp(details),
  signInAccount: (credentials: unknown) => mockSignIn(credentials),
  confirmAccountCode: (code: string) => mockConfirm(code),
  resendAccountCode: () => mockResend(),
  forgotAccountPassword: (email: string) => mockForgot(email),
  resetAccountPassword: (details: unknown) => mockReset(details),
  abandonAccountPending: () => mockAbandon(),
  signOutAccount: () => mockSignOut(),
}));

const renderDialog = (state: IAccountState, onClose = jest.fn()) => {
  mockAccountState = state;
  return render(<AccountDialog onClose={onClose} />);
};

const button = (name: string) => screen.getByRole('button', { name });

describe('the account panel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('says signing in is optional before it offers to do it', () => {
    const { container } = renderDialog({ status: 'signed-out' });
    const body = container.querySelector('.account__body');
    const optional = container.querySelector('.account__optional');

    expect(optional).toHaveTextContent('account.optional');
    // Ahead of the form in the document, not merely present somewhere on it.
    // This app has promised since its first release that it is account-free,
    // and the panel has to lead with that still being true.
    const form = body?.querySelector('form');
    expect(form).not.toBeNull();
    expect(
      // eslint-disable-next-line no-bitwise -- the DOM's own position mask
      optional!.compareDocumentPosition(form!) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).not.toBe(0);
  });

  it('signs in with what was typed, trimmed, and not before it could work', async () => {
    renderDialog({ status: 'signed-out' });
    const submit = screen.getByRole('button', { name: 'account.signIn' });
    expect(submit).toBeDisabled();

    await userEvent.type(
      screen.getByLabelText(/^account.field.email/),
      ' ada@example.com ',
    );
    expect(submit).toBeDisabled();
    await userEvent.type(screen.getByLabelText('account.field.password'), 'pw');
    expect(submit).toBeEnabled();

    await userEvent.keyboard('{Enter}');
    expect(mockSignIn).toHaveBeenCalledWith({
      email: 'ada@example.com',
      password: 'pw',
    });
  });

  /**
   * Emphasis follows recommendation. `button small` is the filled accent and
   * `button small subtle` the quiet outline, and this is the assertion that
   * would have caught the loud style landing on a decline button — which is a
   * defect no test querying by role can otherwise see.
   */
  it('gives the loud style to the one action each form recommends', async () => {
    const { unmount } = renderDialog({ status: 'signed-out' });
    expect(button('account.signIn')).toHaveClass('button', 'small');
    expect(button('account.signIn')).not.toHaveClass('subtle');
    expect(button('account.forgot.link')).toHaveClass('account-link');
    unmount();

    renderDialog({ status: 'signed-in', identity: { id: 'u' } });
    expect(button('account.signOut')).toHaveClass('subtle');
  });

  it('creates an account with a short enough password refused before it is sent', async () => {
    renderDialog({ status: 'signed-out' });
    await userEvent.click(screen.getByRole('tab', { name: 'account.signUp' }));
    const submit = screen.getByRole('button', { name: 'account.signUp' });

    await userEvent.type(screen.getByLabelText(/account\.field\.name/), 'Ada');
    await userEvent.type(
      screen.getByLabelText(/^account.field.email/),
      'ada@example.com',
    );
    await userEvent.type(
      screen.getByLabelText(/account\.field\.password/),
      'short',
    );
    expect(submit).toBeDisabled();
    await userEvent.type(
      screen.getByLabelText(/account\.field\.password/),
      'enough',
    );
    expect(submit).toBeEnabled();

    await userEvent.click(submit);
    expect(mockSignUp).toHaveBeenCalledWith({
      email: 'ada@example.com',
      password: 'shortenough',
      name: 'Ada',
    });
  });

  it('asks for the code once an address is waiting for one, digits only', async () => {
    renderDialog({
      status: 'signed-out',
      pending: { email: 'ada@example.com', purpose: 'signup' },
    });
    expect(
      screen.getByText('account.code.sent:ada@example.com'),
    ).toBeInTheDocument();
    const confirm = button('account.code.confirm');
    expect(confirm).toBeDisabled();

    await userEvent.type(
      screen.getByLabelText('account.field.code'),
      '12a34-56',
    );
    expect(confirm).toBeEnabled();
    await userEvent.click(confirm);
    expect(mockConfirm).toHaveBeenCalledWith('123456');

    await userEvent.click(button('account.code.sendAgain'));
    expect(mockResend).toHaveBeenCalled();
    expect(button('account.code.sentAgain')).toBeDisabled();

    await userEvent.click(button('account.code.otherEmail'));
    expect(mockAbandon).toHaveBeenCalled();
  });

  it('resets a password with the code and the new password together', async () => {
    renderDialog({
      status: 'signed-out',
      pending: { email: 'ada@example.com', purpose: 'recovery' },
    });
    const submit = button('account.reset.submit');
    await userEvent.type(screen.getByLabelText('account.field.code'), '654321');
    expect(submit).toBeDisabled();
    await userEvent.type(
      screen.getByLabelText(/account\.field\.password/),
      'new password!',
    );
    await userEvent.click(submit);
    expect(mockReset).toHaveBeenCalledWith({
      code: '654321',
      password: 'new password!',
    });
  });

  it('sends a reset code from the forgot form, and can come back', async () => {
    renderDialog({ status: 'signed-out' });
    await userEvent.click(button('account.forgot.link'));
    await userEvent.type(
      screen.getByLabelText(/^account.field.email/),
      'ada@example.com',
    );
    await userEvent.click(button('account.forgot.submit'));
    expect(mockForgot).toHaveBeenCalledWith('ada@example.com');

    await userEvent.click(button('account.backToSignIn'));
    expect(button('account.signIn')).toBeInTheDocument();
  });

  it('disables the form and relabels the button while a request is out', () => {
    renderDialog({ status: 'busy' });
    expect(screen.getByLabelText(/^account.field.email/)).toBeDisabled();
    expect(button('account.working')).toBeDisabled();
  });

  it('names who is signed in, and offers to sign out', async () => {
    renderDialog({
      status: 'signed-in',
      identity: { id: 'u-1', name: 'Ada Lovelace', email: 'ada@example.com' },
    });

    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByText('ada@example.com')).toBeInTheDocument();
    expect(screen.queryByLabelText('account.field.email')).toBeNull();

    await userEvent.click(button('account.signOut'));
    expect(mockSignOut).toHaveBeenCalled();
  });

  it('does not print the address twice when it is the only name there is', () => {
    renderDialog({
      status: 'signed-in',
      identity: { id: 'u-1', email: 'ada@example.com' },
    });
    expect(screen.getAllByText('ada@example.com')).toHaveLength(1);
  });

  /**
   * Names arrive in ten scripts. Slicing a string by index cuts a surrogate
   * pair in half and renders the replacement glyph, so the initials are taken
   * as whole characters.
   */
  it.each([
    ['two words', { id: 'u', name: 'Ada Lovelace' }, 'AL'],
    ['one word', { id: 'u', name: 'Ada' }, 'A'],
    ['an address only', { id: 'u', email: 'ada@example.com' }, 'A'],
    ['a name outside the basic plane', { id: 'u', name: '𝒜da' }, '𝒜'],
    ['nothing at all', { id: 'u' }, ''],
  ])('draws initials for %s', (_label, identity, expected) => {
    const { container } = renderDialog({ status: 'signed-in', identity });
    expect(container.querySelector('.account__avatar')?.textContent).toBe(
      expected,
    );
  });

  it('explains itself and offers nothing where the platform cannot store a login', () => {
    renderDialog({ status: 'unavailable' });

    expect(screen.getByText('account.unavailable')).toBeInTheDocument();
    expect(screen.getByText('account.unavailableHint')).toBeInTheDocument();
    expect(screen.queryByLabelText('account.field.email')).toBeNull();
  });

  it('reports a failure where a screen reader will announce it', () => {
    renderDialog({ status: 'signed-out', error: 'wrong_credentials' });
    expect(screen.getByRole('alert')).toHaveTextContent(
      'account.error.wrongCredentials',
    );
  });

  it('closes on Escape and on the backdrop, but not on the panel itself', async () => {
    const onClose = jest.fn();
    const { container } = renderDialog({ status: 'signed-out' }, onClose);

    await userEvent.click(screen.getByRole('dialog'));
    expect(onClose).not.toHaveBeenCalled();

    const backdrop = container.querySelector('.about-backdrop');
    if (backdrop) {
      await userEvent.click(backdrop);
    }
    expect(onClose).toHaveBeenCalledTimes(1);

    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
