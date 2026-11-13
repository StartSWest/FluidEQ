/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import type { IAccountState } from '../../../main/account/session';
import {
  getAccountSnapshot,
  subscribeAccount,
} from '../../../renderer/account/accountStore';
import { openNotMineYet } from '../../../renderer/plus/plusNavigation';
import {
  landInGalleryOnSignIn,
  resetSignedOutLanding,
} from '../../../renderer/plus/signedOutLanding';

// Ivan, 2026-11-13: joining from the signed-out Visualizers page lands in
// the gallery with Not mine yet on (the starter welcome opens over it by
// itself); a sign-in from anywhere else lands where it always did.
let state: IAccountState = { status: 'signed-out' };
const listeners = new Set<() => void>();

jest.mock('../../../renderer/account/accountStore', () => ({
  getAccountSnapshot: jest.fn(() => state),
  subscribeAccount: jest.fn((listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }),
}));
jest.mock('../../../renderer/plus/plusNavigation', () => ({
  openNotMineYet: jest.fn(),
}));

const become = (next: IAccountState) => {
  state = next;
  [...listeners].forEach((listener) => listener());
};
const signedIn: IAccountState = {
  status: 'signed-in',
  identity: { id: 'member', email: 'member@example.com' },
};

afterEach(() => {
  resetSignedOutLanding();
  state = { status: 'signed-out' };
  jest.clearAllMocks();
});

it('lands in Not mine yet once the account the page asked for is in', () => {
  landInGalleryOnSignIn();
  become({ status: 'busy' });
  expect(openNotMineYet).not.toHaveBeenCalled();

  become(signedIn);
  expect(openNotMineYet).toHaveBeenCalledTimes(1);
  // Spent: a later change of account does not send anybody there again.
  become({ status: 'signed-out' });
  become(signedIn);
  expect(openNotMineYet).toHaveBeenCalledTimes(1);
  expect(listeners.size).toBe(0);
});

it('does nothing for a sign-in the page did not start', () => {
  become(signedIn);
  expect(subscribeAccount).not.toHaveBeenCalled();
  expect(getAccountSnapshot).not.toHaveBeenCalled();
  expect(openNotMineYet).not.toHaveBeenCalled();
});

it('waits once however many times the page is pressed', () => {
  landInGalleryOnSignIn();
  landInGalleryOnSignIn();
  expect(subscribeAccount).toHaveBeenCalledTimes(1);
  expect(listeners.size).toBe(1);
  become(signedIn);
  expect(openNotMineYet).toHaveBeenCalledTimes(1);
});
