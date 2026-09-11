/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * @jest-environment node
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import type { IAccountConfig } from '../../../common/accountConfig';
import {
  readMemberSceneFile,
  signMemberScene,
} from '../../../main/memberScenes/sharing';
import {
  fetchBlockedScenes,
  fetchLikeStatus,
  setLike,
} from '../../../main/memberScenes/social';
import {
  fakeResponse,
  memberPack,
  memberPayload,
  signedEnvelope,
  SOMEONE,
} from '../../utils/memberSceneFixtures';

const config: IAccountConfig = {
  supabaseUrl: 'https://project.supabase.co',
  supabaseAnonKey: 'sb_publishable_test',
  apiUrl: 'https://project.supabase.co/functions/v1',
  plusPrice: '$5',
};

const answer = (status: number, body: unknown) =>
  jest.fn(async () => fakeResponse(status, body));

const sign = (fetchImpl: typeof fetch) =>
  signMemberScene({
    config,
    accessToken: 'token',
    pack: memberPack(),
    termsVersion: 3,
    fetchImpl,
  });

describe('signing a scene for sharing', () => {
  // The control: a signed file the app itself would open comes back.
  it('sends the pack and the terms version, and keeps what verifies', async () => {
    const envelope = signedEnvelope(memberPayload());
    const fetchImpl = answer(200, { envelope });
    await expect(sign(fetchImpl as unknown as typeof fetch)).resolves.toEqual({
      ok: true,
      envelope,
    });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe(`${config.apiUrl}/sign-member-scene`);
    expect(JSON.parse(String(init.body))).toEqual({
      termsVersion: 3,
      pack: memberPack(),
    });
    expect((init.headers as Record<string, string>).Authorization).toBe(
      'Bearer token',
    );
  });

  it('turns every refusal into the sentence the member reads', async () => {
    const cases: Array<[number, unknown, string]> = [
      [401, {}, 'signed-out'],
      [403, { error: 'plus_required' }, 'not-entitled'],
      [403, { error: 'banned' }, 'banned'],
      [409, { error: 'terms_outdated' }, 'terms'],
      [429, { error: 'rate_limited' }, 'rate-limited'],
      [422, { error: 'refused' }, 'refused'],
      [413, {}, 'refused'],
      [500, {}, 'server'],
    ];
    const outcomes = await Promise.all(
      cases.map(([status, body]) =>
        sign(answer(status, body) as unknown as typeof fetch),
      ),
    );
    expect(outcomes).toEqual(
      cases.map(([, , reason]) => ({ ok: false, reason })),
    );
  });

  it('says offline when there is no network at all', async () => {
    const fetchImpl = jest.fn(async () => {
      throw new TypeError('fetch failed');
    });
    await expect(sign(fetchImpl as unknown as typeof fetch)).resolves.toEqual({
      ok: false,
      reason: 'offline',
    });
  });

  it('treats a signature the app would not open as a server fault', async () => {
    const forged = signedEnvelope(memberPayload(), { trusted: false });
    await expect(
      sign(answer(200, { envelope: forged }) as unknown as typeof fetch),
    ).resolves.toEqual({ ok: false, reason: 'server' });
    await expect(
      sign(answer(200, { nope: true }) as unknown as typeof fetch),
    ).resolves.toEqual({ ok: false, reason: 'server' });
  });
});

