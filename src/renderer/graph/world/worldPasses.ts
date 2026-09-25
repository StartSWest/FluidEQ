/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  BufferAttribute,
  BufferGeometry,
  Mesh,
  OrthographicCamera,
  Scene,
  type Material,
} from 'three';

/**
 * One triangle over the whole target, for the passes that work on pictures
 * rather than on the world: the glow's chain and the final mix.
 *
 * A triangle rather than a quad for the reason `sceneUniformContract.ts`
 * gives: no seam down a diagonal where two triangles meet and every pixel on
 * it is shaded twice.
 */
export interface IWorldPass {
  scene: Scene;
  camera: OrthographicCamera;
  use(material: Material): void;
  dispose(): void;
}

export const WORLD_PASS_VERTEX = `
in vec3 position;
out vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

export const createWorldPass = (): IWorldPass => {
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    'position',
    new BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3),
  );
  const mesh = new Mesh(geometry);
  mesh.frustumCulled = false;
  const scene = new Scene();
  scene.add(mesh);
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  return {
    scene,
    camera,
    use: (material) => {
      mesh.material = material;
    },
    dispose: () => geometry.dispose(),
  };
};
