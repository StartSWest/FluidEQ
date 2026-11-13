/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import '@testing-library/jest-dom';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { requestAccountPanel } from '../../../renderer/account/accountPanel';
import VisualizersSignedOut from '../../../renderer/plus/VisualizersSignedOut';
import { landInGalleryOnSignIn } from '../../../renderer/plus/signedOutLanding';
import en from '../../../common/i18n/en';

// Ivan, 2026-11-13: both ways in from the signed-out page land in the
// gallery with Not mine yet on once the account is in; creating one opens
// the account panel on its Create account form.
jest.mock('../../../renderer/account/accountPanel', () => ({
  requestAccountPanel: jest.fn(),
}));
jest.mock('../../../renderer/plus/signedOutLanding', () => ({
  landInGalleryOnSignIn: jest.fn(),
}));

afterEach(() => {
  cleanup();
  jest.clearAllMocks();
});

const creates = () =>
  screen.getAllByRole('button', {
    name: new RegExp(en['plus.signedOut.create']),
  });

it('says what the starter credits are, with the number in it', () => {
  render(<VisualizersSignedOut onSignIn={jest.fn()} />);
  expect(
    screen.getByRole('heading', { name: 'Your first 3 scenes are on us.' }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole('heading', { name: '3 scenes, free' }),
  ).toBeInTheDocument();
  expect(creates()[0]).toHaveTextContent('and get 3 scenes');
});

it('creates an account and lands in the gallery afterwards', async () => {
  const onSignIn = jest.fn();
  render(<VisualizersSignedOut onSignIn={onSignIn} />);
  await userEvent.click(creates()[1]);
  expect(requestAccountPanel).toHaveBeenCalledWith('signUp');
  expect(landInGalleryOnSignIn).toHaveBeenCalledTimes(1);
  expect(onSignIn).not.toHaveBeenCalled();
});

it('signs in quietly, and lands in the gallery afterwards too', async () => {
  const onSignIn = jest.fn();
  render(<VisualizersSignedOut onSignIn={onSignIn} />);
  await userEvent.click(
    screen.getAllByRole('button', { name: en['account.signIn'] })[1],
  );
  expect(onSignIn).toHaveBeenCalledTimes(1);
  expect(landInGalleryOnSignIn).toHaveBeenCalledTimes(1);
  expect(requestAccountPanel).not.toHaveBeenCalled();
});
