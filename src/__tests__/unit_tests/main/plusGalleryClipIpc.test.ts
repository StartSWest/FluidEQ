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
import { registerGalleryClipIpc } from '../../../main/ipc/plusGalleryClip';
import type { IGalleryAccess } from '../../../main/plus/galleryAccess';
import type { IGalleryClip } from '../../../main/plus/galleryClip';
import { fakeResponse, SOMEONE } from '../../utils/memberSceneFixtures';
/* eslint-enable import/first */

const config = {
  supabaseUrl: 'https://project.supabase.co',
  supabaseAnonKey: 'anon',
  apiUrl: 'https://project.supabase.co/functions/v1',
} as IAccountConfig;

const fixture = (name: string) =>
  new Uint8Array(fs.readFileSync(path.join(__dirname, '../../utils', name)));
const CLIP = fixture('preview-854x480.webm');
const UPLOAD = '1c9e5a2b-3d4f-4a6b-8c7d-9e0f1a2b3c4d';
const CLIP_PATH = `${SOMEONE}/neon-city/preview/${UPLOAD}.webm`;
const REVISION = '2026-10-31T12:00:00Z';

let root: string;
let signedIn: boolean;
let blocked: boolean;
/** What scene_preview_media answers: the bound clip's path, or anything. */
let media: unknown;
/** What the bucket holds, by object path. */
let bucket: Map<string, Uint8Array>;
let objectReads: string[];
let rpcCalls: number;

const fetchImpl = (async (input: string | URL) => {
  const url = new URL(String(input));
  if (url.pathname.endsWith('/rpc/scene_preview_media')) {
    rpcCalls += 1;
    return fakeResponse(200, media);
  }
  const object = url.pathname.match(/member-scenes\/(.+)$/)?.[1];
  if (object) {
    objectReads.push(object);
    const bytes = bucket.get(object);
    return bytes ? fakeResponse(200, bytes) : fakeResponse(400, {});
  }
  return fakeResponse(404, {});
}) as unknown as typeof fetch;

const access: IGalleryAccess = {
  accountId: () => (signedIn ? 'viewer' : undefined),
  entitled: () => false,
  owns: () => false,
  auth: async () => ({ config, accessToken: 'token', fetchImpl }),
  authorize: async () => ({ ok: false, reason: 'signed-out' }),
};

const register = () =>
  registerGalleryClipIpc({
    access,
    isBlocked: () => blocked,
    clipDir: path.join(root, 'gallery-clips'),
  });

const ask = (sceneId = 'neon-city', revision = REVISION) => {
  const handler = handlers.get('plus-gallery-clip');
  if (!handler) {
    throw new Error('no clip handler');
  }
  return handler({}, SOMEONE, sceneId, 3, revision) as
    Promise<IGalleryClip | undefined> | undefined;
};

beforeEach(() => {
  handlers.clear();
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-gallery-clip-'));
  signedIn = true;
  blocked = false;
  media = { path: CLIP_PATH, mimeType: 'video/webm' };
  bucket = new Map([[CLIP_PATH, CLIP]]);
  objectReads = [];
  rpcCalls = 0;
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

it('hands over the bound clip, checked, and keeps it so it is never downloaded again', async () => {
  register();
  const first = await ask();
  expect(first?.mimeType).toBe('video/webm');
  expect(Buffer.from(first?.bytes ?? []).equals(Buffer.from(CLIP))).toBe(true);
  expect(objectReads).toEqual([CLIP_PATH]);

  // The next session: a new registration over the same folder.
  handlers.clear();
  register();
  const again = await ask();
  expect(Buffer.from(again?.bytes ?? []).equals(Buffer.from(CLIP))).toBe(true);
  expect(objectReads).toEqual([CLIP_PATH]);
  expect(rpcCalls).toBe(1);
});

it('two asks at once share one download', async () => {
  register();
  const [one, two] = await Promise.all([ask(), ask()]);
  expect(one?.mimeType).toBe('video/webm');
  expect(two).toBe(one);
  expect(objectReads).toHaveLength(1);
});

it.each([
  ['another scene', `${SOMEONE}/other-scene/preview/${UPLOAD}.webm`],
  ['the scene file', `${SOMEONE}/neon-city/scene.json`],
  ['a path out of the folder', `${SOMEONE}/neon-city/preview/../../x.webm`],
  ['no answer', null],
])(
  'never downloads what the server names when it is %s',
  async (_case, named) => {
    media = named === null ? null : { path: named, mimeType: 'video/webm' };
    register();
    await expect(ask()).resolves.toBeUndefined();
    expect(objectReads).toEqual([]);
  },
);

it('refuses bytes that are not a clip of the box, and keeps none of them', async () => {
  bucket.set(CLIP_PATH, fixture('preview-856x480.webm'));
  register();
  await expect(ask()).resolves.toBeUndefined();
  await expect(ask()).resolves.toBeUndefined();
  expect(objectReads).toEqual([CLIP_PATH, CLIP_PATH]);
});

it('asks for nothing signed out, for a blocked scene, or for a bad reference', async () => {
  register();
  signedIn = false;
  expect(ask()).toBeUndefined();
  signedIn = true;
  blocked = true;
  await expect(ask()).resolves.toBeUndefined();
  blocked = false;
  expect(ask('Not A Scene')).toBeUndefined();
  expect(rpcCalls).toBe(0);
  expect(objectReads).toEqual([]);
});

it('keeps nothing without a revision to name the version by', async () => {
  register();
  await ask('neon-city', '');
  await ask('neon-city', '');
  expect(objectReads).toEqual([CLIP_PATH, CLIP_PATH]);
});
