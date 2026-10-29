/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { TranslationKey } from 'common/i18n';
import type { IPublishedScene } from 'common/plusGallery';
import type { ISceneSubmission } from 'common/plusReview';
import { premiumLookId } from 'common/scenePacks';
import type { TMineOutcome } from 'main/ipc/plusPublishing';
import type { TMySubmissionsOutcome } from 'main/ipc/plusReview';

/**
 * The scenes this account published and what it sent for review, read once
 * for the gallery's Your scenes page and the Account panel alike, so the two
 * say the same thing about the same scene.
 */

type TMineFailure = Extract<
  TMineOutcome | TMySubmissionsOutcome,
  { ok: false }
>['reason'];

const MINE_ERRORS: Record<TMineFailure, TranslationKey> = {
  offline: 'plus.gallery.error.offline',
  'signed-out': 'plus.gallery.error.signedOut',
  server: 'plus.gallery.error.server',
  forbidden: 'plus.gallery.error.forbidden',
};

export type TMine =
  | { state: 'loading' }
  | {
      state: 'ready';
      scenes: IPublishedScene[];
      /** What was sent for review, waiting or answered (fluideq-premium 0037). */
      sent: ISceneSubmission[];
    }
  | { state: 'failed'; key: TranslationKey };

/** The id a publication is taken down by: FluidEQ's own carry its look's. */
export const publicationId = (scene: IPublishedScene) =>
  scene.official ? premiumLookId(scene.sceneId) : scene.sceneId;

/**
 * A failed review read is not an empty review queue. Otherwise an account
 * with only a pending scene was told it had never sent anything.
 */
export const loadMyScenes = async (): Promise<TMine> => {
  const api = window.electron?.ipcRenderer;
  try {
    const [outcome, sent] = await Promise.all([
      api?.myPublishedScenes?.(),
      api?.mySceneSubmissions?.(),
    ]);
    if (!outcome || !sent) {
      return { state: 'failed', key: 'plus.gallery.error.offline' };
    }
    if (!outcome.ok) {
      return { state: 'failed', key: MINE_ERRORS[outcome.reason] };
    }
    return sent.ok
      ? { state: 'ready', scenes: outcome.scenes, sent: sent.submissions }
      : { state: 'failed', key: MINE_ERRORS[sent.reason] };
  } catch {
    return { state: 'failed', key: 'plus.gallery.error.offline' };
  }
};

/**
 * What was sent and is not in the gallery at all, waiting or not approved: a
 * scene already published says how its newest version fared on its own row.
 */
export const sentOnly = (
  scenes: readonly IPublishedScene[],
  sent: readonly ISceneSubmission[],
): ISceneSubmission[] => {
  const live = new Set(
    scenes.filter((scene) => !scene.official).map((scene) => scene.sceneId),
  );
  return sent.filter(
    (entry) => entry.state !== 'approved' && !live.has(entry.sceneId),
  );
};
