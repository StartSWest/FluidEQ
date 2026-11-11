/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A look that will not play is put right from a better copy: its maker's
 * Studio project, then the gallery's (Ivan, 2026-11-11: "if it fails it
 * recovers"). The scene here is the one that was lost in 2.4.0: a copy in
 * the looks with no palette, whose shader names one.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import type { IScenePack } from '../../../common/scenePacks';
import storedScenePack from '../../../common/sceneStoredPack';
import { createSceneRecovery } from '../../../main/memberScenes/sceneRecovery';
import { createMemberSceneStore } from '../../../main/memberScenes/store';
import { memberLookId } from '../../../common/memberScenes';
import { resetSceneFailuresForTesting } from '../../../main/sceneFailures';
import { everyFieldPack } from '../../utils/everyFieldScene';
import {
  ME,
  memberPayload,
  signedEnvelope,
  SOMEONE,
} from '../../utils/memberSceneFixtures';

jest.mock('electron', () => ({
  safeStorage: jest.requireActual('../../utils/sceneStorageCipher')
    .sceneStorageCipher,
}));

/** The whole scene, and the copy of it that lost its palette and colour. */
const whole = (version = 3): IScenePack => ({ ...everyFieldPack(), version });
const poorer = (version = 3): IScenePack => {
  const { palettes: _palettes, colours: _colours, ...rest } = whole(version);
  return rest;
};

const envelopeOf = (pack: IScenePack, author = SOMEONE) =>
  signedEnvelope(
    memberPayload({ author, pack: storedScenePack(pack) as never }),
  );

let root: string;
beforeEach(() => {
  resetSceneFailuresForTesting();
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'scene-recovery-'));
});
afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

/** A Studio project's folder, as far as recovery reads it: its `pack.json`. */
const projectFolder = (name: string, id: string) => {
  const folder = path.join(root, 'projects', name);
  fs.mkdirSync(folder, { recursive: true });
  fs.writeFileSync(path.join(folder, 'pack.json'), JSON.stringify({ id }));
  return folder;
};

const setUp = ({
  account = ME as string | undefined,
  projects = {} as Record<string, IScenePack | undefined>,
  gallery = undefined as ReturnType<typeof envelopeOf> | undefined,
} = {}) => {
  const store = createMemberSceneStore({ userDataDir: root });
  const announce = jest.fn();
  const fetchGalleryCopy = jest.fn(async () => gallery);
  const readProjectPack = jest.fn(async (folder: string) => projects[folder]);
  const warn = jest.fn();
  const recovery = createSceneRecovery({
    store,
    accountId: () => account,
    ownProjectFolders: () => Object.keys(projects),
    fetchGalleryCopy,
    announce,
    readProjectPack,
    logger: { info: jest.fn(), warn },
  });
  return { store, announce, fetchGalleryCopy, readProjectPack, recovery, warn };
};

const MINE = memberLookId(ME, everyFieldPack().id);
const THEIRS = memberLookId(SOMEONE, everyFieldPack().id);

it('the fixture: the poorer copy is a scene the looks keep, without its palette', () => {
  const { store } = setUp();
  store.save(ME, poorer());
  expect(store.load(ME, whole().id)?.palettes).toBeUndefined();
});

it("the maker's own look is put right from its Studio project, with no word to the gallery", async () => {
  const folder = projectFolder('neon', whole().id);
  const other = projectFolder('other', 'another-scene');
  const { store, announce, fetchGalleryCopy, readProjectPack, recovery, warn } =
    setUp({ projects: { [other]: whole(), [folder]: whole() } });
  store.save(ME, poorer());
  await expect(recovery.recover(MINE)).resolves.toEqual({
    recovered: true,
    from: 'project',
  });
  expect(store.load(ME, whole().id)).toEqual(whole());
  expect(announce).toHaveBeenCalledTimes(1);
  expect(fetchGalleryCopy).not.toHaveBeenCalled();
  // Only the folder that names this scene is read whole.
  expect(readProjectPack.mock.calls).toEqual([[folder]]);
  // Each step of the way back is the report's one line for it.
  expect(warn).toHaveBeenCalledWith(
    `Scene failure: ${MINE} v${whole().version} on looks: healed-project.`,
  );
});

it("falls to the gallery's copy when the project is the copy that failed", async () => {
  const folder = projectFolder('neon', whole().id);
  const { store, announce, recovery } = setUp({
    projects: { [folder]: poorer() },
    gallery: envelopeOf(whole(), ME),
  });
  store.save(ME, poorer());
  await expect(recovery.recover(MINE)).resolves.toEqual({
    recovered: true,
    from: 'gallery',
  });
  expect(store.load(ME, whole().id)).toEqual(whole());
  expect(announce).toHaveBeenCalledTimes(1);
});

