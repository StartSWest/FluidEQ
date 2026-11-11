/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * @jest-environment node
 */

/**
 * Who may ask for a look to be put right (`ipc/sceneRecovery.ts`): a
 * recovery fetches a copy and keeps it, so it is asked only for a scene the
 * account made or owns, and never for one FluidEQ has blocked. Each refusal
 * stands beside the ask that goes through.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';

const handlers = new Map<string, (...args: unknown[]) => unknown>();
jest.mock('electron', () => ({
  safeStorage: jest.requireActual('../../utils/sceneStorageCipher')
    .sceneStorageCipher,
  ipcMain: {
    handle: (channel: string, fn: (...args: unknown[]) => unknown) =>
      handlers.set(channel, fn),
    removeHandler: (channel: string) => handlers.delete(channel),
  },
}));

/* eslint-disable import/first -- the electron mock must be installed first */
import { memberLookId } from '../../../common/memberScenes';
import { registerSceneRecoveryIpc } from '../../../main/ipc/sceneRecovery';
import {
  createMemberSceneStore,
  memberSceneFingerprint,
} from '../../../main/memberScenes/store';
import { ME, memberPack, SOMEONE } from '../../utils/memberSceneFixtures';
/* eslint-enable import/first */

let root: string;
beforeEach(() => {
  handlers.clear();
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'scene-recovery-ipc-'));
});
afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

const setUp = ({ owned = [] as string[] } = {}) => {
  const store = createMemberSceneStore({ userDataDir: root });
  // Signed out of the gallery: an ask that gets as far as the gallery is
  // seen by its asking for the token.
  const auth = jest.fn(async () => undefined);
  const { dispose, recover } = registerSceneRecoveryIpc({
    access: {
      accountId: () => ME,
      auth,
      owns: (lookId) => owned.includes(lookId),
    },
    store,
    ownProjectFolders: () => [],
    announce: jest.fn(),
  });
  const ask = (lookId: unknown) =>
    handlers.get('member-scenes-recover')?.({}, lookId);
  return { store, auth, ask, dispose, recover };
};

const MINE = memberLookId(ME, 'neon-city');
const THEIRS = memberLookId(SOMEONE, 'neon-city');

it("the maker's own look, and one the account owns, are looked for", async () => {
  const { store, auth, ask } = setUp({ owned: [THEIRS] });
  store.save(ME, memberPack());
  await expect(ask(MINE)).resolves.toEqual({ recovered: false });
  expect(auth).toHaveBeenCalledTimes(1);
  await expect(ask(THEIRS)).resolves.toEqual({ recovered: false });
  expect(auth).toHaveBeenCalledTimes(2);
});

it("another member's look the account does not own is not fetched", async () => {
  const { auth, ask } = setUp();
  await expect(ask(THEIRS)).resolves.toEqual({ recovered: false });
  expect(auth).not.toHaveBeenCalled();
});

it('a look FluidEQ has blocked is not fetched, owned or not', async () => {
  const { store, auth, ask } = setUp({ owned: [THEIRS] });
  store.setBlocked([
    memberSceneFingerprint(SOMEONE, 'neon-city'),
    memberSceneFingerprint(ME, 'neon-city'),
  ]);
  await expect(ask(THEIRS)).resolves.toEqual({ recovered: false });
  await expect(ask(MINE)).resolves.toEqual({ recovered: false });
  expect(auth).not.toHaveBeenCalled();
});

it('anything that is not a look is answered without a look', async () => {
  const { auth, ask, dispose } = setUp();
  await expect(ask(42)).resolves.toEqual({ recovered: false });
  await expect(ask('premium:aurora')).resolves.toEqual({ recovered: false });
  expect(auth).not.toHaveBeenCalled();
  dispose();
  expect(handlers.has('member-scenes-recover')).toBe(false);
});

// A desktop background asks from main, not through the window's channel
// (`wallpaper/manager.ts`): the same gate holds it.
it('main’s own ask is held by the same gate as the window’s', async () => {
  const { store, auth, recover } = setUp();
  store.setBlocked([memberSceneFingerprint(ME, 'neon-city')]);
  await expect(recover(THEIRS)).resolves.toEqual({ recovered: false });
  await expect(recover(MINE)).resolves.toEqual({ recovered: false });
  expect(auth).not.toHaveBeenCalled();
  // The control: one it may recover gets as far as the gallery.
  store.setBlocked([]);
  await expect(recover(MINE)).resolves.toEqual({ recovered: false });
  expect(auth).toHaveBeenCalledTimes(1);
});
