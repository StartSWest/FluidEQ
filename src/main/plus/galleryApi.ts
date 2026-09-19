import type { IAccountConfig } from '../../common/accountConfig';
import {
  GALLERY_PAGE_SIZE,
  parseGalleryRow,
  parsePublishedRow,
  parseVersionFloorRow,
  parseVersionRow,
  type IGalleryQuery,
  type IGalleryScene,
  type IGalleryVersion,
  type IPublishedScene,
  type IVersionFloor,
  type TPlusCategory,
  type TReportReason,
} from '../../common/plusGallery';
import {
  isScenePackEnvelope,
  type IScenePack,
  type IScenePackEnvelope,
} from '../../common/scenePacks';
import { MAX_MEMBER_SCENE_FILE_BYTES } from '../../common/memberSceneFile';
import { readWebpSize } from '../../common/sceneArtwork';

/**
 * The gallery's server, spoken to with the member's own token, so every rule
 * about who may see what is the database's: `gallery_scenes` answers nothing
 * to an account that is not paying, and the bucket's policy serves a scene's
 * files only while it is published, unblocked and its author is not banned.
 *
 * Nothing here trusts what comes back. Rows go through the parsers in
 * `common/plusGallery`, a picture must be a small WebP by its own header, and
 * a scene file is only returned as an envelope — the caller verifies it
 * against the member key before a byte of it is used.
 */

/**
 * Largest picture accepted; the publishing function refuses bigger. A
 * 1280 by 720 WebP of a busy scene at a quality that shows it off lands
 * between 100 and 400KB.
 */
export const MAX_PICTURE_BYTES = 512 * 1024;

export const SCENE_BUCKET = 'member-scenes';

export type TGalleryFailure = 'offline' | 'signed-out' | 'server';

export type TPublishFailure =
  | 'offline'
  | 'signed-out'
  | 'not-entitled'
  | 'banned'
  | 'terms'
  | 'rate-limited'
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

export interface IAuthorised {
  config: IAccountConfig;
  accessToken: string;
  fetchImpl?: typeof fetch;
}

