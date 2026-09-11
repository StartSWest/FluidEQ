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
import {
  registerPlusPublishingIpc,
  type TPublishOutcome,
} from '../../../main/ipc/plusPublishing';
import { writeStarterProject } from '../../../main/memberScenes/project';
import * as projects from '../../../main/memberScenes/project';
import { readAgreedTerms } from '../../../main/memberScenes/termsAgreement';
import type { IGalleryAccess } from '../../../main/plus/galleryAccess';
import {
  fakeResponse,
  ME,
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

let root: string;
let folder: string | undefined;
let entitled: boolean;
let signedIn: boolean;
/** Who is signed in: a computer can be shared. */
let signedInAs: string;
/** Somebody else signs in while the token is being fetched. */
let switchDuringAuth: boolean;
let duringAuth: (() => void) | undefined;
let duringFetch: (() => void) | undefined;
let answer: Response;
let calls: Array<{ url: string; body: Record<string, unknown> }>;

const fetchImpl = (async (input: string | URL, init?: RequestInit) => {
  calls.push({
    url: String(input),
    body: JSON.parse(String(init?.body ?? '{}')),
  });
  duringFetch?.();
  return answer;
}) as unknown as typeof fetch;

const access = (): IGalleryAccess => ({
  accountId: () => (signedIn ? signedInAs : undefined),
  entitled: () => entitled && signedIn,
  auth: async () => {
    duringAuth?.();
    if (switchDuringAuth) {
      signedInAs = SOMEONE;
    }
    return signedIn ? { config, accessToken: 'token', fetchImpl } : undefined;
  },
});

const userDataDir = () => path.join(root, 'userData');

const setup = (onTermsAgreed?: (version: number) => void) =>
  registerPlusPublishingIpc({
    access: access(),
    userDataDir: userDataDir(),
    activeFolder: () => folder,
    onTermsAgreed,
  });

beforeEach(async () => {
  handlers.clear();
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-publish-ipc-'));
  folder = path.join(root, 'project');
  fs.mkdirSync(folder);
  await writeStarterProject(folder, {
    name: 'My First Scene',
    id: 'my-first-scene',
  });
  entitled = true;
  signedIn = true;
  signedInAs = ME;
  switchDuringAuth = false;
  duringAuth = undefined;
  duringFetch = undefined;
  answer = fakeResponse(200, { published: {} });
  calls = [];
});

afterEach(() => {
  jest.restoreAllMocks();
  fs.rmSync(root, { recursive: true, force: true });
});

describe('publishing from the Studio', () => {
  it('keeps the initiating account across the asynchronous project read', async () => {
    const read = projects.readProject;
    jest
      .spyOn(projects, 'readProject')
      .mockImplementationOnce(async (project) => {
        const build = await read(project);
        signedInAs = SOMEONE;
        return build;
      });
    setup();
    expect(await invoke('studio-publish', 4, 'space', webpBytes())).toEqual({
      ok: false,
      reason: 'signed-out',
    });
    expect(calls).toEqual([]);
  });

  it.each(['project', 'entitlement'])(
    'rechecks %s after acquiring the token',
    async (change) => {
      setup();
      duringAuth = () => {
        if (change === 'project') {
          folder = path.join(root, 'other');
        } else {
          entitled = false;
        }
      };
      expect(await invoke('studio-publish', 4, 'space', webpBytes())).toEqual({
        ok: false,
        reason: change === 'project' ? 'no-build' : 'not-entitled',
      });
      expect(calls).toEqual([]);
    },
  );

  it('records a completed publication for its author without updating the new account', async () => {
    const onTermsAgreed = jest.fn();
    setup(onTermsAgreed);
    duringFetch = () => {
      signedInAs = SOMEONE;
    };
    expect(await invoke('studio-publish', 4, 'space', webpBytes())).toEqual({
      ok: true,
    });
    expect(readAgreedTerms(userDataDir(), ME)).toBe(4);
    expect(readAgreedTerms(userDataDir(), SOMEONE)).toBe(0);
    expect(onTermsAgreed).not.toHaveBeenCalled();
  });
  // The control: the project on disk goes, with the picture, the category and
  // the terms, and the agreement is remembered.
  it('publishes what is on disk, with the picture the page took', async () => {
    setup();
    const outcome = await invoke<Promise<TPublishOutcome>>(
      'studio-publish',
      4,
      'space',
      webpBytes(),
    );
    expect(outcome).toEqual({ ok: true });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe(
      'https://project.supabase.co/functions/v1/publish-member-scene',
    );
    expect(calls[0]?.body).toMatchObject({
      action: 'publish',
      termsVersion: 4,
      category: 'space',
      pack: { id: 'my-first-scene' },
    });
    expect(Buffer.from(String(calls[0]?.body.picture), 'base64')).toEqual(
      Buffer.from(webpBytes()),
    );
    // Remembered for the account that published, and for nobody else here.
    expect(readAgreedTerms(userDataDir(), ME)).toBe(4);
    expect(readAgreedTerms(userDataDir(), SOMEONE)).toBe(0);
  });

  // The server would record the agreement for whoever the token belongs to;
  // with somebody else signed in by the time it arrived, there is no telling
  // which account agreed, so nothing is sent.
  it('publishes nothing when another account signs in while it starts', async () => {
    setup();
    switchDuringAuth = true;
    expect(await invoke('studio-publish', 4, 'space', webpBytes())).toEqual({
      ok: false,
      reason: 'signed-out',
    });
    expect(calls).toEqual([]);
    expect(readAgreedTerms(userDataDir(), ME)).toBe(0);
    expect(readAgreedTerms(userDataDir(), SOMEONE)).toBe(0);
  });

  it('sends nothing without Plus, without a project, or with a category not on the list', async () => {
    setup();
    entitled = false;
    expect(await invoke('studio-publish', 4, 'space', webpBytes())).toEqual({
      ok: false,
      reason: 'not-entitled',
    });
    entitled = true;
    expect(await invoke('studio-publish', 4, 'weapons', webpBytes())).toEqual({
      ok: false,
      reason: 'no-build',
    });
    folder = undefined;
    expect(await invoke('studio-publish', 4, 'space', webpBytes())).toEqual({
      ok: false,
      reason: 'no-build',
    });
    expect(calls).toEqual([]);
  });

  it('refuses a picture that is not a small WebP', async () => {
    setup();
    expect(
      await invoke('studio-publish', 4, 'space', new Uint8Array(64)),
    ).toEqual({ ok: false, reason: 'no-picture' });
    // Over the 512KB a 1280 by 720 picture is allowed.
    expect(
      await invoke('studio-publish', 4, 'space', webpBytes(600 * 1024)),
    ).toEqual({ ok: false, reason: 'no-picture' });
    expect(await invoke('studio-publish', 4, 'space', 'UklGRg==')).toEqual({
      ok: false,
      reason: 'no-picture',
    });
    expect(calls).toEqual([]);
  });

  it('remembers no agreement when the server refused', async () => {
    setup();
    answer = fakeResponse(409, { error: 'terms_outdated' });
    expect(await invoke('studio-publish', 4, 'space', webpBytes())).toEqual({
      ok: false,
      reason: 'terms',
    });
    expect(readAgreedTerms(userDataDir(), ME)).toBe(0);
  });
});

describe('the member’s own published scenes', () => {
  it.each(['plus-gallery-mine', 'plus-gallery-unpublish'])(
    'refuses %s if the account changed during auth',
    async (channel) => {
      setup();
      switchDuringAuth = true;
      expect(await invoke(channel, 'neon-city')).toEqual({
        ok: false,
        reason: 'signed-out',
      });
      expect(calls).toEqual([]);
    },
  );

  it('does not expose an old account list after the response arrives', async () => {
    setup();
    answer = fakeResponse(200, []);
    duringFetch = () => {
      signedInAs = SOMEONE;
    };
    expect(await invoke('plus-gallery-mine')).toEqual({
      ok: false,
      reason: 'signed-out',
    });
  });
  it('are listed and taken down with the account alone, without Plus', async () => {
    setup();
    entitled = false;
    answer = fakeResponse(200, []);
    expect(await invoke('plus-gallery-mine')).toEqual({ ok: true, scenes: [] });
    answer = fakeResponse(200, {});
    expect(await invoke('plus-gallery-unpublish', 'neon-city')).toEqual({
      ok: true,
    });
    expect(calls[1]?.body).toEqual({
      action: 'unpublish',
      sceneId: 'neon-city',
    });
  });

  it('takes down nothing signed out, and no id that is not an id', async () => {
    setup();
    expect(await invoke('plus-gallery-unpublish', '../../x')).toEqual({
      ok: false,
      reason: 'signed-out',
    });
    signedIn = false;
    expect(await invoke('plus-gallery-unpublish', 'neon-city')).toEqual({
      ok: false,
      reason: 'signed-out',
    });
    expect(calls).toEqual([]);
  });

  it('preserves the official namespace for server authorization', async () => {
    setup();
    answer = fakeResponse(200, {});
    expect(await invoke('plus-gallery-unpublish', 'premium:alpine')).toEqual({
      ok: true,
    });
    expect(calls[0]?.body).toEqual({
      action: 'unpublish',
      sceneId: 'premium:alpine',
    });
    expect(await invoke('plus-gallery-unpublish', 'premium:../../x')).toEqual({
      ok: false,
      reason: 'signed-out',
    });
    expect(calls).toHaveLength(1);
  });
});
