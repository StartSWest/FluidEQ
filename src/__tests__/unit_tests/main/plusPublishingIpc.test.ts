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
import { createHash, randomUUID } from 'crypto';

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
import { MAX_VERSION_NOTE } from '../../../common/sceneVersionNote';
import { MAX_PUBLISH_BYTES } from '../../../common/scenePackSize';
import {
  registerPlusPublishingIpc,
  type TPublishedSettingsOutcome,
  type TPublishOutcome,
} from '../../../main/ipc/plusPublishing';
import { writeStarterProject } from '../../../main/memberScenes/project';
import * as projects from '../../../main/memberScenes/project';
import { previewPackSha256 } from '../../../main/plus/scenePreviewApi';
import type { IScenePreviewUpload } from '../../../common/scenePreviewMedia';
import { writeProjectSettings } from '../../../main/memberScenes/projectSettings';
import { readAgreedTerms } from '../../../main/memberScenes/termsAgreement';
import type { IGalleryAccess } from '../../../main/plus/galleryAccess';
import {
  fakeResponse,
  ME,
  daylightControl,
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
  return handler(
    { sender: { id: 1, isDestroyed: () => false, send: jest.fn() } },
    ...args,
  ) as T;
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
let previewAnswer:
  ((url: URL, init?: RequestInit) => Promise<Response>) | undefined;
/** One reply for every request, or one chosen by the URL asked for. */
let answer: Response | ((url: string) => Response);
/**
 * How the account's version floors are answered (server migration 0039):
 * none, unless a test says otherwise. Asked beside the published list.
 */
let floorsAnswer: () => Response;
let calls: Array<{ url: string; body: Record<string, unknown> }>;

const fetchImpl = (async (input: string | URL, init?: RequestInit) => {
  if (String(input).endsWith('/rpc/published_scene_file')) {
    return fakeResponse(404, {});
  }
  calls.push({
    url: String(input),
    body:
      typeof init?.body === 'string'
        ? JSON.parse(init.body)
        : { bytes: init?.body },
  });
  duringFetch?.();
  if (String(input).includes('/scene-preview-media') && previewAnswer) {
    return previewAnswer(new URL(input), init);
  }
  if (String(input).includes('/rpc/my_scene_version_floors')) {
    return floorsAnswer();
  }
  return typeof answer === 'function' ? answer(String(input)) : answer;
}) as unknown as typeof fetch;

let listAuthorization: IGalleryAccess['authorize'];
const access = (): IGalleryAccess => ({
  accountId: () => (signedIn ? signedInAs : undefined),
  entitled: () => entitled && signedIn,
  // Plus owns every scene while it lasts (`sceneOwnership.ts`).
  owns: () => entitled && signedIn,
  authorize: listAuthorization,
  auth: async () => {
    duringAuth?.();
    if (switchDuringAuth) {
      signedInAs = SOMEONE;
    }
    return signedIn ? { config, accessToken: 'token', fetchImpl } : undefined;
  },
});

const userDataDir = () => path.join(root, 'userData');

/**
 * The publish request itself, whichever position it landed in: publishing
 * first asks the gallery what this account already has, so it can send a
 * version above it, and that read is a call too.
 */
const publishRequest = () =>
  calls.find((call) => call.url.includes('/publish-member-scene'));

/** Publications sent, to say that exactly one went out. */
const publishRequests = () =>
  calls.filter((call) => call.url.includes('/publish-member-scene'));

/**
 * The gallery lists nothing for this account; the publication itself is
 * answered with `refusal`. Refusing every request instead would refuse the
 * listing publishing reads first, and the test would be proving that.
 */
const publishRefusedWith = (refusal: () => Response) => {
  answer = (url: string) =>
    url.includes('/rpc/my_published_scenes')
      ? fakeResponse(200, [])
      : refusal();
};

/** The open project is a FluidEQ scene, opened only to look inside. */
let inspecting: boolean;

const recordPublished = jest.fn();

const setup = (
  onTermsAgreed?: (version: number) => void,
  more: Pick<
    Parameters<typeof registerPlusPublishingIpc>[0],
    'logger' | 'refreshOwnCopy'
  > = {},
) =>
  registerPlusPublishingIpc({
    access: access(),
    userDataDir: userDataDir(),
    activeFolder: () => folder,
    activeIsInspection: () => inspecting,
    // The Studio is any signed-in account's (`projectAccess.ts`).
    mayPublishActive: () => signedIn,
    onTermsAgreed,
    recordPublished,
    ...more,
  });

beforeEach(async () => {
  handlers.clear();
  recordPublished.mockClear();
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-publish-ipc-'));
  folder = path.join(root, 'project');
  fs.mkdirSync(folder);
  await writeStarterProject(folder, {
    name: 'My First Scene',
    id: 'my-first-scene',
  });
  entitled = true;
  signedIn = true;
  listAuthorization = undefined;
  signedInAs = ME;
  switchDuringAuth = false;
  duringAuth = undefined;
  duringFetch = undefined;
  previewAnswer = undefined;
  // Publishing reads this account's gallery listing before it sends, so the
  // version goes out above the one already there. Nothing published, unless a
  // test says otherwise.
  answer = (url: string) =>
    url.includes('/rpc/my_published_scenes')
      ? fakeResponse(200, [])
      : fakeResponse(200, { published: {} });
  floorsAnswer = () => fakeResponse(200, []);
  calls = [];
  inspecting = false;
});

afterEach(() => {
  jest.restoreAllMocks();
  fs.rmSync(root, { recursive: true, force: true });
});

describe('the recorded scene publication', () => {
  const clip = new Uint8Array(
    fs.readFileSync(path.join(__dirname, '../../utils/preview-fixture.webm')),
  );
  let receiptId: string;
  const previewOf = async (): Promise<IScenePreviewUpload> => {
    if (!folder) {
      throw new Error('Missing test project');
    }
    const build = await projects.readProject(folder);
    if (!build.ok) {
      throw new Error('Invalid test project');
    }
    return {
      bytes: clip,
      operationId: randomUUID(),
      sceneId: build.pack.id,
      sourceVersion: build.pack.version,
      version: build.pack.version,
      packSha256: previewPackSha256(build.pack),
    };
  };
  const uploaded = (url: URL) => {
    receiptId = url.searchParams.get('uploadId') ?? '';
    return fakeResponse(200, {
      uploadId: receiptId,
      mediaSha256: createHash('sha256').update(clip).digest('hex'),
    });
  };
  const serving = () => {
    previewAnswer = async (url, init) =>
      init?.method === 'DELETE' ? fakeResponse(200, {}) : uploaded(url);
    answer = (url) =>
      url.includes('/rpc/')
        ? fakeResponse(200, [])
        : fakeResponse(200, { published: {}, previewUploadId: receiptId });
  };
  const send = (preview: IScenePreviewUpload) =>
    invoke<Promise<TPublishOutcome>>(
      'studio-publish',
      5,
      'nature',
      webpBytes(),
      undefined,
      undefined,
      preview,
    );

  it('uploads bounded native video separately, then binds only its receipt to the exact pack', async () => {
    setup();
    serving();
    const preview = await previewOf();
    expect(await send(preview)).toEqual({ ok: true });
    const upload = calls.find((call) =>
      call.url.includes('/scene-preview-media'),
    );
    expect(upload?.body.bytes).toEqual(clip);
    expect(publishRequest()?.body).toMatchObject({
      previewUploadId: receiptId,
      pack: { id: preview.sceneId, version: preview.version },
    });
    expect(JSON.stringify(publishRequest()?.body)).not.toContain('data:video');
    expect(
      calls.filter((call) => call.url.includes('/scene-preview-media')),
    ).toHaveLength(1);
  });

  it('refuses a stale identity or malformed video before uploading or publishing', async () => {
    setup();
    serving();
    const preview = await previewOf();
    expect(await send({ ...preview, packSha256: 'f'.repeat(64) })).toEqual({
      ok: false,
      reason: 'preview-stale',
    });
    expect(
      await send({ ...preview, bytes: new Uint8Array([1, 2, 3]) }),
    ).toEqual({ ok: false, reason: 'preview-invalid' });
    expect(publishRequests()).toEqual([]);
    expect(
      calls.filter(
        (call) => call.url.includes('/scene-preview-media') && call.body.bytes,
      ),
    ).toEqual([]);
  });

  it('refuses double submit; cancel revokes a held upload immediately and never publishes it; retry succeeds', async () => {
    setup();
    serving();
    const preview = await previewOf();
    let enter: () => void = () => undefined;
    let release: () => void = () => undefined;
    const entered = new Promise<void>((resolve) => {
      enter = resolve;
    });
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    previewAnswer = async (url, init) => {
      if (init?.method === 'DELETE') {
        return fakeResponse(200, {});
      }
      enter();
      await gate;
      return uploaded(url);
    };
    const pending = send(preview);
    await entered;
    expect(await send(preview)).toEqual({ ok: false, reason: 'refused' });
    expect(invoke('studio-publish-cancel', randomUUID())).toBe(false);
    expect(invoke('studio-publish-cancel', preview.operationId)).toBe(true);
    expect(
      calls.filter((call) => call.url.includes('/scene-preview-media')),
    ).toHaveLength(2);
    release();
    expect(await pending).toEqual({ ok: false, reason: 'cancelled' });
    expect(publishRequests()).toEqual([]);
    serving();
    expect(await send(await previewOf())).toEqual({ ok: true });
    expect(publishRequests()).toHaveLength(1);
  });

  it('rechecks source after upload and discards only its unused receipt when an edit landed', async () => {
    setup();
    serving();
    const preview = await previewOf();
    previewAnswer = async (url, init) => {
      if (init?.method === 'DELETE') {
        return fakeResponse(200, {});
      }
      if (!folder) {
        throw new Error('Missing project');
      }
      fs.appendFileSync(
        path.join(folder, 'scene.frag'),
        '\nfloat previewRevision = 0.5;\n',
      );
      return uploaded(url);
    };
    expect(await send(preview)).toEqual({ ok: false, reason: 'preview-stale' });
    expect(publishRequests()).toEqual([]);
    expect(
      calls.filter((call) => call.url.includes('/scene-preview-media')),
    ).toHaveLength(2);
  });

  it('retains the chosen cover and retries an accepted file copy using the identical publication body', async () => {
    setup();
    serving();
    const preview = await previewOf();
    let attempt = 0;
    answer = (url) => {
      if (url.includes('/rpc/')) {
        return fakeResponse(200, []);
      }
      expect(invoke('studio-publish-cancel', preview.operationId)).toBe(false);
      attempt += 1;
      return attempt === 1
        ? fakeResponse(502, { error: 'files_failed', accepted: true })
        : fakeResponse(200, { published: {}, previewUploadId: receiptId });
    };
    expect(await send(preview)).toEqual({ ok: true });
    expect(publishRequests()).toHaveLength(2);
    expect(publishRequests()[1].body).toEqual(publishRequests()[0].body);
    expect(publishRequest()?.body.picture).toBe(
      Buffer.from(webpBytes()).toString('base64'),
    );
  });
});

describe('the account publication list', () => {
  it.each(['offline', 'signed-out', 'forbidden', 'server'] as const)(
    'preserves a %s authorization failure before reading publications or version floors',
    async (reason) => {
      listAuthorization = async () => ({ ok: false, reason });
      setup();
      expect(await invoke('plus-gallery-mine')).toEqual({ ok: false, reason });
      expect(calls).toEqual([]);
    },
  );
});

describe('what the open project was published as', () => {
  /** The gallery's list of my scenes, then my scene's own signed file. */
  const serving = (scenes: unknown[], pack?: ReturnType<typeof memberPack>) => {
    answer = (url: string) => {
      if (url.includes('/object/')) {
        return fakeResponse(
          200,
          pack ? signedEnvelope(memberPayload({ author: ME, pack })) : {},
        );
      }
      return fakeResponse(200, scenes);
    };
  };

  const listed = (over: Record<string, unknown> = {}) => ({
    scene_id: 'my-first-scene',
    version: 5,
    category: 'space',
    names: { en: 'My First Scene' },
    swatch: ['#112233', '#445566'],
    likes: 0,
    adds: 0,
    published_at: '2026-09-01T00:00:00+00:00',
    updated_at: '2026-09-02T00:00:00+00:00',
    blocked: false,
    ...over,
  });

  it('answers with the settings the published version carries', async () => {
    serving(
      [listed()],
      memberPack({
        id: 'my-first-scene',
        version: 5,
        params: [
          { id: 'glow', names: { en: 'Glow' }, min: 0, max: 1, value: 0.2 },
        ],
      }),
    );
    setup();
    const outcome = await invoke<Promise<TPublishedSettingsOutcome>>(
      'studio-published-settings',
    );
    expect(outcome).toEqual({
      ok: true,
      published: {
        version: 5,
        settings: { params: { glow: 0.2 }, ambient: {} },
      },
    });
  });

  it('says a scene that has never been published, which is not a failure', async () => {
    serving([]);
    setup();
    expect(
      await invoke<Promise<TPublishedSettingsOutcome>>(
        'studio-published-settings',
      ),
    ).toEqual({ ok: true });
  });

  it('asks nothing for a FluidEQ scene opened to look inside, or signed out', async () => {
    inspecting = true;
    setup();
    expect(
      await invoke<Promise<TPublishedSettingsOutcome>>(
        'studio-published-settings',
      ),
    ).toEqual({ ok: false });
    expect(calls).toHaveLength(0);

    inspecting = false;
    signedIn = false;
    expect(
      await invoke<Promise<TPublishedSettingsOutcome>>(
        'studio-published-settings',
      ),
    ).toEqual({ ok: false });
    expect(calls).toHaveLength(0);
  });

  it('refuses a file whose signature does not verify', async () => {
    answer = (url: string) =>
      url.includes('/object/')
        ? fakeResponse(200, { schema: 1, payload: 'nope' })
        : fakeResponse(200, [listed()]);
    setup();
    // Not "never published": the Studio must not quietly reset to the scene
    // as though the published one had no settings.
    expect(
      await invoke<Promise<TPublishedSettingsOutcome>>(
        'studio-published-settings',
      ),
    ).toEqual({ ok: false });
  });
});

describe('publishing from the Studio', () => {
  it('publishes the last settings even when publishing starts before their save finishes', async () => {
    const project = folder as string;
    const manifestFile = path.join(project, 'pack.json');
    const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
    manifest.params = [
      daylightControl(),
      { id: 'speed', names: { en: 'Speed' }, min: 0, max: 5, value: 1 },
    ];
    fs.writeFileSync(manifestFile, JSON.stringify(manifest));
    setup();
    const response = {
      sensitivity: 1.5,
      threshold: 0.2,
      attack: 40,
      release: 100,
    };
    const saving = writeProjectSettings(project, {
      params: { speed: 3 },
      response,
    });
    const publishing = invoke<Promise<TPublishOutcome>>(
      'studio-publish',
      5,
      'space',
      webpBytes(),
    );
    await expect(publishing).resolves.toEqual({ ok: true });
    await expect(saving).resolves.toBe('written');
    expect(publishRequest()?.body.pack).toMatchObject({
      response,
      params: [{ id: 'daylight' }, { id: 'speed', value: 3 }],
    });
    expect(publishRequest()?.body.pack).not.toHaveProperty('signal');
  });

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

  it('refuses a scene past the publishing limit before sending anything', async () => {
    const read = projects.readProject;
    jest
      .spyOn(projects, 'readProject')
      .mockImplementationOnce(async (project) => {
        const build = await read(project);
        return build.ok
          ? {
              ...build,
              // Code alone past the limit: what is measured is the whole.
              pack: {
                ...build.pack,
                source: 'x'.repeat(MAX_PUBLISH_BYTES + 1),
              },
            }
          : build;
      });
    setup();
    expect(await invoke('studio-publish', 4, 'space', webpBytes())).toEqual({
      ok: false,
      reason: 'too-large',
    });
    expect(calls).toEqual([]);
    // Nothing went out: nothing is recorded as published.
    expect(recordPublished).not.toHaveBeenCalled();
  });

  it('rechecks the project after acquiring the token', async () => {
    setup();
    duringAuth = () => {
      folder = path.join(root, 'other');
    };
    expect(await invoke('studio-publish', 4, 'space', webpBytes())).toEqual({
      ok: false,
      reason: 'no-build',
    });
    expect(calls).toEqual([]);
  });

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
    expect(publishRequests()).toHaveLength(1);
    expect(publishRequest()?.url).toBe(
      'https://project.supabase.co/functions/v1/publish-member-scene',
    );
    expect(publishRequest()?.body).toMatchObject({
      action: 'publish',
      termsVersion: 4,
      category: 'space',
      pack: { id: 'my-first-scene' },
    });
    expect(
      Buffer.from(String(publishRequest()?.body.picture), 'base64'),
    ).toEqual(Buffer.from(webpBytes()));
    // Remembered for the account that published, and for nobody else here.
    expect(readAgreedTerms(userDataDir(), ME)).toBe(4);
    expect(readAgreedTerms(userDataDir(), SOMEONE)).toBe(0);
    // What the folder holds is what went out, under the version it went at.
    expect(recordPublished).toHaveBeenCalledWith(
      folder,
      'my-first-scene',
      (publishRequest()?.body.pack as { version: number }).version,
    );
  });

  it('logs where the time went, the server’s steps beside its own, and fetches its own copy at once', async () => {
    // Ivan, 2026-11-08: "add logs to that too and server timings"; his own
    // copy of Alpine v69 came 82 s after it went out.
    const info = jest.fn();
    const refreshOwnCopy = jest.fn(async () => true);
    answer = (url: string) => {
      if (url.includes('/rpc/my_published_scenes')) {
        return fakeResponse(200, []);
      }
      const response = fakeResponse(200, { published: {} });
      // The server's own steps ride its answer (fluideq-premium steptiming).
      return url.includes('/publish-member-scene')
        ? ({
            ...response,
            headers: {
              get: (name: string) =>
                name === 'server-timing'
                  ? 'auth;dur=120, sign;dur=40, total;dur=200'
                  : null,
            },
          } as unknown as Response)
        : response;
    };
    setup(undefined, { logger: { info, warn: jest.fn() }, refreshOwnCopy });
    const outcome = await invoke<Promise<TPublishOutcome>>(
      'studio-publish',
      4,
      'space',
      webpBytes(),
    );
    expect(outcome).toEqual({ ok: true });
    const { version } = publishRequest()?.body.pack as { version: number };
    const lines = info.mock.calls.map(([logged]) => String(logged));
    const line =
      lines.find((logged) =>
        logged.endsWith(
          'Server - publish-member-scene: auth 120 ms, sign 40 ms, total 200 ms.',
        ),
      ) ?? lines.join('\n');
    expect(line).toMatch(
      new RegExp(
        `^Studio publish my-first-scene v${version} \\(.+\\): read \\d+ ms, versions \\d+ ms, raise \\d+ ms, publish \\d+ ms, keep \\d+ ms; total .+; published\\. Server - publish-member-scene: auth 120 ms, sign 40 ms, total 200 ms\\.$`,
      ),
    );
    expect(refreshOwnCopy).toHaveBeenCalledWith('my-first-scene', version);
    // Its own line: the publication was answered without waiting for it.
    expect(info).toHaveBeenCalledWith(
      expect.stringMatching(
        new RegExp(
          `^Studio publish my-first-scene v${version}: own copy \\d+ ms; total .+; this computer holds it\\.$`,
        ),
      ),
    );
  });

  it('fetches no copy of a version still waiting for review, and logs how it ended', async () => {
    const info = jest.fn();
    const refreshOwnCopy = jest.fn(async () => true);
    answer = (url: string) =>
      url.includes('/rpc/my_published_scenes')
        ? fakeResponse(200, [])
        : fakeResponse(200, { review: 'pending' });
    setup(undefined, { logger: { info, warn: jest.fn() }, refreshOwnCopy });
    const outcome = await invoke<Promise<TPublishOutcome>>(
      'studio-publish',
      4,
      'space',
      webpBytes(),
    );
    expect(outcome).toEqual({ ok: true, review: 'pending' });
    expect(refreshOwnCopy).not.toHaveBeenCalled();
    expect(info).toHaveBeenCalledWith(
      expect.stringMatching(/; sent for review\.$/),
    );
  });

  it('sends what the maker wrote about this version, as one clean line', async () => {
    setup();
    expect(
      await invoke(
        'studio-publish',
        4,
        'space',
        webpBytes(),
        undefined,
        '  The peaks stay whole\n on wide panels ',
      ),
    ).toEqual({ ok: true });
    expect(publishRequest()?.body.note).toBe(
      'The peaks stay whole on wide panels',
    );
  });

  it('refuses a note it could not keep, before sending anything', async () => {
    setup();
    expect(
      await invoke(
        'studio-publish',
        4,
        'space',
        webpBytes(),
        undefined,
        'x'.repeat(MAX_VERSION_NOTE + 1),
      ),
    ).toEqual({ ok: false, reason: 'refused' });
    expect(calls).toEqual([]);
    // The control: no note at all publishes, and sends none.
    expect(await invoke('studio-publish', 4, 'space', webpBytes())).toEqual({
      ok: true,
    });
    expect(publishRequest()?.body).not.toHaveProperty('note');
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

  it('publishes under a second category, and sends nothing with one that repeats the first or is not on the list', async () => {
    setup();
    expect(
      await invoke('studio-publish', 4, 'cities', webpBytes(), 'water'),
    ).toEqual({ ok: true });
    expect(publishRequest()?.body).toMatchObject({
      category: 'cities',
      category2: 'water',
    });
    calls = [];
    const refused = await Promise.all(
      ['cities', 'weapons', 7].map((second) =>
        invoke('studio-publish', 4, 'cities', webpBytes(), second),
      ),
    );
    expect(refused).toEqual(Array(3).fill({ ok: false, reason: 'no-build' }));
    expect(calls).toEqual([]);
  });

  it('sends nothing without a project, or with a category not on the list', async () => {
    setup();
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

  it('publishes for a signed-in account without Plus', async () => {
    // The Studio and publishing are free (Ivan, 2026-10-18); what is sold
    // is a scene, and its maker sees it once it is published.
    setup();
    entitled = false;
    expect(await invoke('studio-publish', 4, 'space', webpBytes())).toEqual({
      ok: true,
    });
    expect(publishRequests()).toHaveLength(1);
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
    publishRefusedWith(() => fakeResponse(409, { error: 'terms_outdated' }));
    expect(await invoke('studio-publish', 4, 'space', webpBytes())).toEqual({
      ok: false,
      reason: 'terms',
    });
    expect(readAgreedTerms(userDataDir(), ME)).toBe(0);
  });

  /**
   * A scene's content may only change under a higher version, so every
   * publication goes out above the one the gallery holds — and the number is
   * written back into the project, or the maker's next build is one behind
   * and the server refuses it with nothing they can do about it.
   */
  describe('the version a publication carries', () => {
    /** The gallery holds this scene at `version`; publishing is answered ok. */
    const galleryHolds = (version: number | undefined) => {
      answer = (url: string) =>
        url.includes('/rpc/my_published_scenes')
          ? fakeResponse(
              200,
              version === undefined
                ? []
                : [
                    {
                      scene_id: 'my-first-scene',
                      version,
                      category: 'space',
                      names: { en: 'My First Scene' },
                      swatch: ['#112233', '#445566'],
                      likes: 0,
                      adds: 0,
                      published_at: '2026-09-01T00:00:00+00:00',
                      updated_at: '2026-09-02T00:00:00+00:00',
                      blocked: false,
                    },
                  ],
            )
          : fakeResponse(200, { published: {} });
    };

    const manifestPath = () => path.join(String(folder), 'pack.json');

    /** The version in `pack.json` on disk now. */
    const onDisk = () =>
      (
        JSON.parse(fs.readFileSync(manifestPath(), 'utf8')) as {
          version: number;
        }
      ).version;

    /** A maker who has taken their project past the gallery by hand. */
    const projectAt = (version: number) => {
      const manifest: unknown = JSON.parse(
        fs.readFileSync(manifestPath(), 'utf8'),
      );
      fs.writeFileSync(
        manifestPath(),
        JSON.stringify({ ...(manifest as object), version }, null, 2),
      );
    };

    it('clears the one in the gallery when the project has not caught up', async () => {
      // The silent swap, from the publishing end: the starter project is at
      // version 1 and the gallery is at 5, so sending 1 — or 5 — would be
      // content changing under a number listeners already hold.
      galleryHolds(5);
      setup();
      expect(await invoke('studio-publish', 5, 'space', webpBytes())).toEqual({
        ok: true,
      });
      expect(publishRequest()?.body.pack).toMatchObject({ version: 6 });
      expect(onDisk()).toBe(6);
    });

    it('is the project’s own when it is already past the gallery', async () => {
      galleryHolds(2);
      projectAt(40);
      setup();
      expect(await invoke('studio-publish', 5, 'space', webpBytes())).toEqual({
        ok: true,
      });
      expect(publishRequest()?.body.pack).toMatchObject({ version: 40 });
      expect(onDisk()).toBe(40);
    });

    it('is left alone for a scene that has never been published', async () => {
      galleryHolds(undefined);
      setup();
      expect(await invoke('studio-publish', 5, 'space', webpBytes())).toEqual({
        ok: true,
      });
      expect(publishRequest()?.body.pack).toMatchObject({ version: 1 });
      expect(onDisk()).toBe(1);
    });

    /**
     * The same scene, listed as one of FluidEQ's own.
     *
     * An account granted official publishing has its scenes in that half of
     * the maker's list and a member half that is empty, so a lookup written
     * to skip official rows was told nothing was published at all. Every
     * republication then went out under the number already on the shelf — and
     * an official scene is only taken by a listener when its version is
     * strictly greater, so the press reported success, the number never moved
     * and no machine ever changed.
     */
    const galleryHoldsOfficial = (version: number, andMember?: number) => {
      const row = (at: number, official: boolean) => ({
        scene_id: 'my-first-scene',
        version: at,
        category: 'space',
        names: { en: 'My First Scene' },
        swatch: ['#112233', '#445566'],
        likes: 0,
        adds: 0,
        published_at: '2026-09-01T00:00:00+00:00',
        updated_at: '2026-09-02T00:00:00+00:00',
        blocked: false,
        ...(official ? { official: true } : {}),
      });
      answer = (url: string) =>
        url.includes('/rpc/my_published_scenes')
          ? fakeResponse(200, [
              row(version, true),
              ...(andMember === undefined ? [] : [row(andMember, false)]),
            ])
          : fakeResponse(200, { published: {} });
    };

    it('rises above one of FluidEQ’s own publications too', async () => {
      galleryHoldsOfficial(51);
      setup();
      expect(await invoke('studio-publish', 5, 'space', webpBytes())).toEqual({
        ok: true,
      });
      expect(publishRequest()?.body.pack).toMatchObject({ version: 52 });
      expect(onDisk()).toBe(52);
    });

    it('rises above the higher of the two where a scene is both', async () => {
      // Neither kind may be published underneath the other: one id, one
      // number that only ever goes up.
      galleryHoldsOfficial(51, 60);
      setup();
      expect(await invoke('studio-publish', 5, 'space', webpBytes())).toEqual({
        ok: true,
      });
      expect(publishRequest()?.body.pack).toMatchObject({ version: 61 });
      expect(onDisk()).toBe(61);
    });

    // Server migration 0039. Unpublishing took the gallery's row away, so the
    // Studio proposed the number members still held and the server refused
    // it: the rule met as a wall.
    it('rises above what a scene was ever out at, unpublished since', async () => {
      galleryHolds(undefined);
      floorsAnswer = () =>
        fakeResponse(200, [
          { scene_id: 'my-first-scene', version: 7, official: false },
        ]);
      setup();
      expect(await invoke('studio-publish', 5, 'space', webpBytes())).toEqual({
        ok: true,
      });
      expect(publishRequest()?.body.pack).toMatchObject({ version: 8 });
      expect(onDisk()).toBe(8);
    });

    it('sends nothing when the floors cannot be read', async () => {
      galleryHolds(undefined);
      floorsAnswer = () => fakeResponse(500, {});
      setup();
      expect(await invoke('studio-publish', 5, 'space', webpBytes())).toEqual({
        ok: false,
        reason: 'server',
      });
      expect(publishRequests()).toEqual([]);
    });

    it('says so when the server got there first', async () => {
      // Two publications of the same scene crossing: the second read the
      // gallery before the first wrote to it, so the number it raised to was
      // taken by the time it arrived. The server is what holds the rule; this
      // is the app saying what happened.
      publishRefusedWith(() =>
        fakeResponse(409, { error: 'version_not_raised' }),
      );
      setup();
      expect(await invoke('studio-publish', 5, 'space', webpBytes())).toEqual({
        ok: false,
        reason: 'version-not-raised',
      });
    });

    it('sends nothing when the gallery cannot be read', async () => {
      // Without knowing what is published there is no number that is safely
      // above it, and the server would refuse whatever was guessed.
      answer = () => fakeResponse(500, {});
      setup();
      expect(await invoke('studio-publish', 5, 'space', webpBytes())).toEqual({
        ok: false,
        reason: 'server',
      });
      expect(publishRequests()).toEqual([]);
    });
  });

  it('never publishes a FluidEQ scene opened to look inside', async () => {
    setup();
    inspecting = true;
    expect(await invoke('studio-publish', 5, 'space', webpBytes())).toEqual({
      ok: false,
      reason: 'inspect-only',
    });
    expect(calls).toEqual([]);
    // The control: the same folder, not marked, is sent.
    inspecting = false;
    expect(await invoke('studio-publish', 5, 'space', webpBytes())).toEqual({
      ok: true,
    });
    expect(publishRequests()).toHaveLength(1);
  });

  it("says so when the server finds the scene is mostly one of FluidEQ's", async () => {
    setup();
    publishRefusedWith(() => fakeResponse(422, { error: 'official_copy' }));
    expect(await invoke('studio-publish', 5, 'space', webpBytes())).toEqual({
      ok: false,
      reason: 'official-copy',
    });
    // Any other refusal is still just refused.
    publishRefusedWith(() =>
      fakeResponse(422, { error: 'refused', reason: 'while' }),
    );
    expect(await invoke('studio-publish', 5, 'space', webpBytes())).toEqual({
      ok: false,
      reason: 'refused',
    });
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
    expect(await invoke('plus-gallery-mine')).toEqual({
      ok: true,
      scenes: [],
      floors: [],
    });
    answer = fakeResponse(200, {});
    expect(await invoke('plus-gallery-unpublish', 'neon-city')).toEqual({
      ok: true,
    });
    expect(
      calls.find((call) => call.url.includes('/publish-member-scene'))?.body,
    ).toEqual({
      action: 'unpublish',
      sceneId: 'neon-city',
    });
  });

  // Server migration 0039: an unpublished scene keeps the highest version it
  // was ever out at, and the list says so, for the Studio to publish above.
  it('lists the floors beside the scenes, and fails with them', async () => {
    setup();
    answer = fakeResponse(200, []);
    floorsAnswer = () =>
      fakeResponse(200, [
        { scene_id: 'lake', version: 7, official: false },
        { scene_id: '../etc', version: 3 },
      ]);
    expect(await invoke('plus-gallery-mine')).toEqual({
      ok: true,
      scenes: [],
      floors: [{ sceneId: 'lake', version: 7 }],
    });
    floorsAnswer = () => fakeResponse(500, {});
    expect(await invoke('plus-gallery-mine')).toEqual({
      ok: false,
      reason: 'server',
    });
    // A server from before floors has nothing to say about them.
    floorsAnswer = () => fakeResponse(404, {});
    expect(await invoke('plus-gallery-mine')).toEqual({
      ok: true,
      scenes: [],
      floors: [],
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
