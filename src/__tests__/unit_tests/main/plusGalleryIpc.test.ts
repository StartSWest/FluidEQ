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
  ipcMain: {
    handle: (channel: string, fn: (...args: unknown[]) => unknown) =>
      handlers.set(channel, fn),
    removeHandler: (channel: string) => handlers.delete(channel),
  },
}));

/* eslint-disable import/first -- the electron mock must be installed first */
import type { IAccountConfig } from '../../../common/accountConfig';
import { memberLookId } from '../../../common/memberScenes';
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
import { createSampleGallery } from '../../../main/plus/sampleGallery';
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
  accountId: () => ME,
  entitled: () => entitled,
  auth: async () => ({ config, accessToken: 'token', fetchImpl }),
});

const setup = (sample?: ReturnType<typeof createSampleGallery>) => {
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
    ...(sample ? { sample } : {}),
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
  it('lists the gallery for a Plus member, and nothing without Plus', async () => {
    setup();
    const listed = await invoke<Promise<TGalleryListOutcome>>(
      'plus-gallery-list',
      { sort: 'liked' },
    );
    expect(listed.ok && listed.scenes.map((scene) => scene.sceneId)).toEqual([
      'neon-city',
    ]);
    entitled = false;
    expect(
      await invoke<Promise<TGalleryListOutcome>>('plus-gallery-list', {}),
    ).toEqual({ ok: false, reason: 'not-entitled' });
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

describe('the development sample', () => {
  const sample = () =>
    createSampleGallery({
      packs: () => [
        {
          id: 'aurora',
          version: 2,
          names: { en: 'Aurora' },
          fallbackStyle: 'ridge',
          swatch: ['#030414', '#19f2b3'],
        },
      ],
      load: (id) =>
        id === 'aurora' ? memberPack({ id: 'aurora' }) : undefined,
      now: () => Date.parse('2026-09-11T00:00:00Z'),
    });

  it('lays the sample scenes in beside the real ones, and plays them', async () => {
    setup(sample());
    const listed = await invoke<Promise<TGalleryListOutcome>>(
      'plus-gallery-list',
      { sort: 'new' },
    );
    expect(
      listed.ok && listed.scenes.map((scene) => scene.sceneId).sort(),
    ).toEqual(['aurora', 'neon-city']);
    const aurora = listed.ok
      ? listed.scenes.find((scene) => scene.sceneId === 'aurora')
      : undefined;
    expect(
      await invoke('plus-gallery-preview', aurora?.authorId, 'aurora', 2),
    ).toMatchObject({ ok: true, pack: { id: 'aurora' } });
    // Never signed, so there is nothing to keep, and no picture to fetch.
    expect(
      await invoke('plus-gallery-add', aurora?.authorId, 'aurora', 2),
    ).toEqual({
      ok: false,
      reason: 'unavailable',
    });
    expect(
      await invoke('plus-gallery-picture', aurora?.authorId, 'aurora', 2),
    ).toBeUndefined();
    expect(
      calls.some((call) => call.url.includes(String(aurora?.authorId))),
    ).toBe(false);
  });
});
