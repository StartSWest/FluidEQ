/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Main's half of the desk lights (`lampScenes.ts`): the scene host runs while
 * lighting is on and the window chose a scene the account may play, is told
 * the scene and the window's part of it, and its grids reach the lamps
 * stamped with the look in the picture. What the window did when it drew the
 * lamps itself is held here: a scene whose frames held the GPU is not handed
 * to it again this session, a lost GPU asks for the scene again, and a host
 * that keeps dying is given up on.
 */

import {
  DEFAULT_LIGHTING_SETTINGS,
  type ILightingFrame,
  type ILightingState,
} from 'common/lighting/lightingModel';
import type { ILampSceneChoice } from 'common/lighting/lampSceneChoice';
import type { IScenePack } from 'common/scenePacks';
import { SCENE_VIEW_VERTEX_SOURCE } from 'common/sceneView';
import {
  createLampScenes,
  hostSceneOf,
  type ILampScenesDeps,
} from 'main/lighting/lampScenes';
import type {
  ILampSceneHost,
  ILampSceneHostEvents,
} from 'main/lighting/lampSceneHost';
import {
  SCENE_HOST_KIND,
  type ISceneHostGrid,
} from 'main/lighting/sceneHostWire';

const on: ILightingState = {
  supported: true,
  searching: false,
  settings: { ...DEFAULT_LIGHTING_SETTINGS, enabled: true },
  devices: [],
  synapse: 'running',
  hasRazerDevices: false,
  heldByWindows: [],
  canOpenRazerChroma: true,
  live: false,
};

const aurora = {
  lookId: 'premium:aurora',
  identity: 'premium:aurora@3',
  swatch: ['#ff0010', 'not a colour'],
  guarded: false,
};

const choice: ILampSceneChoice = {
  scene: aurora,
  paused: false,
  daylight: { clock: true },
  accent: [0, 0.5, 1],
};

const pack = {
  id: 'aurora',
  source: 'void main() { fragColor = vec4(uLevel); }',
  params: [{ id: 'glow', value: 0.25, min: 0, max: 1, names: { en: 'Glow' } }],
} as unknown as IScenePack;

const grid = (drawn: boolean): ISceneHostGrid => ({
  width: 48,
  height: 27,
  level: 0.5,
  beat: 0.25,
  bass: 0.1,
  mid: 0.2,
  treble: 0.3,
  deltaMs: 33,
  timeSeconds: 12,
  activity: 0.02,
  drawn,
  rgb: new Uint8Array(48 * 27 * 3),
});

/** A message's kind, and for a show whether it carries a scene. */
const read = (message: Uint8Array) => {
  const view = new DataView(message.buffer, message.byteOffset);
  const kind = view.getUint32(4, true);
  if (kind !== SCENE_HOST_KIND.show) {
    return { kind };
  }
  const id = view.getUint32(12, true);
  const colours = view.getUint32(16, true);
  return {
    kind,
    id,
    colours,
    withScene: view.getUint32(20 + colours * 3, true) === 1,
  };
};

const setup = (kept: ILampSceneChoice | null = choice) => {
  const hosts: {
    events: ILampSceneHostEvents;
    sent: Uint8Array[];
    host: ILampSceneHost;
  }[] = [];
  const frames: ILightingFrame[] = [];
  let announce = () => undefined as void;
  const deps: ILampScenesDeps = {
    executable: 'C:\\FluidEQ\\FluidEQ-Scenes.exe',
    angleDir: 'C:\\FluidEQ',
    log: { warn: jest.fn() },
    loadScene: jest.fn(() => pack),
    subscribeScenes: (listener) => {
      announce = listener;
      return () => undefined;
    },
    kept: { read: () => kept, keep: jest.fn() },
    frame: (frame) => frames.push(frame),
    release: jest.fn(),
    preview: jest.fn(),
    startHost: ({ events }) => {
      const sent: Uint8Array[] = [];
      const host: ILampSceneHost = {
        send: (message) => sent.push(message),
        stop: jest.fn(),
        pid: () => 4242,
      };
      hosts.push({ events, sent, host });
      return host;
    },
  };
  const lamps = createLampScenes(deps);
  const last = () => hosts[hosts.length - 1];
  const shows = () =>
    last()
      .sent.map(read)
      .filter((message) => message.kind === SCENE_HOST_KIND.show);
  return {
    lamps,
    deps,
    hosts,
    last,
    shows,
    frames,
    announce: () => announce(),
  };
};

it('runs the host only while lighting is on and a scene is chosen', () => {
  const { lamps, hosts, deps } = setup(null);
  lamps.stateChanged(on);
  expect(hosts).toHaveLength(0);
  lamps.choose(choice);
  expect(hosts).toHaveLength(1);
  expect(deps.kept.keep).toHaveBeenCalledWith(choice);
  // The window's part first, then the scene, with its program.
  expect(hosts[0].sent.map((message) => read(message).kind)).toEqual([
    SCENE_HOST_KIND.accent,
    SCENE_HOST_KIND.daylight,
    SCENE_HOST_KIND.pause,
    SCENE_HOST_KIND.profile,
    SCENE_HOST_KIND.preview,
    SCENE_HOST_KIND.show,
  ]);
  expect(read(hosts[0].sent[5])).toMatchObject({ withScene: true, colours: 1 });

  lamps.stateChanged({ ...on, settings: { ...on.settings, enabled: false } });
  expect(hosts[0].host.stop).toHaveBeenCalled();
});

