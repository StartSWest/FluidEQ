/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What a published scene's clip costs on the network, counted the way it is
 * served now (server 0117): a link the `scene-media` function signs — which
 * is what the account's daily allowance counts — then the bytes from R2.
 * Every tile of a look picker, a Details row, a gallery card and a scene's
 * page asks main the same way (`plus-gallery-clip`), so opening the picker is
 * one ask per tile hovered.
 *
 * Ivan, 2026-11-27: "We download it and play from the local client until a
 * new version comes, which downloads and replaces the old video locally."
 * Each count sits beside a control: the same opens with nothing kept on disk,
 * which is what downloading each time would look like to these counters.
 */

import { createHash } from 'crypto';
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

const fixture = (name: string) =>
  new Uint8Array(fs.readFileSync(path.join(__dirname, '../../utils', name)));
const FIRST_CLIP = fixture('preview-854x480.webm');
const NEW_CLIP = fixture('preview-1280x720.webm');

/** A picker's worth of a member's scenes, each with its published clip. */
const SCENES = Array.from(
  { length: 12 },
  (_, n) => `scene-${String.fromCharCode(97 + n)}`,
);
const uploadOf = (n: number) =>
  `1c9e5a2b-3d4f-4a6b-8c7d-${String(n).padStart(12, '0')}`;
const R2 = 'https://acct.r2.cloudflarestorage.com/fluideq-media/';
const FUNCTION = '/functions/v1/scene-media';

interface IPublished {
  version: number;
  path: string;
  bytes: Uint8Array;
}

let root: string;
let published: Map<string, IPublished>;
/** Every request that left the app, by what it was. */
let calls: { links: number; r2: number; rpc: number; other: number };
let allowanceUsedUp: boolean;
let heldR2: { started: () => void; wait: Promise<void> } | undefined;

const sha = (bytes: Uint8Array) =>
  createHash('sha256').update(bytes).digest('hex');

const byPath = (object: string) =>
  [...published.values()].find((scene) => scene.path === object);

const fetchImpl = (async (input: string | URL, init?: RequestInit) => {
  const url = String(input);
  const body: unknown = init?.body ? JSON.parse(String(init.body)) : {};
  if (url.endsWith(FUNCTION)) {
    const { items } = body as { items: { object: string }[] };
    if (allowanceUsedUp) {
      return fakeResponse(429, {
        error: 'daily_allowance',
        resetsAt: '2026-11-28T00:00:00Z',
      });
    }
    calls.links += items.length;
    return fakeResponse(200, {
      live: true,
      items: items.map(({ object }) => {
        const scene = byPath(object);
        return scene
          ? {
              state: 'ready',
              url: `${R2}${object}?X-Amz-Signature=1`,
              bytes: scene.bytes.length,
              sha256: sha(scene.bytes),
            }
          : { state: 'refused' };
      }),
    });
  }
  if (url.startsWith(R2)) {
    calls.r2 += 1;
    const held = heldR2;
    heldR2 = undefined;
    held?.started();
    await held?.wait;
    const scene = byPath(new URL(url).pathname.slice('/fluideq-media/'.length));
    return scene ? fakeResponse(200, scene.bytes) : fakeResponse(404, '');
  }
  if (url.endsWith('/rpc/scene_preview_media')) {
    calls.rpc += 1;
    const { p_scene: scene } = body as { p_scene: string };
    const found = published.get(scene);
    return fakeResponse(200, found ? { path: found.path } : null);
  }
  if (url.endsWith('/rpc/gallery_scenes')) {
    calls.rpc += 1;
    return fakeResponse(
      200,
      [...published].map(([scene, { version }]) => ({
        author_id: SOMEONE,
        scene_id: scene,
        version,
      })),
    );
  }
  // The old storage path: never read while the function answers.
  calls.other += 1;
  return fakeResponse(404, {});
}) as unknown as typeof fetch;

/**
 * One run of the app: its own config, as a new process has, and the handler
 * registered again over the folder the last run left — or over none.
 */
const startApp = (keep = true) => {
  handlers.clear();
  const config = {
    supabaseUrl: 'https://project.supabase.co',
    supabaseAnonKey: 'anon',
    apiUrl: 'https://project.supabase.co/functions/v1',
  } as IAccountConfig;
  const access: IGalleryAccess = {
    accountId: () => 'viewer',
    entitled: () => false,
    owns: () => false,
    auth: async () => ({ config, accessToken: 'token', fetchImpl }),
  };
  registerGalleryClipIpc({
    access,
    isBlocked: () => false,
    clipDir: keep ? path.join(root, 'gallery-clips') : undefined,
  });
};

const hover = (scene: string, version = published.get(scene)?.version) => {
  const handler = handlers.get('plus-gallery-clip');
  if (!handler) {
    throw new Error('no clip handler');
  }
  return handler({}, SOMEONE, scene, version, '2026-11-27T12:00:00Z') as
    Promise<IGalleryClip | undefined> | undefined;
};

