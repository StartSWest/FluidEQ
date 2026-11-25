/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IScenePack } from '../../../common/scenePacks';
import { compileScene } from '../../../renderer/graph/sceneGl';

/**
 * A scene's picture is decoded beside its link, never in front of it.
 *
 * The scene worker used to decode the picture and only then start the link,
 * so every load paid both one after the other: on software GL the link of a
 * cold Alpine or Hanami began 0.2-0.3 s after the load, behind the decode of
 * a 4096x2048 or 3040x2702 picture (harness, 2026-11-25). The build is now
 * handed the decode still under way, starts its link at once and waits for
 * the picture only to upload it.
 */

const mockLink = jest.fn();
jest.mock('../../../renderer/graph/sceneCompile', () => ({
  linkSceneProgram: (...args: unknown[]) => mockLink(...args),
}));
jest.mock('../../../renderer/graph/engineLooks/lookGl', () => ({
  createLookGl: () => ({ draw: () => undefined, dispose: () => undefined }),
}));

const deferred = <T>() => {
  const handles = {
    resolve: (_value: T): void => undefined,
    reject: (_error: unknown): void => undefined,
  };
  const promise = new Promise<T>((resolve, reject) => {
    handles.resolve = resolve;
    handles.reject = reject;
  });
  return { promise, ...handles };
};

/** A context whose every method is a recorder; nothing here draws. */
const fakeGl = () => {
  const calls: string[] = [];
  const methods = new Map<string, jest.Mock>();
  const gl = new Proxy(
    {},
    {
      get: (_target, name: string) => {
        let method = methods.get(name);
        if (!method) {
          method = jest.fn((..._args: unknown[]) => {
            calls.push(name);
            return {};
          });
          methods.set(name, method);
        }
        return method;
      },
    },
  ) as unknown as WebGL2RenderingContext;
  const method = (name: string) => {
    // Reading through the proxy makes the recorder if it is not there yet.
    const reader = gl as unknown as Record<string, jest.Mock>;
    return reader[name];
  };
  return { gl, calls, method };
};

const pack = (withArtwork: boolean) =>
  ({
    id: 'scene',
    version: 1,
    contract: 9,
    names: { en: 'Scene' },
    fallbackStyle: 'bars',
    swatch: ['#000000', '#ffffff', '#888888'],
    params: [],
    source: 'vec4 sceneColour(vec2 uv) { return vec4(uv, 0.0, 1.0); }',
    ...(withArtwork
      ? {
          artwork: {
            mime: 'image/webp',
            width: 4,
            height: 4,
            data: '',
          },
        }
      : {}),
  }) as unknown as IScenePack;

/** Every promise step already due has run. */
const settle = async () => {
  for (let step = 0; step < 20; step += 1) {
    // eslint-disable-next-line no-await-in-loop -- one microtask per step is the point
    await Promise.resolve();
  }
};

beforeEach(() => mockLink.mockReset());

it('starts the link while the picture is still decoding, and uploads it only once it has arrived', async () => {
  const link = deferred<{ ok: true; program: object }>();
  mockLink.mockReturnValue(link.promise);
  const picture = deferred<ImageBitmap | undefined>();
  const { gl, calls } = fakeGl();

  const building = compileScene(gl, pack(true), picture.promise);
  await settle();
  // The picture has not arrived, and the link is already running.
  expect(mockLink).toHaveBeenCalledTimes(1);

  link.resolve({ ok: true, program: {} });
  await settle();
  // Linked, but nothing to upload yet: the build waits for the picture.
  expect(calls).not.toContain('texImage2D');

  const bitmap = { width: 4, height: 4 } as ImageBitmap;
  picture.resolve(bitmap);
  const built = await building;
  expect(built.ok).toBe(true);
  expect(calls).toContain('texImage2D');
  expect(calls).toContain('generateMipmap');
});

it('uploads the very picture it was handed', async () => {
  mockLink.mockResolvedValue({ ok: true, program: {} });
  const { gl, method } = fakeGl();
  const bitmap = { width: 4, height: 4 } as ImageBitmap;
  const built = await compileScene(gl, pack(true), Promise.resolve(bitmap));
  expect(built.ok).toBe(true);
  expect(
    method('texImage2D').mock.calls.some((call) => call[5] === bitmap),
  ).toBe(true);
});

it('lets the linked program go when the picture fails to decode, and says why', async () => {
  mockLink.mockResolvedValue({ ok: true, program: { linked: true } });
  const { gl, method } = fakeGl();
  const failure = new Error(
    'Scene artwork dimensions differ from its signed header.',
  );
  await expect(
    compileScene(gl, pack(true), Promise.reject(failure)),
  ).rejects.toBe(failure);
  expect(method('deleteProgram')).toHaveBeenCalledWith({ linked: true });
  expect(method('texImage2D')).not.toHaveBeenCalled();
});

it('lets the linked program go when a pack with a picture arrives without one', async () => {
  mockLink.mockResolvedValue({ ok: true, program: { linked: true } });
  const { gl, method } = fakeGl();
  await expect(
    compileScene(gl, pack(true), Promise.resolve(undefined)),
  ).resolves.toEqual({ ok: false, log: 'scene artwork was not decoded' });
  expect(method('deleteProgram')).toHaveBeenCalledWith({ linked: true });
});

it('answers a failed link without waiting for the picture at all', async () => {
  mockLink.mockResolvedValue({ ok: false, log: 'ERROR: 0:1: bad' });
  const { gl } = fakeGl();
  const never = deferred<ImageBitmap | undefined>().promise;
  await expect(compileScene(gl, pack(true), never)).resolves.toEqual({
    ok: false,
    log: 'ERROR: 0:1: bad',
  });
});

it('still takes a picture already decoded, and a scene with none', async () => {
  mockLink.mockResolvedValue({ ok: true, program: {} });
  const { gl, method } = fakeGl();
  const bitmap = { width: 4, height: 4 } as ImageBitmap;
  expect((await compileScene(gl, pack(true), bitmap)).ok).toBe(true);
  expect(
    method('texImage2D').mock.calls.some((call) => call[5] === bitmap),
  ).toBe(true);
  const plain = fakeGl();
  expect((await compileScene(plain.gl, pack(false))).ok).toBe(true);
  expect(
    plain.method('texImage2D').mock.calls.some((call) => call.length === 6),
  ).toBe(false);
});