it('lights the desk from what it kept, before any window has spoken', () => {
  const { lamps, hosts } = setup();
  lamps.stateChanged(on);
  expect(hosts).toHaveLength(1);
});

it('stamps each frame with the look in the picture, and gives the lamps back when it stops', () => {
  const { lamps, last, frames, deps, shows } = setup();
  lamps.stateChanged(on);
  last().events.grid(grid(false));
  expect(frames[0]).toMatchObject({
    sceneId: 'premium:aurora',
    level: 0.5,
    ambient: true,
    activity: 0.02,
  });
  last().events.loaded(shows()[0].id ?? 0);
  lamps.choose({
    ...choice,
    scene: { ...aurora, lookId: 'premium:dunes', identity: 'd@1' },
  });
  // Until the next scene has linked, the frames are still the old one's.
  last().events.grid(grid(true));
  expect(frames[1].sceneId).toBe('premium:aurora');

  lamps.choose({ ...choice, scene: null });
  expect(deps.release).toHaveBeenCalledTimes(1);
});

it('does not hand back a scene whose frames held the GPU, and asks again after a lost one', () => {
  const { lamps, last, shows, announce } = setup();
  lamps.stateChanged(on);
  const first = shows()[0];
  last().events.loaded(first.id ?? 0);
  last().events.failed(0, 'lost', 'the GPU was reset');
  // Not the scene's doing: asked for again, with its program.
  expect(shows()).toHaveLength(2);
  expect(shows()[1].withScene).toBe(true);

  last().events.loaded(shows()[1].id ?? 0);
  last().events.failed(0, 'too-heavy', 'too heavy');
  announce();
  // CONTROL above: the same announcement before the refusal showed the scene.
  expect(shows()).toHaveLength(3);
  expect(shows()[2].withScene).toBe(false);
});

it('starts a host that died again, and gives up after three', () => {
  const { lamps, hosts, deps } = setup();
  lamps.stateChanged(on);
  hosts[0].events.exited(false, 'crashed');
  expect(hosts).toHaveLength(2);
  hosts[1].events.exited(false, 'crashed');
  hosts[2].events.exited(false, 'crashed');
  expect(hosts).toHaveLength(3);
  expect(deps.log.warn).toHaveBeenCalledTimes(3);
  // One it was told to stop is no failure.
  const calm = setup();
  calm.lamps.stateChanged(on);
  calm.hosts[0].events.exited(true, '');
  expect(calm.deps.log.warn).not.toHaveBeenCalled();
});

it('shows the open page each frame, with the picture a drawn one comes with', () => {
  const { lamps, last, deps } = setup();
  lamps.stateChanged(on);
  last().events.grid(grid(true));
  expect(deps.preview).not.toHaveBeenCalled();
  lamps.watch(true);
  expect(read(last().sent[last().sent.length - 1]).kind).toBe(
    SCENE_HOST_KIND.preview,
  );
  last().events.grid(grid(true));
  last().events.picture(2, 1, new Uint8Array(6));
  expect(deps.preview).toHaveBeenLastCalledWith(
    expect.objectContaining({
      picture: { width: 2, height: 1, rgb: new Uint8Array(6) },
    }),
  );
  last().events.grid(grid(false));
  expect(deps.preview).toHaveBeenLastCalledWith({
    frame: expect.objectContaining({ level: 0.5 }),
  });
});

it('hands the host the window’s program, sliders, framing and artwork', () => {
  const scene = hostSceneOf(
    {
      ...pack,
      framing: { focus: [0.25, 0.5], narrowest: 32 / 9 },
      artwork: { mime: 'image/webp', width: 4, height: 2, data: 'AQID' },
    } as IScenePack,
    true,
  );
  expect(scene.vertexSource).toBe(SCENE_VIEW_VERTEX_SOURCE);
  expect(scene.fragmentSource).toContain(pack.source);
  expect(scene.guarded).toBe(true);
  expect(scene.response).toEqual({
    sensitivity: 1,
    threshold: 0,
    attack: 0,
    release: 0,
  });
  // A picture composed twice as wide as 16:9: twice the panel, slid so its
  // focus at a quarter is as near the middle as the picture allows.
  expect(scene.view[2]).toBeCloseTo(2, 12);
  expect(scene.view[0]).toBeCloseTo(0, 12);
  expect(scene.spectrumRect[1]).toBeCloseTo(0.5, 12);
  expect([...(scene.artwork?.webp ?? [])]).toEqual([1, 2, 3]);
});
