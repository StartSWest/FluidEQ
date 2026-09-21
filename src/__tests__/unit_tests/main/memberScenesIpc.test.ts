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
import type { BrowserWindow } from 'electron';

const handlers = new Map<string, (...args: unknown[]) => unknown>();
jest.mock('electron', () => ({
  safeStorage: jest.requireActual('../../utils/sceneStorageCipher')
    .sceneStorageCipher,
  ipcMain: {
    handle: (channel: string, fn: (...args: unknown[]) => unknown) =>
      handlers.set(channel, fn),
    removeHandler: (channel: string) => handlers.delete(channel),
  },
  dialog: { showOpenDialog: jest.fn() },
  shell: { openPath: jest.fn() },
}));

/* eslint-disable import/first -- the electron mock must be installed first */
import {
  registerMemberScenesIpc,
  type ILinkFolderResult,
  type IMemberScenesListing,
  type IStudioState,
  type TAddOutcome,
  type TNewProjectResult,
} from '../../../main/ipc/memberScenes';
import { writeStarterProject } from '../../../main/memberScenes/project';
import { setKnownMaker } from '../../../main/account/knownMakers';
import type { IEntitlementStatus } from '../../../main/account/entitlement';
import { memberPack } from '../../utils/memberSceneFixtures';
/* eslint-enable import/first */

const ME = '4f1c2b9e-8d3a-4e7b-9c11-2a6f0d5e7b30';
const SOMEONE = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';

const invoke = <T>(channel: string, ...args: unknown[]) => {
  const handler = handlers.get(channel);
  if (!handler) {
    throw new Error(`no handler for ${channel}`);
  }
  return handler({}, ...args) as T;
};

let root: string;
let status: IEntitlementStatus;
let listeners: Array<(value: IEntitlementStatus) => void>;
let chosen: string | undefined;
/** Where the last folder dialog opened. */
let dialogOpenedAt: string | undefined;
let sent: Array<[string, unknown]>;
/** Tests waiting on the next message sent to the window on a channel. */
let awaitingSend: Array<{
  channel: string;
  resolve: (value: unknown) => void;
}>;

/** The first message sent on `channel`, already sent or when it is. */
const sentOn = (channel: string) => {
  const found = sent.find(([name]) => name === channel);
  return found
    ? Promise.resolve(found[1])
    : new Promise<unknown>((resolve) => {
        awaitingSend.push({ channel, resolve });
      });
};

const setup = (
  over: Partial<Parameters<typeof registerMemberScenesIpc>[0]> = {},
) => {
  const window = {
    webContents: {
      send: (channel: string, value: unknown) => {
        sent.push([channel, value]);
        awaitingSend = awaitingSend.filter((waiting) => {
          if (waiting.channel !== channel) {
            return true;
          }
          waiting.resolve(value);
          return false;
        });
      },
    },
  } as unknown as BrowserWindow;
  return registerMemberScenesIpc({
    getMainWindow: () => window,
    userDataDir: path.join(root, 'userData'),
    documentsDir: path.join(root, 'Documents'),
    session: {
      state: () => ({ status: 'signed-in', identity: { id: ME } }),
    } as never,
    entitlement: {
      status: () => status,
      subscribe: (listener: (value: IEntitlementStatus) => void) => {
        listeners.push(listener);
        return () => undefined;
      },
    } as never,
    dialogImpl: {
      showOpenDialog: (async (_window: unknown, options: unknown) => {
        dialogOpenedAt = (options as { defaultPath?: string }).defaultPath;
        return chosen
          ? { canceled: false, filePaths: [chosen] }
          : { canceled: true, filePaths: [] };
      }) as never,
    },
    openPath: async () => '',
    ...over,
  });
};

/**
 * The account has had a scene approved before. That, not merely being
 * signed in, is what keeps one Studio project open without Plus.
 */
const asMaker = () => setKnownMaker(path.join(root, 'userData'), ME, true);

