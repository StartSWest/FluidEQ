/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later

@jest-environment node
*/

const handlers = new Map<string, (...args: unknown[]) => unknown>();
jest.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, fn: (...args: unknown[]) => unknown) =>
      handlers.set(channel, fn),
    removeHandler: (channel: string) => handlers.delete(channel),
  },
}));

/* eslint-disable import/first -- the electron mock must be installed first */
import type { IAccountConfig } from '../../../common/accountConfig';
import type { IAccountSession } from '../../../main/account/session';
import { registerPlusProfileIpc } from '../../../main/ipc/plusProfile';
import { createProfileApi, readProfile } from '../../../main/plus/profileApi';
/* eslint-enable import/first */

const config = {
  supabaseUrl: 'https://project.supabase.co',
  supabaseAnonKey: 'anon',
  apiUrl: 'https://project.supabase.co/functions/v1',
} as IAccountConfig;

const token = `h.${Buffer.from(JSON.stringify({ sub: 'me' })).toString('base64url')}.s`;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

const ROW = {
  user_id: 'me',
  handle: 'ivan_c',
  display_name: 'Ivan C',
  role: 'member',
};

describe('the member’s name, in the main process', () => {
  let fetchImpl: jest.Mock;
  const api = () =>
    createProfileApi({
      config,
      accessToken: () => Promise.resolve(token),
      fetchImpl,
    });

  beforeEach(() => {
    fetchImpl = jest.fn();
  });

  it('reads a profile, and treats any role it does not know as a member', () => {
    expect(readProfile([ROW])).toEqual({
      userId: 'me',
      handle: 'ivan_c',
      displayName: 'Ivan C',
      role: 'member',
    });
    expect(readProfile({ ...ROW, role: 'admin' })?.role).toBe('admin');
    // A server that has not dropped the chat's contributor role yet.
    expect(readProfile({ ...ROW, role: 'contributor' })?.role).toBe('member');
    expect(readProfile([])).toBeUndefined();
    expect(readProfile({ ...ROW, handle: '' })).toBeUndefined();
  });

  it('asks for this account’s own row, and only the columns it shows', async () => {
    fetchImpl.mockResolvedValue(json([ROW]));
    expect((await api().mine())?.handle).toBe('ivan_c');
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(
      'https://project.supabase.co/rest/v1/profiles?select=user_id,handle,display_name,role&user_id=eq.me',
    );
    expect(init.headers.Authorization).toBe(`Bearer ${token}`);
  });

  it('answers no name, not an error, for an account that has not chosen one', async () => {
    fetchImpl.mockResolvedValue(json([]));
    await expect(api().mine()).resolves.toBeUndefined();
  });

  it('creates the row under the token’s own id', async () => {
    fetchImpl.mockResolvedValue(json([ROW], 201));
    await api().create('ivan_c', 'Ivan C');
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(
      'https://project.supabase.co/rest/v1/profiles?select=user_id,handle,display_name,role',
    );
    expect(init.method).toBe('POST');
    expect(init.headers.Prefer).toBe('return=representation');
    expect(JSON.parse(init.body)).toEqual([
      { user_id: 'me', handle: 'ivan_c', display_name: 'Ivan C' },
    ]);
  });

  it('names a taken handle as taken, and every other refusal as refused', async () => {
    fetchImpl.mockResolvedValueOnce(
      json({ code: '23505', message: 'duplicate key' }, 409),
    );
    await expect(api().create('ada', 'Ada')).rejects.toMatchObject({
      failure: 'handle_taken',
    });
    fetchImpl.mockResolvedValueOnce(json({ code: '42501' }, 403));
    await expect(api().create('ada', 'Ada')).rejects.toMatchObject({
      failure: 'rejected',
    });
    fetchImpl.mockResolvedValueOnce(json({}, 401));
    await expect(api().mine()).rejects.toMatchObject({ failure: 'signed_out' });
    fetchImpl.mockRejectedValueOnce(new Error('offline'));
    await expect(api().mine()).rejects.toMatchObject({ failure: 'network' });
  });

  describe('across the bridge', () => {
    const session = {
      accessToken: () => Promise.resolve(token),
    } as unknown as IAccountSession;
    const invoke = (channel: string, ...args: unknown[]) => {
      const handler = handlers.get(channel);
      if (!handler) {
        throw new Error(`no handler for ${channel}`);
      }
      return handler({}, ...args);
    };

    let dispose: () => void = () => {};
    beforeEach(() => {
      ({ dispose } = registerPlusProfileIpc({ config, session, fetchImpl }));
    });
    afterEach(() => dispose());

    it('answers null for no name, so the renderer can tell it from no answer', async () => {
      fetchImpl.mockResolvedValue(json([]));
      await expect(invoke('plus-profile')).resolves.toEqual({
        ok: true,
        value: null,
      });
    });

    it('refuses a handle the server would refuse, before asking it', async () => {
      await expect(
        invoke('plus-create-profile', 'no spaces!', 'Name'),
      ).resolves.toEqual({ ok: false, failure: 'rejected' });
      await expect(
        invoke('plus-create-profile', 'ab', 'Name'),
      ).resolves.toEqual({ ok: false, failure: 'rejected' });
      await expect(
        invoke('plus-create-profile', 'fine_one', '   '),
      ).resolves.toEqual({ ok: false, failure: 'rejected' });
      expect(fetchImpl).not.toHaveBeenCalled();
    });

    it('sends the handle lower-cased and the name trimmed to forty', async () => {
      fetchImpl.mockResolvedValue(json([ROW], 201));
      await invoke('plus-create-profile', ' Ivan_C ', ` ${'n'.repeat(60)} `);
      const body = JSON.parse(fetchImpl.mock.calls[0][1].body);
      expect(body[0].handle).toBe('ivan_c');
      expect(body[0].display_name).toBe('n'.repeat(40));
    });

    it('takes both handlers down on dispose', () => {
      dispose();
      expect(handlers.has('plus-profile')).toBe(false);
      expect(handlers.has('plus-create-profile')).toBe(false);
    });
  });
});
