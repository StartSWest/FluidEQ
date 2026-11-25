/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * FluidEQ's own scenes are built ahead too, not only the members' a listener
 * added: the driver's compile is nearly all of a slow scene's first load
 * (Alpine 12 s, Hanami 8 s of link on software GL, 2026-11-25), and theirs
 * were left to compile on the first pick of every new version. Each build is
 * a scene worker's (`warmSceneProgram`), which takes the program's turn, so
 * the look the graph is opening at the same moment is never compiled twice
 * side by side.
 */

const mockWarm = jest.fn();
const mockOwn: {
  scenes: { id: string; version: number; revision?: string }[];
  listeners: Set<() => void>;
} = { scenes: [], listeners: new Set() };
const mockMembers: {
  scenes: { lookId: string; packId: string; version: number }[];
  listeners: Set<() => void>;
} = { scenes: [], listeners: new Set() };

jest.mock('../../../renderer/graph/sceneWorkerClient', () => ({
  warmSceneProgram: (...args: unknown[]) => mockWarm(...args),
}));
jest.mock('../../../renderer/utils/scenePacks', () => ({
  getUsableScenes: () => mockOwn.scenes,
  loadScenePack: (id: string) =>
    Promise.resolve({ id, source: `own ${id}`, params: [] }),
  subscribeScenePacks: (listener: () => void) => {
    mockOwn.listeners.add(listener);
    return () => mockOwn.listeners.delete(listener);
  },
}));
jest.mock('../../../renderer/utils/memberScenes', () => ({
  getUsableMemberScenes: () => mockMembers.scenes,
  loadMemberScene: (lookId: string) =>
    Promise.resolve({ id: lookId, source: `member ${lookId}`, params: [] }),
  subscribeMemberScenes: (listener: () => void) => {
    mockMembers.listeners.add(listener);
    return () => mockMembers.listeners.delete(listener);
  },
}));

// eslint-disable-next-line import/first -- after the mocks it is built on
import { startScenePrebuild } from '../../../renderer/graph/scenePrebuild';

const settle = async () => {
  for (let step = 0; step < 60; step += 1) {
    // eslint-disable-next-line no-await-in-loop -- one microtask per step is the point
    await Promise.resolve();
  }
};

const warmedSources = () =>
  mockWarm.mock.calls.map(([pack]) => (pack as { source: string }).source);

let stop: () => void = () => undefined;

beforeEach(() => {
  window.localStorage.clear();
  mockWarm.mockReset();
  mockWarm.mockResolvedValue(undefined);
  mockOwn.scenes = [];
  mockMembers.scenes = [];
  jest.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    callback(0);
    return 1;
  });
});

afterEach(() => {
  stop();
  jest.restoreAllMocks();
});

it("builds FluidEQ's own scenes, then the members', each in a scene worker", async () => {
  mockOwn.scenes = [
    { id: 'alpine', version: 84 },
    { id: 'hanami', version: 5 },
  ];
  mockMembers.scenes = [{ lookId: 'member:cat', packId: 'cat', version: 3 }];
  stop = startScenePrebuild();
  await settle();
  expect(warmedSources()).toEqual([
    'own alpine',
    'own hanami',
    'member member:cat',
  ]);
  // Built as the graph builds them: never another member's scene.
  expect(
    mockWarm.mock.calls.every(([, unwatched]) => unwatched === false),
  ).toBe(true);
});

it('builds one at a time', async () => {
  mockOwn.scenes = [
    { id: 'alpine', version: 84 },
    { id: 'hanami', version: 5 },
  ];
  let finish: () => void = () => undefined;
  mockWarm.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  stop = startScenePrebuild();
  await settle();
  expect(warmedSources()).toEqual(['own alpine']);
  finish();
  await settle();
  expect(warmedSources()).toEqual(['own alpine', 'own hanami']);
});

it('builds each version once, across launches, and a new version again', async () => {
  mockOwn.scenes = [{ id: 'alpine', version: 84 }];
  stop = startScenePrebuild();
  await settle();
  stop();
  stop = startScenePrebuild();
  await settle();
  expect(warmedSources()).toEqual(['own alpine']);

  mockOwn.scenes = [{ id: 'alpine', version: 85 }];
  mockOwn.listeners.forEach((listener) => listener());
  await settle();
  expect(warmedSources()).toEqual(['own alpine', 'own alpine']);
});

it("keeps a member scene's memory as it was, and apart from FluidEQ's scene of the same id", async () => {
  // Built by a version before FluidEQ's own scenes joined the list.
  window.localStorage.setItem(
    'fluideq.scene.prebuilt',
    JSON.stringify(['cat@3']),
  );
  mockMembers.scenes = [{ lookId: 'member:cat', packId: 'cat', version: 3 }];
  mockOwn.scenes = [{ id: 'cat', version: 3 }];
  stop = startScenePrebuild();
  await settle();
  expect(warmedSources()).toEqual(['own cat']);
});
