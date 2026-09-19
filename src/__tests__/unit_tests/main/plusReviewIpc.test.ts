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
  type TReviewAnswerOutcome,
  type TReviewQueueOutcome,
  type TReviewSceneOutcome,
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

/** A row of `admin_scene_submissions` for the envelope above. */
const queuedRow = {
  author_id: SOMEONE,
  author_name: 'Mei Tanaka',
  author_handle: 'mei',
  scene_id: 'neon-city',
  version: 3,
  category: 'cities',
  names: { en: 'Neon City' },
  swatch: ['#050a1a', '#00e5cf'],
  has_photo: true,
  payload_sha256: SHA,
  submitted_at: '2026-09-18T10:00:00.000Z',
  live_version: 2,
  taken_down: false,
  author_banned: false,
  open_reports: 0,
};

let signedInAs: string | undefined;
let status: Record<string, unknown>;
let queue: unknown[];
let mine: unknown[];
let answer: Response;
let calls: Array<{ url: string; body: unknown }>;
let sent: ISceneReviewState[];
let onGalleryChanged: jest.Mock;
let userDataDir: string;
let registration: IPlusReviewRegistration;
/** What storage holds, by path: where the server keeps each file. */
let files: Map<string, () => Response>;
/** When set, the next read of the queue holds, answering as it began. */
let slowQueue: { gate: Promise<void>; started: () => void } | undefined;

/**
 * Holds the next read of the queue until released. `begun` settles once that
 * read has reached the server, so a test knows which read it is holding.
 */
const holdNextQueueRead = () => {
  let release = () => {};
  let started = () => {};
  const begun = new Promise<void>((resolve) => {
    started = resolve;
  });
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  slowQueue = { gate, started };
  return { begun, release: () => release() };
};

/** A submission's file, in the folder its hash names (server migration 0038). */
const waitingFile = (file: string) =>
  `/storage/v1/object/authenticated/member-scenes/${SOMEONE}/neon-city/review/${SHA}/${file}`;

const fetchImpl = (async (input: string | URL, init?: RequestInit) => {
  const url = String(input);
  calls.push({
    url,
    body: init?.body ? JSON.parse(String(init.body)) : undefined,
  });
  if (url.endsWith('/rpc/moderation_status')) {
    return fakeResponse(200, status);
  }
  if (url.endsWith('/rpc/admin_scene_submissions')) {
    const listed = queue;
    const slow = slowQueue;
    slowQueue = undefined;
    if (slow) {
      slow.started();
      await slow.gate;
    }
    return fakeResponse(200, listed);
  }
  if (url.endsWith('/rpc/my_scene_submissions')) {
    return fakeResponse(200, mine);
  }
  const stored = files.get(new URL(url).pathname);
  if (stored) {
    return stored();
  }
  if (url.endsWith('/review-member-scene')) {
    return answer;
  }
  return fakeResponse(404, null);
}) as unknown as typeof fetch;

const access: IGalleryAccess = {
  accountId: () => signedInAs,
  entitled: () => signedInAs !== undefined,
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
    onGalleryChanged,
    onAccountChange: () => () => undefined,
  });

const notice = () => invoke<ISceneReviewState>('scene-review-notice');

beforeEach(() => {
  handlers.clear();
  signedInAs = ME;
  status = { admin: true, open: 0, review: 1 };
  queue = [queuedRow];
  mine = [];
  answer = fakeResponse(200, { ok: true });
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
  slowQueue = undefined;
  onGalleryChanged = jest.fn(async () => undefined);
  userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-review-'));
  registration = register();
});

afterEach(() => {
  registration.dispose();
  fs.rmSync(userDataDir, { recursive: true, force: true });
});

