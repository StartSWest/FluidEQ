/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * @jest-environment node
 */

/**
 * Saving a version the server keeps of a scene (premium 0100), as main does
 * it for the scene's page: owners only, asked before and after the download;
 * nothing downloaded to anybody else or for anything but the ask; the path
 * and the file both held to exactly the version asked; and a save that can
 * be cancelled. Each refusal stands beside the owner's save that succeeds.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { generateKeyPairSync, sign } from 'crypto';

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
import {
  FLUIDEQ_CREATOR_ID,
  type TSaveGalleryVersion,
} from '../../../common/plusGallery';
import { premiumLookId } from '../../../common/scenePacks';
import { registerGalleryVersionSaveIpc } from '../../../main/ipc/plusGalleryVersionSave';
import {
  createMemberSceneStore,
  memberSceneFingerprint,
  type IMemberSceneStore,
} from '../../../main/memberScenes/store';
import type { IGalleryAccess } from '../../../main/plus/galleryAccess';
import {
  createScenePackStore,
  type IScenePackStore,
} from '../../../main/scenePackStore';
import { trustScenePackKeyForTesting } from '../../../main/scenePackVerify';
import {
  fakeResponse,
  ME,
  memberPack,
  memberPayload,
  signedEnvelope,
  SOMEONE,
} from '../../utils/memberSceneFixtures';
/* eslint-enable import/first */

const official = generateKeyPairSync('ed25519');
trustScenePackKeyForTesting('save-test', official.publicKey);

const config = {
  supabaseUrl: 'https://project.supabase.co',
  supabaseAnonKey: 'anon',
  apiUrl: 'https://project.supabase.co/functions/v1',
} as IAccountConfig;

const memberEnvelope = (version: number, author = SOMEONE) =>
  signedEnvelope(memberPayload({ author, pack: memberPack({ version }) }));

const officialEnvelope = (version: number) => {
  const bytes = Buffer.from(JSON.stringify(memberPack({ version })));
  return {
    schema: 1 as const,
    algorithm: 'ed25519' as const,
    keyId: 'save-test',
    payload: bytes.toString('base64'),
    signature: sign(null, bytes, official.privateKey).toString('base64'),
  };
};

const keptAt = (author: string, version: number) =>
  `${author}/neon-city/versions/${version}.scene.json`;

let root: string;
let account: string | undefined;
let owned: Set<string>;
let store: IMemberSceneStore;
let officialStore: IScenePackStore;
let announced: number;
let announcedOfficial: number;
let calls: string[];
/** What `scene_version_file` answers, by default the path an owner is told. */
let answerPath: (body: Record<string, unknown>) => unknown;
let rpcStatus: number;
let offline: boolean;
/** What the bucket holds, by object path. */
let bucket: Map<string, unknown>;
let beforeObjectRead: (() => Promise<void>) | undefined;
let dispose: () => void;

const fetchImpl = (async (input: string | URL, init?: RequestInit) => {
  const parsed = new URL(String(input));
  calls.push(parsed.pathname);
  if (offline) {
    throw new TypeError('fetch failed');
  }
  if (parsed.pathname.endsWith('/rpc/scene_version_file')) {
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return fakeResponse(rpcStatus, answerPath(body));
  }
  const object = parsed.pathname.match(/member-scenes\/(.+)$/)?.[1];
  if (object) {
    await beforeObjectRead?.();
    if (init?.signal?.aborted) {
      throw new DOMException('aborted', 'AbortError');
    }
    return bucket.has(object)
      ? fakeResponse(200, bucket.get(object))
      : fakeResponse(400, { error: 'not_found' });
  }
  throw new Error(`unexpected ${parsed.pathname}`);
}) as typeof fetch;

const access: IGalleryAccess = {
  accountId: () => account,
  entitled: () => true,
  owns: (lookId) => owned.has(lookId),
  auth: async () =>
    account
      ? { config, accessToken: `token-${account}`, fetchImpl }
      : undefined,
};

const save = (author: string, version: number, scene = 'neon-city') =>
  (
    handlers.get('plus-gallery-save-version') as (
      ...args: unknown[]
    ) => Promise<TSaveGalleryVersion>
  )({}, author, scene, version);