beforeEach(() => {
  handlers.clear();
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-studio-ipc-'));
  status = { state: 'active' };
  listeners = [];
  chosen = undefined;
  dialogOpenedAt = undefined;
  sent = [];
  awaitingSend = [];
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

/** "Open a folder…", answered with the list as it is after. */
const link = async () =>
  (await invoke<Promise<ILinkFolderResult>>('studio-link-folder')).state;

const project = async () => {
  const folder = path.join(root, 'my-scene');
  fs.mkdirSync(folder);
  await writeStarterProject(folder, {
    name: 'My First Scene',
    id: 'my-first-scene',
  });
  return folder;
};

describe('member scenes over IPC', () => {
  // The control: a member links a folder, adds it, and can draw it.
  it('links a folder, adds the scene, and loads it back', async () => {
    const registration = setup();
    chosen = await project();
    await invoke<Promise<IStudioState>>('studio-open');
    const state = await link();
    expect(state.projects.map((entry) => entry.folderName)).toEqual([
      'my-scene',
    ]);
    expect(state.activeId).toBe(state.projects[0]?.id);
    const added = await invoke<Promise<TAddOutcome>>('studio-add-to-looks');
    expect(added).toMatchObject({
      ok: true,
      scene: { packId: 'my-first-scene' },
    });
    const listing = invoke<IMemberScenesListing>('member-scenes-list');
    expect(listing.scenes.map((scene) => scene.packId)).toEqual([
      'my-first-scene',
    ]);
    const { lookId } = listing.scenes[0];
    expect(invoke('member-scenes-load', lookId)).toMatchObject({
      id: 'my-first-scene',
    });
    registration.dispose();
  });

  it('refuses every drawing and sharing call without Plus, and keeps the one project', async () => {
    const registration = setup();
    chosen = await project();
    await invoke<Promise<IStudioState>>('studio-open');
    await link();
    await invoke<Promise<TAddOutcome>>('studio-add-to-looks');
    const { lookId } =
      invoke<IMemberScenesListing>('member-scenes-list').scenes[0];

    status = { state: 'none' };
    asMaker();
    listeners.forEach((listener) => listener(status));
    expect(invoke('member-scenes-load', lookId)).toBeUndefined();
    // The project they have stays; a second one is Plus's.
    expect(await invoke('studio-create-project', 'Neon City')).toBe(
      'plus-only',
    );
    expect(await invoke('studio-add-to-looks')).toEqual({
      ok: false,
      reason: 'not-entitled',
    });
    // Kept and shown locked, never deleted.
    const listing = invoke<IMemberScenesListing>('member-scenes-list');
    expect(listing.entitled).toBe(false);
    expect(listing.locked.map((scene) => scene.lookId)).toEqual([lookId]);
    // And the member can still take their own work out.
    expect(invoke('member-scenes-remove', lookId)).toBe(true);
    registration.dispose();
  });

  // A desktop background's page has no channel of its own to report on, so
  // main hands its scene's failure to the same handler the graph's goes into.
  // Nothing about the failure is written to disk: it is logged for an
  // operator to see, and a later attempt at the same scene still succeeds.
  it('logs a scene failure reported from every place that draws it, without blocking a later attempt', async () => {
    const warn = jest.fn();
    const registration = setup({ logger: { info: jest.fn(), warn } });
    chosen = await project();
    await invoke<Promise<IStudioState>>('studio-open');
    await link();
    await invoke<Promise<TAddOutcome>>('studio-add-to-looks');
    const { lookId } =
      invoke<IMemberScenesListing>('member-scenes-list').scenes[0];

    registration.reportFailure(lookId, 'gpu-reset');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining(lookId));

    // Still loads: nothing about the failure was kept from a fresh attempt.
    expect(invoke('member-scenes-load', lookId)).toBeDefined();
    expect(registration.loadVisible(lookId)).toBeDefined();
    registration.dispose();
  });

  it("will not load or remove another account's scene", async () => {
    const registration = setup();
    const lookId = `member:${SOMEONE}:my-first-scene`;
    expect(invoke('member-scenes-load', lookId)).toBeUndefined();
    expect(invoke('member-scenes-remove', lookId)).toBe(false);
    expect(invoke('member-scenes-load', '../../etc/passwd')).toBeUndefined();
    registration.dispose();
  });

  it('makes a named project in the projects folder, and opens it', async () => {
    const registration = setup();
    const opened = await invoke<Promise<IStudioState>>('studio-open');
    const documents = path.join(root, 'Documents');
    expect(opened.projectsRoot).toBe(path.join(documents, 'FluidEQ Studio'));

    expect(await invoke('studio-create-project', 'Northern Lights')).toBe(
      'written',
    );
    const folder = path.join(documents, 'FluidEQ Studio', 'Northern Lights');
    expect(
      JSON.parse(fs.readFileSync(path.join(folder, 'pack.json'), 'utf8')),
    ).toMatchObject({
      id: 'northern-lights',
      names: { en: 'Northern Lights' },
    });
    const state = await invoke<Promise<IStudioState>>('studio-open');
    const active = state.projects.find((entry) => entry.id === state.activeId);
    expect(active?.path).toBe(folder);
    registration.dispose();
  });

  it('never writes a project over a folder that is there, or from a path', async () => {
    const registration = setup();
    await invoke<Promise<IStudioState>>('studio-open');
    expect(await invoke('studio-create-project', 'Deep Sea')).toBe('written');
    expect(await invoke('studio-create-project', 'Deep Sea')).toBe('exists');
    expect(await invoke('studio-create-project', '..')).toBe('invalid');
    expect(await invoke('studio-create-project', { path: 'C:\\' })).toBe(
      'invalid',
    );
    registration.dispose();
  });

  it('opens "Open a folder" on the projects folder, made if it is not there', async () => {
    const registration = setup();
    const studioFolder = path.join(root, 'Documents', 'FluidEQ Studio');
    await link();
    expect(dialogOpenedAt).toBe(studioFolder);
    expect(fs.existsSync(studioFolder)).toBe(true);
    // Once the member has chosen another, that is where it opens.
    chosen = path.join(root, 'My scenes');
    fs.mkdirSync(chosen);
    await invoke<Promise<IStudioState>>('studio-choose-root');
    chosen = undefined;
    await link();
    expect(dialogOpenedAt).toBe(path.join(root, 'My scenes'));
    registration.dispose();
  });

  it('remembers where new projects go once the member chooses', async () => {
    const registration = setup();
    chosen = path.join(root, 'My scenes');
    fs.mkdirSync(chosen);
    const state = await invoke<Promise<IStudioState>>('studio-choose-root');
    expect(state.projectsRoot).toBe(chosen);
    expect(await invoke('studio-create-project', 'Vinyl')).toBe('written');
    expect(fs.existsSync(path.join(chosen, 'Vinyl', 'pack.json'))).toBe(true);
    registration.dispose();
    // And after a restart.
    const again = setup();
    expect(
      (await invoke<Promise<IStudioState>>('studio-open')).projectsRoot,
    ).toBe(chosen);
    again.dispose();
  });

  it('keeps many projects, and works on the one that is open', async () => {
    const registration = setup();
    const city = await project();
    const sea = path.join(root, 'sea');
    fs.mkdirSync(sea);
    await writeStarterProject(sea, {
      name: 'My First Scene',
      id: 'my-first-scene',
    });
    fs.writeFileSync(
      path.join(sea, 'pack.json'),
      fs
        .readFileSync(path.join(sea, 'pack.json'), 'utf8')
        .replace('"my-first-scene"', '"deep-sea"')
        .replace('"My First Scene"', '"Deep Sea"'),
    );
    await invoke<Promise<IStudioState>>('studio-open');
    chosen = city;
    await link();
    chosen = sea;
    const both = await link();

    // Most recent first, named by what the scene is called, the new one open.
    expect(both.projects.map((entry) => entry.names?.en)).toEqual([
      'Deep Sea',
      'My First Scene',
    ]);
    expect(both.activeId).toBe(both.projects[0]?.id);
    expect(await invoke('studio-add-to-looks')).toMatchObject({
      ok: true,
      scene: { packId: 'deep-sea' },
    });

    // Opening the other one moves the work to it.
    const cityId = both.projects[1]?.id;
    const switched = await invoke<Promise<IStudioState>>(
      'studio-select-project',
      cityId,
    );
    expect(switched.activeId).toBe(cityId);
    expect(await invoke('studio-add-to-looks')).toMatchObject({
      ok: true,
      scene: { packId: 'my-first-scene' },
    });

    // An id the list does not hold changes nothing.
    expect(
      (await invoke<Promise<IStudioState>>('studio-select-project', 'nope'))
        .activeId,
    ).toBe(cityId);

    // Removing the open one opens the other, and leaves the folder as it was.
    const after = await invoke<Promise<IStudioState>>(
      'studio-forget-project',
      cityId,
    );
    expect(after.projects.map((entry) => entry.folderName)).toEqual(['sea']);
    expect(after.activeId).toBe(after.projects[0]?.id);
    expect(fs.existsSync(path.join(city, 'pack.json'))).toBe(true);
    registration.dispose();
  });

  it('adds what is on disk, not what the page says', async () => {
    const registration = setup();
    chosen = await project();
    await invoke<Promise<IStudioState>>('studio-open');
    await link();
    // Break the folder after linking: the add reads it afresh and refuses.
    fs.writeFileSync(path.join(chosen, 'scene.frag'), '#define BROKEN 1\n');
    expect(await invoke('studio-add-to-looks')).toEqual({
      ok: false,
      reason: 'no-build',
    });
    registration.dispose();
  });

  it("shows the open project's code, and saves the code pane's text into it", async () => {
    const registration = setup();
    chosen = await project();
    const file = path.join(chosen, 'scene.frag');
    await invoke<Promise<IStudioState>>('studio-open');
    await link();
    await expect(sentOn('studio-source-changed')).resolves.toEqual({
      file: 'scene.frag',
      text: fs.readFileSync(file, 'utf8'),
    });

    expect(await invoke('studio-write-source', '// from the pane')).toBe(
      'written',
    );
    expect(fs.readFileSync(file, 'utf8')).toBe('// from the pane');

    // Text only: never a path or anything else the page might send.
    expect(await invoke('studio-write-source', { file: '../x' })).toBe(
      'failed',
    );

    // Their own project is theirs to work on with or without Plus.
    status = { state: 'none' };
    asMaker();
    listeners.forEach((listener) => listener(status));
    expect(await invoke('studio-write-source', '// without Plus')).toBe(
      'written',
    );
    expect(fs.readFileSync(file, 'utf8')).toBe('// without Plus');
    registration.dispose();
  });

  it('gives a maker without Plus one project, made and worked on here', async () => {
    status = { state: 'none' };
    asMaker();
    const registration = setup();
    const opened = await invoke<Promise<IStudioState>>('studio-open');
    expect(opened).toMatchObject({ entitled: false, mayAddProject: true });

    expect(await invoke('studio-create-project', 'Neon City')).toBe('written');
    const state = await invoke<Promise<IStudioState>>('studio-open');
    expect(state.projects.map((entry) => entry.names?.en)).toEqual([
      'Neon City',
    ]);
    // It plays and is edited like any other: the source is written, its
    // settings and notes are saved, and the folder is watched.
    expect(await invoke('studio-write-source', '// mine')).toBe('written');
    const folder = state.projects[0]?.path ?? '';
    expect(fs.readFileSync(path.join(folder, 'scene.frag'), 'utf8')).toBe(
      '// mine',
    );

    // The second one, and every other way to one, is Plus's.
    expect(state.mayAddProject).toBe(false);
    expect(await invoke('studio-create-project', 'Deep Sea')).toBe('plus-only');
    chosen = await project();
    expect((await link()).projects.map((entry) => entry.names?.en)).toEqual([
      'Neon City',
    ]);
    expect(await invoke('studio-add-to-looks')).toEqual({
      ok: false,
      reason: 'not-entitled',
    });
    expect(invoke<IMemberScenesListing>('member-scenes-list').scenes).toEqual(
      [],
    );
    registration.dispose();
  });

  it('gives a member with neither Plus nor an approved scene no project at all', async () => {
    // The Studio is Plus's, reached through the trial (Ivan, 2026-09-20).
    // The one project above is the maker's way back in — somebody who has
    // never had a scene approved has nothing to be locked out of, and the
    // page shows them what the Studio is instead of a bench.
    status = { state: 'none' };
    const registration = setup();
    const opened = await invoke<Promise<IStudioState>>('studio-open');
    expect(opened).toMatchObject({
      entitled: false,
      maker: false,
      mayAddProject: false,
    });

    expect(await invoke('studio-create-project', 'Neon City')).toBe(
      'plus-only',
    );
    chosen = await project();
    expect((await link()).projects).toEqual([]);

    // And the same account, once the server says it is a maker: the state
    // the page is given says so, and the project can be made. Without this
    // control the refusals above could be anything at all.
    asMaker();
    registration.makerChanged();
    const asMakerNow = await invoke<Promise<IStudioState>>('studio-open');
    expect(asMakerNow).toMatchObject({ maker: true, mayAddProject: true });
    expect(await invoke('studio-create-project', 'Neon City')).toBe('written');
    registration.dispose();
  });

  it('opens the first of a folder of several without Plus, and lists the rest locked', async () => {
    status = { state: 'none' };
    asMaker();
    const registration = setup();
    const many = path.join(root, 'many');
    fs.mkdirSync(many);
    await Promise.all(
      ['one', 'two', 'three'].map(async (name) => {
        const folder = path.join(many, name);
        fs.mkdirSync(folder);
        await writeStarterProject(folder, { name, id: name });
      }),
    );
    await invoke<Promise<IStudioState>>('studio-open');
    chosen = many;
    const linked =
      await invoke<Promise<ILinkFolderResult>>('studio-link-folder');
    expect(linked.outcome).toBe('one-opened');
    const byName = (state: IStudioState) =>
      [...state.projects]
        .sort((a, b) => a.folderName.localeCompare(b.folderName))
        .map((entry) => `${entry.folderName}${entry.locked ? ':locked' : ''}`);
    // All three listed, the first by name on the bench, the others locked.
    expect(byName(linked.state)).toEqual(['one', 'three:locked', 'two:locked']);
    const one = linked.state.projects.find(
      (entry) => entry.folderName === 'one',
    );
    const two = linked.state.projects.find(
      (entry) => entry.folderName === 'two',
    );
    expect(linked.state.activeId).toBe(one?.id);
    expect(linked.state.mayAddProject).toBe(false);
    // A locked one is not picked, and its notes are not read or written.
    expect(
      (await invoke<Promise<IStudioState>>('studio-select-project', two?.id))
        .activeId,
    ).toBe(one?.id);
    const notes = { description: 'two', prompt: 'the second scene' };
    expect(invoke('studio-notes-save', two?.id, notes)).toBe(false);
    // Letting the open one go moves the bench to the next: one at a time.
    const after = await invoke<Promise<IStudioState>>(
      'studio-forget-project',
      one?.id,
    );
    expect(after.projects.map((entry) => entry.locked)).toContain(undefined);
    expect(after.activeId).toBeDefined();
    expect(
      after.projects.find((entry) => entry.id === after.activeId)?.locked,
    ).toBeUndefined();
    // With Plus every one of them opens, and lapsing keeps the open one.
    status = { state: 'active' };
    listeners.forEach((listener) => listener(status));
    const opened = await invoke<Promise<IStudioState>>(
      'studio-select-project',
      two?.id,
    );
    expect(opened.activeId).toBe(two?.id);
    expect(opened.projects.every((entry) => !entry.locked)).toBe(true);
    status = { state: 'none' };
    asMaker();
    listeners.forEach((listener) => listener(status));
    const lapsed = await invoke<Promise<IStudioState>>('studio-open');
    expect(lapsed.activeId).toBe(two?.id);
    expect(byName(lapsed)).toEqual(['three:locked', 'two']);
    // A cancelled dialog says so.
    chosen = undefined;
    status = { state: 'active' };
    expect(
      (await invoke<Promise<ILinkFolderResult>>('studio-link-folder')).outcome,
    ).toBe('cancelled');
    registration.dispose();
  });

  it('makes one project at a time: two asked for together leave one without Plus', async () => {
    status = { state: 'none' };
    asMaker();
    const registration = setup();
    await invoke<Promise<IStudioState>>('studio-open');
    const results = await Promise.all([
      invoke<Promise<TNewProjectResult>>('studio-create-project', 'One'),
      invoke<Promise<TNewProjectResult>>('studio-create-project', 'Two'),
    ]);
    expect(results).toEqual(['written', 'plus-only']);
    const state = await invoke<Promise<IStudioState>>('studio-open');
    expect(state.projects).toHaveLength(1);
    expect(
      fs.existsSync(path.join(root, 'Documents', 'FluidEQ Studio', 'Two')),
    ).toBe(false);
    registration.dispose();
  });

  it('moves the bench off a FluidEQ scene when Plus lapses, and keeps its mark for when it returns', async () => {
    const registration = setup();
    await invoke<Promise<IStudioState>>('studio-open');
    chosen = await project();
    const mine = (await link()).projects[0];
    const aurora = memberPack({ id: 'aurora', names: { en: 'Aurora' } });
    await registration.openInspection(aurora);
    const withPlus = await invoke<Promise<IStudioState>>('studio-open');
    const official = withPlus.projects.find((entry) => entry.official);
    expect(withPlus.activeId).toBe(official?.id);

    status = { state: 'none' };
    asMaker();
    listeners.forEach((listener) => listener(status));
    const lapsed = await invoke<Promise<IStudioState>>('studio-open');
    // Listed with a lock and off the bench: the member's own project opens.
    expect(
      lapsed.projects.map((entry) => [entry.id, entry.locked ?? false]),
    ).toEqual([
      [mine?.id, false],
      [official?.id, true],
    ]);
    expect(lapsed.activeId).toBe(mine?.id);
    expect(registration.activeIsInspection()).toBe(false);
    // Not to be picked, read, or let go of — letting go would drop the mark,
    // and the folder opened again would come back as the member's own.
    expect(
      (
        await invoke<Promise<IStudioState>>(
          'studio-select-project',
          official?.id,
        )
      ).activeId,
    ).toBe(mine?.id);
    const notes = { description: 'mine', prompt: 'a scene of my own' };
    expect(invoke('studio-notes-save', official?.id, notes)).toBe(false);
    expect(invoke('studio-notes-save', mine?.id, notes)).toBe(true);
    await invoke<Promise<IStudioState>>('studio-forget-project', official?.id);

    status = { state: 'active' };
    listeners.forEach((listener) => listener(status));
    const back = await invoke<Promise<IStudioState>>('studio-open');
    expect(back.projects.find((entry) => entry.official)?.id).toBe(
      official?.id,
    );
    registration.dispose();
  });

  it('refreshes a look from a settings save only with Plus', async () => {
    const registration = setup();
    await invoke<Promise<IStudioState>>('studio-open');
    chosen = await project();
    await link();
    await invoke<Promise<TAddOutcome>>('studio-add-to-looks');
    const settings = { params: { glow: 0.25 } };
    expect(await invoke('studio-write-settings', settings)).toEqual({
      written: 'written',
      lookUpdated: true,
    });

    status = { state: 'none' };
    asMaker();
    listeners.forEach((listener) => listener(status));
    // The project is still theirs to edit; the look they added stays as it
    // was, since saving it again is adding it, and adding is Plus's.
    expect(
      await invoke('studio-write-settings', { params: { glow: 0.5 } }),
    ).toEqual({ written: 'written', lookUpdated: false });
    registration.dispose();
  });

  it('opens a FluidEQ scene as a project marked to look inside, and never adds it to looks', async () => {
    const registration = setup();
    await invoke<Promise<IStudioState>>('studio-open');
    const aurora = memberPack({ id: 'aurora', names: { en: 'Aurora' } });

    expect(await registration.openInspection(aurora)).toBe('opened');
    const projectsRoot = path.join(root, 'Documents', 'FluidEQ Studio');
    const folder = path.join(projectsRoot, 'Aurora (FluidEQ)');
    expect(fs.readFileSync(path.join(folder, 'scene.frag'), 'utf8')).toBe(
      aurora.source,
    );
    expect(registration.activeIsInspection()).toBe(true);
    expect(registration.activeFolder()).toBe(folder);
    const listed = await invoke<Promise<IStudioState>>('studio-open');
    expect(listed.projects[0]).toMatchObject({
      folderName: 'Aurora (FluidEQ)',
      official: true,
    });

    expect(await invoke('studio-add-to-looks')).toEqual({
      ok: false,
      reason: 'inspect-only',
    });
    expect(invoke<IMemberScenesListing>('member-scenes-list').scenes).toEqual(
      [],
    );

    // Asked again, the project already made is opened, not a second copy.
    expect(await registration.openInspection(aurora)).toBe('present');
    expect(fs.readdirSync(projectsRoot)).toEqual(['Aurora (FluidEQ)']);

    // The control: the member's own project beside it is added as ever.
    chosen = await project();
    await link();
    expect(registration.activeIsInspection()).toBe(false);
    expect(await invoke('studio-add-to-looks')).toMatchObject({ ok: true });
    registration.dispose();
  });

  it('makes a fresh project when the one it made has gone from its folder', async () => {
    const registration = setup();
    await invoke<Promise<IStudioState>>('studio-open');
    const aurora = memberPack({ id: 'aurora', names: { en: 'Aurora' } });
    await registration.openInspection(aurora);
    const projectsRoot = path.join(root, 'Documents', 'FluidEQ Studio');
    fs.rmSync(path.join(projectsRoot, 'Aurora (FluidEQ)'), {
      recursive: true,
    });
    expect(await registration.openInspection(aurora)).toBe('opened');
    expect(registration.activeIsInspection()).toBe(true);
    registration.dispose();
  });

  it('has nowhere to save the code pane into before a project is open', async () => {
    const registration = setup();
    await invoke<Promise<IStudioState>>('studio-open');
    expect(await invoke('studio-write-source', '// nowhere')).toBe('failed');
    registration.dispose();
  });
});