describe('the admin told scenes wait', () => {
  it('names the waiting scene once, and not again once the queue is opened', async () => {
    await registration.refreshIfDue('launch');
    expect(await notice()).toMatchObject({
      accountId: ME,
      waiting: 1,
      notice: { kind: 'waiting', count: 1 },
    });
    expect(sent[sent.length - 1]?.notice).toMatchObject({ kind: 'waiting' });

    const opened = await invoke<TReviewQueueOutcome>('plus-review-queue');
    expect(opened.ok && opened.items.map((item) => item.sha256)).toEqual([SHA]);
    expect((await notice()).notice).toBeNull();

    // Remembered on disk, so the next launch is quiet about it too.
    registration.dispose();
    registration = register();
    await registration.refreshIfDue('launch');
    expect((await notice()).notice).toBeNull();
  });

  it('puts away only what the notice it sent was about', async () => {
    await registration.refreshIfDue('launch');
    const shown = (await notice()).notice;
    await invoke('scene-review-notice-seen', ['waiting:somebody-else']);
    expect((await notice()).notice).toEqual(shown);
    await invoke('scene-review-notice-seen', shown?.keys);
    expect((await notice()).notice).toBeNull();
  });

  it('asks again only when a minute has gone by, however many events arrive', async () => {
    await registration.refreshIfDue('launch');
    const asked = calls.length;
    expect(asked).toBeGreaterThan(0);
    await registration.refreshIfDue('focus');
    await registration.refreshIfDue('unlock');
    expect(calls).toHaveLength(asked);
  });

  it('shows nothing of one account to the next one signed in', async () => {
    await registration.refreshIfDue('launch');
    signedInAs = SOMEONE;
    expect(await notice()).toEqual({ notice: null });
  });

  // A read begun before an answer finished after it and put the answered
  // scene back, with the badge counting it, for a minute or more.
  it('never lets a slow read put back a queue opened since', async () => {
    const held = holdNextQueueRead();
    const slow = registration.refreshIfDue('launch');
    await held.begun;
    // The admin answers and opens the queue again while that read is out.
    queue = [];
    status = { admin: true, open: 0, review: 0 };
    const opened = await invoke<TReviewQueueOutcome>('plus-review-queue');
    expect(opened.ok && opened.items).toEqual([]);
    held.release();
    await slow;
    expect(await notice()).toMatchObject({ notice: null, waiting: 0 });
  });

  it('follows an answer with a read of its own, not one already under way', async () => {
    const held = holdNextQueueRead();
    const slow = registration.refreshIfDue('launch');
    await held.begun;
    await invoke('plus-review-answer', SOMEONE, 'neon-city', 3, SHA, {
      action: 'approve',
    });
    // What the server holds once the answer is in.
    queue = [];
    status = { admin: true, open: 0, review: 0 };
    held.release();
    await slow;
    // Within the minute: joins the read the answer queued, and waits for it.
    await registration.refreshIfDue('focus');
    expect(await notice()).toMatchObject({ notice: null, waiting: 0 });
    expect(
      calls.filter((call) => call.url.endsWith('/rpc/moderation_status')),
    ).toHaveLength(2);
  });
});

describe('a maker told what became of their scene', () => {
  it('says it is in the gallery', async () => {
    status = { admin: false, open: 0, review: 0 };
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
    // A member is never read the admin's queue, nor told its length.
    expect(state).not.toHaveProperty('waiting');
    expect(
      calls.some((call) => call.url.endsWith('/rpc/admin_scene_submissions')),
    ).toBe(false);
  });
});

describe('watching a scene that waits', () => {
  it('opens the bytes the queue named, through the member door', async () => {
    const outcome = await invoke<TReviewSceneOutcome>(
      'plus-review-scene',
      SOMEONE,
      'neon-city',
      SHA,
    );
    expect(outcome.ok && outcome.pack.version).toBe(3);
  });

  it('refuses bytes other than the ones the queue named', async () => {
    await expect(
      invoke<TReviewSceneOutcome>(
        'plus-review-scene',
        SOMEONE,
        'neon-city',
        'f'.repeat(64),
      ),
    ).resolves.toEqual({ ok: false, reason: 'changed' });
  });

  it('refuses a file that says it is somebody else’s scene', async () => {
    files.set(
      `/storage/v1/object/authenticated/member-scenes/${ME}/neon-city/review/${SHA}/scene.json`,
      () => fakeResponse(200, JSON.stringify(envelope)),
    );
    await expect(
      invoke<TReviewSceneOutcome>('plus-review-scene', ME, 'neon-city', SHA),
    ).resolves.toEqual({ ok: false, reason: 'server' });
  });

  it('reads a folder no longer there as a submission no longer waiting', async () => {
    files.delete(waitingFile('scene.json'));
    await expect(
      invoke<TReviewSceneOutcome>(
        'plus-review-scene',
        SOMEONE,
        'neon-city',
        SHA,
      ),
    ).resolves.toEqual({ ok: false, reason: 'changed' });
  });

  // It used to say "its maker sent a newer version" for a dropped connection.
  it.each([
    ['a server that fails', () => fakeResponse(503, {}), 'server'],
    [
      'a connection that drops',
      () => {
        throw new Error('socket hang up');
      },
      'offline',
    ],
  ])('calls %s what it is', async (_label, reply, reason) => {
    files.set(waitingFile('scene.json'), reply);
    await expect(
      invoke<TReviewSceneOutcome>(
        'plus-review-scene',
        SOMEONE,
        'neon-city',
        SHA,
      ),
    ).resolves.toEqual({ ok: false, reason });
  });

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

  it.each([
    ['an author that is not an id', ['mei', 'neon-city', SHA]],
    ['a scene id that is a path', [SOMEONE, '../../etc', SHA]],
    ['bytes it cannot name', [SOMEONE, 'neon-city', 'abc']],
  ])('asks nothing for %s', async (_label, args) => {
    await expect(
      invoke<TReviewSceneOutcome>('plus-review-scene', ...args),
    ).resolves.toEqual({ ok: false, reason: 'server' });
    expect(calls).toHaveLength(0);
  });
});

