/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ISceneSubmission, TRejectReason } from './plusReview';

/**
 * Where each of a maker's scenes stands with the review, from the server's
 * record of what was sent (`my_scene_submissions`): the mark the Studio, Your
 * scenes and the project picker put beside a scene.
 *
 * Ivan, 2026-11-11: "make sure it is shown on the Studio somewhere until they
 * republish", "like with a warning icon, they hover and see the reason". It
 * comes from the server and never from this computer, so it survives putting
 * the notice away, a restart and signing in on another PC; and it is the
 * NEWEST thing sent of each scene that decides, so sending a refused scene
 * again turns its warning into "waiting for review" and an approval takes the
 * mark away.
 */
export type TSceneStanding =
  | {
      kind: 'rejected';
      version: number;
      reason: TRejectReason;
      reasonNote?: string;
      decidedAt: string;
    }
  | { kind: 'pending'; version: number; submittedAt: string };

/** By scene id: the maker's own scenes, so an id names one scene. */
export type TSceneStandings = Readonly<Record<string, TSceneStanding>>;

const newer = (a: ISceneSubmission, b: ISceneSubmission) =>
  b.version !== a.version
    ? b.version > a.version
    : Date.parse(b.submittedAt) > Date.parse(a.submittedAt);

export const sceneStandings = (
  mine: readonly ISceneSubmission[] | undefined,
): TSceneStandings => {
  const latest = new Map<string, ISceneSubmission>();
  (mine ?? []).forEach((entry) => {
    const held = latest.get(entry.sceneId);
    if (!held || newer(held, entry)) {
      latest.set(entry.sceneId, entry);
    }
  });
  const standings: Record<string, TSceneStanding> = {};
  latest.forEach((entry, sceneId) => {
    if (entry.state === 'pending') {
      standings[sceneId] = {
        kind: 'pending',
        version: entry.version,
        submittedAt: entry.submittedAt,
      };
    } else if (entry.state === 'rejected' && entry.reason && entry.decidedAt) {
      standings[sceneId] = {
        kind: 'rejected',
        version: entry.version,
        reason: entry.reason,
        ...(entry.reasonNote ? { reasonNote: entry.reasonNote } : {}),
        decidedAt: entry.decidedAt,
      };
    }
  });
  return standings;
};

/** Whether anything of this account's waits for the review's answer. */
export const anyPending = (mine: readonly ISceneSubmission[] | undefined) =>
  (mine ?? []).some((entry) => entry.state === 'pending');
