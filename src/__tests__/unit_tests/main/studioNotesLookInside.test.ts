/**
 * @jest-environment node
 */

/**
 * The Studio's panes as main wires them: notes are written only into a
 * scene that is the member's own, never one opened to look inside - one of
 * FluidEQ's official scenes or a copy of another member's - though both are
 * read (Ivan, 2026-11-11: the notes editable in the Code tab; FluidEQ's own
 * scenes and locked copies never).
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import type { IStoredProject } from '../../../main/memberScenes/studioProjects';
import type { IMemberSceneStore } from '../../../main/memberScenes/store';
import { registerStudioProjectPanes } from '../../../main/ipc/studioProjectPanes';

const mockHandlers = new Map<
  string,
  (event: unknown, ...args: unknown[]) => unknown
>();

jest.mock('electron', () => ({
  ipcMain: {
    handle: (
      name: string,
      handler: (event: unknown, ...args: unknown[]) => unknown,
    ) => mockHandlers.set(name, handler),
    removeHandler: (name: string) => mockHandlers.delete(name),
    on: () => undefined,
    removeListener: () => undefined,
    removeAllListeners: () => undefined,
  },
  app: { getPath: () => os.tmpdir() },
  nativeImage: { createFromBuffer: () => ({ isEmpty: () => true }) },
}));

let root: string;
let projects: Record<string, IStoredProject>;
let dispose: () => void;

const call = (channel: string, ...args: unknown[]) => {
  const handler = mockHandlers.get(channel);
  if (!handler) {
    throw new Error(`${channel} is not handled`);
  }
  return handler({}, ...args);
};

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-notes-panes-'));
  const project = (id: string, mark: Partial<IStoredProject> = {}) => {
    const folder = path.join(root, id);
    fs.mkdirSync(folder);
    fs.writeFileSync(
      path.join(folder, 'studio-notes.json'),
      JSON.stringify({ schema: 1, description: `${id} as it was` }),
    );
    return { id, folder, openedAt: 1, ...mark };
  };
  projects = {
    mine: project('mine'),
    official: project('official', { official: 'aquarium' }),
    copy: project('copy', {
      member: { authorId: 'a', sceneId: 's', version: 1, maker: 'Ana' },
      origin: 'opened',
    }),
  };
  dispose = registerStudioProjectPanes({
    getMainWindow: () => null,
    usableProject: (id) => projects[id],
    mayUseActive: () => true,
    activeFolder: () => projects.mine.folder,
    mayUpdateLook: () => false,
    accountId: () => undefined,
    store: {} as IMemberSceneStore,
    announceScenes: () => undefined,
    dialogImpl: { showOpenDialog: jest.fn() } as never,
  });
});

afterEach(() => {
  dispose();
  fs.rmSync(root, { recursive: true, force: true });
});

const onDisk = (id: string) =>
  JSON.parse(
    fs.readFileSync(
      path.join(projects[id].folder, 'studio-notes.json'),
      'utf8',
    ),
  ).description;

it("writes the member's own scene's notes", () => {
  expect(call('studio-notes-save', 'mine', { description: 'changed' })).toBe(
    true,
  );
  expect(onDisk('mine')).toBe('changed');
});

it('reads and never writes the notes of a scene opened to look inside', () => {
  ['official', 'copy'].forEach((id) => {
    expect(call('studio-notes-read', id)).toEqual({
      description: `${id} as it was`,
    });
    expect(call('studio-notes-save', id, { description: 'changed' })).toBe(
      false,
    );
    expect(onDisk(id)).toBe(`${id} as it was`);
  });
});
