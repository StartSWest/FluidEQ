/**
 * A project's animations are read as a stranger's files
 * (`projectAnimations.ts`): `animations/<name>.json` and the sheet it names,
 * each a plain file inside the project's own folder. And the member's AI
 * looks at one by name (`look_at_animation`), its step said in the chat as
 * a look at that animation.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  readProjectAnimation,
  readProjectAnimations,
} from '../../../main/memberScenes/projectAnimations';
import { stepOf } from '../../../main/studioChat/chatStream';
import lookAnimationTool from '../../../main/studioChat/lookAnimationTool';

jest.mock('electron', () => ({ nativeImage: {} }));

let project: string;

const write = (relative: string, contents: string | Buffer) => {
  const file = path.join(project, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, contents);
};

beforeEach(() => {
  project = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-animations-'));
});

afterEach(() => {
  fs.rmSync(project, { recursive: true, force: true });
});

describe("a project's animations", () => {
  it('are each file in animations/ with the sheet it names, by name', async () => {
    write('art/wolf.png', Buffer.from([1, 2, 3]));
    write('art/fox.png', Buffer.from([4, 5]));
    write(
      'animations/wolf-walk.json',
      JSON.stringify({ sheet: 'art/wolf.png', count: 8 }),
    );
    write(
      'animations/fox-trot.json',
      JSON.stringify({ sheet: 'art/fox.png', count: 6, fps: 10 }),
    );
    write('animations/notes.txt', 'not an animation');
    const found = await readProjectAnimations(project);
    expect(found.map(({ animation }) => animation.name)).toEqual([
      'fox-trot',
      'wolf-walk',
    ]);
    expect(Array.from(found[1].sheet)).toEqual([1, 2, 3]);
    expect(found[0].animation.fps).toBe(10);
  });

  it('are none in a project without the folder', async () => {
    expect(await readProjectAnimations(project)).toEqual([]);
  });

  it('leave out one whose sheet is missing or unreadable, and keep the rest', async () => {
    write('art/wolf.png', Buffer.from([1]));
    write(
      'animations/wolf-walk.json',
      JSON.stringify({ sheet: 'art/wolf.png', count: 8 }),
    );
    write(
      'animations/gone.json',
      JSON.stringify({ sheet: 'art/gone.png', count: 4 }),
    );
    write('animations/broken.json', '{ not json');
    expect(
      (await readProjectAnimations(project)).map(
        ({ animation }) => animation.name,
      ),
    ).toEqual(['wolf-walk']);
  });

  it('never read a sheet outside the project, by path or by link', async () => {
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-outside-'));
    try {
      fs.writeFileSync(path.join(outside, 'secret.png'), 'secret');
      write(
        'animations/climb.json',
        JSON.stringify({ sheet: '../secret.png', count: 2 }),
      );
      expect(await readProjectAnimation(project, 'climb')).toBeUndefined();
      fs.mkdirSync(path.join(project, 'art'));
      fs.symlinkSync(outside, path.join(project, 'art', 'linked'), 'junction');
      write(
        'animations/linked.json',
        JSON.stringify({ sheet: 'art/linked/secret.png', count: 2 }),
      );
      expect(await readProjectAnimation(project, 'linked')).toBeUndefined();
      // The control: the same file inside the project is read.
      write('art/secret.png', 'secret');
      write(
        'animations/inside.json',
        JSON.stringify({ sheet: 'art/secret.png', count: 2 }),
      );
      expect(await readProjectAnimation(project, 'inside')).toBeDefined();
    } finally {
      fs.rmSync(outside, { recursive: true, force: true });
    }
  });
});

describe('looking at an animation', () => {
  it('names the animation it looks at in the chat', () => {
    expect(
      stepOf('1', 'mcp__fluideq__look_at_animation', { name: 'wolf-walk' }),
    ).toEqual({
      id: '1',
      kind: 'animation',
      file: 'wolf-walk',
      state: 'running',
    });
    // A name that is not one is not shown.
    expect(
      stepOf('2', 'mcp__fluideq__look_at_animation', { name: '../x' }),
    ).toEqual({
      id: '2',
      kind: 'animation',
      state: 'running',
    });
  });

  it('says what is wrong with a name, or an animation that is not there', async () => {
    const tool = lookAnimationTool(project);
    const badName = await tool.call({ name: 'Wolf Walk' });
    expect(badName.isError).toBe(true);
    const missing = await tool.call({ name: 'wolf-walk' });
    expect(missing.isError).toBe(true);
    expect(JSON.stringify(missing.content)).toContain(
      'animations/wolf-walk.json',
    );
  });
});
