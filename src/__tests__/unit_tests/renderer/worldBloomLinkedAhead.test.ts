/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { readFileSync } from 'fs';
import { join } from 'path';
import {
  OrthographicCamera,
  RawShaderMaterial,
  Scene,
  Texture,
  WebGLRenderTarget,
  type Material,
  type WebGLRenderer,
} from 'three';
import { createWorldBloom } from '../../../renderer/graph/world/worldBloom';
import type { IWorldPass } from '../../../renderer/graph/world/worldPasses';
import { compileWorldPrograms } from '../../../renderer/graph/world/worldTrial';

/**
 * A world's glow is linked with every other program before its first frame.
 *
 * Its two passes were linked by the trial frame on first use, one after the
 * other, each holding the worker until the driver was done — two of the four
 * programs three compiled that way under Dunes (harness, 2026-11-25, software
 * GL); the trial frame took 292 ms cold where it takes 136 ms with every
 * program already linked. The world now links the passes the glow lists
 * beside the rest, so the list must hold every material the glow draws with.
 */

it('lists every material its passes draw with', () => {
  const used = new Set<Material>();
  const pass: IWorldPass = {
    scene: new Scene(),
    camera: new OrthographicCamera(),
    use: (material) => used.add(material),
    dispose: () => undefined,
  };
  const renderer = {
    setRenderTarget: () => undefined,
    render: () => undefined,
  } as unknown as WebGLRenderer;
  const bloom = createWorldBloom(renderer, pass, true);
  bloom.render(new Texture(), 256, 128);
  expect(used.size).toBeGreaterThan(0);
  expect(
    [...used].every((material) => bloom.materials.includes(material)),
  ).toBe(true);
  expect(new Set(bloom.materials).size).toBe(used.size);
  bloom.dispose();
});

it('hands the driver every pass with the world, and leaves the pass on the last', () => {
  const pass: IWorldPass & { current?: Material } = {
    scene: new Scene(),
    camera: new OrthographicCamera(),
    use: (material) => {
      pass.current = material;
    },
    dispose: () => undefined,
  };
  const own = new Scene();
  const ownMaterial = new RawShaderMaterial();
  const compiledWith: (Material | undefined)[] = [];
  const renderer = {
    setRenderTarget: () => undefined,
    compile: (scene: Scene) => {
      const material = scene === own ? ownMaterial : pass.current;
      compiledWith.push(material);
      return new Set(material ? [material] : []);
    },
  } as unknown as WebGLRenderer;
  const glowDown = new RawShaderMaterial();
  const glowUp = new RawShaderMaterial();
  const mix = new RawShaderMaterial();
  const point = jest.fn();
  const linked = compileWorldPrograms(
    renderer,
    {
      scene: own,
      camera: new OrthographicCamera(),
      drawn: new WebGLRenderTarget(1, 1),
    },
    pass,
    [glowDown, glowUp, mix],
    { target: new WebGLRenderTarget(1, 1), point },
  );
  expect([...linked]).toEqual([ownMaterial, glowDown, glowUp, mix]);
  expect(compiledWith).toEqual([ownMaterial, glowDown, glowUp, mix]);
  expect(pass.current).toBe(mix);
  expect(point).toHaveBeenCalledTimes(1);
});

it('is given the glow beside the final mix, before the wait for every link', () => {
  const program = readFileSync(
    join(__dirname, '../../../renderer/graph/world/worldProgram.ts'),
    'utf8',
  );
  const linkedAhead = program.indexOf(
    '[...(bloom?.materials ?? []), composite.material]',
  );
  const waited = program.indexOf('waitForPrograms(renderer, [...materials]');
  expect(linkedAhead).toBeGreaterThan(0);
  expect(waited).toBeGreaterThan(linkedAhead);
});
