/*
Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later

@jest-environment node
*/

/**
 * Short preset links against FluidEQ's server (premium 0116). Whatever the
 * server answers is a stranger's text: a row that is not exactly what the
 * database itself allows reads as "missing", never as a preset.
 */

import type { IAccountConfig } from '../../../common/accountConfig';
import {
  fetchSharedPreset,
  sharePresetLink,
} from '../../../main/sharedPresets';

const config: IAccountConfig = {
  supabaseUrl: 'https://project.example',
  supabaseAnonKey: 'sb_publishable_test',
  apiUrl: 'https://project.example/functions/v1',
} as IAccountConfig;

const ID = 'Ab3dE6gH';
const CODE = 'FQP1.abcdefghijkl';

const answering = (status: number, body: unknown) =>
  jest.fn<Promise<Response>, Parameters<typeof fetch>>(() =>
    Promise.resolve(
      new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
    ),
  );

const row = (fields: Record<string, unknown> = {}) => ({
  id: ID,
  name: 'Night Drive',
  code: CODE,
  author_name: 'Night Owl',
  created_at: '2026-11-20T00:00:00Z',
  ...fields,
});

describe('fetching a shared preset', () => {
  it('asks the server by id with the public key alone and reads the row', async () => {
    const fetchImpl = answering(200, [row()]);
    await expect(
      fetchSharedPreset({ config, id: ID, fetchImpl }),
    ).resolves.toEqual({
      ok: true,
      preset: { id: ID, name: 'Night Drive', code: CODE, author: 'Night Owl' },
    });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://project.example/rest/v1/rpc/shared_preset');
    expect(JSON.parse(String(init?.body))).toEqual({ p_id: ID });
    expect((init?.headers as Record<string, string>).Authorization).toBe(
      'Bearer sb_publishable_test',
    );
  });

  it.each(['abc', `${ID}x`, `${ID}/..`, '', 'Ab3dE6gＨ'])(
    'never asks for %j',
    async (id) => {
      const fetchImpl = answering(200, [row()]);
      await expect(
        fetchSharedPreset({ config, id, fetchImpl }),
      ).resolves.toEqual({ ok: false, problem: 'missing' });
      expect(fetchImpl).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['another id', row({ id: 'Zz9Yy8Xx' })],
    ['a code shaped wrong', row({ code: 'FQP1.abc<script>alert(1)</script>' })],
    ['a code of another version', row({ code: 'FQP2.abcdefghijkl' })],
    ['a code too long', row({ code: `FQP1.${'a'.repeat(4001)}` })],
    ['a name past 40 characters', row({ name: 'n'.repeat(41) })],
    ['a name with a control character', row({ name: 'Night\u001bDrive' })],
    ['a blank name', row({ name: '   ' })],
    ['a name that is not text', row({ name: { toString: 'x' } })],
    ['nothing', undefined],
  ])('reads %s as missing', async (_label, answer) => {
    const fetchImpl = answering(200, answer === undefined ? [] : [answer]);
    await expect(
      fetchSharedPreset({ config, id: ID, fetchImpl }),
    ).resolves.toEqual({ ok: false, problem: 'missing' });
  });

  it('keeps no author it would not show', async () => {
    const fetchImpl = answering(200, [row({ author_name: `x${'\u0007'}y` })]);
    const answer = await fetchSharedPreset({ config, id: ID, fetchImpl });
    expect(answer.ok && answer.preset.author).toBeNull();
  });

  it('reads a failure, a non-list and a refused connection as offline', async () => {
    await expect(
      fetchSharedPreset({ config, id: ID, fetchImpl: answering(503, {}) }),
    ).resolves.toEqual({ ok: false, problem: 'offline' });
    await expect(
      fetchSharedPreset({ config, id: ID, fetchImpl: answering(200, row()) }),
    ).resolves.toEqual({ ok: false, problem: 'offline' });
    await expect(
      fetchSharedPreset({
        config,
        id: ID,
        fetchImpl: () => Promise.reject(new Error('ENOTFOUND')),
      }),
    ).resolves.toEqual({ ok: false, problem: 'offline' });
  });
});

describe('making a short link', () => {
  it('sends the name and code with the account token and answers the page', async () => {
    const fetchImpl = answering(200, ID);
    await expect(
      sharePresetLink({
        config,
        accessToken: 'member-token',
        name: 'Night Drive',
        code: CODE,
        fetchImpl,
      }),
    ).resolves.toEqual({
      ok: true,
      id: ID,
      url: `https://fluideq.com/p/${ID}`,
    });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://project.example/rest/v1/rpc/share_preset');
    expect(JSON.parse(String(init?.body))).toEqual({
      p_name: 'Night Drive',
      p_code: CODE,
    });
    expect((init?.headers as Record<string, string>).Authorization).toBe(
      'Bearer member-token',
    );
  });

  it.each([
    ['signed_out', 'signed-out'],
    ['suspended', 'suspended'],
    ['rate_limited', 'rate-limited'],
    ['too_many', 'too-many'],
    ['taken_down', 'taken-down'],
    ['bad_code', 'invalid'],
    ['Could not find the function public.share_preset', 'offline'],
  ])('reads the refusal %j', async (message, reason) => {
    await expect(
      sharePresetLink({
        config,
        accessToken: 't',
        name: 'n',
        code: CODE,
        fetchImpl: answering(400, { message }),
      }),
    ).resolves.toEqual({ ok: false, reason });
  });

  it('takes nothing but an id for a link', async () => {
    await expect(
      sharePresetLink({
        config,
        accessToken: 't',
        name: 'n',
        code: CODE,
        fetchImpl: answering(200, 'https://evil.example/p/x'),
      }),
    ).resolves.toEqual({ ok: false, reason: 'offline' });
  });
});
