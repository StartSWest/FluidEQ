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

/**
 * The scenes this account published and what it sent for review, read once
 * for the gallery's Your scenes page and the Account panel alike, so the two
 * say the same thing about the same scene.
 */

type TMineFailure = Extract<TMineOutcome, { ok: false }>['reason'];

const MINE_ERRORS: Record<TMineFailure, TranslationKey> = {
  offline: 'plus.gallery.error.offline',
  'signed-out': 'plus.gallery.error.signedOut',
  server: 'plus.gallery.error.server',
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
 * Both lists. What waits for review never costs the published list: a server
 * before review has nothing waiting, and a read that failed shows the
 * published scenes as they are.
 */
export const loadMyScenes = async (): Promise<TMine> => {
  const api = window.electron?.ipcRenderer;
  const sent =
    api
      ?.mySceneSubmissions?.()
      .then((outcome) => (outcome.ok ? outcome.submissions : []))
      .catch(() => []) ?? Promise.resolve([]);
  try {
    const [outcome, submissions] = await Promise.all([
      api?.myPublishedScenes?.(),
      sent,
    ]);
    if (!outcome) {
      return { state: 'failed', key: 'plus.gallery.error.offline' };
    }
    return outcome.ok
      ? { state: 'ready', scenes: outcome.scenes, sent: submissions }
      : { state: 'failed', key: MINE_ERRORS[outcome.reason] };
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
