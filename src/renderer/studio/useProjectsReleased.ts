/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useCallback, useEffect, useState } from 'react';
import type { IPublishedScene } from 'common/plusGallery';
import type { ISceneSubmission } from 'common/plusReview';
import type { IStudioProject } from 'main/ipc/studioProjectTypes';
import { loadMyScenes } from '../plus/myScenes';

/**
 * Where each project stands in the gallery, for the project list (Ivan,
 * 2026-11-08: "show in the list published if last version is on the lib on
 * the server for all ... and no more changes were made"):
 *
 * - published: the version last published from its folder is live in the
 *   gallery for everyone, and the folder holds exactly what went out;
 * - review: that version waits for review, the folder still unchanged.
 *
 * Nothing at all while its folder changed since, which is a scene being
 * worked on again; and the list puts its AI's state ahead of either.
 */
export type TProjectRelease = 'published' | 'review';

export const releaseOf = (
  project: Pick<IStudioProject, 'published'>,
  scenes: readonly IPublishedScene[],
  sent: readonly ISceneSubmission[],
): TProjectRelease | undefined => {
  const { published } = project;
  if (!published?.unchanged) {
    return undefined;
  }
  const { sceneId, version } = published;
  if (
    scenes.some(
      (scene) =>
        !scene.official &&
        !scene.blocked &&
        scene.sceneId === sceneId &&
        scene.version === version,
    )
  ) {
    return 'published';
  }
  return sent.some(
    (entry) =>
      entry.sceneId === sceneId &&
      entry.version === version &&
      entry.state === 'pending',
  )
    ? 'review'
    : undefined;
};

/**
 * The gallery's word on this account's scenes, asked only while a project
 * here has been published, and again whenever what was published changes.
 */
export default function useProjectsReleased(
  projects: readonly IStudioProject[],
): (project: IStudioProject) => TProjectRelease | undefined {
  const [mine, setMine] = useState<{
    scenes: readonly IPublishedScene[];
    sent: readonly ISceneSubmission[];
  }>({ scenes: [], sent: [] });
  // What was published from here, as one key: a new publication asks again.
  const key = projects
    .flatMap(({ published }) =>
      published ? [`${published.sceneId}@${published.version}`] : [],
    )
    .sort()
    .join(',');
  useEffect(() => {
    if (!key) {
      return undefined;
    }
    let current = true;
    loadMyScenes()
      .then((outcome) => {
        if (current && outcome.state === 'ready') {
          setMine({ scenes: outcome.scenes, sent: outcome.sent });
        }
        return undefined;
      })
      .catch(() => undefined);
    return () => {
      current = false;
    };
  }, [key]);
  return useCallback(
    (project: IStudioProject) => releaseOf(project, mine.scenes, mine.sent),
    [mine],
  );
}
