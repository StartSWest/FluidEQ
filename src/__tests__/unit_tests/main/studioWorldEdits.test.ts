/**
 * @jest-environment node
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  readProject,
  writeStarterProject,
} from '../../../main/memberScenes/project';
import { editProjectWorld } from '../../../main/memberScenes/worldEdits';

/**
 * Edit mode's Save, in the scene's own folder (Ivan, 2026-11-10: "make sure
 * I dont shit the scene"): every change since the last written once, where
 * the world already is, and never a world that will not build - what was
 * there before is put back.
 */

const WORLD = {
  camera: { fov: 45, position: [0, 2.6, 13], target: [0, 1.2, 0] },
  backdrop: '#0a1730',
  materials: {
    moon: { kind: 'basic', colour: '#f2ecd2' },
    pine: { kind: 'standard', colour: '#0e3a33', roughness: 0.9 },
  },
  nodes: [
    {
      type: 'light',
      name: 'Sky light',
      light: { kind: 'hemisphere', colour: '#8fb4ff', intensity: 1.4 },
    },
    {
      type: 'mesh',
      name: 'Moon',
      position: [5.5, 5.6, -9],
      geometry: { kind: 'sphere', radius: 0.9 },
      material: 'moon',
    },
    {
      type: 'group',
      name: 'Shore',
      position: [-5, 0, -2],
      children: [
        {
          type: 'mesh',
          name: 'Pine',
          position: [0, 1.1, 0],
          geometry: { kind: 'cone', radius: 0.6, size: [1, 2.2, 1] },
          material: 'pine',
        },
      ],
    },
  ],
};

let folder: string;

const file = (name: string) => path.join(folder, name);
const readJson = (name: string) =>
  JSON.parse(fs.readFileSync(file(name), 'utf8')) as Record<string, unknown>;
const nodesOf = (world: unknown) =>
  (world as { nodes: Record<string, unknown>[] }).nodes;

/** The starter, with `WORLD` written inside pack.json or in a file beside it. */
const project = async (where: 'inline' | 'file', world: unknown = WORLD) => {
  await writeStarterProject(folder, { name: 'Lake', id: 'lake' });
  const manifest = readJson('pack.json');
  if (where === 'file') {
    fs.writeFileSync(file('world.json'), `${JSON.stringify(world, null, 2)}\n`);
    fs.writeFileSync(
      file('pack.json'),
      JSON.stringify({ ...manifest, worldFile: 'world.json' }, null, 2),
    );
  } else {
    fs.writeFileSync(
      file('pack.json'),
      JSON.stringify({ ...manifest, world }, null, 2),
    );
  }
};

beforeEach(() => {
  folder = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-edit-'));
});

afterEach(() => {
  fs.rmSync(folder, { recursive: true, force: true });
});

