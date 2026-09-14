/** @jest-environment node */
import type { IGalleryQuery, IGalleryScene } from '../../../common/plusGallery';
import { FLUIDEQ_CREATOR_ID } from '../../../common/plusGallery';
import type { IGalleryAccess } from '../../../main/plus/galleryAccess';

const listGallery = jest.fn();
jest.mock('../../../main/plus/galleryApi', () => ({
  listGallery: (...args: unknown[]) => listGallery(...args),
}));

/* eslint-disable import/first -- install the gallery API mock first */
import { createGalleryRefresh } from '../../../main/plus/galleryRefresh';
/* eslint-enable import/first */

const ADA = '0b6e3f2a-3c1d-4e5f-8a9b-1c2d3e4f5a6b';
const BOB = '1c7f4a3b-4d2e-4f6a-9b0c-2d3e4f5a6b7c';

const scene = (authorId: string, sceneId: string) =>
  ({ authorId, sceneId, version: 1 }) as unknown as IGalleryScene;

describe('bringing the scenes added from the gallery up to date', () => {
  let entitled: boolean;
  const access: IGalleryAccess = {
    accountId: () => 'me',
    entitled: () => entitled,
    auth: async () => ({}) as Awaited<ReturnType<IGalleryAccess['auth']>>,
  };

  beforeEach(() => {
    entitled = true;
    listGallery.mockReset();
  });

  it('asks each maker of an installed scene once, every page, and never FluidEQ', async () => {
    const pages: Record<string, IGalleryScene[][]> = {
      [ADA]: [[scene(ADA, 'dunes')], []],
      [BOB]: [[scene(BOB, 'rain')]],
    };
    listGallery.mockImplementation(async (_auth, query: IGalleryQuery) => {
      const page = (query.offset ?? 0) === 0 ? 0 : 1;
      const scenes = pages[query.authorId ?? '']?.[page] ?? [];
      return { ok: true, scenes, more: query.authorId === ADA && page === 0 };
    });
    const sync = jest.fn(async () => {});
    const refresh = createGalleryRefresh(access, sync, () => [
      ADA,
      FLUIDEQ_CREATOR_ID,
      ADA,
      BOB,
    ]);

    await refresh();

    const asked = listGallery.mock.calls.map(
      ([, query]) => (query as IGalleryQuery).authorId,
    );
    expect(asked).toEqual([ADA, ADA, BOB]);
    expect(sync).toHaveBeenCalledWith([scene(ADA, 'dunes')]);
    expect(sync).toHaveBeenCalledWith([scene(BOB, 'rain')]);
  });

  // The four-hour wait is gone: the question is small, so every event asks.
  it('asks again at every event', async () => {
    listGallery.mockResolvedValue({ ok: true, scenes: [], more: false });
    const refresh = createGalleryRefresh(
      access,
      jest.fn(async () => {}),
      () => [ADA],
    );
    await refresh();
    await refresh();
    expect(listGallery).toHaveBeenCalledTimes(2);
  });

  it('asks nothing with nothing installed, or without Plus', async () => {
    const sync = jest.fn(async () => {});
    await createGalleryRefresh(access, sync, () => [])();
    await createGalleryRefresh(access, sync, () => [FLUIDEQ_CREATOR_ID])();
    entitled = false;
    await createGalleryRefresh(access, sync, () => [ADA])();
    expect(listGallery).not.toHaveBeenCalled();
    expect(sync).not.toHaveBeenCalled();
  });

  it('runs once more after a check under way when forced, and joins it when not', async () => {
    let answer: (value: unknown) => void = () => {};
    const pending = new Promise((resolve) => {
      answer = resolve;
    });
    // Settles once the first check is waiting on the server.
    let started: () => void = () => {};
    const waiting = new Promise<void>((resolve) => {
      started = resolve;
    });
    listGallery.mockImplementationOnce(() => {
      started();
      return pending;
    });
    listGallery.mockResolvedValue({ ok: true, scenes: [], more: false });
    const refresh = createGalleryRefresh(
      access,
      jest.fn(async () => {}),
      () => [ADA],
    );

    const first = refresh();
    const joined = refresh();
    const forced = refresh(true);
    await waiting;
    answer({ ok: true, scenes: [], more: false });
    await Promise.all([first, joined, forced]);

    expect(listGallery).toHaveBeenCalledTimes(2);
  });
});
