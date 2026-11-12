/** @jest-environment node */
import type { IUnpublishedScene } from '../../../common/sceneStore';
import type { IMemberSceneStore } from '../../../main/memberScenes/store';
import type { IGalleryAccess } from '../../../main/plus/galleryAccess';

const openMemberEnvelope = jest.fn();
jest.mock('../../../main/memberScenes/sharing', () => ({
  openMemberEnvelope: (...args: unknown[]) => openMemberEnvelope(...args),
}));

/* eslint-disable import/first -- install the envelope mock first */
import { createKeptSceneSync } from '../../../main/plus/syncKeptScenes';
/* eslint-enable import/first */

/**
 * A scene its maker unpublished is out of the gallery, so there is no card to
 * add it from (premium 0103). The store names it, and a computer without it
 * gets it from the copy kept for its owners — verified as a gallery download
 * is, and only for an account that still owns it.
 */
const ME = '11111111-1111-4111-8111-111111111111';
const MAKER = '22222222-2222-4222-8222-222222222222';
const LOOK = `member:${MAKER}:lake`;
const ENVELOPE = { payload: 'signed' };

const harness = ({
  owns = true,
  blocked = false,
  held,
  ownCopy = false,
  unpublished = [{ lookId: LOOK, version: 3 }],
}: {
  owns?: boolean;
  blocked?: boolean;
  held?: number;
  ownCopy?: boolean;
  unpublished?: IUnpublishedScene[];
} = {}) => {
  const listeners: Array<() => void> = [];
  const saveImported = jest.fn();
  const announce = jest.fn();
  const fetchKept = jest.fn().mockResolvedValue(ENVELOPE);
  const access: IGalleryAccess = {
    accountId: () => ME,
    entitled: () => true,
    // A maker owns their own scene too (`sceneOwnership.ts`).
    owns: (lookId) =>
      owns && (lookId === LOOK || lookId === `member:${ME}:lake`),
    auth: async () => ({}) as Awaited<ReturnType<IGalleryAccess['auth']>>,
  };
  const store = {
    isBlocked: () => blocked,
    newest: () => (held === undefined ? undefined : { version: held }),
    list: () => (ownCopy ? [{ lookId: LOOK, own: true }] : []),
    saveImported,
  } as unknown as IMemberSceneStore;
  const sync = createKeptSceneSync({
    access,
    ownership: {
      known: () => ({
        balance: 0,
        starterClaimed: true,
        owned: [LOOK],
        packs: [],
        unpublished,
      }),
      subscribe: (listener) => {
        listeners.push(listener);
        return () => undefined;
      },
    },
    store,
    announce,
    fetchKept,
  });
  return { sync, saveImported, announce, fetchKept, listeners };
};

beforeEach(() => {
  openMemberEnvelope.mockReset();
  openMemberEnvelope.mockReturnValue({
    author: { id: MAKER },
    pack: { id: 'lake', version: 3 },
  });
});

it('brings an owned unpublished scene onto a computer that does not have it', async () => {
  const { sync, saveImported, announce, fetchKept } = harness();
  await sync.run();
  expect(fetchKept).toHaveBeenCalledWith({}, MAKER, 'lake', 3);
  expect(saveImported).toHaveBeenCalledWith(ENVELOPE);
  expect(announce).toHaveBeenCalledTimes(1);
});

it('replaces an older copy, and leaves a copy at that version alone', async () => {
  const older = harness({ held: 2 });
  await older.sync.run();
  expect(older.saveImported).toHaveBeenCalledTimes(1);

  const same = harness({ held: 3 });
  await same.sync.run();
  expect(same.fetchKept).not.toHaveBeenCalled();
  expect(same.saveImported).not.toHaveBeenCalled();
});

it.each([
  ['an account that no longer owns it', { owns: false }],
  ['a blocked scene', { blocked: true }],
  ["another account's own copy", { ownCopy: true }],
])('takes nothing for %s', async (_, setup) => {
  const { sync, fetchKept, saveImported } = harness(setup);
  await sync.run();
  expect(fetchKept).not.toHaveBeenCalled();
  expect(saveImported).not.toHaveBeenCalled();
});

it.each([
  ['an unsigned copy', undefined],
  ['another author', { author: { id: ME }, pack: { id: 'lake', version: 3 } }],
  [
    'another scene',
    { author: { id: MAKER }, pack: { id: 'pond', version: 3 } },
  ],
  [
    'an older version',
    { author: { id: MAKER }, pack: { id: 'lake', version: 1 } },
  ],
])('refuses %s', async (_, opened) => {
  openMemberEnvelope.mockReturnValue(opened);
  const { sync, saveImported } = harness({ held: 2 });
  await sync.run();
  expect(saveImported).not.toHaveBeenCalled();
});

it('asks again at the next store change when the copy could not be read, and not again once it was kept', async () => {
  const { sync, fetchKept, saveImported, listeners } = harness();
  fetchKept.mockResolvedValueOnce(undefined);
  await sync.run();
  expect(saveImported).not.toHaveBeenCalled();

  listeners.forEach((listener) => listener());
  await sync.run();
  expect(saveImported).toHaveBeenCalledTimes(1);

  await sync.run();
  expect(fetchKept).toHaveBeenCalledTimes(2);
});

it("never fetches the maker's own scene from a kept copy", async () => {
  const own = `member:${ME}:lake`;
  const { sync, fetchKept } = harness({
    unpublished: [{ lookId: own, version: 3 }],
  });
  await sync.run();
  expect(fetchKept).not.toHaveBeenCalled();
});
