/** @jest-environment node */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { registerStudioProjectCode } from '../../../main/ipc/studioProjectCode';
import { registerStudioWorldEdit } from '../../../main/ipc/studioWorldEdit';
import { writeStarterProject } from '../../../main/memberScenes/project';

/**
 * The two requests the Studio's bench sends about the open project's own
 * files - Edit mode's Save and the Code tab's list - at the point where
 * they arrive from the window: which project they are about, whether the
 * member may, and that what the window sent is read as a stranger's.
 *
 * Run against a real folder, through the handlers themselves: a page that
 * answers these for itself has not run them (Edit mode's Save hung for good
 * on its first real folder, 2026-11-11).
 */

const mockHandlers = new Map<
  string,
  (event: unknown, value?: unknown) => unknown
>();
const mockRemoved: string[] = [];
jest.mock('electron', () => ({
  ipcMain: {
    handle: (
      name: string,
      handler: (event: unknown, value?: unknown) => unknown,
    ) => mockHandlers.set(name, handler),
    removeHandler: (name: string) => mockRemoved.push(name),
  },
}));

const WORLD = {
  camera: { fov: 45, position: [0, 2.6, 13], target: [0, 1.2, 0] },
  backdrop: '#0a1730',
  materials: { moon: { kind: 'basic', colour: '#f2ecd2' } },
  nodes: [
    {
      type: 'mesh',
      name: 'Moon',
      position: [5.5, 5.6, -9],
      geometry: { kind: 'sphere', radius: 0.9 },
      material: 'moon',
    },
  ],
};

let folder: string;
let may = true;
let open = true;
let dispose: () => void = () => undefined;

const send = (channel: string, value?: unknown) =>
  mockHandlers.get(channel)?.(undefined, value);
const world = () =>
  JSON.parse(fs.readFileSync(path.join(folder, 'world.json'), 'utf8')) as {
    nodes: Record<string, unknown>[];
  };

beforeEach(async () => {
  mockHandlers.clear();
  mockRemoved.length = 0;
  may = true;
  open = true;
  folder = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-bench-'));
  await writeStarterProject(folder, { name: 'Lake', id: 'lake' });
  const manifest = JSON.parse(
    fs.readFileSync(path.join(folder, 'pack.json'), 'utf8'),
  ) as Record<string, unknown>;
  fs.writeFileSync(path.join(folder, 'world.json'), JSON.stringify(WORLD));
  fs.writeFileSync(
    path.join(folder, 'pack.json'),
    JSON.stringify({ ...manifest, worldFile: 'world.json' }),
  );
  const deps = {
    activeFolder: () => (open ? folder : undefined),
  };
  const stopEdit = registerStudioWorldEdit({ ...deps, mayEdit: () => may });
  const stopCode = registerStudioProjectCode({ ...deps, mayRead: () => may });
  dispose = () => {
    stopEdit();
    stopCode();
  };
});

afterEach(() => {
  fs.rmSync(folder, { recursive: true, force: true });
});

describe("Edit mode's Save, as the window sends it", () => {
  it('writes the changes into the open project and answers', async () => {
    expect(
      await send('studio-world-edit', [
        { kind: 'move', path: [0], position: [1, 0, 0] },
        { kind: 'rename', path: [0], name: 'Full moon' },
      ]),
    ).toEqual({ ok: true, changed: true });
    expect(world().nodes[0]).toMatchObject({
      name: 'Full moon',
      position: [6.5, 5.6, -9],
    });
    // The next save answers too: the first did not hold the folder.
    expect(
      await send('studio-world-edit', [
        { kind: 'rename', path: [0], name: 'Moon' },
      ]),
    ).toEqual({ ok: true, changed: true });
  });

  it('is closed with no project open, and for one the member may not change', async () => {
    const edit = [{ kind: 'rename', path: [0], name: 'x' }];
    open = false;
    expect(await send('studio-world-edit', edit)).toEqual({
      ok: false,
      reason: 'closed',
    });
    open = true;
    may = false;
    expect(await send('studio-world-edit', edit)).toEqual({
      ok: false,
      reason: 'closed',
    });
    expect(world().nodes[0].name).toBe('Moon');
  });

  it.each([
    ['nothing at all', undefined],
    ['no changes', []],
    ['something that is not a list', { kind: 'rename', path: [0], name: 'x' }],
    ['a change of no known kind', [{ kind: 'explode', path: [0] }]],
    [
      'a place that is not a path',
      [{ kind: 'rename', path: 'first', name: 'x' }],
    ],
    ['a path below zero', [{ kind: 'delete', path: [-1] }]],
    [
      'a move to nowhere',
      [{ kind: 'move', path: [0], position: [Infinity, 0, 0] }],
    ],
    [
      'a good change beside a bad one',
      [
        { kind: 'rename', path: [0], name: 'x' },
        { kind: 'move', path: [0], position: ['1', 0, 0] },
      ],
    ],
  ])('refuses %s, and writes nothing', async (_name, sent) => {
    expect(await send('studio-world-edit', sent)).toEqual({
      ok: false,
      reason: 'failed',
    });
    expect(world()).toEqual(WORLD);
  });

  it('keeps a name to 64 letters', async () => {
    await send('studio-world-edit', [
      { kind: 'rename', path: [0], name: 'm'.repeat(200) },
    ]);
    expect(world().nodes[0].name).toBe('m'.repeat(64));
  });
});

describe("the Code tab's files, as the window asks for them", () => {
  it("are the open project's, with nothing for the window to name", async () => {
    // Whatever is sent along is not looked at: there is no folder or file
    // the window can ask for.
    const files = (await send('studio-project-code', {
      folder: 'C:/Windows',
      file: '../secret.txt',
    })) as { file: string; role: string; text?: string }[];
    expect(files.map(({ role, file }) => `${role}:${file}`)).toEqual([
      'scene:scene.frag',
      'pack:pack.json',
      'world:world.json',
      'animation:animations/swallow-flight.json',
    ]);
    expect(files[2].text).toBe(JSON.stringify(WORLD));
  });

  it('are none with no project open, and for one the member may not use', async () => {
    open = false;
    expect(await send('studio-project-code')).toEqual([]);
    open = true;
    may = false;
    expect(await send('studio-project-code')).toEqual([]);
  });
});

describe('both channels', () => {
  it('are taken away again', () => {
    dispose();
    expect(mockRemoved.sort()).toEqual([
      'studio-project-code',
      'studio-world-edit',
    ]);
  });
});