describe('the answer', () => {
  it('approves the version and the bytes watched, then asks the gallery again', async () => {
    await expect(
      invoke<TReviewAnswerOutcome>(
        'plus-review-answer',
        SOMEONE,
        'neon-city',
        3,
        SHA,
        { action: 'approve' },
      ),
    ).resolves.toEqual({ ok: true });
    const sentAnswer = calls.find((call) =>
      call.url.endsWith('/review-member-scene'),
    );
    expect(sentAnswer).toEqual({
      url: 'https://project.supabase.co/functions/v1/review-member-scene',
      body: {
        action: 'approve',
        authorId: SOMEONE,
        sceneId: 'neon-city',
        version: 3,
        sha256: SHA,
      },
    });
    expect(onGalleryChanged).toHaveBeenCalledTimes(1);
  });

  it('sends a refusal with its reason and line, and leaves the gallery be', async () => {
    await invoke('plus-review-answer', SOMEONE, 'neon-city', 3, SHA, {
      action: 'reject',
      reason: 'flashing',
      note: 'The white flash at the drop',
    });
    expect(
      calls.find((call) => call.url.endsWith('/review-member-scene'))?.body,
    ).toMatchObject({
      action: 'reject',
      reason: 'flashing',
      note: 'The white flash at the drop',
    });
    expect(onGalleryChanged).not.toHaveBeenCalled();
  });

  it.each([
    [409, 'changed_since', 'changed'],
    [409, 'not_waiting', 'changed'],
    [409, 'version_not_raised', 'version-not-raised'],
    [409, 'taken_down', 'taken-down'],
    [409, 'deleted', 'deleted'],
    // Half an answer: approved, its files not yet in the gallery.
    [502, 'files_failed', 'files-failed'],
    // A word nobody taught this side is still a scene that moved on.
    [409, 'constructor', 'changed'],
  ])('says %s %s as %s', async (code, word, reason) => {
    answer = fakeResponse(code, { error: word });
    await expect(
      invoke<TReviewAnswerOutcome>(
        'plus-review-answer',
        SOMEONE,
        'neon-city',
        3,
        SHA,
        { action: 'approve' },
      ),
    ).resolves.toEqual({ ok: false, reason });
    expect(onGalleryChanged).not.toHaveBeenCalled();
  });

  it.each([
    ['a version that is not a whole number', [3.5, SHA, { action: 'approve' }]],
    ['no version', [0, SHA, { action: 'approve' }]],
    ['bytes it cannot name', [3, 'abc', { action: 'approve' }]],
    [
      'a reason it does not know',
      [3, SHA, { action: 'reject', reason: 'ugly' }],
    ],
    ['an answer it does not know', [3, SHA, { action: 'delete' }]],
  ])('asks nothing for %s', async (_label, args) => {
    await expect(
      invoke<TReviewAnswerOutcome>(
        'plus-review-answer',
        SOMEONE,
        'neon-city',
        ...args,
      ),
    ).resolves.toEqual({ ok: false, reason: 'server' });
    expect(calls).toHaveLength(0);
  });
});
