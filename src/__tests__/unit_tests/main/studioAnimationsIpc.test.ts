/**
 * The Animations tab's channel (`studioAnimations.ts`): the open project's
 * animations, read fresh on every ask, and a word to the window whenever a
 * file of theirs changes - watched where those files are, because the
 * project's own watcher sees none of them.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';

const handlers = new Map<string, (...args: unknown[]) => unknown>();
jest.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, fn: (...args: unknown[]) => unknown) =>
      handlers.set(channel, fn),
    removeHandler: (channel: string) => handlers.delete(channel),
  },
}));

/* eslint-disable import/first -- the electron mock must be installed first */
import {
  ANIMATIONS_CHANGED,
  registerStudioAnimationsIpc,
} from '../../../main/ipc/studioAnimations';
import { pngHeader } from '../../utils/pictureHeaders';
/* eslint-enable import/first */

let project: string;
const sent: string[] = [];
const watched = new Map<string, (file: string | null) => void>();
const closed: string[] = [];

const register = (mayEdit = true) =>
  registerStudioAnimationsIpc({
    getMainWindow: () =>
      ({
        isDestroyed: () => false,
        webContents: { send: (channel: string) => sent.push(channel) },
      }) as unknown as Electron.BrowserWindow,
    mayEdit: () => mayEdit,
    activeFolder: () => project,
    watch: (folder, onChange) => {
      watched.set(path.relative(project, folder) || '.', onChange);
      return {
        on: () => undefined,
        close: () => closed.push(path.relative(project, folder) || '.'),
      };
    },
  });

const ask = () =>
  handlers.get('studio-animations')?.() as Promise<{
    kind: string;
    animations?: { animation: { name: string } }[];
  }>;

beforeEach(() => {
  project = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-anim-ipc-'));
  sent.length = 0;
  watched.clear();
  closed.length = 0;
  fs.mkdirSync(path.join(project, 'art'));
  fs.mkdirSync(path.join(project, 'animations'));
  // A real header: a sheet whose size cannot be read is refused before it is
  // decoded (`pictureBounds.ts`), and this one is eight 64px frames.
  fs.writeFileSync(path.join(project, 'art', 'wolf.png'), pngHeader(512, 64));
  fs.writeFileSync(
    path.join(project, 'animations', 'wolf-walk.json'),
    JSON.stringify({ sheet: 'art/wolf.png', count: 8 }),
  );
});

afterEach(() => {
  handlers.clear();
  fs.rmSync(project, { recursive: true, force: true });
});

it("hands the window the open project's animations", async () => {
  const dispose = register();
  const answer = await ask();
  expect(answer.kind).toBe('animations');
  expect(answer.animations?.map(({ animation }) => animation.name)).toEqual([
    'wolf-walk',
  ]);
  dispose();
  expect(handlers.has('studio-animations')).toBe(false);
});

it('hands nothing from a project that may not be edited', async () => {
  register(false);
  expect(await ask()).toEqual({ kind: 'none' });
  expect(watched.size).toBe(0);
});

it('tells the window when an animation or its sheet changes, and not for other files', async () => {
  register();
  await ask();
  expect([...watched.keys()].sort()).toEqual(['.', 'animations', 'art']);
  // The control: files that are no animation's say nothing.
  watched.get('.')?.('pack.json');
  watched.get('art')?.('bark.png');
  expect(sent).toEqual([]);
  watched.get('animations')?.('wolf-walk.json');
  watched.get('art')?.('wolf.png');
  watched.get('.')?.('animations');
  expect(sent).toEqual([
    ANIMATIONS_CHANGED,
    ANIMATIONS_CHANGED,
    ANIMATIONS_CHANGED,
  ]);
});

it('watches afresh on every read, letting the old watches go', async () => {
  const dispose = register();
  await ask();
  await ask();
  expect(closed.sort()).toEqual(['.', 'animations', 'art']);
  dispose();
  expect(closed).toHaveLength(6);
});
