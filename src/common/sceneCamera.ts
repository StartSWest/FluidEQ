/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The viewer's camera on a 3D scene: how far they may turn it, tilt it and
 * move in or out, as the scene's author allows in `pack.json`'s `camera`.
 *
 * The app does the dragging, the zooming and the easing, the same way in
 * every scene, and hands the scene only where the camera stands
 * (`uCamera`). A scene left to read the pointer and clamp an angle itself
 * leaves a dead zone past its limit: a drag that goes on past it moves
 * nothing, and coming back means dragging all that way first. Knowing the
 * limits here is what lets the drag stop where the scene stops.
 *
 * Angles are radians, zoom a factor: 0 and 0 and 1 is the view the author
 * drew, which must lie inside every range. A scene with no `camera` cannot be
 * turned at all, and the drag is left to whatever else the panel does.
 */

export interface ISceneCameraLimits {
  /** Radians the viewer may turn the scene to the left (below 0) and right. */
  yaw: readonly [number, number];
  /**
   * Radians the viewer may be lowered to look up at it (below 0) and raised
   * to look down on it.
   */
  pitch: readonly [number, number];
  /** How far out (below 1) and in (above 1) the viewer may move. */
  zoom: readonly [number, number];
}

export interface ISceneCamera {
  yaw: number;
  pitch: number;
  zoom: number;
}

export const DEFAULT_SCENE_CAMERA: ISceneCamera = { yaw: 0, pitch: 0, zoom: 1 };

/** A whole turn each way: past it a scene turns round and round. */
export const MAX_CAMERA_YAW = Math.PI;
/** Short of straight up and straight down, where a look-at basis folds. */
export const MAX_CAMERA_PITCH = 1.45;
export const MIN_CAMERA_ZOOM = 0.25;
export const MAX_CAMERA_ZOOM = 4;

const isCameraRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * One range from `pack.json`, kept inside `[low, high]` and around `home`
 * (the author's own view), or `[home, home]` when it says nothing usable.
 */
const readRange = (
  raw: unknown,
  low: number,
  high: number,
  home: number,
): readonly [number, number] => {
  if (
    !Array.isArray(raw) ||
    raw.length !== 2 ||
    typeof raw[0] !== 'number' ||
    typeof raw[1] !== 'number' ||
    !Number.isFinite(raw[0]) ||
    !Number.isFinite(raw[1])
  ) {
    return [home, home];
  }
  const from = Math.max(low, Math.min(home, Math.min(raw[0], raw[1])));
  const to = Math.min(high, Math.max(home, Math.max(raw[0], raw[1])));
  const tidy = (value: number) => Math.round(value * 1000) / 1000;
  return [tidy(from), tidy(to)];
};

const moves = ([from, to]: readonly [number, number]) => to - from > 1e-3;

/**
 * The limits `pack.json` gives, kept in range, or nothing when they would let
 * the camera move nowhere. Kept rather than refused, as a wave is: a range
 * past what the camera can do is still the author's meaning, and its ends
 * are where the camera can actually go.
 */
export const readSceneCamera = (
  raw: unknown,
): ISceneCameraLimits | undefined => {
  if (!isCameraRecord(raw)) {
    return undefined;
  }
  const limits: ISceneCameraLimits = {
    yaw: readRange(raw.yaw, -MAX_CAMERA_YAW, MAX_CAMERA_YAW, 0),
    pitch: readRange(raw.pitch, -MAX_CAMERA_PITCH, MAX_CAMERA_PITCH, 0),
    zoom: readRange(raw.zoom, MIN_CAMERA_ZOOM, MAX_CAMERA_ZOOM, 1),
  };
  return moves(limits.yaw) || moves(limits.pitch) || moves(limits.zoom)
    ? limits
    : undefined;
};

/**
 * How far short of a whole circle a yaw range may fall and still be one: a
 * member writing [-3.14, 3.14] means all the way round, and is 0.0032 short.
 */
const WHOLE_TURN_SLACK = 0.01;

/** Whether the scene may turn a whole circle, and so never stops turning. */
export const turnsRound = (limits: ISceneCameraLimits) =>
  limits.yaw[1] - limits.yaw[0] >= 2 * MAX_CAMERA_YAW - WHOLE_TURN_SLACK;

const within = (value: number, [from, to]: readonly [number, number]) =>
  Math.max(from, Math.min(to, value));

/** `camera` inside `limits`, a full circle of yaw kept inside one turn. */
export const clampSceneCamera = (
  camera: ISceneCamera,
  limits: ISceneCameraLimits,
): ISceneCamera => {
  let { yaw } = camera;
  if (turnsRound(limits)) {
    // One turn either side of the author's view, so the angle never grows
    // without bound and never jumps where it wraps.
    yaw =
      ((((yaw + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) -
      Math.PI;
  } else {
    yaw = within(yaw, limits.yaw);
  }
  return {
    yaw,
    pitch: within(camera.pitch, limits.pitch),
    zoom: within(camera.zoom, limits.zoom),
  };
};
