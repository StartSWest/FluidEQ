import { createHash } from 'crypto';
import type { IAccountConfig } from '../../../common/accountConfig';
import { download } from '../../../main/plus/galleryApi';
import { fetchOfficialScene } from '../../../main/plus/officialGallery';
import {
  fetchSceneMedia,
  onSceneDownloadsPaused,
  recheckSceneMedia,
} from '../../../main/plus/sceneMediaApi';
import { fakeResponse } from '../../utils/memberSceneFixtures';

// Scene files from the server's R2 bucket (server 0117): links asked in
// batches, bytes checked against what the server recorded, the old paths
// read only when the server says so, and an allowance used up never read
// around. Each refusal sits beside the answer one step from it.

const AUTHOR = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
const PICTURE = `${AUTHOR}/lake/picture.webp`;
const LINK =
  'https://acct.r2.cloudflarestorage.com/fluideq-media/x?X-Amz-Signature=1';
const FUNCTION = 'https://project.supabase.co/functions/v1/scene-media';

/** A config of its own per test: what the server said is kept per config. */
const configFor = () =>
  ({
    supabaseUrl: 'https://project.supabase.co',
    supabaseAnonKey: 'anon',
    apiUrl: 'https://project.supabase.co/functions/v1',
  }) as IAccountConfig;

const sha = (bytes: Uint8Array) =>
  createHash('sha256').update(bytes).digest('hex');
const bytesOf = (...values: number[]) => new Uint8Array(values);
const ready = (bytes: Uint8Array, extra: Record<string, unknown> = {}) => ({
  state: 'ready',
  url: LINK,
  bytes: bytes.length,
  sha256: sha(bytes),
  ...extra,
});

interface IWorld {
  fetchImpl: jest.Mock;
  asks: () => unknown[][];
  auth: {
    config: IAccountConfig;
    accessToken: string;
    fetchImpl: typeof fetch;
  };
}

/**
 * The function answers with `answer(items)`, R2 with `r2`, anything else
 * (the old paths) with `old`.
 */
const world = (
  answer: (items: unknown[]) => Response,
  r2: () => Response = () => fakeResponse(404, ''),
  old: () => Response = () => fakeResponse(200, bytesOf(9, 9)),
): IWorld => {
  const fetchImpl = jest.fn(async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === FUNCTION) {
      const body = JSON.parse(String(init?.body)) as { items: unknown[] };
      return answer(body.items);
    }
    return url.startsWith('https://acct.r2.cloudflarestorage.com/')
      ? r2()
      : old();
  });
  return {
    fetchImpl,
    asks: () =>
      fetchImpl.mock.calls
        .filter(([input]) => String(input) === FUNCTION)
        .map(
          ([, init]) =>
            (JSON.parse(String(init?.body)) as { items: unknown[] }).items,
        ),
    auth: {
      config: configFor(),
      accessToken: 'token',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    },
  };
};
const urlsOf = (fetchImpl: jest.Mock) =>
  fetchImpl.mock.calls.map(([input]) => String(input));

describe('a link from the server', () => {
  it('downloads the bytes from R2 with no account token and checks them', async () => {
    const bytes = bytesOf(1, 2, 3);
    const w = world(
      (items) =>
        fakeResponse(200, {
          live: true,
          items: items.map(() => ready(bytes, { version: 4 })),
        }),
      () => fakeResponse(200, bytes),
    );
    await expect(
      fetchSceneMedia(w.auth, { pack: 'hill' }, 100),
    ).resolves.toEqual({
      kind: 'bytes',
      bytes,
      version: 4,
    });
    const r2Call = w.fetchImpl.mock.calls.find(
      ([input]) => String(input) === LINK,
    );
    expect(JSON.stringify(r2Call?.[1] ?? {})).not.toContain('token');
    const ask = w.fetchImpl.mock.calls.find(
      ([input]) => String(input) === FUNCTION,
    );
    expect((ask?.[1]?.headers as Record<string, string>).Authorization).toBe(
      'Bearer token',
    );
  });

  it('reads the old way when the bytes are not the ones recorded', async () => {
    const recorded = bytesOf(1, 2, 3);
    const w = world(
      (items) =>
        fakeResponse(200, {
          live: true,
          items: items.map(() => ready(recorded)),
        }),
      () => fakeResponse(200, bytesOf(1, 2, 4)),
    );
    await expect(
      fetchSceneMedia(w.auth, { object: PICTURE }, 100),
    ).resolves.toEqual({ kind: 'fallback' });
    // The control: the recorded bytes are taken.
    const good = world(
      (items) =>
        fakeResponse(200, {
          live: true,
          items: items.map(() => ready(recorded)),
        }),
      () => fakeResponse(200, recorded),
    );
    expect(
      (await fetchSceneMedia(good.auth, { object: PICTURE }, 100)).kind,
    ).toBe('bytes');
  });

  it('never downloads a file larger than the caller takes', async () => {
    const bytes = bytesOf(1, 2, 3, 4);
    const w = world(
      (items) =>
        fakeResponse(200, { live: true, items: items.map(() => ready(bytes)) }),
      () => fakeResponse(200, bytes),
    );
    await expect(
      fetchSceneMedia(w.auth, { object: PICTURE }, 3),
    ).resolves.toEqual({ kind: 'fallback' });
    expect(urlsOf(w.fetchImpl)).not.toContain(LINK);
    expect((await fetchSceneMedia(w.auth, { object: PICTURE }, 4)).kind).toBe(
      'bytes',
    );
  });

  it('asks for everything asked in one turn in one call, and what comes meanwhile in the next', async () => {
    const bytes = bytesOf(5);
    const w = world(
      (items) =>
        fakeResponse(200, { live: true, items: items.map(() => ready(bytes)) }),
      () => fakeResponse(200, bytes),
    );
    const first = Promise.all(
      ['a', 'b', 'c'].map((scene) =>
        fetchSceneMedia(w.auth, { pack: `scene-${scene}` }, 10),
      ),
    );
    await first;
    expect(w.asks()).toEqual([
      [{ pack: 'scene-a' }, { pack: 'scene-b' }, { pack: 'scene-c' }],
    ]);
    // Thirty at once: the function takes 24 an ask.
    await Promise.all(
      Array.from({ length: 30 }, (_, i) =>
        fetchSceneMedia(w.auth, { pack: `many-${i}` }, 10),
      ),
    );
    expect(
      w
        .asks()
        .slice(1)
        .map((items) => items.length),
    ).toEqual([24, 6]);
  });
});

