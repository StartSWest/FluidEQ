/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { Vector3, type PerspectiveCamera } from 'three';
import type { IWorldCamera } from 'common/sceneWorld';
import { createFormula, createVec3Formula } from './worldFormula';
import type { IWorldInputs } from './worldInputs';

/**
 * Where the world is seen from, moved by its formulas: an orbit that speeds
 * up with the music, a push in on the bass, a tilt on the accent. Returns
 * the step to run each frame with the picture's aspect.
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
  return (aspect) => {
    camera.fov = Math.min(170, Math.max(1, fov.value()));
    camera.aspect = aspect;
    camera.position.set(
      position.x.value(),
      position.y.value(),
      position.z.value(),
    );
    look.set(target.x.value(), target.y.value(), target.z.value());
    camera.lookAt(look);
    camera.rotateZ(roll.value());
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
  };
};

export default createWorldCamera;