export const headers = ({ config, accessToken }: IAuthorised) => ({
  apikey: config.supabaseAnonKey,
  Authorization: `Bearer ${accessToken}`,
  'Content-Type': 'application/json',
  Accept: 'application/json',
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const rpc = async (
  auth: IAuthorised,
  name: string,
  body: Record<string, unknown>,
): Promise<Response> =>
  (auth.fetchImpl ?? fetch)(
    new URL(`/rest/v1/rpc/${name}`, auth.config.supabaseUrl).toString(),
    { method: 'POST', headers: headers(auth), body: JSON.stringify(body) },
  );

const failureOf = (status: number): TGalleryFailure =>
  status === 401 ? 'signed-out' : 'server';

type TListOutcome =
  | { ok: true; scenes: IGalleryScene[]; more: boolean }
  | { ok: false; reason: TGalleryFailure };

/** One ask, and whether a failure was the connection rather than the server. */
const listOnce = async (
  auth: IAuthorised,
  query: IGalleryQuery,
): Promise<
  TListOutcome | { ok: false; reason: TGalleryFailure; dropped: true }
> => {
  let response: Response;
  try {
    response = await rpc(auth, 'gallery_scenes', {
      p_category: query.category ?? null,
      p_author: query.authorId ?? null,
      p_query: query.query ?? null,
      p_sort: query.sort,
      p_limit: GALLERY_PAGE_SIZE,
      p_offset: Math.max(0, Math.floor(query.offset ?? 0)),
    });
  } catch {
    return { ok: false, reason: 'offline', dropped: true };
  }
  if (!response.ok) {
    return { ok: false, reason: failureOf(response.status) };
  }
  let rows: unknown;
  try {
    rows = await response.json();
  } catch {
    // The body stopped arriving, or was not JSON; the first is by far the
    // likelier from PostgREST, and is the connection's doing.
    return { ok: false, reason: 'server', dropped: true };
  }
  if (!Array.isArray(rows)) {
    return { ok: false, reason: 'server' };
  }
  return {
    ok: true,
    scenes: rows.flatMap((row) => {
      const scene = parseGalleryRow(row);
      return scene ? [scene] : [];
    }),
    // Counted before parsing: a full page with a row dropped still has
    // another page behind it.
    more: rows.length >= GALLERY_PAGE_SIZE,
  };
};

/**
 * One page of the gallery.
 *
 * ASKED A SECOND TIME, AT ONCE, ONLY WHEN THE CONNECTION DROPPED. A connection
 * kept open from an earlier request is the one that fails after the computer
 * slept or sat idle — reset by the network or the server's proxy — and a new
 * one on the second ask goes through; that was a gallery saying "could not
 * load" to somebody whose next click worked. A server that answered is not
 * asked again: a 500 from this query is it running out of time, and asking
 * the same thing again straight away is more of what made it run out.
 */
export const listGallery = async (
  auth: IAuthorised,
  query: IGalleryQuery,
): Promise<TListOutcome> => {
  const first = await listOnce(auth, query);
  const outcome =
    !first.ok && 'dropped' in first ? await listOnce(auth, query) : first;
  return outcome.ok ? outcome : { ok: false, reason: outcome.reason };
};

export const listPublished = async (
  auth: IAuthorised,
): Promise<
  | { ok: true; scenes: IPublishedScene[] }
  | { ok: false; reason: TGalleryFailure }
> => {
  let response: Response;
  try {
    response = await rpc(auth, 'my_published_scenes', {});
  } catch {
    return { ok: false, reason: 'offline' };
  }
  if (!response.ok) {
    return { ok: false, reason: failureOf(response.status) };
  }
  try {
    const rows: unknown = await response.json();
    return Array.isArray(rows)
      ? {
          ok: true,
          scenes: rows.flatMap((row) => {
            const scene = parsePublishedRow(row);
            return scene ? [scene] : [];
          }),
        }
      : { ok: false, reason: 'server' };
  } catch {
    return { ok: false, reason: 'server' };
  }
};

/**
 * The highest version each of this maker's scenes was ever out at, the
 * unpublished ones included (server migration 0039), so publishing goes out
 * above what members may still hold. A server before 0039 has no such
 * question to answer, which reads as no floors: the live list is then all
 * there is, as it always was.
 */
export const listVersionFloors = async (
  auth: IAuthorised,
): Promise<
  { ok: true; floors: IVersionFloor[] } | { ok: false; reason: TGalleryFailure }
> => {
  let response: Response;
  try {
    response = await rpc(auth, 'my_scene_version_floors', {});
  } catch {
    return { ok: false, reason: 'offline' };
  }
  if (response.status === 404) {
    return { ok: true, floors: [] };
  }
  if (!response.ok) {
    return { ok: false, reason: failureOf(response.status) };
  }
  try {
    const rows: unknown = await response.json();
    return Array.isArray(rows)
      ? {
          ok: true,
          floors: rows.flatMap((row) => {
            const floor = parseVersionFloorRow(row);
            return floor ? [floor] : [];
          }),
        }
      : { ok: false, reason: 'server' };
  } catch {
    return { ok: false, reason: 'server' };
  }
};

/**
 * A scene's versions before the one showing, newest first, with what its maker
 * wrote about each (fluideq-premium 0026). A server before 0026 has no such
 * question to answer, which reads as a scene with no earlier versions.
 */
export const listVersions = async (
  auth: IAuthorised,
  authorId: string,
  sceneId: string,
): Promise<
  | { ok: true; versions: IGalleryVersion[] }
  | { ok: false; reason: TGalleryFailure }
> => {
  let response: Response;
  try {
    response = await rpc(auth, 'scene_version_history', {
      p_author: authorId,
      p_scene: sceneId,
    });
  } catch {
    return { ok: false, reason: 'offline' };
  }
  if (response.status === 404) {
    return { ok: true, versions: [] };
  }
  if (!response.ok) {
    return { ok: false, reason: failureOf(response.status) };
  }
  try {
    const rows: unknown = await response.json();
    return Array.isArray(rows)
      ? {
          ok: true,
          versions: rows.flatMap((row) => {
            const version = parseVersionRow(row);
            return version ? [version] : [];
          }),
        }
      : { ok: false, reason: 'server' };
  } catch {
    return { ok: false, reason: 'server' };
  }
};

export const objectUrl = (config: IAccountConfig, path: string) =>
  new URL(
    `/storage/v1/object/authenticated/${SCENE_BUCKET}/${path}`,
    config.supabaseUrl,
  ).toString();

/** The two files of a published scene, by the paths the server writes. */
export const publishedPath = (
  authorId: string,
  sceneId: string,
  file: 'scene.json' | 'picture.webp',
) => `${authorId}/${sceneId}/${file}`;

export const download = async (
  auth: IAuthorised,
  path: string,
  maxBytes: number,
): Promise<Uint8Array | undefined> => {
  try {
    const response = await (auth.fetchImpl ?? fetch)(
      objectUrl(auth.config, path),
      { headers: headers(auth), cache: 'no-store' },
    );
    if (!response.ok) {
      return undefined;
    }
    const declared = Number(response.headers.get('content-length') ?? '0');
    if (declared > maxBytes) {
      return undefined;
    }
    // Read whole rather than streamed: see CLAUDE.md on `pipeline`.
    const bytes = new Uint8Array(await response.arrayBuffer());
    return bytes.length <= maxBytes ? bytes : undefined;
  } catch {
    return undefined;
  }
};

/** The largest picture a card decodes; the app publishes 1280 by 720. */
const MAX_PICTURE_WIDTH = 1920;
const MAX_PICTURE_HEIGHT = 1080;

/**
 * A still WebP no bigger than a card's picture, by its own header, whatever
 * it claims to be. The byte limit alone let half a megabyte declare 16383
 * pixels a side, a gigabyte in the window of everyone who scrolled past it.
 */
export const isCardPicture = (bytes: Uint8Array) => {
  const size = readWebpSize((at) => bytes[at], bytes.length);
  return (
    size !== null &&
    size.width <= MAX_PICTURE_WIDTH &&
    size.height <= MAX_PICTURE_HEIGHT
  );
};

/** The picture a scene was published with, as bytes that are a WebP. */
export const fetchPicture = async (
  auth: IAuthorised,
  authorId: string,
  sceneId: string,
): Promise<Uint8Array | undefined> => {
  const bytes = await download(
    auth,
    publishedPath(authorId, sceneId, 'picture.webp'),
    MAX_PICTURE_BYTES,
  );
  return bytes && isCardPicture(bytes) ? bytes : undefined;
};

/** The published scene file, unverified: the caller checks the signature. */
export const fetchEnvelope = async (
  auth: IAuthorised,
  authorId: string,
  sceneId: string,
): Promise<IScenePackEnvelope | undefined> => {
  const bytes = await download(
    auth,
    publishedPath(authorId, sceneId, 'scene.json'),
    MAX_MEMBER_SCENE_FILE_BYTES,
  );
  if (!bytes) {
    return undefined;
  }
  try {
    const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes));
    return isScenePackEnvelope(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
};

/** Counted once per member per scene; the member's own does not count. */
export const recordAdd = async (
  auth: IAuthorised,
  authorId: string,
  sceneId: string,
): Promise<boolean> => {
  try {
    const response = await rpc(auth, 'record_scene_add', {
      p_author: authorId,
      p_scene: sceneId,
    });
    return response.ok;
  } catch {
    return false;
  }
};

export const reportScene = async (
  auth: IAuthorised,
  authorId: string,
  sceneId: string,
  reason: TReportReason,
): Promise<boolean> => {
  try {
    const response = await rpc(auth, 'report_scene', {
      p_author: authorId,
      p_scene: sceneId,
      p_reason: reason,
    });
    return response.ok;
  } catch {
    return false;
  }
};

const errorWord = async (response: Response): Promise<string> => {
  try {
    const body: unknown = await response.json();
    return isRecord(body) && typeof body.error === 'string' ? body.error : '';
  } catch {
    return '';
  }
};

const publishFailure = async (response: Response): Promise<TPublishFailure> => {
  if (response.status === 401) {
    return 'signed-out';
  }
  const word = await errorWord(response);
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
    return 'rate-limited';
  }
  if (response.status === 422 && word === 'official_copy') {
    return 'official-copy';
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
