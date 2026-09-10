/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later

@jest-environment node
*/

import {
  CommunityError,
  createCommunityApi,
  readChannel,
  readMessage,
  readProfile,
} from '../../../main/community/communityApi';

const CONFIG = {
  supabaseUrl: 'https://project.supabase.co',
  supabaseAnonKey: `sb_publishable_${'a'.repeat(40)}`,
  apiUrl: 'https://project.supabase.co/functions/v1',
  plusPrice: '',
};

/** A JWT whose payload says who we are; the signature is never checked here. */
const tokenFor = (sub: string) =>
  `h.${Buffer.from(JSON.stringify({ sub })).toString('base64url')}.s`;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

describe('reading rows from the community tables', () => {
  it('reads a profile and defaults an unknown role to member', () => {
    expect(
      readProfile({
        user_id: 'u1',
        handle: 'ada',
        display_name: 'Ada',
        role: 'wizard',
        accepted_conduct_at: '2026-09-01T00:00:00Z',
      }),
    ).toMatchObject({ userId: 'u1', handle: 'ada', role: 'member' });
    expect(readProfile({ user_id: 'u1' })).toBeUndefined();
  });

  it('reads a channel and defaults an unknown write role to plus', () => {
    expect(
      readChannel({ id: 'general', name: 'General', write_role: 'anyone' }),
    ).toMatchObject({ id: 'general', writeRole: 'plus', position: 0 });
  });

  it('reads a message with its embedded author, and without one', () => {
    const withAuthor = readMessage({
      id: 7,
      channel_id: 'general',
      user_id: 'u1',
      body: 'hi',
      created_at: '2026-09-01T12:00:00Z',
      profiles: { handle: 'ada', display_name: 'Ada', role: 'admin' },
    });
    expect(withAuthor).toMatchObject({ id: 7, handle: 'ada', role: 'admin' });

    const bare = readMessage({
      id: 8,
      channel_id: 'general',
      user_id: 'u1',
      body: 'hi',
      created_at: '2026-09-01T12:00:00Z',
    });
    expect(bare?.handle).toBe('');
  });

  it('refuses a message with a malformed date or no body', () => {
    expect(
      readMessage({
        id: 1,
        channel_id: 'g',
        user_id: 'u',
        body: 'x',
        created_at: 'when',
      }),
    ).toBeUndefined();
    expect(
      readMessage({
        id: 1,
        channel_id: 'g',
        user_id: 'u',
        created_at: '2026-09-01T00:00:00Z',
      }),
    ).toBeUndefined();
  });
});

describe('the community API', () => {
  let fetchImpl: jest.Mock;
  const build = (token = tokenFor('me')) =>
    createCommunityApi({
      config: CONFIG,
      accessToken: () => Promise.resolve(token),
      fetchImpl,
    });

  beforeEach(() => {
    fetchImpl = jest.fn();
  });

  it('asks for its own profile by the id inside the token, with both keys', async () => {
    fetchImpl.mockResolvedValue(
      json([{ user_id: 'me', handle: 'ada', display_name: 'Ada' }]),
    );
    const profile = await build().getMyProfile();
    expect(profile?.handle).toBe('ada');
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/rest/v1/profiles?');
    expect(url).toContain('user_id=eq.me');
    const headers = init.headers as Record<string, string>;
    expect(headers.apikey).toBe(CONFIG.supabaseAnonKey);
    expect(headers.Authorization).toBe(`Bearer ${tokenFor('me')}`);
  });

  it('pages messages newest first and embeds the author', async () => {
    fetchImpl.mockResolvedValue(json([]));
    await build().listMessages('general', 500, 20);
    const [url] = fetchImpl.mock.calls[0] as [string];
    expect(url).toContain('channel_id=eq.general');
    expect(url).toContain('order=id.desc');
    expect(url).toContain('id=lt.500');
    expect(url).toContain('limit=20');
    expect(url).toContain('profiles%21inner');
  });

  /**
   * The database trigger names the refusal in one word, and that word must
   * survive to the panel — it is the difference between "Plus members can post"
   * and "row-level security policy violation".
   */
  it.each([
    ['rate_limited', 'rate_limited'],
    ['plus_required', 'plus_required'],
    ['banned', 'banned'],
    ['conduct_required', 'conduct_required'],
    ['contributor_required', 'contributor_required'],
    ['handle_required', 'handle_required'],
  ])('maps a %s refusal from the server', async (word, failure) => {
    fetchImpl.mockResolvedValue(
      json({ message: `P0001: ${word}`, code: 'P0001' }, 400),
    );
    await expect(build().sendMessage('general', 'hi')).rejects.toMatchObject({
      failure,
    });
  });

  it('reads a unique-key collision on the handle as taken', async () => {
    fetchImpl.mockResolvedValue(
      json({ code: '23505', message: 'duplicate' }, 409),
    );
    await expect(build().createProfile('ada', 'Ada')).rejects.toMatchObject({
      failure: 'handle_taken',
    });
  });

  it('reads a 401 as signed out and a dead network as network', async () => {
    fetchImpl.mockResolvedValue(json({}, 401));
    await expect(build().listChannels()).rejects.toMatchObject({
      failure: 'signed_out',
    });
    fetchImpl.mockRejectedValue(new Error('offline'));
    await expect(build().listChannels()).rejects.toMatchObject({
      failure: 'network',
    });
  });

  it('fails as signed out when no token can be had', async () => {
    const api = createCommunityApi({
      config: CONFIG,
      accessToken: () => Promise.reject(new Error('nobody')),
      fetchImpl,
    });
    await expect(api.listChannels()).rejects.toBeInstanceOf(CommunityError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('marks nothing read when there is nothing to mark', async () => {
    await build().markMentionsRead([]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
