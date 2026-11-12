/** @jest-environment node */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { writeStarterProject } from '../../../main/memberScenes/project';
import {
  jsonErrorLine,
  jsonErrorOffset,
} from '../../../main/memberScenes/jsonErrorLine';
import {
  checkCodeDraft,
  writeCodeFile,
} from '../../../main/memberScenes/projectCodeDraft';
import {
  STARTER_ANIMATION,
  STARTER_ANIMATION_NAME,
} from '../../../main/memberScenes/starterScene';

/**
 * A Code tab file's draft, checked and saved on a real project folder (the
 * mockup Ivan approved on 2026-11-11): built by the rules every save of the
 * folder goes through with the draft standing in for the file, never
 * written when it fails, and only ever a file the tab lists as the scene's
 * code.
 */

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
const ANIMATION_FILE = `animations/${STARTER_ANIMATION_NAME}.json`;

let folder: string;
const read = (file: string) => fs.readFileSync(path.join(folder, file), 'utf8');

beforeEach(async () => {
  folder = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-code-draft-'));
  await writeStarterProject(folder, { name: 'Lake', id: 'lake' });
  const manifest = JSON.parse(read('pack.json')) as Record<string, unknown>;
  fs.writeFileSync(
    path.join(folder, 'world.json'),
    JSON.stringify(WORLD, null, 2),
  );
  fs.writeFileSync(
    path.join(folder, 'pack.json'),
    JSON.stringify({ ...manifest, worldFile: 'world.json' }),
  );
});

afterEach(() => {
  fs.rmSync(folder, { recursive: true, force: true });
});

describe("the scene's shader", () => {
  it('builds from the draft without writing it, and plays as the draft', async () => {
    const saved = read('scene.frag');
    const draft = `${saved}\n// a draft\n`;
    const checked = await checkCodeDraft(folder, 'scene.frag', draft);
    expect(checked).toMatchObject({ ok: true });
    expect(checked.ok && checked.pack?.source).toContain('// a draft');
    expect(read('scene.frag')).toBe(saved);
  });

  it('is held back with the line the rules point at, and not written', async () => {
    const saved = read('scene.frag');
    // A loop the scene rules refuse, on the draft's line 2.
    const [first, ...rest] = saved.split('\n');
    const draft = [first, 'void stall() { while (true) {} }', ...rest].join(
      '\n',
    );
    const checked = await checkCodeDraft(folder, 'scene.frag', draft);
    expect(checked.ok).toBe(false);
    const problems =
      !checked.ok && 'problems' in checked ? checked.problems : [];
    expect(problems.length).toBeGreaterThan(0);
    expect(problems.some((problem) => problem.line === 2)).toBe(true);
    await expect(writeCodeFile(folder, 'scene.frag', draft)).resolves.toEqual({
      problems,
    });
    expect(read('scene.frag')).toBe(saved);
  });
});

describe('the world and its JSON', () => {
  it('says which line a draft stops being JSON on, and writes nothing', async () => {
    const saved = read('world.json');
    const lines = saved.split('\n');
    lines.splice(3, 0, '  "oops": ,');
    const draft = lines.join('\n');
    const answer = await writeCodeFile(folder, 'world.json', draft);
    expect(answer).toEqual({ problems: [{ code: 'bad-json', line: 4 }] });
    expect(read('world.json')).toBe(saved);
  });

  it('holds back a world the rules refuse, and writes one they take', async () => {
    const empty = JSON.stringify({ ...WORLD, nodes: [] }, null, 2);
    const refused = await writeCodeFile(folder, 'world.json', empty);
    expect(typeof refused === 'object' && refused.problems[0].code).toBe(
      'bad-world',
    );
    const moved = JSON.stringify(
      { ...WORLD, nodes: [{ ...WORLD.nodes[0], position: [1, 2, 3] }] },
      null,
      2,
    );
    await expect(writeCodeFile(folder, 'world.json', moved)).resolves.toBe(
      'written',
    );
    expect(read('world.json')).toBe(moved);
  });
});

describe('an animation', () => {
  it('is saved through its history, as the Studio keeps it', async () => {
    const draft = `${JSON.stringify({ ...STARTER_ANIMATION, fps: 14 }, null, 2)}\n`;
    await expect(writeCodeFile(folder, ANIMATION_FILE, draft)).resolves.toBe(
      'written',
    );
    expect(JSON.parse(read(ANIMATION_FILE))).toMatchObject({ fps: 14 });
    // Undoable like any other change: its history now holds a version.
    expect(fs.existsSync(path.join(folder, 'animation-history'))).toBe(true);
  });

  it('is refused when it is no longer one the Studio plays, or names another sheet', async () => {
    const saved = read(ANIMATION_FILE);
    const tooFast = JSON.stringify({ ...STARTER_ANIMATION, fps: 400 });
    const elsewhere = JSON.stringify({
      ...STARTER_ANIMATION,
      sheet: 'art/someone-else.png',
    });
    await expect(
      writeCodeFile(folder, ANIMATION_FILE, tooFast),
    ).resolves.toEqual({ problems: [{ code: 'bad-animation' }] });
    await expect(
      writeCodeFile(folder, ANIMATION_FILE, elsewhere),
    ).resolves.toEqual({ problems: [{ code: 'bad-animation' }] });
    expect(read(ANIMATION_FILE)).toBe(saved);
  });
});

describe('what is never edited here', () => {
  it('the details file, the notes, and a name the folder does not list', async () => {
    const pack = read('pack.json');
    await expect(writeCodeFile(folder, 'pack.json', '{}')).resolves.toBe(
      'not-editable',
    );
    await expect(checkCodeDraft(folder, 'pack.json', '{}')).resolves.toEqual({
      ok: false,
      refused: 'not-editable',
    });
    await expect(
      writeCodeFile(folder, '../outside.frag', '// x'),
    ).resolves.toBe('not-editable');
    await expect(writeCodeFile(folder, 'made-up.glsl', '// x')).resolves.toBe(
      'not-editable',
    );
    expect(read('pack.json')).toBe(pack);
    expect(fs.existsSync(path.join(folder, 'made-up.glsl'))).toBe(false);
  });
});

describe('where a text stops being JSON', () => {
  it('is the first character the grammar cannot take', () => {
    expect(jsonErrorLine('{\n  "a": ,\n}')).toBe(2);
    expect(jsonErrorOffset('{"a": [1, 2,, 3]}')).toBe(12);
    expect(jsonErrorLine('{\n  "a": 1\n  "b": 2\n}')).toBe(3);
    // Cut off: the place is the end of the text.
    expect(jsonErrorOffset('{"a": "b')).toBe(8);
    // Something after a whole value.
    expect(jsonErrorOffset('{} x')).toBe(3);
    expect(jsonErrorOffset('{"a": tru}')).toBe(6);
  });

  it('is nowhere in text that is JSON, however it is laid out', () => {
    [
      '{}',
      '[]',
      '  {"a": [1, -2.5e3, true, false, null, "x\\u00e9\\n"], "b": {"c": []}}  ',
      JSON.stringify({ nested: [[[{ deep: [1] }]]] }, null, 2),
    ].forEach((text) => {
      expect(() => JSON.parse(text)).not.toThrow();
      expect(jsonErrorOffset(text)).toBeUndefined();
    });
  });
});
