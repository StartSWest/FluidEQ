/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * @jest-environment node
 */

const handlers = new Map<string, (...args: unknown[]) => unknown>();
jest.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, fn: (...args: unknown[]) => unknown) =>
      handlers.set(channel, fn),
    removeHandler: (channel: string) => handlers.delete(channel),
  },
  app: {
    whenReady: () =>
      new Promise<never>(() => {
        // Never ready: launch's own ask is left out, and each test asks
        // when it means to.
      }),
  },
}));

/* eslint-disable import/first -- the electron mock must be installed first */
import { createHash } from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import type { IAccountConfig } from '../../../common/accountConfig';
import {
  registerPlusReviewIpc,
  type IPlusReviewRegistration,
  type ISceneReviewState,
} from '../../../main/ipc/plusReview';
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
  return handler({}, ...args) as Promise<T>;
};

const envelope = signedEnvelope(
  memberPayload({ author: SOMEONE, pack: memberPack({ version: 3 }) }),
);
const SHA = createHash('sha256')
  .update(Buffer.from(envelope.payload, 'base64'))
  .digest('hex');

let signedInAs: string | undefined;
let mine: unknown[];
let calls: Array<{ url: string; body: unknown }>;
let sent: ISceneReviewState[];
let userDataDir: string;
let registration: IPlusReviewRegistration;
/** What storage holds, by path: where the server keeps each file. */
let files: Map<string, () => Response>;
/** A submission's file, in the folder its hash names (server migration 0038). */
const waitingFile = (file: string) =>
  `/storage/v1/object/authenticated/member-scenes/${SOMEONE}/neon-city/review/${SHA}/${file}`;

const fetchImpl = (async (input: string | URL, init?: RequestInit) => {
  const url = String(input);
  calls.push({
    url,
    body: init?.body ? JSON.parse(String(init.body)) : undefined,
  });
  if (url.endsWith('/rpc/my_scene_submissions')) {
    return fakeResponse(200, mine);
  }
  const stored = files.get(new URL(url).pathname);
  if (stored) {
    return stored();
  }
  return fakeResponse(404, null);
}) as unknown as typeof fetch;

const access: IGalleryAccess = {
  accountId: () => signedInAs,
  entitled: () => signedInAs !== undefined,
  // Plus owns every scene while it lasts (`sceneOwnership.ts`).
  owns: () => signedInAs !== undefined,
  auth: async () =>
    signedInAs ? { config, accessToken: 'token', fetchImpl } : undefined,
};

const register = () =>
  registerPlusReviewIpc({
    getMainWindow: () =>
      ({
        webContents: {
          send: (_channel: string, state: ISceneReviewState) =>
            sent.push(state),
        },
      }) as unknown as Electron.BrowserWindow,
    userDataDir,
    access,
    onAccountChange: () => () => undefined,
  });

const notice = () => invoke<ISceneReviewState>('scene-review-notice');

beforeEach(() => {
  handlers.clear();
  signedInAs = ME;
  mine = [];
  calls = [];
  sent = [];
  files = new Map([
    [
      waitingFile('scene.json'),
      () => fakeResponse(200, JSON.stringify(envelope)),
    ],
    [
      waitingFile('picture.webp'),
      () => fakeResponse(200, webpBytes(64, 1280, 720)),
    ],
  ]);
  userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-review-'));
  registration = register();
});

afterEach(() => {
  registration.dispose();
  fs.rmSync(userDataDir, { recursive: true, force: true });
});
describe('a maker told what became of their scene', () => {
  it('says it is in the gallery', async () => {
    mine = [
      {
        scene_id: 'lake',
        version: 2,
        category: 'water',
        names: { en: 'Lake' },
        swatch: ['#0a1020', '#ffb347'],
        state: 'approved',
        submitted_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        decided_at: new Date().toISOString(),
        first_version: 2,
      },
    ];
    await registration.refreshIfDue('launch');
    const state = await notice();
    expect(state.notice).toMatchObject({ kind: 'approved', sceneId: 'lake' });
  });
});

describe('the picture that waits', () => {
  it('shows the picture from the folder the hash names, and asks nothing without one', async () => {
    const url = await invoke<string | undefined>(
      'plus-review-picture',
      SOMEONE,
      'neon-city',
      SHA,
    );
    expect(url).toMatch(/^data:image\/webp;base64,/);
    calls = [];
    await expect(
      invoke('plus-review-picture', SOMEONE, 'neon-city', 'not-a-hash'),
    ).resolves.toBeUndefined();
    expect(calls).toHaveLength(0);
  });
});
