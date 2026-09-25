/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { TPlusCategory } from '../../common/plusGallery';
import type { IScenePack } from '../../common/scenePacks';
import { headers, type IAuthorised } from './galleryApi';

/**
 * Publishing a member's scene and taking it down: one function on the server
 * does both (`publish-member-scene`), and every answer it can give is told
 * apart here, because each one asks the member for something different — to
 * update FluidEQ, to wait a month, to take a scene down, or nothing at all.
 */

export type TPublishFailure =
  | 'offline'
  | 'signed-out'
  | 'not-entitled'
  | 'banned'
  | 'terms'
  | 'rate-limited'
  /**
   * The month's allowance of submissions is spent, and it is not a wait of
   * an hour: told apart from `rate-limited` so the answer can say when it
   * comes back rather than "try again shortly" to somebody who must wait
   * weeks. How many a month takes is the server's (`maker_month_submissions`)
   * and is not repeated here.
   */
  | 'too-many-this-month'
  /**
   * The member already has as many scenes in the gallery and waiting for
   * review as one member may (`PLUS_MAX_PUBLISHED_SCENES`). Nothing in the
   * scene is wrong, so it is told apart from `refused`, whose answer is to
   * fix what the Studio shows: only a NEW scene is refused, and one taken
   * down makes room.
   */
  | 'too-many-scenes'
  | 'refused'
  /** Most of the scene is one of FluidEQ's own, which is only to learn from. */
  | 'official-copy'
  /**
   * The gallery already holds this version of the scene, and a scene's content
   * may only change under a higher one. Publishing raises the number itself,
   * so this is two publications of the same scene crossing — the second read
   * the gallery before the first wrote to it.
   */
  | 'version-not-raised'
  /**
   * The admin took this scene down: it takes no new version, and comes back
   * only as it was, if the admin restores it (server migration 0038).
   */
  | 'taken-down'
  /** The admin deleted this scene for good; it is never published again. */
  | 'deleted'
  | 'server';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * The words of a refusal: `error`, and `reason` where one word covers several
 * causes — every 422 the function sends for the scene itself is `refused`,
 * and only its reason says which.
 */
const refusalOf = async (
  response: Response,
): Promise<{ word: string; reason: string }> => {
  try {
    const body: unknown = await response.json();
    return isRecord(body)
      ? {
          word: typeof body.error === 'string' ? body.error : '',
          reason: typeof body.reason === 'string' ? body.reason : '',
        }
      : { word: '', reason: '' };
  } catch {
    return { word: '', reason: '' };
  }
};

const publishFailure = async (response: Response): Promise<TPublishFailure> => {
  if (response.status === 401) {
    return 'signed-out';
  }
  const { word, reason } = await refusalOf(response);
  if (response.status === 409 && word === 'terms_outdated') {
    return 'terms';
  }
  if (response.status === 409 && word === 'version_not_raised') {
    return 'version-not-raised';
  }
  if (response.status === 409 && word === 'scene_taken_down') {
    return 'taken-down';
  }
  if (response.status === 409 && word === 'scene_deleted') {
    return 'deleted';
  }
  if (response.status === 403) {
    return word === 'banned' ? 'banned' : 'not-entitled';
  }
  if (response.status === 429) {
    return word === 'too_many_this_month'
      ? 'too-many-this-month'
      : 'rate-limited';
  }
  if (response.status === 422 && word === 'official_copy') {
    return 'official-copy';
  }
  if (response.status === 422 && reason === 'too_many_scenes') {
    return 'too-many-scenes';
  }
  if (response.status === 422 || response.status === 413) {
    return 'refused';
  }
  return 'server';
};

const callPublish = async (
  auth: IAuthorised,
  body: Record<string, unknown>,
): Promise<Response | undefined> => {
  try {
    return await (auth.fetchImpl ?? fetch)(
      `${auth.config.apiUrl}/publish-member-scene`,
      { method: 'POST', headers: headers(auth), body: JSON.stringify(body) },
    );
  } catch {
    return undefined;
  }
};

export const publishScene = async (
  auth: IAuthorised,
  {
    termsVersion,
    category,
    category2,
    pack,
    picture,
    note,
  }: {
    termsVersion: number;
    category: TPlusCategory;
    /** A second category, never the first (fluideq-premium 0018). */
    category2?: TPlusCategory;
    pack: IScenePack;
    /** The WebP, base64. */
    picture: string;
    /** What changed in this version, already cleaned (fluideq-premium 0026). */
    note?: string;
  },
): Promise<
  { ok: true; review?: 'pending' } | { ok: false; reason: TPublishFailure }
> => {
  const response = await callPublish(auth, {
    action: 'publish',
    termsVersion,
    category,
    ...(category2 ? { category2 } : {}),
    pack,
    picture,
    ...(note ? { note } : {}),
  });
  if (!response) {
    return { ok: false, reason: 'offline' };
  }
  if (!response.ok) {
    return { ok: false, reason: await publishFailure(response) };
  }
  // A member's publication waits for the admin (fluideq-premium 0037), and
  // the answer says so; the admin's own goes straight out and says nothing of
  // the kind. A body that cannot be read is a publication that went through,
  // which is what the status already said.
  try {
    const body: unknown = await response.json();
    return typeof body === 'object' &&
      body !== null &&
      'review' in body &&
      body.review === 'pending'
      ? { ok: true, review: 'pending' }
      : { ok: true };
  } catch {
    return { ok: true };
  }
};

export const unpublishScene = async (
  auth: IAuthorised,
  sceneId: string,
): Promise<{ ok: true } | { ok: false; reason: TPublishFailure }> => {
  const response = await callPublish(auth, { action: 'unpublish', sceneId });
  if (!response) {
    return { ok: false, reason: 'offline' };
  }
  return response.ok
    ? { ok: true }
    : { ok: false, reason: await publishFailure(response) };
};
