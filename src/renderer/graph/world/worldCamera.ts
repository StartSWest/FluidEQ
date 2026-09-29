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
 * world and its sky turn the same way. With the pack's `pivot` at `eye`
 * (`sceneCamera.ts`) the viewer looks round from where the camera stands
 * instead - the target turned about the eye, the zoom a longer lens - as a
 * landscape needs: its target is far off, and an orbit round it swung the
 * camera through its own dock and pines. Returns the step to run each frame
 * with the picture's aspect.
 */
const createWorldCamera = (
  spec: IWorldCamera,
  camera: PerspectiveCamera,
  inputs: IWorldInputs,
  pivot: 'target' | 'eye' = 'target',
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
    const atEye = pivot === 'eye' && (yaw !== 0 || pitch !== 0 || zoom !== 1);
    if (atEye) {
      // A longer lens; the look itself is turned below, about the
      // camera's own axes.
      camera.fov = Math.min(
        170,
        Math.max(1, camera.fov / Math.max(zoom, 1e-3)),
      );
    } else if (yaw !== 0 || pitch !== 0 || zoom !== 1) {
      orbit.setFromVector3(offset.subVectors(camera.position, look));
      orbit.theta += yaw;
      // Held short of the poles, but never pushed back past where the author
      // put the camera: one looking almost straight down jumped the moment
      // the viewer turned it at all, and jumped back at home.
      orbit.phi = Math.min(
        Math.max(Math.PI - MIN_POLAR, orbit.phi),
        Math.max(Math.min(MIN_POLAR, orbit.phi), orbit.phi - pitch),
      );
      orbit.radius /= Math.max(zoom, 1e-3);
      camera.position.setFromSpherical(orbit).add(look);
    }
    camera.lookAt(look);
    camera.rotateZ(roll.value());
    if (atEye) {
      // Round the camera's own up and right, never the world's: a camera
      // looking down on a flower turned about the world's up rolled the
      // picture as it turned, and the painted sky, which only slides, parted
      // from the world in front of it. Right as the orbit turns it, down
      // when raised - after the author's roll, so the lean runs along the
      // picture's own edges: before it, Saturn's tilted camera (0.34) moved
      // the planet on a slant while its painted copy slid straight.
      camera.rotateY(yaw);
      camera.rotateX(-pitch);
    }
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
  };
};

export default createWorldCamera;
