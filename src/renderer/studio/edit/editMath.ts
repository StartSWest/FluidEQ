/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ISceneEditCamera, TTriple } from 'common/sceneEdit';

/**
 * The arithmetic of Edit mode's handles and of the Studio's own camera, on
 * plain numbers: the page never loads the 3D engine, which lives in the
 * scene's worker.
 */

export type TPoint = readonly [number, number];

const sub = (a: TTriple, b: TTriple): TTriple => [
  a[0] - b[0],
  a[1] - b[1],
  a[2] - b[2],
];
const add = (a: TTriple, b: TTriple): TTriple => [
  a[0] + b[0],
  a[1] + b[1],
  a[2] + b[2],
];
const times = (a: TTriple, by: number): TTriple => [
  a[0] * by,
  a[1] * by,
  a[2] * by,
];
const cross = (a: TTriple, b: TTriple): TTriple => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const length = (a: TTriple) => Math.hypot(a[0], a[1], a[2]);
const unit = (a: TTriple): TTriple => {
  const size = length(a);
  return size > 1e-9 ? times(a, 1 / size) : [0, 0, 1];
};

/** How far along a handle a drag went, in the handle's own units. */
export const alongAxis = (drag: TPoint, axis: TPoint): number => {
  const size = axis[0] * axis[0] + axis[1] * axis[1];
  return size > 1e-12 ? (drag[0] * axis[0] + drag[1] * axis[1]) / size : 0;
};

/**
 * A drag as so much of `a` and so much of `b`: a thing slid across the
 * plane two of its axes span. Undefined where the two lie along each other
 * on the canvas, seen edge on, and no drag can tell them apart.
 */
export const inPlane = (
  drag: TPoint,
  a: TPoint,
  b: TPoint,
): readonly [number, number] | undefined => {
  const det = a[0] * b[1] - a[1] * b[0];
  if (Math.abs(det) < 1e-9) {
    return undefined;
  }
  return [
    (drag[0] * b[1] - drag[1] * b[0]) / det,
    (a[0] * drag[1] - a[1] * drag[0]) / det,
  ];
};

/** The angle of `point` on the ring two axes span, from the first of them. */
export const ringAngle = (
  point: TPoint,
  a: TPoint,
  b: TPoint,
): number | undefined => {
  const parts = inPlane(point, a, b);
  return parts ? Math.atan2(parts[1], parts[0]) : undefined;
};

/** The shortest way round from one angle to another. */
export const turnBetween = (from: number, to: number): number => {
  const turn = (to - from) % (2 * Math.PI);
  if (turn > Math.PI) {
    return turn - 2 * Math.PI;
  }
  return turn < -Math.PI ? turn + 2 * Math.PI : turn;
};

export const snapTo = (value: number, step: number): number =>
  step > 0 ? Math.round(value / step) * step : value;

/** Never over the top: the view would flip as it passed the pole. */
const MIN_POLAR = 0.05;

/** The camera swung round what it looks at. */
export const orbit = (
  camera: ISceneEditCamera,
  yaw: number,
  pitch: number,
): ISceneEditCamera => {
  const offset = sub(camera.position, camera.target);
  const radius = Math.max(length(offset), 1e-3);
  const theta = Math.atan2(offset[0], offset[2]) - yaw;
  const phi = Math.min(
    Math.PI - MIN_POLAR,
    Math.max(MIN_POLAR, Math.acos(offset[1] / radius) - pitch),
  );
  return {
    target: camera.target,
    position: add(camera.target, [
      radius * Math.sin(phi) * Math.sin(theta),
      radius * Math.cos(phi),
      radius * Math.sin(phi) * Math.cos(theta),
    ]),
  };
};

/** The camera and what it looks at slid sideways and up, by canvas shares. */
export const slide = (
  camera: ISceneEditCamera,
  right: number,
  up: number,
): ISceneEditCamera => {
  const offset = sub(camera.target, camera.position);
  const forward = unit(offset);
  const side = unit(cross(forward, [0, 1, 0]));
  const rise = cross(side, forward);
  const reach = length(offset);
  const shift = add(times(side, -right * reach), times(rise, up * reach));
  return {
    position: add(camera.position, shift),
    target: add(camera.target, shift),
  };
};

/** Nearer (under 1) or further (over 1) from what it looks at. */
export const dolly = (
  camera: ISceneEditCamera,
  factor: number,
): ISceneEditCamera => {
  const offset = sub(camera.position, camera.target);
  const reach = Math.min(5000, Math.max(0.05, length(offset) * factor));
  return {
    target: camera.target,
    position: add(camera.target, times(unit(offset), reach)),
  };
};

export type TEditSide = 'top' | 'front' | 'side';

/** Straight on from above, the front or the side, as far away as it was. */
export const lookFrom = (
  camera: ISceneEditCamera,
  side: TEditSide,
): ISceneEditCamera => {
  const reach = Math.max(length(sub(camera.position, camera.target)), 0.05);
  const from: Record<TEditSide, TTriple> = {
    // A hair forward of straight down, which has no up to keep.
    top: [0, reach, reach * 0.001],
    front: [0, 0, reach],
    side: [reach, 0, 0],
  };
  return { target: camera.target, position: add(camera.target, from[side]) };
};

/** The camera turned to look at `centre`, from the side it was on. */
export const lookAt = (
  camera: ISceneEditCamera,
  centre: TTriple,
  reach?: number,
): ISceneEditCamera => {
  const offset = sub(camera.position, camera.target);
  const kept = reach ?? length(offset);
  return { target: centre, position: add(centre, times(unit(offset), kept)) };
};
