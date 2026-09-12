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

const handlers = new Map<string, (...args: unknown[]) => unknown>();
jest.mock('electron', () => ({
  safeStorage: jest.requireActual('../../utils/sceneStorageCipher')
    .sceneStorageCipher,
  ipcMain: {
    handle: (channel: string, fn: (...args: unknown[]) => unknown) =>
      handlers.set(channel, fn),
    removeHandler: (channel: string) => handlers.delete(channel),
  },
}));

/* eslint-disable import/first -- the electron mock must be installed first */
import type { IAccountConfig } from '../../../common/accountConfig';
import { memberLookId } from '../../../common/memberScenes';
import { FLUIDEQ_CREATOR_ID } from '../../../common/plusGallery';
import {
  registerPlusGalleryIpc,
  type TGalleryAddOutcome,
  type TGalleryListOutcome,
  type TGalleryPreviewOutcome,
} from '../../../main/ipc/plusGallery';
import {
  createMemberSceneStore,
  memberSceneFingerprint,
  type IMemberSceneStore,
} from '../../../main/memberScenes/store';
import type { IGalleryAccess } from '../../../main/plus/galleryAccess';
import {
  fakeResponse,
  ME,
  memberPack,
  memberPayload,
  signedEnvelope,
  SOMEONE,
  webpBytes,
} from '../../utils/memberSceneFixtures';
/* eslint-enable import/first */

const config = {
  supabaseUrl: 'https://project.supabase.co',
  supabaseAnonKey: 'anon',
  apiUrl: 'https://project.supabase.co/functions/v1',
} as IAccountConfig;

const invoke = <T>(channel: string, ...args: unknown[]) => {
  const handler = handlers.get(channel);
  if (!handler) {
    throw new Error(`no handler for ${channel}`);
  }
  return handler({}, ...args) as T;
};

const row = (over: Record<string, unknown> = {}) => ({
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
  ...over,
});

let root: string;
let entitled: boolean;
let signedIn: boolean;
let store: IMemberSceneStore;
let announced: number;
let refreshed: number;
let calls: Array<{ url: string; body?: unknown }>;
/** What the bucket holds, by object path. */
let bucket: Map<string, unknown>;
let rows: unknown[];

const fetchImpl = (async (input: string | URL, init?: RequestInit) => {
  const url = String(input);
  calls.push({
    url,
    body: init?.body ? JSON.parse(String(init.body)) : undefined,
  });
  const object = url.match(/member-scenes\/(.+)$/)?.[1];
  if (object) {
    return bucket.has(object)
      ? fakeResponse(200, bucket.get(object))
      : fakeResponse(400, { error: 'not_found' });
  }
  if (url.endsWith('/rpc/gallery_scenes')) {
    return fakeResponse(200, rows);
  }
  return fakeResponse(200, null);
}) as unknown as typeof fetch;

const access = (): IGalleryAccess => ({
  accountId: () => (signedIn ? ME : undefined),
  entitled: () => entitled,
  auth: async () => ({ config, accessToken: 'token', fetchImpl }),
});

const setup = () => {
  store = createMemberSceneStore({
    userDataDir: path.join(root, 'userData'),
    appVersion: '1.0.0',
  });
  return registerPlusGalleryIpc({
    access: access(),
    store,
    refreshBlocked: async () => {
      refreshed += 1;
    },
    announce: () => {
      announced += 1;
    },
    onEntitlementChange: () => () => undefined,
  });
};

const publishScene = (author: string, pack = memberPack()) =>
  bucket.set(
    `${author}/${pack.id}/scene.json`,
    signedEnvelope(memberPayload({ author, pack })),
  );

