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
      showOpenDialog: (async () =>
        chosen
          ? { canceled: false, filePaths: [chosen] }
          : { canceled: true, filePaths: [] }) as never,
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
  sent = [];
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

const project = async () => {
  const folder = path.join(root, 'my-scene');
  fs.mkdirSync(folder);
  await writeStarterProject(folder);
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
    expect(await invoke('studio-create-starter')).toBe('refused');
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

  it('never writes a starter over an existing scene', async () => {
    const registration = setup();
    chosen = await project();
    expect(await invoke('studio-create-starter')).toBe('exists');
    chosen = undefined;
    expect(await invoke('studio-create-starter')).toBe('cancelled');
    registration.dispose();
  });

  it('keeps many projects, and works on the one that is open', async () => {
    const registration = setup();
    const city = await project();
    const sea = path.join(root, 'sea');
    fs.mkdirSync(sea);
    await writeStarterProject(sea);
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
