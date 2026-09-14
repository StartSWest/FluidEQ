/** @jest-environment node */

/**
 * The window's report that a scene's code would not run. What is held here:
 * only a source a scene could carry and a known reason are taken, and the look
 * lists are sent again only when the refusal is new — a worker reporting the
 * same scene on every frame must not flood the window with lists.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { MAX_SHADER_BYTES } from '../../../common/scenePacks';

const handlers = new Map<string, (...args: unknown[]) => unknown>();
jest.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, fn: (...args: unknown[]) => unknown) =>
      handlers.set(channel, fn),
    removeHandler: (channel: string) => handlers.delete(channel),
  },
}));

/* eslint-disable import/first -- the electron mock must be installed first */
import { registerSceneRefusalsIpc } from '../../../main/ipc/sceneRefusals';
import { createSceneRefusals } from '../../../main/sceneRefusals';
/* eslint-enable import/first */

const SOURCE = 'vec4 sceneColour(vec2 uv) { return vec4(uv, 0.0, 1.0); }';

let userDataDir: string;

beforeEach(() => {
  handlers.clear();
  userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-refusal-ipc-'));
});

afterEach(() => {
  fs.rmSync(userDataDir, { recursive: true, force: true });
});

const report = (...args: unknown[]) =>
  handlers.get('scene-source-refused')?.({}, ...args);

it('keeps a reported refusal and sends the looks again once', () => {
  const refusals = createSceneRefusals({ userDataDir });
  const announce = jest.fn();
  registerSceneRefusalsIpc({ refusals, announce });

  report(SOURCE, 'gpu-reset');
  expect(refusals.refusalOf(SOURCE)).toBe('gpu-reset');
  expect(announce).toHaveBeenCalledTimes(1);
  report(SOURCE, 'gpu-reset');
  report(SOURCE, 'compile');
  expect(announce).toHaveBeenCalledTimes(1);
});

it('takes nothing that is not a scene source and a known reason', () => {
  const refusals = createSceneRefusals({ userDataDir });
  const announce = jest.fn();
  registerSceneRefusalsIpc({ refusals, announce });

  report(SOURCE, 'everything');
  report(SOURCE);
  report({ source: SOURCE }, 'gpu-reset');
  report('', 'gpu-reset');
  report('x'.repeat(MAX_SHADER_BYTES + 1), 'gpu-reset');
  expect(announce).not.toHaveBeenCalled();
  expect(refusals.refusalOf(SOURCE)).toBeUndefined();
  expect(fs.existsSync(path.join(userDataDir, 'scene-refusals.json'))).toBe(
    false,
  );
});

it('lets go of its channel when disposed', () => {
  const registration = registerSceneRefusalsIpc({
    refusals: createSceneRefusals({ userDataDir }),
    announce: jest.fn(),
  });
  expect(handlers.has('scene-source-refused')).toBe(true);
  registration.dispose();
  expect(handlers.has('scene-source-refused')).toBe(false);
});