/** The picker opened and every tile hovered, one after another, as a pointer does. */
const openPicker = async () => {
  const played: (IGalleryClip | undefined)[] = [];
  await SCENES.reduce(async (previous, scene) => {
    await previous;
    played.push(await hover(scene));
  }, Promise.resolve());
  return played;
};

const countsOf = async (open: () => Promise<unknown>) => {
  const before = { ...calls };
  await open();
  return {
    links: calls.links - before.links,
    r2: calls.r2 - before.r2,
    rpc: calls.rpc - before.rpc,
    other: calls.other - before.other,
  };
};

const keptFiles = () => fs.readdirSync(path.join(root, 'gallery-clips')).sort();

const NOTHING = { links: 0, r2: 0, rpc: 0, other: 0 };

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-clip-downloads-'));
  published = new Map(
    SCENES.map((scene, n) => [
      scene,
      {
        version: 3,
        path: `${SOMEONE}/${scene}/preview/${uploadOf(n)}.webm`,
        bytes: FIRST_CLIP,
      },
    ]),
  );
  calls = { links: 0, r2: 0, rpc: 0, other: 0 };
  allowanceUsedUp = false;
  heldR2 = undefined;
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

it('downloads each clip once: a second open and a restart ask the network for nothing', async () => {
  startApp();
  const first = await countsOf(openPicker);
  // One link (one count against the allowance) and one download per clip.
  // The lookups that bind a clip to its version are not counted against the
  // allowance, and how many there are is the binding's business.
  expect(first).toMatchObject({ links: 12, r2: 12, other: 0 });

  const second = await countsOf(openPicker);
  startApp();
  const restarted = await countsOf(async () => {
    const played = await openPicker();
    expect(played.every((clip) => clip?.mimeType === 'video/webm')).toBe(true);
  });
  expect(second).toEqual(NOTHING);
  expect(restarted).toEqual(NOTHING);
  expect(keptFiles()).toHaveLength(12);

  // Control: the same three opens with nothing kept, which is what
  // downloading each time looks like to the same counters.
  const control = { ...calls };
  startApp(false);
  await openPicker();
  await openPicker();
  startApp(false);
  await openPicker();
  expect(calls.links - control.links).toBe(36);
  expect(calls.r2 - control.r2).toBe(36);
});

it('downloads a new version once, keeps the old file until it is whole, then replaces it', async () => {
  startApp();
  await openPicker();
  const changed = SCENES[0];
  // The kept file's name: the scene's digest, then its version.
  const prefix = `${sha(new TextEncoder().encode(`${SOMEONE}/${changed}`))}.`;
  const ofScene = () => keptFiles().filter((name) => name.startsWith(prefix));
  expect(ofScene()).toEqual([`${prefix}3.clip`]);
  // Republished: a new version, bound to a new upload with other bytes.
  published.set(changed, {
    version: 4,
    path: `${SOMEONE}/${changed}/preview/${uploadOf(99)}.webm`,
    bytes: NEW_CLIP,
  });

  let release: () => void = () => undefined;
  let started: () => void = () => undefined;
  const downloading = new Promise<void>((resolve) => {
    started = resolve;
  });
  heldR2 = {
    started,
    wait: new Promise<void>((resolve) => {
      release = resolve;
    }),
  };
  const before = { ...calls };
  const arriving = hover(changed);
  await downloading;
  // Halfway through the download the old version is still the one kept.
  expect(ofScene()).toEqual([`${prefix}3.clip`]);
  release();
  const clip = await arriving;
  expect(Buffer.from(clip?.bytes ?? []).equals(Buffer.from(NEW_CLIP))).toBe(
    true,
  );
  expect(calls.links - before.links).toBe(1);
  expect(calls.r2 - before.r2).toBe(1);

  // Replaced, not added: one file for the scene, holding the new bytes.
  const now = ofScene();
  expect(now).toEqual([`${prefix}4.clip`]);
  expect(keptFiles()).toHaveLength(12);
  expect(
    fs
      .readFileSync(path.join(root, 'gallery-clips', now[0]))
      .equals(Buffer.from(NEW_CLIP)),
  ).toBe(true);

  // Every later open, this run or the next, plays it from disk.
  expect(await countsOf(openPicker)).toEqual(NOTHING);
  startApp();
  expect(await countsOf(openPicker)).toEqual(NOTHING);
});

it('a kept clip plays with the allowance used up, and spends none of it', async () => {
  startApp();
  await openPicker();
  allowanceUsedUp = true;
  startApp();
  const played: (IGalleryClip | undefined)[] = [];
  const counts = await countsOf(async () => {
    played.push(...(await openPicker()));
  });
  expect(counts).toEqual(NOTHING);
  expect(played.every((clip) => clip !== undefined)).toBe(true);

  // Control: a clip not kept yet is refused for the allowance, as it must be.
  published.set('scene-new', {
    version: 1,
    path: `${SOMEONE}/scene-new/preview/${uploadOf(50)}.webm`,
    bytes: FIRST_CLIP,
  });
  await expect(hover('scene-new')).resolves.toBeUndefined();
  expect(calls.r2).toBe(12);
});
