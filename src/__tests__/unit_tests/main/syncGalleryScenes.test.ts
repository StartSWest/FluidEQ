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
const fetchEnvelope = jest.fn();
jest.mock('../../../main/plus/galleryApi', () => ({
  fetchEnvelope: (...args: unknown[]) => fetchEnvelope(...args),
}));
const openMemberEnvelope = jest.fn();
jest.mock('../../../main/memberScenes/sharing', () => ({
  openMemberEnvelope: (...args: unknown[]) => openMemberEnvelope(...args),
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

describe('a member scene already installed', () => {
  const access: IGalleryAccess = {
    accountId: () => 'me',
    entitled: () => true,
    auth: async () => ({}) as Awaited<ReturnType<IGalleryAccess['auth']>>,
  };

  const listed = (version: number, updatedAt: string) =>
    ({
      authorId: 'maker',
      sceneId: 'lake',
      lookId: 'member:maker:lake',
      version,
      updatedAt,
    }) as unknown as IGalleryScene;

  /** The installed copy, and a store that records what replaces it. */
  const storeHolding = (pack: Record<string, unknown>) => {
    const saveImported = jest.fn();
    return {
      saveImported,
      store: {
        isBlocked: () => false,
        list: () => [],
        load: () => pack,
        save: jest.fn(),
        saveImported,
      } as unknown as IMemberSceneStore,
    };
  };

  beforeEach(() => {
    fetchEnvelope.mockReset();
    openMemberEnvelope.mockReset();
  });

  /**
   * The silent swap: a maker publishes again under the version everybody
   * already installed, with different code inside. Nothing about the listing
   * says anything changed — same number — so the update notice never fires
   * and the versions page shows nothing, while the scene on the listener's
   * screen is a different scene.
   */
  it('is never replaced by different content under the same version', async () => {
    const held = { id: 'lake', version: 4, source: 'the scene they installed' };
    const { store, saveImported } = storeHolding(held);
    fetchEnvelope.mockResolvedValue({ envelope: true });
    openMemberEnvelope.mockReturnValue({
      author: { id: 'maker' },
      pack: { id: 'lake', version: 4, source: 'something else entirely' },
    });
    const sync = createGallerySceneSync({
      access,
      store,
      announce: () => {},
    });

    await sync([listed(4, '2026-09-18T09:00:00Z')]);

    expect(saveImported).not.toHaveBeenCalled();
    // And it is not even downloaded: the listing already said the number had
    // not moved.
    expect(fetchEnvelope).not.toHaveBeenCalled();
  });

  it('is not replaced by a version that goes backwards', async () => {
    const { store, saveImported } = storeHolding({ id: 'lake', version: 4 });
    const sync = createGallerySceneSync({
      access,
      store,
      announce: () => {},
    });

    await sync([listed(3, '2026-09-18T09:00:00Z')]);

    expect(saveImported).not.toHaveBeenCalled();
  });

  /**
   * The positive control. Without it the two refusals above pass just as
   * happily on a sync that adopts nothing at all, and a broken update path
   * would read as a working guard.
   */
  it('is replaced by a higher version, which is the whole point of syncing', async () => {
    const { store, saveImported } = storeHolding({ id: 'lake', version: 4 });
    const envelope = { envelope: true };
    fetchEnvelope.mockResolvedValue(envelope);
    openMemberEnvelope.mockReturnValue({
      author: { id: 'maker' },
      pack: { id: 'lake', version: 5, source: 'the new one' },
    });
    const sync = createGallerySceneSync({
      access,
      store,
      announce: () => {},
    });

    await sync([listed(5, '2026-09-18T09:00:00Z')]);

    expect(fetchEnvelope).toHaveBeenCalledTimes(1);
    expect(saveImported).toHaveBeenCalledWith(envelope);
  });

  /**
   * The listing is the server's word for what the file holds; the file is
   * what gets adopted. A listing claiming a new version over a pack that
   * carries the old one must not get the pack in.
   */
  it('is not replaced when the listing promises a version the pack does not carry', async () => {
    const { store, saveImported } = storeHolding({ id: 'lake', version: 4 });
    fetchEnvelope.mockResolvedValue({ envelope: true });
    openMemberEnvelope.mockReturnValue({
      author: { id: 'maker' },
      pack: { id: 'lake', version: 4, source: 'something else entirely' },
    });
    const sync = createGallerySceneSync({
      access,
      store,
      announce: () => {},
    });

    await sync([listed(9, '2026-09-18T09:00:00Z')]);

    expect(fetchEnvelope).toHaveBeenCalledTimes(1);
    expect(saveImported).not.toHaveBeenCalled();
  });
});
