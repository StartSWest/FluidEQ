/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ISceneSubmission, TRejectReason } from './plusReview';
import type { TLocalizedName } from './scenePacks';

/**
 * The corner notice about scenes under review: a maker told what became of
 * what they sent.
 *
 * Decided here from facts the main process gathers — who is signed in, what
 * the server says was answered, what this computer already
 * showed — so the rule can be read and tested apart from the IPC around it.
 * The window draws what it is sent and says when it was put away.
 *
 * Told once. A notice put away marks what it was about as seen; only
 * something new brings it back.
 */

export type TSceneReviewNotice =
  | {
      kind: 'approved';
      sceneId: string;
      version: number;
      names: TLocalizedName;
      swatch: string[];
      /** True when a version of it was out before: an update, not a first. */
      update: boolean;
      keys: string[];
    }
  | {
      kind: 'rejected';
      sceneId: string;
      version: number;
      names: TLocalizedName;
      swatch: string[];
      reason: TRejectReason;
      reasonNote?: string;
      /** The version members still have, which a refused update leaves out. */
      liveVersion?: number;
      keys: string[];
    };

export interface ISceneReviewFacts {
  /** What this account sent for review, when it could be read. */
  mine?: readonly ISceneSubmission[];
  /** Keys already shown on this computer to this account. */
  seen: ReadonlySet<string>;
  /** Now, for how old an answer may be and still be news. */
  now: number;
}

/**
 * An answer older than this is not news any more. A maker who installs the
 * app on a new computer is not told about everything ever decided.
 */
export const ANSWER_NEWS_DAYS = 30;

/**
 * What makes one answer news: the scene, the version, the answer, and when it
 * was given. Only the gallery's version has to be beaten, so a maker whose
 * version was refused fixes it and sends it again under the same number — and
 * a second refusal of it is news as much as the first was.
 */
const answerKey = (entry: ISceneSubmission) =>
  `answer:${entry.sceneId}@${entry.version}:${entry.state}:${entry.decidedAt ?? ''}`;

export const newest = <T>(entries: readonly T[], when: (entry: T) => string) =>
  [...entries].sort((a, b) => Date.parse(when(b)) - Date.parse(when(a)))[0];

export const sceneReviewNotice = ({
  mine,
  seen,
  now,
}: ISceneReviewFacts): TSceneReviewNotice | undefined => {
  const oldest = now - ANSWER_NEWS_DAYS * 24 * 60 * 60 * 1000;
  const answered = (mine ?? []).filter(
    (entry) =>
      entry.state !== 'pending' &&
      entry.decidedAt !== undefined &&
      Date.parse(entry.decidedAt) >= oldest &&
      !seen.has(answerKey(entry)),
  );
  if (answered.length === 0) {
    return undefined;
  }
  const latest = newest(answered, (entry) => entry.decidedAt ?? '');
  const keys = [answerKey(latest)];
  if (latest.state === 'approved') {
    return {
      kind: 'approved',
      sceneId: latest.sceneId,
      version: latest.version,
      names: latest.names,
      swatch: latest.swatch,
      update:
        latest.firstVersion !== undefined &&
        latest.firstVersion < latest.version,
      keys,
    };
  }
  if (!latest.reason) {
    return undefined;
  }
  return {
    kind: 'rejected',
    sceneId: latest.sceneId,
    version: latest.version,
    names: latest.names,
    swatch: latest.swatch,
    reason: latest.reason,
    ...(latest.reasonNote ? { reasonNote: latest.reasonNote } : {}),
    ...(latest.liveVersion ? { liveVersion: latest.liveVersion } : {}),
    keys,
  };
};