const cancel = (author: string, version: number) =>
  (
    handlers.get('plus-gallery-save-version-cancel') as (
      ...args: unknown[]
    ) => boolean
  )({}, author, 'neon-city', version);

/**
 * Each case's save after the one before: two asks for one version at once
 * share one save, which is the point of `saving` and not what these test.
 */
const oneByOne = <T>(cases: readonly T[], run: (item: T) => Promise<void>) =>
  cases.reduce<Promise<void>>(
    (before, item) => before.then(() => run(item)),
    Promise.resolve(),
  );

const objectReads = () => calls.filter((call) => call.includes('/storage/'));

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'version-save-'));
  account = ME;
  owned = new Set([
    memberLookId(SOMEONE, 'neon-city'),
    premiumLookId('neon-city'),
  ]);
  store = createMemberSceneStore({ userDataDir: root });
  officialStore = createScenePackStore({ userDataDir: root });
  store.saveImported(memberEnvelope(3));
  officialStore.adopt([
    { id: 'neon-city', version: 3, envelope: officialEnvelope(3) },
  ]);
  announced = 0;
  announcedOfficial = 0;
  calls = [];
  rpcStatus = 200;
  offline = false;
  beforeObjectRead = undefined;
  // The server's own answer: the path, to whoever owns the scene.
  answerPath = (body) =>
    `${String(body.p_author)}/${String(body.p_scene)}/versions/${String(body.p_version)}.scene.json`;
  bucket = new Map<string, unknown>([
    [keptAt(SOMEONE, 1), memberEnvelope(1)],
    [keptAt(FLUIDEQ_CREATOR_ID, 1), officialEnvelope(1)],
  ]);
  dispose = registerGalleryVersionSaveIpc({
    access,
    store,
    officialStore,
    refreshBlocked: async () => undefined,
    announce: () => {
      announced += 1;
    },
    announceOfficial: () => {
      announcedOfficial += 1;
    },
  });
});

afterEach(() => {
  dispose();
  fs.rmSync(root, { recursive: true, force: true });
});

describe('an owner', () => {
  it("saves a member's version among the kept ones, with one ask and one download", async () => {
    await expect(save(SOMEONE, 1)).resolves.toEqual({ ok: true, version: 1 });
    expect(store.keptVersions(SOMEONE, 'neon-city')).toEqual([1]);
    expect(store.newest(SOMEONE, 'neon-city')?.version).toBe(3);
    expect(announced).toBe(1);
    expect(calls).toEqual([
      '/rest/v1/rpc/scene_version_file',
      `/storage/v1/object/authenticated/member-scenes/${keptAt(SOMEONE, 1)}`,
    ]);
  });

  it("saves one of FluidEQ's own the same way, and tells the official looks", async () => {
    await expect(save(FLUIDEQ_CREATOR_ID, 1)).resolves.toEqual({
      ok: true,
      version: 1,
    });
    expect(officialStore.keptVersions('neon-city')).toEqual([1]);
    expect(announcedOfficial).toBe(1);
    expect(announced).toBe(0);
  });

  it('asking twice at once shares one download', async () => {
    const [a, b] = await Promise.all([save(SOMEONE, 1), save(SOMEONE, 1)]);
    expect(a).toEqual({ ok: true, version: 1 });
    expect(b).toEqual(a);
    expect(objectReads()).toHaveLength(1);
  });
});

