/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  parseSubmissionRow,
  type ISceneSubmission,
} from '../../common/plusReview';
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
 * migration 0037): what a maker sent, and the picture that waits with it.
 * Who may read a file that waits is the server's to say on every call.
 */

export type TReviewFailure = TGalleryFailure | 'forbidden';

export const failureOf = (status: number): TReviewFailure => {
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

export type TWaitingFile =
  | { ok: true; bytes: Uint8Array }
  | { ok: false; reason: TReviewFailure | 'changed' };

/**
 * One file that waits, whole. Storage answers a file it will not hand over —
 * gone, or no longer the submission that waits, which the bucket's policy
 * then refuses — with 400 or 404: that is `changed`, and anything else is the
 * connection's or the server's, never a claim that the maker sent again.
 */
export const waitingFile = async (
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

export const listed = async <TRow>(
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
    const parsedRows = rows.map(parse);
    // A malformed pending scene is a failed read, not an empty queue.
    return parsedRows.every((row): row is TRow => row !== undefined)
      ? { ok: true, rows: parsedRows }
      : { ok: false, reason: 'server' };
  } catch {
    return { ok: false, reason: 'server' };
  }
};

/** What this account sent for review, and what became of it. */
export const mySubmissions = (auth: IAuthorised) =>
  listed<ISceneSubmission>(auth, 'my_scene_submissions', parseSubmissionRow);

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
