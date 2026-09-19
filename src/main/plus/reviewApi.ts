/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { MAX_MEMBER_SCENE_FILE_BYTES } from '../../common/memberSceneFile';
import {
  parseReviewRow,
  parseSubmissionRow,
  type IReviewItem,
  type ISceneSubmission,
  type TReviewAnswer,
} from '../../common/plusReview';
import {
  isScenePackEnvelope,
  type IScenePackEnvelope,
} from '../../common/scenePacks';
import {
  headers,
  isCardPicture,
  MAX_PICTURE_BYTES,
  objectUrl,
  rpc,
  type IAuthorised,
  type TGalleryFailure,
} from './galleryApi';

/**
 * Scenes under review, spoken to with the account's own token (server
 * migration 0037). Who the admin is, and who may read a file that waits, is
 * the server's to say on every call; nothing here decides it.
 */

export type TReviewFailure = TGalleryFailure | 'forbidden';

/**
 * Why an answer was refused. `changed` is the maker sending a newer version
 * while the admin watched, withdrawing it, or the scene being answered from
 * another window: what was watched is no longer what waits, and nothing was
 * answered. `files-failed` is the one refusal that is half an answer: the
 * approval stands and its files did not reach the gallery, which answering
 * again finishes. A scene taken down or deleted takes no new version (server
 * migration 0038).
 */
export type TReviewAnswerFailure =
  | TReviewFailure
  | 'changed'
  | 'version-not-raised'
  | 'files-failed'
  | 'taken-down'
  | 'deleted';

const failureOf = (status: number): TReviewFailure => {
  if (status === 401) {
    return 'signed-out';
  }
  return status === 403 ? 'forbidden' : 'server';
};

/**
 * Where a submission's files wait: beside the scene's own, under `review/`,
 * in a folder named by the hash of what was signed (server migration 0038) —
 * so the bytes a hash names are the bytes read, whatever was sent since.
 */
export const reviewPath = (
  authorId: string,
  sceneId: string,
  sha256: string,
  file: 'scene.json' | 'picture.webp',
) => `${authorId}/${sceneId}/review/${sha256}/${file}`;

type TWaitingFile =
  | { ok: true; bytes: Uint8Array }
  | { ok: false; reason: TReviewFailure | 'changed' };

/**
 * One file that waits, whole. Storage answers a file it will not hand over —
 * gone, or no longer the submission that waits, which the bucket's policy
 * then refuses — with 400 or 404: that is `changed`, and anything else is the
 * connection's or the server's, never a claim that the maker sent again.
 */
const waitingFile = async (
  auth: IAuthorised,
  path: string,
  maxBytes: number,
): Promise<TWaitingFile> => {
  let response: Response;
  try {
    response = await (auth.fetchImpl ?? fetch)(objectUrl(auth.config, path), {
      headers: headers(auth),
      cache: 'no-store',
    });
  } catch {
    return { ok: false, reason: 'offline' };
  }
  if (response.status === 400 || response.status === 404) {
    return { ok: false, reason: 'changed' };
  }
  if (!response.ok) {
    return { ok: false, reason: failureOf(response.status) };
  }
  if (Number(response.headers.get('content-length') ?? '0') > maxBytes) {
    return { ok: false, reason: 'server' };
  }
  try {
    // Read whole rather than streamed: see CLAUDE.md on `pipeline`.
    const bytes = new Uint8Array(await response.arrayBuffer());
    return bytes.length <= maxBytes
      ? { ok: true, bytes }
      : { ok: false, reason: 'server' };
  } catch {
    return { ok: false, reason: 'offline' };
  }
};

const listed = async <TRow>(
  auth: IAuthorised,
  name: string,
  parse: (row: unknown) => TRow | undefined,
): Promise<
  { ok: true; rows: TRow[] } | { ok: false; reason: TReviewFailure }
> => {
  let response: Response;
  try {
    response = await rpc(auth, name, {});
  } catch {
    return { ok: false, reason: 'offline' };
  }
  if (!response.ok) {
    return { ok: false, reason: failureOf(response.status) };
  }
  try {
    const rows: unknown = await response.json();
    if (!Array.isArray(rows)) {
      return { ok: false, reason: 'server' };
    }
    return {
      ok: true,
      rows: rows.flatMap((row) => {
        const parsed = parse(row);
        return parsed ? [parsed] : [];
      }),
    };
  } catch {
    return { ok: false, reason: 'server' };
  }
};

