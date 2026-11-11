/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * One line in the app's log for every way a scene ends up not playing, the
 * same shape wherever it happens (Ivan, 2026-11-11: "make sure we log scene
 * failures so users can send logs to us"). The line that found his palette
 * bug was "Member scene … failed to run here: compile. ERROR: 0:14:
 * 'uPalette_colours' : undeclared identifier"; every other way a scene could
 * fail said nothing, or said it in its own words somewhere else.
 *
 * Ids and versions only, never a name or a path; the driver's or reader's own
 * words are flattened onto the line and redacted with the rest of the log
 * when a report gathers it. Written once per scene, surface and cause in a
 * session, so a scene that fails on every frame writes one line.
 */

/** Where the scene was to play. */
export const SCENE_SURFACES = [
  'graph',
  'player',
  'preview',
  'desktop',
  'studio',
  'lamps',
  'engine-look',
  'looks',
] as const;
export type TSceneSurface = (typeof SCENE_SURFACES)[number];

/** Why it did not. */
export const SCENE_FAILURE_REASONS = [
  // Never reached the renderer.
  'not-listed',
  'not-owned',
  'blocked',
  'load-failed',
  'read-refused',
  'signature-refused',
  // Reached it and would not build or run.
  'compile',
  'version-compile',
  'world-refused',
  'unavailable',
  'no-worker',
  'context-lost',
  'gpu-reset',
  'stalled-gpu',
  // What stood in, or how it was mended (`useSceneRunner`, the recovery chain).
  'stood-in',
  'healed-disk',
  'healed-project',
  'healed-server',
  'gave-up',
] as const;
export type TSceneFailureReason = (typeof SCENE_FAILURE_REASONS)[number];

export interface ISceneFailureEntry {
  /** The look id (`premium:…`, `member:…:…`) or the scene's own id. */
  lookId: string;
  /** The version or revision that failed, when known. */
  version?: string;
  surface: TSceneSurface;
  reason: TSceneFailureReason;
  /** The driver's, loader's or reader's own words. */
  detail?: string;
}

/** The one channel every window writes them through. */
export const SCENE_FAILURE_CHANNEL = 'scene-failure-log';

/** What every line starts with, so a report can find them all. */
export const SCENE_FAILURE_MARK = 'Scene failure:';

const SAFE_ID = /^[A-Za-z0-9:._@-]{1,160}$/;
const MAX_DETAIL = 400;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** An entry as it crossed from a window, or undefined when it is not one. */
export const readSceneFailureEntry = (
  value: unknown,
): ISceneFailureEntry | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }
  const { lookId, version, surface, reason, detail } = value;
  const knownSurface = SCENE_SURFACES.find((one) => one === surface);
  const knownReason = SCENE_FAILURE_REASONS.find((one) => one === reason);
  if (
    typeof lookId !== 'string' ||
    !SAFE_ID.test(lookId) ||
    !knownSurface ||
    !knownReason ||
    (version !== undefined &&
      (typeof version !== 'string' || !SAFE_ID.test(version)))
  ) {
    return undefined;
  }
  return {
    lookId,
    surface: knownSurface,
    reason: knownReason,
    ...(typeof version === 'string' ? { version } : {}),
    ...(typeof detail === 'string' ? { detail } : {}),
  };
};

/** The words flattened onto one line and cut to a length a log can carry. */
const flatten = (detail: string | undefined): string => {
  if (!detail) {
    return '';
  }
  // eslint-disable-next-line no-control-regex -- a driver's log is flattened onto one line, control characters included
  const line = detail.replace(/[\u0000-\u001f\u007f]+/g, ' ').trim();
  if (!line) {
    return '';
  }
  return ` ${line.length > MAX_DETAIL ? `${line.slice(0, MAX_DETAIL)}…` : line}`;
};

/** The line itself. */
export const sceneFailureLine = ({
  lookId,
  version,
  surface,
  reason,
  detail,
}: ISceneFailureEntry): string =>
  `${SCENE_FAILURE_MARK} ${lookId}${version ? ` v${version}` : ''} on ${surface}: ${reason}.${flatten(detail)}`;

/** Once per scene, version, surface and cause. */
export const sceneFailureKey = ({
  lookId,
  version,
  surface,
  reason,
}: ISceneFailureEntry): string =>
  `${lookId}|${version ?? ''}|${surface}|${reason}`;