describe('what the server says instead of a link', () => {
  it('refused: nothing, and the old path is not tried', async () => {
    const w = world((items) =>
      fakeResponse(200, {
        live: true,
        items: items.map(() => ({ state: 'refused' })),
      }),
    );
    await expect(download(w.auth, PICTURE, 100)).resolves.toBeUndefined();
    expect(urlsOf(w.fetchImpl)).toEqual([FUNCTION]);
  });

  it('a used-up allowance pauses downloads, says when they return, and is never read around', async () => {
    const heard: unknown[] = [];
    const stop = onSceneDownloadsPaused((paused) => heard.push(paused));
    const w = world(() =>
      fakeResponse(429, {
        error: 'daily_allowance',
        resetsAt: '2026-11-25T00:00:00Z',
      }),
    );
    await expect(download(w.auth, PICTURE, 100)).resolves.toBeUndefined();
    await expect(fetchOfficialScene(w.auth, 'hill')).resolves.toBeUndefined();
    stop();
    expect(heard).toEqual([
      { reason: 'daily_allowance', resetsAt: '2026-11-25T00:00:00Z' },
      { reason: 'daily_allowance', resetsAt: '2026-11-25T00:00:00Z' },
    ]);
    // Only the function was asked: no old path, no R2.
    expect(new Set(urlsOf(w.fetchImpl))).toEqual(new Set([FUNCTION]));
    const busy = world(() =>
      fakeResponse(429, { error: 'busy', resetsAt: '2026-11-25T00:00:00Z' }),
    );
    await expect(
      fetchSceneMedia(busy.auth, { object: PICTURE }, 10),
    ).resolves.toEqual({
      kind: 'paused',
      paused: { reason: 'busy', resetsAt: '2026-11-25T00:00:00Z' },
    });
  });

  it('fallback reads the old path, as before', async () => {
    const w = world((items) =>
      fakeResponse(200, {
        live: true,
        items: items.map(() => ({ state: 'fallback' })),
      }),
    );
    await expect(download(w.auth, PICTURE, 100)).resolves.toEqual(
      bytesOf(9, 9),
    );
    expect(urlsOf(w.fetchImpl)).toEqual([
      FUNCTION,
      `https://project.supabase.co/storage/v1/object/authenticated/member-scenes/${PICTURE}`,
    ]);
  });

  it('not live: the old paths until the next come-back, without asking again', async () => {
    const w = world((items) =>
      fakeResponse(200, {
        live: false,
        items: items.map(() => ({ state: 'fallback' })),
      }),
    );
    await download(w.auth, PICTURE, 100);
    await download(w.auth, PICTURE, 100);
    expect(w.asks()).toHaveLength(1);
    recheckSceneMedia();
    await download(w.auth, PICTURE, 100);
    expect(w.asks()).toHaveLength(2);
  });

  it('a server without the function is asked once; a dropped connection is not remembered', async () => {
    const missing = world(() => fakeResponse(404, {}));
    await download(missing.auth, PICTURE, 100);
    await download(missing.auth, PICTURE, 100);
    expect(missing.asks()).toHaveLength(1);
    let calls = 0;
    const dropped = world(() => {
      calls += 1;
      throw new Error('socket hang up');
    });
    await expect(download(dropped.auth, PICTURE, 100)).resolves.toEqual(
      bytesOf(9, 9),
    );
    await download(dropped.auth, PICTURE, 100);
    expect(calls).toBe(2);
  });

  it('an official pack the account does not own reads as not owned', async () => {
    const w = world((items) =>
      fakeResponse(200, {
        live: true,
        items: items.map(() => ({ state: 'refused' })),
      }),
    );
    await expect(fetchOfficialScene(w.auth, 'hill')).resolves.toBe(
      'plus-required',
    );
  });

  it('a malformed answer is the old way, never a link', async () => {
    const w = world(() =>
      fakeResponse(200, {
        live: true,
        items: [
          {
            state: 'ready',
            url: 'http://plain.example/x',
            bytes: 1,
            sha256: 'a'.repeat(64),
          },
        ],
      }),
    );
    await expect(
      fetchSceneMedia(w.auth, { object: PICTURE }, 10),
    ).resolves.toEqual({ kind: 'fallback' });
    expect(urlsOf(w.fetchImpl)).not.toContain('http://plain.example/x');
  });
});