describe("Edit mode's Save", () => {
  it('builds the scene these cases start from', async () => {
    await project('file');
    const build = await readProject(folder);
    expect(build.ok && build.pack.world?.nodes).toHaveLength(3);
  });

  it('writes every change of one save into the world file, in order, once', async () => {
    await project('file');
    const before = fs.readFileSync(file('pack.json'), 'utf8');
    expect(
      await editProjectWorld(folder, [
        { kind: 'move', path: [1], position: [1, 0, 0.5] },
        { kind: 'rename', path: [1], name: 'Full moon' },
        { kind: 'move', path: [2, 0], position: [0, 0, 2] },
      ]),
    ).toEqual({ ok: true, changed: true });
    const nodes = nodesOf(readJson('world.json'));
    expect(nodes[1]).toMatchObject({
      name: 'Full moon',
      position: [6.5, 5.6, -8.5],
    });
    expect(
      (nodes[2] as { children: Record<string, unknown>[] }).children[0],
    ).toMatchObject({ name: 'Pine', position: [0, 1.1, 2] });
    // The world has a file of its own, so pack.json is not rewritten.
    expect(fs.readFileSync(file('pack.json'), 'utf8')).toBe(before);
    // And the scene still plays, with the thing where it was put.
    const build = await readProject(folder);
    expect(build.ok && build.pack.world?.nodes[1].name).toBe('Full moon');
  });

  it('writes into pack.json when the world is written there, and keeps the rest of it', async () => {
    await project('inline');
    const before = readJson('pack.json');
    expect(
      await editProjectWorld(folder, [
        { kind: 'show', path: [1], shown: false },
      ]),
    ).toEqual({ ok: true, changed: true });
    const after = readJson('pack.json');
    expect(nodesOf(after.world)[1]).toMatchObject({ name: 'Moon' });
    expect(JSON.stringify(nodesOf(after.world)[1])).not.toBe(
      JSON.stringify(nodesOf(before.world)[1]),
    );
    const { world: was, ...restBefore } = before;
    const { world: is, ...restAfter } = after;
    expect(restAfter).toEqual(restBefore);
    expect(fs.existsSync(file('world.json'))).toBe(false);
  });

  it('writes nothing when the changes leave the world as it was', async () => {
    await project('file');
    const before = fs.readFileSync(file('world.json'), 'utf8');
    expect(
      await editProjectWorld(folder, [
        { kind: 'rename', path: [1], name: 'Moon' },
      ]),
    ).toEqual({ ok: true, changed: false });
    expect(fs.readFileSync(file('world.json'), 'utf8')).toBe(before);
  });

  it('refuses a change to a thing that is not there, and writes none of the save', async () => {
    await project('file');
    const before = fs.readFileSync(file('world.json'), 'utf8');
    expect(
      await editProjectWorld(folder, [
        { kind: 'rename', path: [1], name: 'Full moon' },
        { kind: 'move', path: [9], position: [1, 0, 0] },
      ]),
    ).toEqual({ ok: false, reason: 'missing' });
    expect(fs.readFileSync(file('world.json'), 'utf8')).toBe(before);
  });

  it('says a scene with no 3D world has none', async () => {
    await writeStarterProject(folder, { name: 'Lake', id: 'lake' });
    expect(
      await editProjectWorld(folder, [
        { kind: 'rename', path: [0], name: 'x' },
      ]),
    ).toEqual({ ok: false, reason: 'no-world' });
  });

  it('will not edit a world whose file holds a thing FluidEQ does not draw', async () => {
    // Places are counted on the world as drawn: with a thing the reader
    // drops, the second thing of the file is the first on the stage.
    await project('file', {
      ...WORLD,
      nodes: [{ type: 'hologram', name: 'Not a thing' }, ...WORLD.nodes],
    });
    const before = fs.readFileSync(file('world.json'), 'utf8');
    expect(
      await editProjectWorld(folder, [
        { kind: 'rename', path: [1], name: 'Renamed' },
      ]),
    ).toEqual({ ok: false, reason: 'mismatch' });
    expect(fs.readFileSync(file('world.json'), 'utf8')).toBe(before);
  });

  it('puts the world back when a save would leave the scene without one', async () => {
    await project('file');
    const before = fs.readFileSync(file('world.json'), 'utf8');
    const outcome = await editProjectWorld(folder, [
      { kind: 'delete', path: [2] },
      { kind: 'delete', path: [1] },
      { kind: 'delete', path: [0] },
    ]);
    expect(outcome).toEqual({ ok: false, reason: 'refused' });
    expect(JSON.parse(fs.readFileSync(file('world.json'), 'utf8'))).toEqual(
      JSON.parse(before),
    );
    const build = await readProject(folder);
    expect(build.ok && build.pack.world?.nodes).toHaveLength(3);
  });

  it('answers "failed", and breaks nothing, for a folder that is not a project', async () => {
    expect(
      await editProjectWorld(folder, [
        { kind: 'rename', path: [0], name: 'x' },
      ]),
    ).toEqual({ ok: false, reason: 'failed' });
    expect(fs.readdirSync(folder)).toEqual([]);
  });
});
