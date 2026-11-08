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
import createClipDiskCache from '../../../main/plus/clipDiskCache';
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
let currentVersion: number;
let nextRead: { started: () => void; wait: Promise<void> } | undefined;

const fetchImpl = (async (input: string | URL) => {
  const url = new URL(String(input));
  if (url.pathname.endsWith('/rpc/gallery_scenes')) {
    return fakeResponse(200, [
      { author_id: SOMEONE, scene_id: 'neon-city', version: currentVersion },
    ]);
  }
  if (url.pathname.endsWith('/rpc/scene_preview_media')) {
    rpcCalls += 1;
    return fakeResponse(200, media);
  }
  const object = url.pathname.match(/member-scenes\/(.+)$/)?.[1];
  if (object) {
    objectReads.push(object);
    const held = nextRead;
    nextRead = undefined;
    held?.started();
    await held?.wait;
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

const ask = (sceneId = 'neon-city', revision = REVISION, version = 3) => {
  const handler = handlers.get('plus-gallery-clip');
  if (!handler) {
    throw new Error('no clip handler');
  }
  return handler({}, SOMEONE, sceneId, version, revision) as
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
  currentVersion = 3;
  nextRead = undefined;
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
  bucket.set(CLIP_PATH, fixture('preview-1282x720.webm'));
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

it('retains the version without a date, through cosmetic changes and offline restart', async () => {
  register();
  await ask('neon-city', '');
  await ask('neon-city', '');
  await ask('neon-city', '2026-11-06T18:00:00Z');
  handlers.clear();
  register();
  bucket.clear();
  expect(await ask()).toBeDefined();
  expect(objectReads).toEqual([CLIP_PATH]);
  expect(rpcCalls).toBe(1);
});

it('does not persist the current clip under a stale page version', async () => {
  register();
  currentVersion = 4;
  await expect(ask()).resolves.toBeUndefined();
  expect(objectReads).toEqual([]);
  await expect(ask('neon-city', REVISION, 4)).resolves.toBeDefined();
  expect(objectReads).toEqual([CLIP_PATH]);
});

it('replaces an obsolete version only after a valid download, and repairs corruption', async () => {
  register();
  await ask();
  const dir = path.join(root, 'gallery-clips');
  currentVersion = 4;
  bucket.set(CLIP_PATH, new Uint8Array([1, 2]));
  await expect(ask('neon-city', REVISION, 4)).resolves.toBeUndefined();
  expect(
    fs.readdirSync(dir).filter((name) => name.endsWith('.clip')),
  ).toHaveLength(1);
  bucket.set(CLIP_PATH, CLIP);
  await ask('neon-city', REVISION, 4);
  expect(
    fs.readdirSync(dir).filter((name) => name.endsWith('.3.clip')),
  ).toHaveLength(0);
  const file = fs.readdirSync(dir).find((name) => name.endsWith('.4.clip'))!;
  fs.writeFileSync(path.join(dir, file), 'corrupt');
  await ask('neon-city', REVISION, 4);
  expect(objectReads).toHaveLength(4);
});

it('does not resurrect a version whose download finishes after the replacement', async () => {
  const cache = createClipDiskCache(path.join(root, 'versions'));
  const identity = `${SOMEONE}/neon-city`;
  await cache.write(identity, 3, CLIP);
  await cache.write(identity, 4, CLIP);
  await cache.write(identity, 3, CLIP);
  expect(await cache.read(identity, 3)).toBeUndefined();
  expect(await cache.read(identity, 4)).toEqual(CLIP);
});

it('keeps the newer version when two actual downloads finish in reverse order', async () => {
  let release: () => void = () => undefined;
  let started: () => void = () => undefined;
  const firstRead = new Promise<void>((resolve) => {
    started = resolve;
  });
  const wait = new Promise<void>((resolve) => {
    release = resolve;
  });
  nextRead = { started, wait };
  register();
  const older = ask();
  await firstRead;
  currentVersion = 4;
  const newerPath = CLIP_PATH.replace(
    UPLOAD,
    '2c9e5a2b-3d4f-4a6b-8c7d-9e0f1a2b3c4d',
  );
  bucket.set(newerPath, CLIP);
  media = { path: newerPath, mimeType: 'video/webm' };
  expect(await ask('neon-city', REVISION, 4)).toBeDefined();
  release();
  expect(await older).toBeDefined();
  const files = fs.readdirSync(path.join(root, 'gallery-clips'));
  expect(files.filter((name) => name.endsWith('.3.clip'))).toHaveLength(0);
  expect(files.filter((name) => name.endsWith('.4.clip'))).toHaveLength(1);
  expect(objectReads).toEqual([CLIP_PATH, newerPath]);
});

it('plays on a full disk and retries persistence on the next opening', async () => {
  register();
  const write = jest
    .spyOn(fs.promises, 'writeFile')
    .mockRejectedValueOnce(
      Object.assign(new Error('disk full'), { code: 'ENOSPC' }),
    );
  try {
    expect(await ask()).toBeDefined();
    expect(await ask()).toBeDefined();
    expect(objectReads).toHaveLength(2);
    expect(await ask()).toBeDefined();
    expect(objectReads).toHaveLength(2);
  } finally {
    write.mockRestore();
  }
});

it('never evicts a current clip because the collection exceeds the old 64 MiB limit', async () => {
  const dir = path.join(root, 'gallery-clips');
  fs.mkdirSync(dir, { recursive: true });
  const count = Math.ceil((65 * 1024 * 1024) / CLIP.length);
  for (let n = 0; n < count; n += 1) {
    fs.writeFileSync(path.join(dir, `other-${n}.3.clip`), CLIP);
  }
  register();
  await ask();
  handlers.clear();
  register();
  bucket.clear();
  expect(await ask()).toBeDefined();
  expect(objectReads).toHaveLength(1);
  expect(
    fs.readdirSync(dir).filter((name) => name.endsWith('.clip')),
  ).toHaveLength(count + 1);
});
