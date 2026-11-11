/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { TPlusCategory } from '../../common/plusGallery';
import type { IScenePack } from '../../common/scenePacks';
import storedScenePack from '../../common/sceneStoredPack';
import { headers, type IAuthorised } from './galleryApi';
import { previewPackSha256 } from './scenePreviewApi';

/**
 * Publishing a member's scene and taking it down: one function on the server
 * does both (`publish-member-scene`), and every answer it can give is told
 * apart here, because each one asks the member for something different — to
 * update FluidEQ, to wait a month, to take a scene down, or nothing at all.
 */

export type TPublishFailure =
  | 'cancelled'
  | 'preview-invalid'
  | 'preview-stale'
  | 'preview-upload'
  | 'offline'
  | 'signed-out'
  | 'forbidden'
  /** A server before the free Studio: only Plus members could publish. */
  | 'not-entitled'
  /** The address is not confirmed yet, which publishing needs. */
  | 'unconfirmed'
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
   * The gallery read this scene differently from how it was built here, and
   * kept nothing (`packSha256` below). Told apart from `refused`: nothing
   * the Studio shows is wrong with the scene, and editing it will not help.
   */
  | 'pack-differs'
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
    if (word === 'banned' || word === 'unconfirmed') {
      return word;
    }
    return 'not-entitled';
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
  if (response.status === 422 && reason === 'pack_differs') {
    return 'pack-differs';
  }
  if (response.status === 422 && reason === 'preview') {
    return 'preview-invalid';
  }
  if (response.status === 422 || response.status === 413) {
    return 'refused';
  }
  return 'server';
};

/**
 * Whether the gallery kept the scene that was meant: `same` by its own
 * digest of what it kept; `unsaid` from a service before the check, which
 * compared nothing; `differs` should be impossible, since a service that
 * answers with a digest refuses the publication first, and is logged loudly.
 */
export type TKeptCopy = 'same' | 'differs' | 'unsaid';

const keptCopyOf = (body: unknown, meant: string): TKeptCopy => {
  const said = isRecord(body) ? body.packSha256 : undefined;
  if (typeof said !== 'string') {
    return 'unsaid';
  }
  return said === meant ? 'same' : 'differs';
};

const callPublish = async (
  auth: IAuthorised,
  body: Record<string, unknown>,
): Promise<Response | undefined> => {
  try {
    let response = await (auth.fetchImpl ?? fetch)(
      `${auth.config.apiUrl}/publish-member-scene`,
      { method: 'POST', headers: headers(auth), body: JSON.stringify(body) },
    );
    // An accepted publication can need its staged files copied again. Repeat
    // the identical receipt once; the server finishes that exact transaction.
    if (
      body.previewUploadId &&
      response.status === 502 &&
      (await refusalOf(response.clone())).word === 'files_failed'
    ) {
      response = await (auth.fetchImpl ?? fetch)(
        `${auth.config.apiUrl}/publish-member-scene`,
        { method: 'POST', headers: headers(auth), body: JSON.stringify(body) },
      );
    }
    return response;
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
    previewUploadId,
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
    previewUploadId?: string;
  },
): Promise<
  | { ok: true; review?: 'pending'; kept: TKeptCopy }
  | { ok: false; reason: TPublishFailure }
> => {
  // What this publication is meant to be, as the service will work it out
  // from the scene it reads: it refuses when the two differ, before it signs
  // or keeps anything, and answers a publication with what it kept.
  const meant = previewPackSha256(pack);
  const response = await callPublish(auth, {
    action: 'publish',
    termsVersion,
    category,
    ...(category2 ? { category2 } : {}),
    // The service reads every control from `params` alone.
    pack: storedScenePack(pack),
    packSha256: meant,
    picture,
    ...(note ? { note } : {}),
    ...(previewUploadId ? { previewUploadId } : {}),
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
    if (
      previewUploadId &&
      (!isRecord(body) || body.previewUploadId !== previewUploadId)
    ) {
      return { ok: false, reason: 'preview-upload' };
    }
    const kept = keptCopyOf(body, meant);
    return isRecord(body) && body.review === 'pending'
      ? { ok: true, review: 'pending', kept }
      : { ok: true, kept };
  } catch {
    return previewUploadId
      ? { ok: false, reason: 'preview-upload' }
      : { ok: true, kept: 'unsaid' };
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
