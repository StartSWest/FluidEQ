/** @jest-environment node */
import type { IGalleryScene } from '../../../common/plusGallery';
import { FLUIDEQ_CREATOR_ID } from '../../../common/plusGallery';
import { premiumLookId } from '../../../common/scenePacks';
import type { IMemberSceneStore } from '../../../main/memberScenes/store';
import type { IGalleryAccess } from '../../../main/plus/galleryAccess';
import type { IScenePackStore } from '../../../main/scenePackStore';

const fetchOfficialScene = jest.fn();
jest.mock('../../../main/plus/officialGallery', () => ({
  fetchOfficialScene: (...args: unknown[]) => fetchOfficialScene(...args),
}));
jest.mock('../../../main/plus/galleryApi', () => ({
  fetchEnvelope: jest.fn(),
}));

/* eslint-disable import/first -- install the fetch mocks first */
import { createGallerySceneSync } from '../../../main/plus/syncGalleryScenes';
/* eslint-enable import/first */

describe('FluidEQ scenes listed in the gallery', () => {
  const access: IGalleryAccess = {
    accountId: () => 'me',
    entitled: () => true,
    auth: async () => ({}) as Awaited<ReturnType<IGalleryAccess['auth']>>,
  };
  const memberStore = {
    isBlocked: () => false,
    list: () => [],
  } as unknown as IMemberSceneStore;

  const listed = (version: number, updatedAt = '2026-09-13T02:00:00Z') =>
    ({
      authorId: FLUIDEQ_CREATOR_ID,
      sceneId: 'alpine',
      lookId: premiumLookId('alpine'),
      version,
      updatedAt,
      official: true,
    }) as unknown as IGalleryScene;

  beforeEach(() => {
    fetchOfficialScene.mockReset();
    fetchOfficialScene.mockResolvedValue(undefined);
  });

  // The pack listing brings every publication of these, so a gallery page
  // must not download an 11 MB scene to find it is the one already held.
  it('downloads only a version newer than the one held', async () => {
    const officialStore = {
      load: () => ({ id: 'alpine', version: 49 }),
      adopt: jest.fn(() => 0),
    } as unknown as IScenePackStore;
    const sync = createGallerySceneSync({
      access,
      store: memberStore,
      officialStore,
      announce: () => {},
    });

    await sync([listed(49)]);
    await sync([listed(48, '2026-09-14T00:00:00Z')]);
    expect(fetchOfficialScene).not.toHaveBeenCalled();

    await sync([listed(50, '2026-09-14T01:00:00Z')]);
    expect(fetchOfficialScene).toHaveBeenCalledTimes(1);
  });
});