beforeEach(() => {
  handlers.clear();
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-gallery-ipc-'));
  entitled = true;
  signedIn = true;
  announced = 0;
  refreshed = 0;
  calls = [];
  bucket = new Map();
  rows = [row()];
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe('listing', () => {
  it('syncs a signed republication into an installed copy and retains it after withdrawal', async () => {
    setup();
    store.saveImported(signedEnvelope(memberPayload()));
    const oldRevision = store.list()[0].revision;
    const next = memberPack({
      source: 'vec4 sceneColour(vec2 uv) { return vec4(0.5); }',
    });
    publishScene(SOMEONE, next);
    await invoke('plus-gallery-list', {});
    expect(store.load(SOMEONE, next.id)?.source).toBe(next.source);
    expect(store.list()[0].revision).not.toBe(oldRevision);
    rows = [];
    bucket.clear();
    await invoke('plus-gallery-list', {});
    expect(store.load(SOMEONE, next.id)?.source).toBe(next.source);
  });

  it('never installs an unseen scene or a forged update while browsing', async () => {
    setup();
    publishScene(SOMEONE);
    await invoke('plus-gallery-list', {});
    expect(store.list()).toEqual([]);
    store.saveImported(signedEnvelope(memberPayload()));
    const before = store.list()[0].revision;
    bucket.set(
      `${SOMEONE}/neon-city/scene.json`,
      signedEnvelope(memberPayload({ author: ME })),
    );
    await invoke('plus-gallery-list', {});
    expect(store.list()[0].revision).toBe(before);
  });

  it('lists the gallery for anyone signed in, Plus or not', async () => {
    setup();
    const listed = await invoke<Promise<TGalleryListOutcome>>(
      'plus-gallery-list',
      { sort: 'liked' },
    );
    expect(listed.ok && listed.scenes.map((scene) => scene.sceneId)).toEqual([
      'neon-city',
    ]);
    entitled = false;
    const browsed = await invoke<Promise<TGalleryListOutcome>>(
      'plus-gallery-list',
      {},
    );
    expect(browsed.ok && browsed.scenes.map((scene) => scene.sceneId)).toEqual([
      'neon-city',
    ]);
  });

  it('lists nothing to somebody signed out, and asks the server nothing', async () => {
    setup();
    signedIn = false;
    expect(
      await invoke<Promise<TGalleryListOutcome>>('plus-gallery-list', {}),
    ).toEqual({ ok: false, reason: 'signed-out' });
    expect(calls).toEqual([]);
  });

  it('rebuilds the query from only the parts that check out', async () => {
    setup();
    await invoke('plus-gallery-list', {
      sort: 'DROP TABLE',
      category: 'weapons',
      authorId: '../../admin',
      query: '  neon  ',
      offset: 1e9,
    });
    expect(calls[0]?.body).toMatchObject({
      p_sort: 'liked',
      p_category: null,
      p_author: null,
      p_query: 'neon',
      p_offset: 6000,
    });
  });

  it('leaves out a scene this computer knows is blocked', async () => {
    setup();
    store.setBlocked([memberSceneFingerprint(SOMEONE, 'neon-city')]);
    const listed = await invoke<Promise<TGalleryListOutcome>>(
      'plus-gallery-list',
      { sort: 'liked' },
    );
    expect(listed).toEqual({ ok: true, scenes: [], more: false });
  });
});

describe('a scene’s page', () => {
  it('refreshes the cover and scene when republished without a manifest version bump', async () => {
    setup();
    publishScene(SOMEONE);
    const imagePath = `${SOMEONE}/neon-city/picture.webp`;
    bucket.set(imagePath, webpBytes(64));
    const first = '2026-09-10T12:00:00Z';
    const next = '2026-09-11T12:00:00Z';
    const cover = await invoke(
      'plus-gallery-picture',
      SOMEONE,
      'neon-city',
      1,
      first,
    );
    await invoke('plus-gallery-preview', SOMEONE, 'neon-city', 1, first);
    bucket.set(imagePath, webpBytes(96));
    publishScene(SOMEONE, memberPack({ names: { en: 'Changed scene' } }));
    expect(
      await invoke('plus-gallery-picture', SOMEONE, 'neon-city', 1, next),
    ).not.toBe(cover);
    expect(
      await invoke('plus-gallery-preview', SOMEONE, 'neon-city', 1, next),
    ).toMatchObject({ ok: true, pack: { names: { en: 'Changed scene' } } });
  });
  it('plays the scene the member key vouches for', async () => {
    setup();
    publishScene(SOMEONE);
    const preview = await invoke<Promise<TGalleryPreviewOutcome>>(
      'plus-gallery-preview',
      SOMEONE,
      'neon-city',
      1,
    );
    expect(preview).toMatchObject({
      ok: true,
      own: false,
      pack: { id: 'neon-city' },
    });
  });

  it('refuses a file signed for somebody else’s row', async () => {
    setup();
    // The bucket path says Mei's scene; the file inside says it is mine.
    bucket.set(
      `${SOMEONE}/neon-city/scene.json`,
      signedEnvelope(memberPayload({ author: ME })),
    );
    expect(
      await invoke('plus-gallery-preview', SOMEONE, 'neon-city', 1),
    ).toEqual({ ok: false, reason: 'changed' });
  });

  it('refuses a file FluidEQ never signed', async () => {
    setup();
    bucket.set(
      `${SOMEONE}/neon-city/scene.json`,
      signedEnvelope(memberPayload(), { trusted: false }),
    );
    expect(
      await invoke('plus-gallery-preview', SOMEONE, 'neon-city', 1),
    ).toEqual({ ok: false, reason: 'changed' });
  });

  it('says so when the file is not there, and when it is blocked', async () => {
    setup();
    expect(
      await invoke('plus-gallery-preview', SOMEONE, 'neon-city', 1),
    ).toEqual({ ok: false, reason: 'unavailable' });
    store.setBlocked([memberSceneFingerprint(SOMEONE, 'neon-city')]);
    expect(
      await invoke('plus-gallery-preview', SOMEONE, 'neon-city', 1),
    ).toEqual({ ok: false, reason: 'blocked' });
  });

  it('takes no ids that are not ids', async () => {
    setup();
    expect(
      await invoke('plus-gallery-preview', '../../etc', 'passwd', 1),
    ).toEqual({ ok: false, reason: 'not-entitled' });
    expect(calls).toEqual([]);
  });
});

describe('adding', () => {
  it('keeps the scene, counts the add, and tells the looks', async () => {
    setup();
    publishScene(SOMEONE);
    const added = await invoke<Promise<TGalleryAddOutcome>>(
      'plus-gallery-add',
      SOMEONE,
      'neon-city',
      1,
    );
    expect(added).toEqual({
      ok: true,
      lookId: memberLookId(SOMEONE, 'neon-city'),
    });
    expect(refreshed).toBe(1);
    expect(announced).toBe(1);
    expect(store.list().map((scene) => [scene.packId, scene.own])).toEqual([
      ['neon-city', false],
    ]);
    expect(calls.map((call) => call.url)).toContain(
      'https://project.supabase.co/rest/v1/rpc/record_scene_add',
    );
  });

  it('reuses the file its page already downloaded', async () => {
    setup();
    publishScene(SOMEONE);
    await invoke('plus-gallery-preview', SOMEONE, 'neon-city', 1);
    await invoke('plus-gallery-add', SOMEONE, 'neon-city', 1);
    expect(
      calls.filter((call) => call.url.endsWith('scene.json')),
    ).toHaveLength(1);
  });

  it('brings the member’s own scene back as their own', async () => {
    setup();
    publishScene(ME);
    await invoke('plus-gallery-add', ME, 'neon-city', 1);
    expect(store.list()[0]).toMatchObject({ authorId: ME, own: true });
  });

  it('asks the block list first, and keeps nothing it names', async () => {
    const registration = setup();
    publishScene(SOMEONE);
    registration.dispose();
    handlers.clear();
    registerPlusGalleryIpc({
      access: access(),
      store,
      refreshBlocked: async () => {
        store.setBlocked([memberSceneFingerprint(SOMEONE, 'neon-city')]);
      },
      announce: () => undefined,
      onEntitlementChange: () => () => undefined,
    });
    expect(await invoke('plus-gallery-add', SOMEONE, 'neon-city', 1)).toEqual({
      ok: false,
      reason: 'blocked',
    });
    expect(store.list()).toEqual([]);
  });
});

describe('pictures', () => {
  it('loads the actual Studio cover for an official publication', async () => {
    setup();
    bucket.set(`${FLUIDEQ_CREATOR_ID}/alpine/picture.webp`, webpBytes());
    expect(
      await invoke('plus-gallery-picture', FLUIDEQ_CREATOR_ID, 'alpine', 47),
    ).toMatch(/^data:image\/webp;base64,/);
  });
  it('hands the page a WebP as a data URL, once fetched', async () => {
    setup();
    bucket.set(`${SOMEONE}/neon-city/picture.webp`, webpBytes());
    const first = await invoke<Promise<string>>(
      'plus-gallery-picture',
      SOMEONE,
      'neon-city',
      1,
    );
    expect(first).toMatch(/^data:image\/webp;base64,/);
    await invoke('plus-gallery-picture', SOMEONE, 'neon-city', 1);
    expect(
      calls.filter((call) => call.url.endsWith('picture.webp')),
    ).toHaveLength(1);
  });

  it('shows nothing that is not a WebP', async () => {
    setup();
    bucket.set(`${SOMEONE}/neon-city/picture.webp`, new Uint8Array(64));
    expect(
      await invoke('plus-gallery-picture', SOMEONE, 'neon-city', 1),
    ).toBeUndefined();
  });

  it('shows and plays a scene without Plus, but keeps nothing', async () => {
    setup();
    entitled = false;
    bucket.set(`${SOMEONE}/neon-city/picture.webp`, webpBytes());
    publishScene(SOMEONE);
    expect(
      await invoke<Promise<string>>(
        'plus-gallery-picture',
        SOMEONE,
        'neon-city',
        1,
      ),
    ).toMatch(/^data:image\/webp;base64,/);
    // Its page may play it — verified exactly as with Plus — for the taste.
    expect(
      await invoke<Promise<TGalleryPreviewOutcome>>(
        'plus-gallery-preview',
        SOMEONE,
        'neon-city',
        1,
      ),
    ).toMatchObject({ ok: true, pack: { id: 'neon-city' } });
    // Keeping it is Plus.
    expect(
      await invoke<Promise<TGalleryAddOutcome>>(
        'plus-gallery-add',
        SOMEONE,
        'neon-city',
        1,
      ),
    ).toEqual({ ok: false, reason: 'not-entitled' });
    expect(store.list()).toEqual([]);
    expect(announced).toBe(0);
  });

  it('plays nothing to somebody signed out', async () => {
    setup();
    signedIn = false;
    publishScene(SOMEONE);
    expect(
      await invoke('plus-gallery-preview', SOMEONE, 'neon-city', 1),
    ).toEqual({ ok: false, reason: 'not-entitled' });
    expect(calls).toEqual([]);
  });
});

describe('reporting', () => {
  it('sends one of the four reasons, and nothing else', async () => {
    setup();
    expect(
      await invoke('plus-gallery-report', SOMEONE, 'neon-city', 'rights'),
    ).toBe(true);
    expect(
      await invoke('plus-gallery-report', SOMEONE, 'neon-city', 'I hate it'),
    ).toBe(false);
    expect(
      calls.filter((call) => call.url.endsWith('/rpc/report_scene')),
    ).toEqual([
      {
        url: 'https://project.supabase.co/rest/v1/rpc/report_scene',
        body: { p_author: SOMEONE, p_scene: 'neon-city', p_reason: 'rights' },
      },
    ]);
  });
});

it('lists only server publications, without fabricated creators or scenes', async () => {
  setup();
  rows = [];
  expect(await invoke('plus-gallery-list', { sort: 'new' })).toEqual({
    ok: true,
    scenes: [],
    more: false,
  });
});
