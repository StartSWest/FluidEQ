/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Auto builds the next Plus scene while the current look plays (Ivan,
 * 2026-11-24: "preload the next plus visualizer before showing it"), and
 * holds at most that one: a worker, a GPU context and a compiled program
 * that nothing draws. Held here: it is built once the look on screen has
 * drawn, and given back the moment it stops being next — a look picked by
 * hand, the list changing, Auto switched off, the graph's scene host gone —
 * and never built while something holds the cycle.
 */

import { act, renderHook } from '@testing-library/react';
import type { IScenePack } from '../../../common/scenePacks';
import { SCENE_CONTRACT_VERSION } from '../../../common/sceneUniformContract';
import type { IScenePacksListing } from '../../../main/ipc/scenePacks';
import { setSceneRenderingAvailableForTesting } from '../../../renderer/graph/sceneHealth';
import {
  preparedSceneForTests,
  resetScenePreloadForTests,
  startScenePreload,
  takePreparedScene,
} from '../../../renderer/graph/scenePreload';
import {
  useGraphAutoCycle,
  useHoldGraphAutoCycle,
} from '../../../renderer/utils/graphAutoCycle';
import {
  getSelectableLooks,
  setGraphLook,
} from '../../../renderer/utils/graphStyle';
import { adoptScenePackListingForTesting } from '../../../renderer/utils/scenePacks';

const mockCreated: { pack?: IScenePack; dispose: jest.Mock }[] = [];

jest.mock('../../../renderer/graph/sceneWorkerClient', () => ({
  createSceneWorkerClient: () => {
    const client = {
      pack: undefined as IScenePack | undefined,
      dispose: jest.fn(),
    };
    mockCreated.push(client);
    return {
      load: (pack: IScenePack) => {
        client.pack = pack;
        return Promise.resolve({ kind: 'ready', rebuilt: true });
      },
      canDraw: () => false,
      draw: jest.fn(),
      idle: jest.fn(),
      holdPicture: jest.fn(),
      probe: jest.fn(),
      rehost: jest.fn(),
      whenShown: () => Promise.resolve(),
      dispose: client.dispose,
    };
  },
  warmSceneProgram: () => Promise.resolve(),
}));

const listed = (id: string) =>
  ({
    id,
    version: 2,
    names: { en: id },
    swatch: ['#102030', '#a0b0c0'],
  }) as IScenePacksListing['packs'][number];

const packOf = (id: string): IScenePack => ({
  schema: 1,
  id,
  version: 2,
  contract: SCENE_CONTRACT_VERSION,
  names: { en: id },
  fallbackStyle: 'skyline',
  swatch: ['#102030', '#a0b0c0'],
  source: `vec4 sceneColour(vec2 uv) { return vec4(uv, ${id.length}., 1.); }`,
  params: [],
});

// Animation frames by hand: the preparation is weighed on the frame after
// the change that asked for it, and a test says when that frame comes.
let frames = new Map<number, FrameRequestCallback>();
let nextFrame = 1;
const runFrame = async () => {
  const due = frames;
  frames = new Map();
  await act(async () => {
    due.forEach((callback) => callback(performance.now()));
    // The pack's load and the worker's build answer as promises.
    for (let turn = 0; turn < 6; turn += 1) {
      // eslint-disable-next-line no-await-in-loop -- one turn at a time
      await Promise.resolve();
    }
  });
};

const looks = () => getSelectableLooks().map((look) => look.id);
/** The look that comes before `id` in the walk. */
const before = (id: string) => {
  const ids = looks();
  return ids[ids.indexOf(id) - 1];
};

let stop: (() => void) | undefined;

beforeAll(() => {
  setSceneRenderingAvailableForTesting(true);
  window.electron = {
    ipcRenderer: {
      loadScenePack: (id: string) => Promise.resolve(packOf(id)),
    },
  } as unknown as typeof window.electron;
  window.requestAnimationFrame = (callback) => {
    nextFrame += 1;
    frames.set(nextFrame, callback);
    return nextFrame;
  };
  window.cancelAnimationFrame = (id) => {
    frames.delete(id);
  };
});

beforeEach(() => {
  mockCreated.length = 0;
  frames = new Map();
  act(() => {
    adoptScenePackListingForTesting({
      packs: [
        listed('alpine'),
        listed('borealis'),
        listed('crystal'),
        listed('dunes'),
      ],
      locked: [],
    });
  });
  resetScenePreloadForTests();
  stop = startScenePreload();
});

afterEach(() => {
  stop?.();
  stop = undefined;
});

/** Auto on, counting from `lookId`. */
const autoOn = (lookId: string) =>
  renderHook(({ id }) => useGraphAutoCycle(120, false, id), {
    initialProps: { id: lookId },
  });

