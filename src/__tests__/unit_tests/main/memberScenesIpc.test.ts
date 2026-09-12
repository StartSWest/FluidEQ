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

// eslint-disable-next-line import/first -- the electron mock must be installed first
import {
  registerMemberScenesIpc,
  type IMemberScenesListing,
  type IStudioState,
  type TAddOutcome,
} from '../../../main/ipc/memberScenes';
// eslint-disable-next-line import/first -- as above
import { writeStarterProject } from '../../../main/memberScenes/project';
// eslint-disable-next-line import/first -- as above
import type { IEntitlementStatus } from '../../../main/account/entitlement';

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

const setup = () => {
  const window = {
    webContents: {
      send: (channel: string, value: unknown) => sent.push([channel, value]),
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
  });
};

beforeEach(() => {
  handlers.clear();
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-studio-ipc-'));
  status = { state: 'active' };
  listeners = [];
  chosen = undefined;
  dialogOpenedAt = undefined;
  sent = [];
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

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
    const state = await invoke<Promise<IStudioState>>('studio-link-folder');
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

  it('refuses every making and drawing call without Plus', async () => {
    const registration = setup();
    chosen = await project();
    await invoke<Promise<IStudioState>>('studio-open');
    await invoke<Promise<IStudioState>>('studio-link-folder');
    await invoke<Promise<TAddOutcome>>('studio-add-to-looks');
    const { lookId } =
      invoke<IMemberScenesListing>('member-scenes-list').scenes[0];

    status = { state: 'none' };
    listeners.forEach((listener) => listener(status));
    expect(invoke('member-scenes-load', lookId)).toBeUndefined();
    expect(await invoke('studio-create-project', 'Neon City')).toBe('refused');
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
    await invoke<Promise<IStudioState>>('studio-link-folder');
    expect(dialogOpenedAt).toBe(studioFolder);
    expect(fs.existsSync(studioFolder)).toBe(true);
    // Once the member has chosen another, that is where it opens.
    chosen = path.join(root, 'My scenes');
    fs.mkdirSync(chosen);
    await invoke<Promise<IStudioState>>('studio-choose-root');
    chosen = undefined;
    await invoke<Promise<IStudioState>>('studio-link-folder');
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
    await invoke<Promise<IStudioState>>('studio-link-folder');
    chosen = sea;
    const both = await invoke<Promise<IStudioState>>('studio-link-folder');

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
    await invoke<Promise<IStudioState>>('studio-link-folder');
    // Break the folder after linking: the add reads it afresh and refuses.
    fs.writeFileSync(path.join(chosen, 'scene.frag'), '#define BROKEN 1\n');
    expect(await invoke('studio-add-to-looks')).toEqual({
      ok: false,
      reason: 'no-build',
    });
    registration.dispose();
  });
});
