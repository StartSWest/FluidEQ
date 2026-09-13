/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * @jest-environment node
 */

import type { IAccountConfig } from '../../../common/accountConfig';
import {
  fetchEnvelope,
  fetchPicture,
  listGallery,
  MAX_PICTURE_BYTES,
  publishScene,
  unpublishScene,
} from '../../../main/plus/galleryApi';
import {
  fakeResponse,
  memberPack,
  memberPayload,
  signedEnvelope,
  SOMEONE,
  webpBytes,
} from '../../utils/memberSceneFixtures';

const config = {
  supabaseUrl: 'https://project.supabase.co',
  supabaseAnonKey: 'anon',
  apiUrl: 'https://project.supabase.co/functions/v1',
} as IAccountConfig;

const row = {
  author_id: SOMEONE,
  author_name: 'Mei Tanaka',
  author_handle: 'mei',
  scene_id: 'neon-city',
  version: 1,
  category: 'cities',
  names: { en: 'Neon City' },
  swatch: ['#050a1a', '#00e5cf'],
  has_photo: false,
  likes: 3,
  likes_week: 1,
  adds: 2,
  updated_at: '2026-09-10T12:00:00Z',
  liked: false,
  added: false,
};

/** A fetch that answers every request the same way, and remembers them. */
const answering = (response: Response) =>
  jest.fn(async (_input: string, _init?: RequestInit) => response);

const authWith = (fetchImpl: jest.Mock) => ({
  config,
  accessToken: 'token',
  fetchImpl: fetchImpl as unknown as typeof fetch,
});

describe('listing the gallery', () => {
  it('asks gallery_scenes with the member’s token and reads the rows', async () => {
    const fetchImpl = jest.fn(async () =>
      fakeResponse(200, [row, { junk: 1 }]),
    );
    const listed = await listGallery(authWith(fetchImpl), {
      sort: 'week',
      category: 'cities',
      query: 'neon',
      offset: 60,
    });
    expect(listed).toMatchObject({ ok: true, more: false });
    expect(listed.ok && listed.scenes.map((scene) => scene.sceneId)).toEqual([
      'neon-city',
    ]);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe('https://project.supabase.co/rest/v1/rpc/gallery_scenes');
    expect((init.headers as Record<string, string>).Authorization).toBe(
      'Bearer token',
    );
    expect(JSON.parse(String(init.body))).toMatchObject({
      p_category: 'cities',
      p_query: 'neon',
      p_sort: 'week',
      p_offset: 60,
    });
  });

  it('says there is more when a whole page came back', async () => {
    const page = Array.from({ length: 60 }, (_, index) => ({
      ...row,
      scene_id: `scene-${index}`,
    }));
    const fetchImpl = jest.fn(async () => fakeResponse(200, page));
    expect(
      await listGallery(authWith(fetchImpl), { sort: 'liked' }),
    ).toMatchObject({
      ok: true,
      more: true,
    });
  });

  it('tells a signed-out answer and no connection apart', async () => {
    expect(
      await listGallery(authWith(jest.fn(async () => fakeResponse(401, {}))), {
        sort: 'liked',
      }),
    ).toEqual({ ok: false, reason: 'signed-out' });
    expect(
      await listGallery(
        authWith(
          jest.fn(async () => {
            throw new Error('ECONNREFUSED');
          }),
        ),
        { sort: 'liked' },
      ),
    ).toEqual({ ok: false, reason: 'offline' });
  });
});

