/**
 * @jest-environment node
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  MAX_SHOWN_BYTES,
  readProjectCode,
} from '../../../main/memberScenes/projectCode';

/**
 * The Studio's Code tab showed the scene's shader and nothing else (Ivan,
 * 2026-11-11: "it needs to show the full code, all files"). This is the read
 * behind it: every file of a project that is code, in the order the tab
 * lists them, and nothing from outside the project's folder.
 */

let folder: string;

const put = (name: string, text: string) => {
  const file = path.join(folder, name);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
};

const listed = async () =>
  (await readProjectCode(folder)).map((file) => `${file.role}:${file.file}`);

beforeEach(() => {
  folder = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-code-'));
});

afterEach(() => {
  fs.rmSync(folder, { recursive: true, force: true });
});

describe("a project's code files", () => {
  it('are every one of them, the shader first and the notes last', async () => {
    put(
      'pack.json',
      JSON.stringify({ sourceFile: 'sea.frag', worldFile: 'world.json' }),
    );
    put('sea.frag', 'vec4 sceneColour(vec2 uv) { return vec4(0.0); }');
    put(
      'world.json',
      JSON.stringify({
        materials: {
          water: { vertexFile: 'water.vert', fragmentFile: 'water.frag' },
          // The same file again, and a material with no files of its own.
          foam: { fragmentFile: 'water.frag' },
          rock: { color: '#555555' },
        },
      }),
    );
    put('water.vert', 'void main() {}');
    put('water.frag', 'void main() {}');
    put('animations/gull.json', '{"frames":4}');
    put('animations/whale.json', '{"frames":9}');
    put('studio-notes.json', '{"whatsNew":"The gull flaps."}');
    // What is not code, and is not listed.
    put('artwork.webp', 'not a picture');
    put('preview.png', 'not a picture');
    put('animations/gull.webp', 'not a picture');

    expect(await listed()).toEqual([
      'scene:sea.frag',
      'pack:pack.json',
      'world:world.json',
      'material:water.vert',
      'material:water.frag',
      'animation:animations/gull.json',
      'animation:animations/whale.json',
      'notes:studio-notes.json',
    ]);
    const files = await readProjectCode(folder);
    expect(files[0]).toEqual({
      file: 'sea.frag',
      role: 'scene',
      bytes: 47,
      text: 'vec4 sceneColour(vec2 uv) { return vec4(0.0); }',
    });
  });

  it("finds the materials' files of a world written inside pack.json", async () => {
    put(
      'pack.json',
      JSON.stringify({
        world: { materials: { gem: { fragmentFile: 'gem.frag' } } },
      }),
    );
    put('scene.frag', 'void x() {}');
    put('gem.frag', 'void main() {}');
    expect(await listed()).toEqual([
      'scene:scene.frag',
      'pack:pack.json',
      'material:gem.frag',
    ]);
  });

  it('lists a file too large to show by its size, without its text', async () => {
    put('pack.json', JSON.stringify({ worldFile: 'world.json' }));
    put('scene.frag', 'void x() {}');
    put('world.json', `{"pad":"${'x'.repeat(MAX_SHOWN_BYTES)}"}`);
    const world = (await readProjectCode(folder)).find(
      (file) => file.role === 'world',
    );
    expect(world?.bytes).toBe(MAX_SHOWN_BYTES + 10);
    expect(world && 'text' in world).toBe(false);
    // The control: one byte under the line is shown whole.
    put('world.json', 'y'.repeat(MAX_SHOWN_BYTES));
    const shown = (await readProjectCode(folder)).find(
      (file) => file.role === 'world',
    );
    expect(shown?.text).toHaveLength(MAX_SHOWN_BYTES);
  });

  it('reads nothing a name could reach outside the folder', async () => {
    const outside = path.join(path.dirname(folder), 'fluideq-code-secret.frag');
    fs.writeFileSync(outside, 'secret');
    try {
      put(
        'pack.json',
        JSON.stringify({
          sourceFile: '../fluideq-code-secret.frag',
          worldFile: 'world.json',
        }),
      );
      put(
        'world.json',
        JSON.stringify({
          materials: {
            a: {
              vertexFile: '../fluideq-code-secret.frag',
              fragmentFile: 'sub/inside.frag',
            },
            b: { fragmentFile: outside },
            c: { fragmentFile: 'thesis.docx' },
            d: { fragmentFile: 'good.frag' },
          },
        }),
      );
      put('sub/inside.frag', 'void main() {}');
      put('thesis.docx', 'not code');
      put('good.frag', 'void main() {}');
      // The control beside the refusals: a plain name in the folder is read.
      expect(await listed()).toEqual([
        'pack:pack.json',
        'world:world.json',
        'material:good.frag',
      ]);
    } finally {
      fs.rmSync(outside, { force: true });
    }
  });

  it('takes only plain animation files, never a second name for another file', async () => {
    put('pack.json', '{}');
    put('scene.frag', 'void x() {}');
    put('animations/bird.json', '{}');
    put('animations/Bird Two.json', '{}');
    put('animations/notes.txt', 'x');
    put('animations/deep/inner.json', '{}');
    const outside = path.join(path.dirname(folder), 'fluideq-code-linked.json');
    fs.writeFileSync(outside, '{"secret":true}');
    try {
      // A hard link needs no privilege on Windows, and is the way a file
      // outside the folder gets a name inside it.
      fs.linkSync(outside, path.join(folder, 'animations', 'linked.json'));
      expect(await listed()).toEqual([
        'scene:scene.frag',
        'pack:pack.json',
        'animation:animations/bird.json',
      ]);
    } finally {
      fs.rmSync(outside, { force: true });
    }
  });

  it('answers nothing for a folder with no pack.json, and survives a broken world', async () => {
    expect(await readProjectCode(folder)).toEqual([]);
    put('pack.json', JSON.stringify({ worldFile: 'world.json' }));
    put('scene.frag', 'void x() {}');
    put('world.json', '{ not json');
    expect(await listed()).toEqual([
      'scene:scene.frag',
      'pack:pack.json',
      'world:world.json',
    ]);
  });
});
