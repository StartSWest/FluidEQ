/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { Spherical, Vector3, type PerspectiveCamera } from 'three';
import type { IWorldCamera } from 'common/sceneWorld';
import { createFormula, createVec3Formula } from './worldFormula';
import type { IWorldInputs } from './worldInputs';

/**
 * Short of straight up and down, where a look-at camera folds: the author's
 * own tilt plus the viewer's may add up past what either range allows.
 */
const MIN_POLAR = 0.08;

/**
 * Where the world is seen from, moved by its formulas: an orbit that speeds
 * up with the music, a push in on the bass, a tilt on the accent. Then the
 * viewer's own turn, when the pack lets a drag turn it (`sceneCamera.ts`):
 * round what the camera looks at, raised to look down, nearer or further,
 * which is how the brief tells a shader to read `uCamera` as well, so a
 * world and its sky turn the same way. Returns the step to run each frame
 * with the picture's aspect.
 */
const createWorldCamera = (
  spec: IWorldCamera,
  camera: PerspectiveCamera,
  inputs: IWorldInputs,
): ((aspect: number) => void) => {
  const { runtime, scope } = inputs;
  const fov = createFormula(spec.fov, runtime, scope);
  const position = createVec3Formula(spec.position, runtime, scope);
  const target = createVec3Formula(spec.target, runtime, scope);
  const roll = createFormula(spec.roll, runtime, scope);
  const look = new Vector3();
  const offset = new Vector3();
  const orbit = new Spherical();
  return (aspect) => {
    camera.fov = Math.min(170, Math.max(1, fov.value()));
    camera.aspect = aspect;
    camera.position.set(
      position.x.value(),
      position.y.value(),
      position.z.value(),
    );
    look.set(target.x.value(), target.y.value(), target.z.value());
    const [yaw, pitch, zoom] = inputs.view;
    if (yaw !== 0 || pitch !== 0 || zoom !== 1) {
      orbit.setFromVector3(offset.subVectors(camera.position, look));
      orbit.theta += yaw;
      orbit.phi = Math.min(
        Math.PI - MIN_POLAR,
        Math.max(MIN_POLAR, orbit.phi - pitch),
      );
      orbit.radius /= Math.max(zoom, 1e-3);
      camera.position.setFromSpherical(orbit).add(look);
    }
    camera.lookAt(look);
    camera.rotateZ(roll.value());
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
  };
};

export default createWorldCamera;