describe('the scene Auto builds ahead', () => {
  it('is the next one, built once the look on screen has drawn', async () => {
    act(() => setGraphLook(before('premium:borealis')));
    const auto = autoOn(before('premium:borealis'));
    await runFrame();
    expect(preparedSceneForTests()).toEqual({
      lookId: 'premium:borealis',
      ready: true,
    });
    expect(mockCreated).toHaveLength(1);
    expect(mockCreated[0].pack?.id).toBe('borealis');
    expect(mockCreated[0].dispose).not.toHaveBeenCalled();
    auto.unmount();
  });

  it('waits while anything holds the cycle', async () => {
    act(() => setGraphLook(before('premium:borealis')));
    const auto = autoOn(before('premium:borealis'));
    const hold = renderHook(({ held }) => useHoldGraphAutoCycle(held), {
      initialProps: { held: true },
    });
    await runFrame();
    expect(mockCreated).toHaveLength(0);
    // Let go: the look on screen has drawn.
    hold.rerender({ held: false });
    await runFrame();
    expect(mockCreated).toHaveLength(1);
    hold.unmount();
    auto.unmount();
  });

  it('is let go when a look picked by hand changes what is next', async () => {
    act(() => setGraphLook(before('premium:borealis')));
    const auto = autoOn(before('premium:borealis'));
    await runFrame();
    expect(mockCreated).toHaveLength(1);

    // Picked by hand past it: another scene is next now.
    act(() => setGraphLook('premium:crystal'));
    auto.rerender({ id: 'premium:crystal' });
    await runFrame();
    expect(mockCreated[0].dispose).toHaveBeenCalledTimes(1);
    expect(preparedSceneForTests()).toEqual({
      lookId: 'premium:dunes',
      ready: true,
    });
    expect(mockCreated).toHaveLength(2);
    auto.unmount();
  });

  it('is let go when the list no longer has it', async () => {
    act(() => setGraphLook(before('premium:borealis')));
    const auto = autoOn(before('premium:borealis'));
    await runFrame();
    expect(mockCreated).toHaveLength(1);

    act(() => {
      adoptScenePackListingForTesting({
        packs: [listed('alpine'), listed('crystal'), listed('dunes')],
        locked: [],
      });
    });
    await runFrame();
    expect(mockCreated[0].dispose).toHaveBeenCalledTimes(1);
    auto.unmount();
  });

  it('is let go when Auto is switched off', async () => {
    act(() => setGraphLook(before('premium:borealis')));
    const auto = autoOn(before('premium:borealis'));
    await runFrame();
    expect(mockCreated).toHaveLength(1);
    expect(mockCreated[0].dispose).not.toHaveBeenCalled();

    auto.unmount();
    await runFrame();
    expect(mockCreated[0].dispose).toHaveBeenCalledTimes(1);
    expect(preparedSceneForTests()).toBeUndefined();
  });

  it('is let go when the graph’s scene host goes', async () => {
    act(() => setGraphLook(before('premium:borealis')));
    const auto = autoOn(before('premium:borealis'));
    await runFrame();
    stop?.();
    stop = undefined;
    expect(mockCreated[0].dispose).toHaveBeenCalledTimes(1);
    auto.unmount();
  });

  it('is handed over whole to the canvas that puts it on, and never disposed', async () => {
    act(() => setGraphLook(before('premium:borealis')));
    const auto = autoOn(before('premium:borealis'));
    await runFrame();
    act(() => setGraphLook('premium:borealis'));
    const taken = takePreparedScene('borealis', '2');
    expect(taken?.pack.id).toBe('borealis');
    expect(taken?.result.kind).toBe('ready');
    auto.rerender({ id: 'premium:borealis' });
    await runFrame();
    // Taken, it is the canvas's: weighing again gives back nothing of it.
    expect(mockCreated[0].dispose).not.toHaveBeenCalled();
    auto.unmount();
  });

  it('is let go when chosen and not taken by any canvas', async () => {
    act(() => setGraphLook(before('premium:borealis')));
    const auto = autoOn(before('premium:borealis'));
    await runFrame();
    act(() => setGraphLook('premium:borealis'));
    auto.rerender({ id: 'premium:borealis' });
    await runFrame();
    expect(mockCreated[0].dispose).toHaveBeenCalledTimes(1);
    // One ahead, never two: the next after it is built in its place.
    expect(preparedSceneForTests()).toEqual({
      lookId: 'premium:crystal',
      ready: true,
    });
    expect(mockCreated).toHaveLength(2);
    expect(mockCreated[1].dispose).not.toHaveBeenCalled();
    auto.unmount();
  });
});
