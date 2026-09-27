/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type {
  PerspectiveCamera,
  WebGLRenderer,
  WebGLRenderTarget,
} from 'three';
import type { ISceneFrame } from '../../../renderer/graph/sceneGl';
import {
  firstBandRows,
  WIDEST_BAND_SHARE,
} from '../../../renderer/graph/sceneStillBands';
import type { IWorldComposite } from '../../../renderer/graph/world/worldComposite';
import { createWorldSceneProgram } from '../../../renderer/graph/world/worldDraw';
import type { IWorldInputs } from '../../../renderer/graph/world/worldInputs';
import type { IWorldPass } from '../../../renderer/graph/world/worldPasses';

/**
 * A built world's draw, with the GPU replaced by a record of what was asked
 * of it. Two promises are held here. A frame drawn again — to be timed, for
 * the member's AI — renders the world again: served the finished picture, a
 * heavy world timed as cheap as its sky. And a still renders its world once,
 * in strips each finished before the next is sent, and every band of it only
 * lays that picture down: rendered per band, or whole in one job, a still
 * held the GPU for as long as Windows allows before it resets the display.
 */

const GL = {
  FRAMEBUFFER: 0x8d40,
  FRAMEBUFFER_BINDING: 0x8ca6,
  SCISSOR_BOX: 0x0c10,
  SCISSOR_TEST: 0x0c11,
  RGBA: 0x1908,
  UNSIGNED_BYTE: 0x1401,
};

/** What the worker left bound, which the picture is laid into. */
const WORKER_FRAMEBUFFER = { worker: true };
const SCISSOR = [0, 12, 640, 336];

const frameAt = (timeSeconds: number): ISceneFrame => ({
  timeSeconds,
  deltaMs: 16,
  level: 0.5,
  beat: 0,
  bands: [0, 0, 0],
  musicAccent: [0.25, 1],
  musicRun: [0, 0],
  accent: [1, 1, 1],
  fade: 1,
  spectrum: new Uint8Array(512),
  waveform: new Uint8Array(512),
  params: {},
});

type TStrip = { from: number; rows: number } | undefined;

const fakeWorld = () => {
  let lost = false;
  /** Every render and every wait for the GPU to finish, in order. */
  const jobs: string[] = [];
  const gl = {
    ...GL,
    isContextLost: jest.fn(() => lost),
    getParameter: jest.fn((name: number) =>
      name === GL.FRAMEBUFFER_BINDING
        ? WORKER_FRAMEBUFFER
        : new Int32Array(SCISSOR),
    ),
    isEnabled: jest.fn(() => true),
    bindFramebuffer: jest.fn(),
    viewport: jest.fn(),
    enable: jest.fn(),
    disable: jest.fn(),
    scissor: jest.fn(),
    readPixels: jest.fn(() => {
      jobs.push('wait');
    }),
  };
  const renderer = {
    resetState: jest.fn(),
    setRenderTarget: jest.fn(),
    render: jest.fn(),
    shadowMap: { autoUpdate: true },
  };
  /** Whether three may redraw its shadow maps, as each strip found it. */
  const shadowsAtStrip: boolean[] = [];
  const renderMain = jest.fn((strip?: TStrip) => {
    shadowsAtStrip.push(renderer.shadowMap.autoUpdate);
    jobs.push(strip ? 'strip' : 'world');
  });
  const finish = jest.fn(() => {
    jobs.push('glow');
  });
  const pass = { use: jest.fn(), scene: {}, camera: {} };
  const composite = { material: { composite: true } };
  const external = { point: jest.fn() };
  const parts = {
    gl: gl as unknown as WebGL2RenderingContext,
    renderer: renderer as unknown as WebGLRenderer,
    inputs: {
      update: jest.fn(),
      settled: jest.fn(() => true),
    } as unknown as IWorldInputs,
    camera: {
      view: null,
      clearViewOffset: jest.fn(),
      setViewOffset: jest.fn(),
    } as unknown as PerspectiveCamera,
    aim: jest.fn(),
    advance: jest.fn(),
    prepare: jest.fn(),
    renderMain,
    finish,
    composite: composite as unknown as IWorldComposite,
    pass: pass as unknown as IWorldPass,
    shown: {
      viewport: { set: jest.fn() },
      scissor: { set: jest.fn() },
      scissorTest: false,
    } as unknown as WebGLRenderTarget,
    external,
    free: jest.fn(),
    release: jest.fn(),
  };
  return {
    program: createWorldSceneProgram(parts),
    parts,
    gl,
    renderer,
    pass,
    external,
    jobs,
    shadowsAtStrip,
    strips: () => renderMain.mock.calls.map(([strip]) => strip),
    lose: () => {
      lost = true;
    },
  };
};

