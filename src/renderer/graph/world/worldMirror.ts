/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  HalfFloatType,
  LinearFilter,
  LinearMipmapLinearFilter,
  Matrix4,
  PerspectiveCamera,
  Plane,
  UnsignedByteType,
  Vector3,
  Vector4,
  WebGLRenderTarget,
  type IUniform,
  type Mesh,
  type Scene,
  type WebGLRenderer,
} from 'three';

/**
 * A flat floor's reflection: the world drawn again from under the floor, at
 * half size, and handed to the floor's material (`worldShaderHooks.ts`).
 *
 * The camera is the viewer's mirrored in the floor's plane, and its near
 * plane is tilted to lie in the floor itself (Lengyel's oblique clipping, as
 * three.js's own `Reflector` does), so nothing under the floor turns up in
 * its reflection. The picture keeps its smaller copies, so a rough floor can
 * read a blurred reflection for the price of one sample.
 *
 * The floor itself is hidden for the pass, and the shadows are not drawn
 * again for it: the viewer's pass does that, and the reflection of a shadow
 * a frame old is not something anyone can see.
 */

export interface IWorldMirror {
  uniforms: Record<string, IUniform>;
  render(
    renderer: WebGLRenderer,
    scene: Scene,
    camera: PerspectiveCamera,
    floor: Mesh,
    width: number,
    height: number,
  ): void;
  dispose(): void;
}

export const createWorldMirror = (floatTargets: boolean): IWorldMirror => {
  const target = new WebGLRenderTarget(1, 1, {
    type: floatTargets ? HalfFloatType : UnsignedByteType,
    minFilter: LinearMipmapLinearFilter,
    magFilter: LinearFilter,
    generateMipmaps: true,
    depthBuffer: true,
  });
  const matrix = new Matrix4();
  const uniforms: Record<string, IUniform> = {
    uMirror: { value: target.texture },
    uMirrorMatrix: { value: matrix },
  };
  const mirrored = new PerspectiveCamera();
  const floorPoint = new Vector3();
  const eye = new Vector3();
  const normal = new Vector3();
  const rotation = new Matrix4();
  const view = new Vector3();
  const lookAt = new Vector3();
  const aim = new Vector3();
  const plane = new Plane();
  const clip = new Vector4();
  const q = new Vector4();

  return {
    uniforms,
    render: (renderer, scene, camera, floor, width, height) => {
      floor.updateWorldMatrix(true, false);
      floorPoint.setFromMatrixPosition(floor.matrixWorld);
      eye.setFromMatrixPosition(camera.matrixWorld);
      rotation.extractRotation(floor.matrixWorld);
      normal.set(0, 0, 1).applyMatrix4(rotation);
      view.subVectors(floorPoint, eye);
      if (view.dot(normal) > 0) {
        // Seen from underneath: there is nothing to reflect.
        return;
      }
      view.reflect(normal).negate().add(floorPoint);
      rotation.extractRotation(camera.matrixWorld);
      lookAt.set(0, 0, -1).applyMatrix4(rotation).add(eye);
      aim
        .subVectors(floorPoint, lookAt)
        .reflect(normal)
        .negate()
        .add(floorPoint);
      mirrored.position.copy(view);
      mirrored.up.set(0, 1, 0).applyMatrix4(rotation).reflect(normal);
      mirrored.lookAt(aim);
      mirrored.far = camera.far;
      mirrored.updateMatrixWorld();
      mirrored.projectionMatrix.copy(camera.projectionMatrix);

      matrix.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
      matrix.multiply(mirrored.projectionMatrix);
      matrix.multiply(mirrored.matrixWorldInverse);

      plane.setFromNormalAndCoplanarPoint(normal, floorPoint);
      plane.applyMatrix4(mirrored.matrixWorldInverse);
      clip.set(plane.normal.x, plane.normal.y, plane.normal.z, plane.constant);
      const projection = mirrored.projectionMatrix.elements;
      q.set(
        (Math.sign(clip.x) + projection[8]) / projection[0],
        (Math.sign(clip.y) + projection[9]) / projection[5],
        -1,
        (1 + projection[10]) / projection[14],
      );
      clip.multiplyScalar(2 / clip.dot(q));
      projection[2] = clip.x;
      projection[6] = clip.y;
      projection[10] = clip.z + 1;
      projection[14] = clip.w;
      mirrored.projectionMatrixInverse.copy(mirrored.projectionMatrix).invert();

      const w = Math.max(1, Math.floor(width / 2));
      const h = Math.max(1, Math.floor(height / 2));
      if (target.width !== w || target.height !== h) {
        target.setSize(w, h);
      }
      const shown = floor.visible;
      const shadows = renderer.shadowMap.autoUpdate;
      floor.visible = false;
      renderer.shadowMap.autoUpdate = false;
      renderer.setRenderTarget(target);
      renderer.setClearColor(0x000000, 0);
      renderer.clear(true, true, false);
      renderer.render(scene, mirrored);
      renderer.shadowMap.autoUpdate = shadows;
      floor.visible = shown;
    },
    dispose: () => target.dispose(),
  };
};
