/** @jest-environment node */
/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */
import type { IAccountConfig } from 'common/accountConfig';
import { AuthError } from 'main/account/authClient';
import type { IEntitlement } from 'main/account/entitlement';
import type { IAccountSession } from 'main/account/session';
import { authorizeGallery, createGalleryAccess } from 'main/plus/galleryAccess';

const config = {
  supabaseUrl: 'https://project.supabase.co',
  supabaseAnonKey: 'anon',
  apiUrl: 'https://project.supabase.co/functions/v1',
} as IAccountConfig;
const setup = () => {
  let me: string | undefined = 'first';
  const token = jest.fn<Promise<string>, []>().mockResolvedValue('test-token');
  const session = {
    state: () =>
      me
        ? { status: 'signed-in', identity: { id: me } }
        : { status: 'signed-out' },
    accessToken: token,
  } as unknown as IAccountSession;
  const access = createGalleryAccess({
    config,
    session,
    entitlement: {
      status: () => ({ state: 'none' }),
    } as unknown as IEntitlement,
    ownership: { owns: () => false },
    fetchImpl: jest.fn(async () => {
      throw new Error(
        'No HTTP request is expected while obtaining authorization',
      );
    }),
  });
  return {
    access,
    token,
    changeAccount: (id: string | undefined) => {
      me = id;
    },
  };
};

test('a successful list authorization keeps the existing nullable auth view', async () => {
  const { access } = setup();
  expect(await authorizeGallery(access, 'first')).toMatchObject({
    ok: true,
    auth: { config, accessToken: 'test-token' },
  });
  expect(await access.auth()).toMatchObject({
    config,
    accessToken: 'test-token',
  });
});

test.each([
  ['network', 'offline'],
  ['expired', 'signed-out'],
  ['signed_out_elsewhere', 'signed-out'],
  ['malformed', 'server'],
  ['rejected', 'server'],
] as const)(
  'a %s token refresh stays %s without changing the saved account',
  async (failure, reason) => {
    const { access, token } = setup();
    token.mockRejectedValue(
      new AuthError(failure, 'Synthetic refresh failure'),
    );
    expect(await authorizeGallery(access, 'first')).toEqual({
      ok: false,
      reason,
    });
    expect(access.accountId()).toBe('first');
    // Other channels retain the old contract; only these list reads opt in.
    expect(await access.auth()).toBeUndefined();
  },
);

test('a guest never asks for a token', async () => {
  const { access, token, changeAccount } = setup();
  changeAccount(undefined);
  expect(await authorizeGallery(access, undefined)).toEqual({
    ok: false,
    reason: 'signed-out',
  });
  expect(token).not.toHaveBeenCalled();
});

test('account switching during token refresh cannot authorize the old request', async () => {
  const { access, token, changeAccount } = setup();
  let finish: ((value: string) => void) | undefined;
  token.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const pending = authorizeGallery(access, 'first');
  changeAccount('second');
  finish?.('test-token');
  expect(await pending).toEqual({ ok: false, reason: 'signed-out' });
});
