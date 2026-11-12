/** @jest-environment node */

/**
 * A look that will not play is put right from the gallery's copy, and, once
 * its maker unpublished it, from the copy FluidEQ keeps for its owners
 * (premium 0103): the gallery has no file for it any more.
 */

jest.mock('electron', () => ({
  ipcMain: { handle: jest.fn(), removeHandler: jest.fn() },
}));
const fetchEnvelope = jest.fn();
jest.mock('../../../main/plus/galleryApi', () => ({
  fetchEnvelope: (...args: unknown[]) => fetchEnvelope(...args),
}));
const fetchKeptEnvelope = jest.fn();
jest.mock('../../../main/plus/keptScene', () => ({
  fetchKeptEnvelope: (...args: unknown[]) => fetchKeptEnvelope(...args),
}));
type TFetch = (authorId: string, sceneId: string) => Promise<unknown>;
let fetchGalleryCopy: TFetch | undefined;
jest.mock('../../../main/memberScenes/sceneRecovery', () => ({
  createSceneRecovery: (deps: { fetchGalleryCopy: TFetch }) => {
    fetchGalleryCopy = deps.fetchGalleryCopy;
    return { recover: jest.fn() };
  },
}));

/* eslint-disable import/first -- the mocks must be installed first */
import { memberLookId } from '../../../common/memberScenes';
import { registerSceneRecoveryIpc } from '../../../main/ipc/sceneRecovery';
import type { IMemberSceneStore } from '../../../main/memberScenes/store';
/* eslint-enable import/first */

const MAKER = '22222222-2222-4222-8222-222222222222';
const AUTH = { token: 'member' };

const setUp = (kept?: number) => {
  registerSceneRecoveryIpc({
    access: {
      accountId: () => '11111111-1111-4111-8111-111111111111',
      auth: async () => AUTH as never,
      owns: () => true,
    },
    store: {} as IMemberSceneStore,
    ownProjectFolders: () => [],
    announce: jest.fn(),
    keptVersionOf: (lookId) =>
      lookId === memberLookId(MAKER, 'lake') ? kept : undefined,
  });
  if (!fetchGalleryCopy) {
    throw new Error('the recovery was not built');
  }
  return fetchGalleryCopy;
};

beforeEach(() => {
  fetchEnvelope.mockReset();
  fetchKeptEnvelope.mockReset();
});

it('takes the gallery copy while there is one, and asks for no kept copy', async () => {
  fetchEnvelope.mockResolvedValue('from the gallery');
  await expect(setUp(3)(MAKER, 'lake')).resolves.toBe('from the gallery');
  expect(fetchKeptEnvelope).not.toHaveBeenCalled();
});

it('takes the kept copy, at its version, once the gallery has none', async () => {
  fetchEnvelope.mockResolvedValue(undefined);
  fetchKeptEnvelope.mockResolvedValue('kept for its owners');
  await expect(setUp(3)(MAKER, 'lake')).resolves.toBe('kept for its owners');
  expect(fetchKeptEnvelope).toHaveBeenCalledWith(AUTH, MAKER, 'lake', 3);
});

it('asks for no kept copy of a scene that is not kept', async () => {
  fetchEnvelope.mockResolvedValue(undefined);
  await expect(setUp(undefined)(MAKER, 'lake')).resolves.toBeUndefined();
  expect(fetchKeptEnvelope).not.toHaveBeenCalled();
});