describe('opening a scene file somebody sent', () => {
  let folder: string;

  beforeEach(() => {
    folder = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-shared-'));
  });

  afterEach(() => {
    fs.rmSync(folder, { recursive: true, force: true });
  });

  const write = (name: string, contents: string) => {
    const file = path.join(folder, name);
    fs.writeFileSync(file, contents);
    return file;
  };

  // The control.
  it('reads a genuine file and hands back who made it', async () => {
    const envelope = signedEnvelope(memberPayload());
    const read = await readMemberSceneFile(
      write('neon.fluideq-scene.json', JSON.stringify(envelope)),
    );
    expect(read).toMatchObject({
      ok: true,
      envelope,
      payload: { author: { id: SOMEONE, name: 'Mei Tanaka' } },
    });
  });

  it('calls a file that is not a scene unreadable', async () => {
    await expect(
      readMemberSceneFile(write('a.json', 'not json')),
    ).resolves.toEqual({ ok: false, reason: 'unreadable' });
    await expect(
      readMemberSceneFile(write('b.json', '{"x":1}')),
    ).resolves.toEqual({ ok: false, reason: 'unreadable' });
    await expect(readMemberSceneFile(folder)).resolves.toEqual({
      ok: false,
      reason: 'unreadable',
    });
    await expect(
      readMemberSceneFile(path.join(folder, 'missing.json')),
    ).resolves.toEqual({ ok: false, reason: 'unreadable' });
  });

  it('calls a file edited after export changed, and opens nothing of it', async () => {
    const envelope = signedEnvelope(memberPayload());
    const edited = {
      ...envelope,
      payload: Buffer.from(
        memberPayload({ name: 'Somebody Else' }),
        'utf8',
      ).toString('base64'),
    };
    await expect(
      readMemberSceneFile(write('edited.json', JSON.stringify(edited))),
    ).resolves.toEqual({ ok: false, reason: 'changed' });
    const unsigned = signedEnvelope(memberPayload(), { trusted: false });
    await expect(
      readMemberSceneFile(write('unsigned.json', JSON.stringify(unsigned))),
    ).resolves.toEqual({ ok: false, reason: 'changed' });
  });
});

describe('the block list and likes', () => {
  const PRINT = 'a'.repeat(64);

  it('reads the block list, keeping only real fingerprints', async () => {
    const fetchImpl = answer(200, [
      { fingerprint: PRINT },
      { fingerprint: 'not-a-print' },
      { other: 1 },
    ]);
    await expect(
      fetchBlockedScenes({
        config,
        accessToken: 'token',
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).resolves.toEqual([PRINT]);
    expect(String((fetchImpl.mock.calls[0] as unknown[])[0])).toBe(
      'https://project.supabase.co/rest/v1/blocked_scenes?select=fingerprint',
    );
  });

  it('keeps the last block list when the server cannot be asked', async () => {
    await expect(
      fetchBlockedScenes({
        config,
        accessToken: 'token',
        fetchImpl: answer(401, {}) as unknown as typeof fetch,
      }),
    ).resolves.toBeUndefined();
  });

  it('reads the like count whether it arrives as a number or as text', async () => {
    const status = (body: unknown) =>
      fetchLikeStatus({
        config,
        accessToken: 'token',
        authorId: SOMEONE,
        sceneId: 'neon-city',
        fetchImpl: answer(200, body) as unknown as typeof fetch,
      });
    // PostgREST sends a bigint as a string.
    await expect(status([{ likes: '12', liked: true }])).resolves.toEqual({
      likes: 12,
      liked: true,
    });
    await expect(status([{ likes: 3, liked: false }])).resolves.toEqual({
      likes: 3,
      liked: false,
    });
    await expect(
      status([{ likes: '-1', liked: false }]),
    ).resolves.toBeUndefined();
    await expect(
      status([{ likes: 'x', liked: false }]),
    ).resolves.toBeUndefined();
    await expect(status([])).resolves.toBeUndefined();
  });

  it('likes through like_scene and takes it back through unlike_scene', async () => {
    const fetchImpl = answer(200, null);
    const like = (liked: boolean) =>
      setLike({
        config,
        accessToken: 'token',
        authorId: SOMEONE,
        sceneId: 'neon-city',
        liked,
        fetchImpl: fetchImpl as unknown as typeof fetch,
      });
    await expect(like(true)).resolves.toBe(true);
    await expect(like(false)).resolves.toBe(true);
    const urls = fetchImpl.mock.calls.map((call) =>
      String((call as unknown[])[0]),
    );
    expect(urls).toEqual([
      'https://project.supabase.co/rest/v1/rpc/like_scene',
      'https://project.supabase.co/rest/v1/rpc/unlike_scene',
    ]);
    const body = JSON.parse(
      String(((fetchImpl.mock.calls[0] as unknown[])[1] as RequestInit).body),
    );
    expect(body).toEqual({ p_author: SOMEONE, p_scene: 'neon-city' });
  });
});