describe('nobody else downloads a byte', () => {
  it('not an account that does not own the scene, nor one signed out, nor the maker of it', async () => {
    owned.clear();
    await expect(save(SOMEONE, 1)).resolves.toEqual({
      ok: false,
      reason: 'not-owned',
    });
    account = undefined;
    await expect(save(SOMEONE, 1)).resolves.toEqual({
      ok: false,
      reason: 'signed-out',
    });
    // The maker's own scene is their Studio project, with its own history.
    account = SOMEONE;
    owned.add(memberLookId(SOMEONE, 'neon-city'));
    await expect(save(SOMEONE, 1)).resolves.toEqual({
      ok: false,
      reason: 'failed',
    });
    expect(calls).toEqual([]);
  });

  it('not for a scene blocked since the page opened', async () => {
    store.setBlocked([memberSceneFingerprint(SOMEONE, 'neon-city')]);
    await expect(save(SOMEONE, 1)).resolves.toEqual({
      ok: false,
      reason: 'gone',
    });
    expect(calls).toEqual([]);
  });

  it('not when the account changes while the file comes down: nothing is kept for it', async () => {
    beforeObjectRead = async () => {
      account = SOMEONE;
    };
    await expect(save(SOMEONE, 1)).resolves.toEqual({
      ok: false,
      reason: 'not-owned',
    });
    beforeObjectRead = async () => {
      account = undefined;
    };
    account = ME;
    await expect(save(SOMEONE, 1)).resolves.toEqual({
      ok: false,
      reason: 'signed-out',
    });
    expect(store.keptVersions(SOMEONE, 'neon-city')).toEqual([]);
  });
});

describe("the server's answer is held to the version asked", () => {
  it('a version let go, a server before it kept any, or a lapsed sign-in say so', async () => {
    answerPath = () => null;
    await expect(save(SOMEONE, 1)).resolves.toEqual({
      ok: false,
      reason: 'gone',
    });
    rpcStatus = 404;
    await expect(save(SOMEONE, 1)).resolves.toEqual({
      ok: false,
      reason: 'gone',
    });
    rpcStatus = 401;
    await expect(save(SOMEONE, 1)).resolves.toEqual({
      ok: false,
      reason: 'signed-out',
    });
    expect(objectReads()).toEqual([]);
    offline = true;
    await expect(save(SOMEONE, 1)).resolves.toEqual({
      ok: false,
      reason: 'offline',
    });
  });

  it('a path that is not where that version is kept is never read', async () => {
    await oneByOne(
      [
        `${SOMEONE}/neon-city/scene.json`,
        keptAt(SOMEONE, 2),
        `${SOMEONE}/other/versions/1.scene.json`,
        `../${keptAt(SOMEONE, 1)}`,
        42,
      ],
      async (hostile) => {
        answerPath = () => hostile;
        await expect(save(SOMEONE, 1)).resolves.toEqual({
          ok: false,
          reason: 'failed',
        });
      },
    );
    expect(objectReads()).toEqual([]);
  });

  it('a file that is another version, another author or not signed by the member key is not kept', async () => {
    const untrusted = signedEnvelope(
      memberPayload({ pack: memberPack({ version: 1 }) }),
      { trusted: false },
    );
    await oneByOne(
      [
        memberEnvelope(2),
        memberEnvelope(1, ME),
        untrusted,
        officialEnvelope(1),
        'not json',
      ],
      async (file) => {
        bucket.set(keptAt(SOMEONE, 1), file);
        await expect(save(SOMEONE, 1)).resolves.toEqual({
          ok: false,
          reason: 'failed',
        });
      },
    );
    expect(store.keptVersions(SOMEONE, 'neon-city')).toEqual([]);
    expect(announced).toBe(0);
  });
});

describe('cancelling', () => {
  it('stops a save under way, and keeps nothing', async () => {
    beforeObjectRead = async () => {
      expect(cancel(SOMEONE, 1)).toBe(true);
    };
    await expect(save(SOMEONE, 1)).resolves.toEqual({
      ok: false,
      reason: 'cancelled',
    });
    expect(store.keptVersions(SOMEONE, 'neon-city')).toEqual([]);
    // The control: asked again, it saves.
    beforeObjectRead = undefined;
    await expect(save(SOMEONE, 1)).resolves.toEqual({ ok: true, version: 1 });
  });

  it('a cancel with no save under way changes nothing', async () => {
    await expect(save(SOMEONE, 1)).resolves.toEqual({ ok: true, version: 1 });
    expect(cancel(SOMEONE, 1)).toBe(false);
    expect(cancel(SOMEONE, 7)).toBe(false);
    expect(store.keptVersions(SOMEONE, 'neon-city')).toEqual([1]);
  });
});
