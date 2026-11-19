/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import '@testing-library/jest-dom';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import GoogleSignIn, {
  GoogleWaiting,
  useGoogleSignInAvailable,
} from 'renderer/account/GoogleSignIn';
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

/** What the form reads: the service's answer, as a word on screen. */
function Offered() {
  return <span>{useGoogleSignInAvailable() ? 'offered' : 'not offered'}</span>;
}

it('offers Google only once the service says it is switched on', async () => {
  render(<Offered />);
  // Nothing is offered while the question is out: a button that might end on
  // an error page is worse than email alone for a moment.
  expect(screen.getByText('not offered')).toBeInTheDocument();
  expect(await screen.findByText('offered')).toBeInTheDocument();
  expect(isGoogleSignInAvailable).toHaveBeenCalledTimes(1);
});

it('offers nothing while the service has Google switched off', async () => {
  jest.mocked(isGoogleSignInAvailable).mockResolvedValueOnce(false);
  render(<Offered />);
  // The service's answer lands.
  await act(async () => undefined);
  expect(isGoogleSignInAvailable).toHaveBeenCalled();
  expect(screen.getByText('not offered')).toBeInTheDocument();
});

it('puts Google above the email form, loud, in the window language', () => {
  render(<GoogleSignIn available busy={false} />);
  const button = screen.getByRole('button', { name: en['account.google'] });
  expect(screen.getByText(en['account.or.email'])).toBeInTheDocument();
  expect(screen.getByText(en['account.google.note'])).toBeInTheDocument();
  // The easy way in is the loud one (Ivan approved the screens 2026-11-13).
  expect(button).toHaveClass('button', 'account-google__button');
  expect(button).not.toHaveClass('subtle');
  fireEvent.click(button);
  // The browser tab's last page is in the window's language.
  expect(signInWithGoogle).toHaveBeenCalledWith('en');
});

it('draws nothing where Google is not offered', () => {
  const { container } = render(<GoogleSignIn available={false} busy={false} />);
  expect(container).toBeEmptyDOMElement();
});

it('holds the button while another attempt is running', () => {
  render(<GoogleSignIn available busy />);
  expect(
    screen.getByRole('button', { name: en['account.google'] }),
  ).toBeDisabled();
});

it('says Google is open in the browser, with a quiet Cancel, and nothing else', () => {
  render(<GoogleWaiting />);
  const waiting = screen.getByRole('status');
  expect(waiting).toHaveTextContent(en['account.google.waitingTitle']);
  expect(waiting).toHaveTextContent(en['account.google.waitingBody']);
  expect(
    screen.getByRole('heading', { name: en['account.google.waitingTitle'] }),
  ).toBeInTheDocument();
  // Cancel declines, so it wears the quiet style.
  const cancel = screen.getByRole('button', {
    name: en['account.google.cancel'],
  });
  expect(cancel).toHaveClass('button', 'subtle');
  fireEvent.click(cancel);
  expect(cancelAccountAttempt).toHaveBeenCalled();
  // The way in is not offered again while one is open.
  expect(
    screen.queryByRole('button', { name: en['account.google'] }),
  ).toBeNull();
});