describe('a scene’s files', () => {
  it('reads a picture only when it is a WebP by its own header', async () => {
    const picture = webpBytes();
    expect(
      await fetchPicture(
        authWith(jest.fn(async () => fakeResponse(200, picture))),
        SOMEONE,
        'neon-city',
      ),
    ).toEqual(picture);
    expect(
      await fetchPicture(
        authWith(jest.fn(async () => fakeResponse(200, new Uint8Array(64)))),
        SOMEONE,
        'neon-city',
      ),
    ).toBeUndefined();
    expect(
      await fetchPicture(
        authWith(
          jest.fn(async () =>
            fakeResponse(200, webpBytes(MAX_PICTURE_BYTES + 1)),
          ),
        ),
        SOMEONE,
        'neon-city',
      ),
    ).toBeUndefined();
  });

  it('asks the private bucket with the member’s own token', async () => {
    const fetchImpl = answering(fakeResponse(200, webpBytes()));
    await fetchPicture(authWith(fetchImpl), SOMEONE, 'neon-city');
    expect(fetchImpl.mock.calls[0]?.[0]).toBe(
      `https://project.supabase.co/storage/v1/object/authenticated/member-scenes/${SOMEONE}/neon-city/picture.webp`,
    );
  });

  it('returns a scene file as an envelope, and nothing else as one', async () => {
    const envelope = signedEnvelope(memberPayload());
    expect(
      await fetchEnvelope(
        authWith(jest.fn(async () => fakeResponse(200, envelope))),
        SOMEONE,
        'neon-city',
      ),
    ).toEqual(envelope);
    expect(
      await fetchEnvelope(
        authWith(jest.fn(async () => fakeResponse(200, '<html>'))),
        SOMEONE,
        'neon-city',
      ),
    ).toBeUndefined();
  });
});

describe('publishing', () => {
  const publish = (status: number, body: unknown) =>
    publishScene(authWith(jest.fn(async () => fakeResponse(status, body))), {
      termsVersion: 4,
      category: 'cities',
      pack: memberPack(),
      picture: 'UklGRg==',
    });

  it('says each refusal in its own word', async () => {
    expect(await publish(200, { published: {} })).toEqual({ ok: true });
    expect(await publish(409, { error: 'terms_outdated' })).toEqual({
      ok: false,
      reason: 'terms',
    });
    expect(await publish(403, { error: 'banned' })).toEqual({
      ok: false,
      reason: 'banned',
    });
    expect(await publish(403, { error: 'plus_required' })).toEqual({
      ok: false,
      reason: 'not-entitled',
    });
    expect(await publish(429, {})).toEqual({
      ok: false,
      reason: 'rate-limited',
    });
    expect(await publish(422, {})).toEqual({ ok: false, reason: 'refused' });
    expect(await publish(500, {})).toEqual({ ok: false, reason: 'server' });
  });

  it('sends the action, the terms and the category the member chose', async () => {
    const fetchImpl = answering(fakeResponse(200, {}));
    await publishScene(authWith(fetchImpl), {
      termsVersion: 4,
      category: 'space',
      pack: memberPack(),
      picture: 'UklGRg==',
    });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe(
      'https://project.supabase.co/functions/v1/publish-member-scene',
    );
    expect(JSON.parse(String(init.body))).toMatchObject({
      action: 'publish',
      termsVersion: 4,
      category: 'space',
      pack: { id: 'neon-city' },
    });
  });

  it('sends a second category only when the member chose one', async () => {
    const fetchImpl = answering(fakeResponse(200, {}));
    await publishScene(authWith(fetchImpl), {
      termsVersion: 4,
      category: 'cities',
      category2: 'water',
      pack: memberPack(),
      picture: 'UklGRg==',
    });
    await publishScene(authWith(fetchImpl), {
      termsVersion: 4,
      category: 'cities',
      pack: memberPack(),
      picture: 'UklGRg==',
    });
    const bodies = (
      fetchImpl.mock.calls as unknown as Array<[string, RequestInit]>
    ).map(([, init]) => JSON.parse(String(init.body)));
    expect(bodies[0]).toMatchObject({ category: 'cities', category2: 'water' });
    expect(bodies[1]).not.toHaveProperty('category2');
  });

  it('takes a scene down by its id alone', async () => {
    const fetchImpl = answering(fakeResponse(200, {}));
    expect(await unpublishScene(authWith(fetchImpl), 'neon-city')).toEqual({
      ok: true,
    });
    const init = fetchImpl.mock.calls[0]?.[1] as unknown as RequestInit;
    expect(JSON.parse(String(init.body))).toEqual({
      action: 'unpublish',
      sceneId: 'neon-city',
    });
  });
});