describe('a world drawn a frame at a time', () => {
  it('renders the world for every draw, the same frame drawn again to be timed included', () => {
    const world = fakeWorld();
    const frame = frameAt(1);
    world.program.draw(frame, 640, 360);
    world.program.draw(frame, 640, 360);
    // Strict: toEqual reads [] and [undefined, undefined] as the same list.
    expect(world.strips()).toStrictEqual([undefined, undefined]);
    expect(world.parts.prepare).toHaveBeenCalledTimes(2);
    expect(world.parts.finish).toHaveBeenCalledTimes(2);
    expect(world.renderer.render).toHaveBeenCalledTimes(2);
  });

  it('lays the picture into what the worker left bound, and leaves the context as it found it', () => {
    const world = fakeWorld();
    world.program.draw(frameAt(1), 640, 360);
    expect(world.external.point).toHaveBeenCalledWith(
      world.parts.shown,
      WORKER_FRAMEBUFFER,
    );
    expect(world.pass.use).toHaveBeenCalledWith(world.parts.composite.material);
    expect(world.gl.bindFramebuffer).toHaveBeenLastCalledWith(
      GL.FRAMEBUFFER,
      WORKER_FRAMEBUFFER,
    );
    expect(world.gl.enable).toHaveBeenLastCalledWith(GL.SCISSOR_TEST);
    expect(world.gl.scissor).toHaveBeenLastCalledWith(...SCISSOR);
  });

  it('touches nothing on a lost context, not even to ask what is bound', () => {
    const world = fakeWorld();
    world.lose();
    world.program.draw(frameAt(1), 640, 360);
    expect(world.program.prepareStill?.(frameAt(1), 640, 360)).toEqual({
      spentMs: 0,
      longestMs: 0,
    });
    expect(world.gl.getParameter).not.toHaveBeenCalled();
    expect(world.renderer.resetState).not.toHaveBeenCalled();
    expect(world.parts.prepare).not.toHaveBeenCalled();
    expect(world.strips()).toStrictEqual([]);
    expect(world.renderer.render).not.toHaveBeenCalled();
  });
});

describe('a still of a world, drawn a band at a time', () => {
  const HEIGHT = 1080;

  const prepared = () => {
    const world = fakeWorld();
    const frame = frameAt(1);
    world.program.prepareStill?.(frame, 640, HEIGHT);
    return { world, frame };
  };

  it('renders the world once, and every band of that frame only lays it down', () => {
    const { world, frame } = prepared();
    const rendered = world.strips().length;
    expect(rendered).toBeGreaterThan(1);
    [0, 1, 2].forEach(() => world.program.draw(frame, 640, HEIGHT));
    expect(world.strips()).toHaveLength(rendered);
    expect(world.parts.prepare).toHaveBeenCalledTimes(1);
    expect(world.parts.finish).toHaveBeenCalledTimes(1);
    expect(world.renderer.render).toHaveBeenCalledTimes(3);
    expect(world.pass.use).toHaveBeenCalledTimes(3);
  });

  it('renders the world again for a later still of the same frame', () => {
    const { world, frame } = prepared();
    const rendered = world.strips().length;
    world.program.prepareStill?.(frame, 640, HEIGHT);
    expect(world.parts.prepare).toHaveBeenCalledTimes(2);
    expect(world.strips().length).toBeGreaterThan(rendered);
  });

  it.each([
    ['another frame, even at the same instant', true, 640, HEIGHT],
    ['another width', false, 320, HEIGHT],
    ['another height', false, 640, HEIGHT / 2],
  ])(
    'renders the world again for a draw of %s, and forgets the still',
    (_what, otherFrame, width, height) => {
      const { world, frame } = prepared();
      const rendered = world.strips().length;
      world.program.draw(
        otherFrame ? frameAt(frame.timeSeconds) : frame,
        width,
        height,
      );
      world.program.draw(frame, 640, HEIGHT);
      // Both whole: the other draw's world, and the still's frame's again.
      expect(world.strips().slice(rendered)).toStrictEqual([
        undefined,
        undefined,
      ]);
    },
  );

  it('renders the world again after a rest', () => {
    const { world, frame } = prepared();
    const rendered = world.strips().length;
    world.program.rest?.();
    world.program.draw(frame, 640, HEIGHT);
    expect(world.parts.free).toHaveBeenCalledTimes(1);
    expect(world.strips()).toHaveLength(rendered + 1);
  });

  it('renders the world in strips that cover every row once, top to bottom, the first a thirty-second of it', () => {
    const { world } = prepared();
    const strips = world
      .strips()
      .map((strip) => strip ?? { from: -1, rows: 0 });
    expect(strips[0]).toEqual({ from: 0, rows: firstBandRows(HEIGHT) });
    const widest = Math.ceil(HEIGHT * WIDEST_BAND_SHARE);
    const end = strips.reduce((at, strip) => {
      expect(strip.from).toBe(at);
      expect(strip.rows).toBeGreaterThan(0);
      expect(strip.rows).toBeLessThanOrEqual(widest);
      return at + strip.rows;
    }, 0);
    expect(end).toBe(HEIGHT);
  });

  it('waits for each strip to finish before it sends the next', () => {
    const { world } = prepared();
    const strips = world.strips().length;
    expect(world.jobs).toEqual([
      'wait',
      ...Array.from({ length: strips }, () => ['strip', 'wait']).flat(),
      'glow',
      'wait',
    ]);
  });

  it('keeps the shadow maps the first strip drew for the rest of the walk, and gives the renderer its own setting back', () => {
    const { world } = prepared();
    expect(world.shadowsAtStrip).toEqual([
      true,
      ...Array(world.shadowsAtStrip.length - 1).fill(false),
    ]);
    expect(world.renderer.shadowMap.autoUpdate).toBe(true);

    const still = fakeWorld();
    still.renderer.shadowMap.autoUpdate = false;
    still.program.prepareStill?.(frameAt(1), 640, HEIGHT);
    expect(still.shadowsAtStrip.every((updating) => !updating)).toBe(true);
    expect(still.renderer.shadowMap.autoUpdate).toBe(false);
  });

  it('gives the renderer its shadow setting back when a strip fails', () => {
    const world = fakeWorld();
    world.parts.renderMain.mockImplementationOnce(() => undefined);
    world.parts.renderMain.mockImplementationOnce(() => {
      throw new Error('context gone mid-strip');
    });
    expect(() => world.program.prepareStill?.(frameAt(1), 640, HEIGHT)).toThrow(
      'context gone mid-strip',
    );
    expect(world.renderer.shadowMap.autoUpdate).toBe(true);
  });
});