/** What this account sent for review, and what became of it. */
export const mySubmissions = (auth: IAuthorised) =>
  listed<ISceneSubmission>(auth, 'my_scene_submissions', parseSubmissionRow);

/** Everything waiting for the admin, oldest first. */
export const reviewQueue = (auth: IAuthorised) =>
  listed<IReviewItem>(auth, 'admin_scene_submissions', parseReviewRow);

/** The file that waits, unverified: the caller checks its signature. */
export const fetchSubmissionEnvelope = async (
  auth: IAuthorised,
  authorId: string,
  sceneId: string,
  sha256: string,
): Promise<
  | { ok: true; envelope: IScenePackEnvelope }
  | { ok: false; reason: TReviewFailure | 'changed' }
> => {
  const file = await waitingFile(
    auth,
    reviewPath(authorId, sceneId, sha256, 'scene.json'),
    MAX_MEMBER_SCENE_FILE_BYTES,
  );
  if (!file.ok) {
    return file;
  }
  try {
    const parsed: unknown = JSON.parse(new TextDecoder().decode(file.bytes));
    return isScenePackEnvelope(parsed)
      ? { ok: true, envelope: parsed }
      : { ok: false, reason: 'server' };
  } catch {
    return { ok: false, reason: 'server' };
  }
};

/** The picture that waits with it, as bytes that are a WebP. */
export const fetchSubmissionPicture = async (
  auth: IAuthorised,
  authorId: string,
  sceneId: string,
  sha256: string,
): Promise<Uint8Array | undefined> => {
  const file = await waitingFile(
    auth,
    reviewPath(authorId, sceneId, sha256, 'picture.webp'),
    MAX_PICTURE_BYTES,
  );
  return file.ok && isCardPicture(file.bytes) ? file.bytes : undefined;
};

const errorWord = async (response: Response): Promise<string> => {
  try {
    const body: unknown = await response.json();
    return typeof body === 'object' &&
      body !== null &&
      'error' in body &&
      typeof body.error === 'string'
      ? body.error
      : '';
  } catch {
    return '';
  }
};

/**
 * The review function's 409 words the window says apart; every other one
 * (`not_waiting`, `changed_since`) means what was watched no longer waits.
 */
const ANSWER_CONFLICTS = new Map<string, TReviewAnswerFailure>([
  ['version_not_raised', 'version-not-raised'],
  ['taken_down', 'taken-down'],
  ['deleted', 'deleted'],
]);

const callReview = async (
  auth: IAuthorised,
  body: Record<string, unknown>,
): Promise<{ ok: true } | { ok: false; reason: TReviewAnswerFailure }> => {
  let response: Response;
  try {
    response = await (auth.fetchImpl ?? fetch)(
      `${auth.config.apiUrl}/review-member-scene`,
      { method: 'POST', headers: headers(auth), body: JSON.stringify(body) },
    );
  } catch {
    return { ok: false, reason: 'offline' };
  }
  if (response.ok) {
    return { ok: true };
  }
  const word = await errorWord(response);
  if (response.status === 502 && word === 'files_failed') {
    return { ok: false, reason: 'files-failed' };
  }
  if (response.status === 409) {
    return { ok: false, reason: ANSWER_CONFLICTS.get(word) ?? 'changed' };
  }
  return { ok: false, reason: failureOf(response.status) };
};

/**
 * The admin's answer to one waiting scene, naming the version and the bytes
 * that were watched: the server answers nothing else in its place.
 */
export const answerSubmission = (
  auth: IAuthorised,
  item: Pick<IReviewItem, 'authorId' | 'sceneId' | 'version' | 'sha256'>,
  answer: TReviewAnswer,
) =>
  callReview(auth, {
    action: answer.action,
    authorId: item.authorId,
    sceneId: item.sceneId,
    version: item.version,
    sha256: item.sha256,
    ...(answer.action === 'reject'
      ? { reason: answer.reason, ...(answer.note ? { note: answer.note } : {}) }
      : {}),
  });

/** A scene out of the gallery and out of every member's looks, for good. */
export const deleteScene = (
  auth: IAuthorised,
  authorId: string,
  sceneId: string,
) => callReview(auth, { action: 'delete', authorId, sceneId });
