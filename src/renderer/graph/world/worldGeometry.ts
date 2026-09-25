/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  BoxGeometry,
  CapsuleGeometry,
  ConeGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  IcosahedronGeometry,
  OctahedronGeometry,
  PlaneGeometry,
  RingGeometry,
  SphereGeometry,
  TetrahedronGeometry,
  TorusGeometry,
  TorusKnotGeometry,
  type BufferGeometry,
} from 'three';
import type { IWorldGeometry, IWorldLayout } from 'common/sceneWorld';
import { layoutCount } from 'common/sceneWorldNodes';
import { hash01 } from 'common/worldExpressionLexicon';

/** A world's shapes, and where a set of copies of one starts. */

export const buildWorldGeometry = (shape: IWorldGeometry): BufferGeometry => {
  const [width, height, depth] = shape.size;
  const [around, along] = shape.segments;
  switch (shape.kind) {
    case 'sphere':
      return new SphereGeometry(shape.radius, around, Math.max(2, along));
    case 'icosahedron':
      return new IcosahedronGeometry(shape.radius, shape.detail);
    case 'octahedron':
      return new OctahedronGeometry(shape.radius, shape.detail);
    case 'tetrahedron':
      return new TetrahedronGeometry(shape.radius, shape.detail);
    case 'dodecahedron':
      return new DodecahedronGeometry(shape.radius, shape.detail);
    case 'torus':
      return new TorusGeometry(
        shape.radius,
        shape.tube,
        Math.max(2, along),
        Math.max(3, around),
      );
    case 'torusKnot':
      return new TorusKnotGeometry(
        shape.radius,
        shape.tube,
        Math.max(3, around * 2),
        Math.max(3, along),
        shape.knot[0],
        shape.knot[1],
      );
    case 'cylinder':
      return new CylinderGeometry(
        shape.radius,
        shape.tube,
        height,
        Math.max(3, around),
        1,
        shape.open,
      );
    case 'cone':
      return new ConeGeometry(
        shape.radius,
        height,
        Math.max(3, around),
        1,
        shape.open,
      );
    case 'plane':
      return new PlaneGeometry(width, height, around, along);
    case 'ring':
      return new RingGeometry(shape.tube, shape.radius, Math.max(3, around));
    case 'capsule':
      return new CapsuleGeometry(
        shape.radius,
        height,
        Math.max(1, along),
        Math.max(3, around),
      );
    default:
      return new BoxGeometry(width, height, depth);
  }
};

/** One copy's starting place and the numbers its formulas are given. */
export interface IWorldSlot {
  x: number;
  y: number;
  z: number;
  u: number;
  rand: number;
  rand2: number;
  rand3: number;
  angle: number;
}

/**
 * Every copy's start. The golden angle spaces a sphere's points evenly
 * without a seam; `rand` is repeatable, so a scene looks the same each time
 * it is opened and a copy keeps its own character from frame to frame.
 */
export const layoutSlots = (layout: IWorldLayout): IWorldSlot[] => {
  const count = layoutCount(layout);
  const slots: IWorldSlot[] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i += 1) {
    const u = count > 1 ? i / (count - 1) : 0;
    const seed = layout.seed * 1000 + i;
    const rand = hash01(seed);
    const rand2 = hash01(seed + 0.37);
    const rand3 = hash01(seed + 0.71);
    let x = 0;
    let y = 0;
    let z = 0;
    switch (layout.kind) {
      case 'grid': {
        const [nx, ny] = layout.count;
        const ix = i % nx;
        const iy = Math.floor(i / nx) % ny;
        const iz = Math.floor(i / (nx * ny));
        const [sx, sy, sz] = layout.spacing;
        x = (ix - (nx - 1) / 2) * sx;
        y = (iy - (ny - 1) / 2) * sy;
        z = (iz - (layout.count[2] - 1) / 2) * sz;
        break;
      }
      case 'ring': {
        const full = Math.abs(layout.arc - Math.PI * 2) < 1e-6;
        const step = full ? layout.arc / count : layout.arc * u;
        const theta = full ? i * step : step - layout.arc / 2;
        x = Math.sin(theta) * layout.radius;
        z = Math.cos(theta) * layout.radius;
        y = layout.height;
        break;
      }
      case 'spiral': {
        const theta = u * layout.turns * Math.PI * 2;
        x = Math.sin(theta) * layout.radius;
        z = Math.cos(theta) * layout.radius;
        y = (u - 0.5) * layout.height;
        break;
      }
      case 'scatter': {
        const [bx, by, bz] = layout.box;
        x = (rand - 0.5) * bx;
        y = (rand2 - 0.5) * by;
        z = (rand3 - 0.5) * bz;
        break;
      }
      case 'sphere': {
        const lift = count > 1 ? 1 - (i / (count - 1)) * 2 : 0;
        const across = Math.sqrt(Math.max(0, 1 - lift * lift));
        const theta = golden * i;
        x = Math.cos(theta) * across * layout.radius;
        y = lift * layout.radius;
        z = Math.sin(theta) * across * layout.radius;
        break;
      }
      default: {
        const [fx, fy, fz] = layout.from;
        const [tx, ty, tz] = layout.to;
        x = fx + (tx - fx) * u;
        y = fy + (ty - fy) * u;
        z = fz + (tz - fz) * u;
      }
    }
    slots.push({
      x,
      y,
      z,
      u,
      rand,
      rand2,
      rand3,
      angle: Math.atan2(x, z),
    });
  }
  return slots;
};