it("another member's look is put right from the gallery, and no project is read", async () => {
  const folder = projectFolder('neon', whole().id);
  const { store, recovery, readProjectPack, warn } = setUp({
    projects: { [folder]: whole(9) },
    gallery: envelopeOf(whole(4)),
  });
  store.saveImported(envelopeOf(poorer(3)));
  await expect(recovery.recover(THEIRS)).resolves.toEqual({
    recovered: true,
    from: 'gallery',
  });
  expect(store.load(SOMEONE, whole().id)).toEqual(whole(4));
  expect(readProjectPack).not.toHaveBeenCalled();
  expect(warn).toHaveBeenCalledWith(
    `Scene failure: ${THEIRS} v4 on looks: healed-server.`,
  );
});

it('says so when no better copy is left, keeps what was there, and never keeps a failed copy again', async () => {
  const folder = projectFolder('neon', whole().id);
  const { store, announce, recovery, warn } = setUp({
    projects: { [folder]: poorer() },
    gallery: envelopeOf(poorer(), ME),
  });
  store.save(ME, poorer());
  const save = jest.spyOn(store, 'save');
  await expect(recovery.recover(MINE)).resolves.toEqual({ recovered: false });
  expect(save).not.toHaveBeenCalled();
  expect(announce).not.toHaveBeenCalled();
  expect(store.load(ME, whole().id)).toEqual(poorer());
  // The report's one line for it (`sceneFailureLog.ts`).
  expect(warn).toHaveBeenCalledWith(
    expect.stringMatching(/on looks: gave-up\. no better copy found; 1 tried$/),
  );
});

it('a copy that was put in place and failed too is not put in place twice', async () => {
  const folder = projectFolder('neon', whole().id);
  const { store, recovery } = setUp({
    projects: { [folder]: whole() },
    gallery: envelopeOf(whole(), ME),
  });
  store.save(ME, poorer());
  await expect(recovery.recover(MINE)).resolves.toEqual({
    recovered: true,
    from: 'project',
  });
  // The whole scene fails here as well (a driver's refusal, say): the
  // project and the gallery hold that same copy, so nothing is left.
  await expect(recovery.recover(MINE)).resolves.toEqual({ recovered: false });
});

it('never puts an earlier version in place of the one the looks hold', async () => {
  const folder = projectFolder('neon', whole().id);
  const { store, recovery } = setUp({
    projects: { [folder]: whole(2) },
    gallery: envelopeOf(whole(2), ME),
  });
  store.save(ME, poorer(3));
  await expect(recovery.recover(MINE)).resolves.toEqual({ recovered: false });
  expect(store.load(ME, whole().id)?.version).toBe(3);
});

it("refuses a gallery file that is another maker's or another scene's", async () => {
  const wrongAuthor = setUp({ gallery: envelopeOf(whole(), SOMEONE) });
  wrongAuthor.store.save(ME, poorer());
  await expect(wrongAuthor.recovery.recover(MINE)).resolves.toEqual({
    recovered: false,
  });
  fs.rmSync(path.join(root, 'member-scenes'), { recursive: true, force: true });
  const wrongScene = setUp({
    gallery: envelopeOf({ ...whole(), id: 'another-scene' }, ME),
  });
  wrongScene.store.save(ME, poorer());
  await expect(wrongScene.recovery.recover(MINE)).resolves.toEqual({
    recovered: false,
  });
  // And one nobody signed.
  fs.rmSync(path.join(root, 'member-scenes'), { recursive: true, force: true });
  const unsigned = setUp({
    gallery: signedEnvelope(
      memberPayload({ author: ME, pack: storedScenePack(whole()) as never }),
      { trusted: false },
    ),
  });
  unsigned.store.save(ME, poorer());
  await expect(unsigned.recovery.recover(MINE)).resolves.toEqual({
    recovered: false,
  });
});

it('a look with no copy at all in the looks is fetched again', async () => {
  const { store, recovery } = setUp({ gallery: envelopeOf(whole()) });
  await expect(recovery.recover(THEIRS)).resolves.toEqual({
    recovered: true,
    from: 'gallery',
  });
  expect(store.load(SOMEONE, whole().id)).toEqual(whole());
});

it('an unreachable gallery is an answer, not a throw; and two reports share one recovery', async () => {
  const { store, recovery, fetchGalleryCopy } = setUp();
  store.save(ME, poorer());
  fetchGalleryCopy.mockRejectedValue(new Error('offline'));
  const [one, two] = await Promise.all([
    recovery.recover(MINE),
    recovery.recover(MINE),
  ]);
  expect(one).toEqual({ recovered: false });
  expect(two).toEqual({ recovered: false });
  expect(fetchGalleryCopy).toHaveBeenCalledTimes(1);
  await expect(recovery.recover('not-a-look')).resolves.toEqual({
    recovered: false,
  });
});

it('an account that changed while the gallery answered keeps nothing', async () => {
  let account: string | undefined = ME;
  const store = createMemberSceneStore({ userDataDir: root });
  store.save(ME, poorer());
  const recovery = createSceneRecovery({
    store,
    accountId: () => account,
    ownProjectFolders: () => [],
    fetchGalleryCopy: async () => {
      account = SOMEONE;
      return envelopeOf(whole(), ME);
    },
    announce: jest.fn(),
  });
  await expect(recovery.recover(MINE)).resolves.toEqual({ recovered: false });
  expect(store.load(ME, whole().id)).toEqual(poorer());
});
