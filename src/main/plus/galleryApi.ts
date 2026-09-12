import type { IAccountConfig } from '../../common/accountConfig';
import {
  GALLERY_PAGE_SIZE,
  parseGalleryRow,
  parsePublishedRow,
  type IGalleryQuery,
  type IGalleryScene,
  type IPublishedScene,
  type TPlusCategory,
  type TReportReason,
} from '../../common/plusGallery';
import {
  isScenePackEnvelope,
  type IScenePack,
  type IScenePackEnvelope,
} from '../../common/scenePacks';
import { MAX_MEMBER_SCENE_FILE_BYTES } from '../../common/memberSceneFile';

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
  | 'server';

interface IAuthorised {
  config: IAccountConfig;
  accessToken: string;
  fetchImpl?: typeof fetch;
}

const headers = ({ config, accessToken }: IAuthorised) => ({
  apikey: config.supabaseAnonKey,
  Authorization: `Bearer ${accessToken}`,
  'Content-Type': 'application/json',
  Accept: 'application/json',
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const rpc = async (
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

export const listGallery = async (
  auth: IAuthorised,
  query: IGalleryQuery,
): Promise<
  | { ok: true; scenes: IGalleryScene[]; more: boolean }
  | { ok: false; reason: TGalleryFailure }
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
      scenes: rows.flatMap((row) => {
        const scene = parseGalleryRow(row);
        return scene ? [scene] : [];
      }),
      // Counted before parsing: a full page with a row dropped still has
      // another page behind it.
      more: rows.length >= GALLERY_PAGE_SIZE,
    };
  } catch {
    return { ok: false, reason: 'server' };
  }
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

const objectUrl = (config: IAccountConfig, path: string) =>
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

const download = async (
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

/** A WebP by its own RIFF header, whatever it claims to be. */
export const isWebp = (bytes: Uint8Array) =>
  bytes.length > 16 &&
  String.fromCharCode(...bytes.subarray(0, 4)) === 'RIFF' &&
  String.fromCharCode(...bytes.subarray(8, 12)) === 'WEBP';

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
  return bytes && isWebp(bytes) ? bytes : undefined;
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
  if (response.status === 403) {
    return word === 'banned' ? 'banned' : 'not-entitled';
  }
  if (response.status === 429) {
    return 'rate-limited';
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
    pack,
    picture,
  }: {
    termsVersion: number;
    category: TPlusCategory;
    pack: IScenePack;
    /** The WebP, base64. */
    picture: string;
  },
): Promise<{ ok: true } | { ok: false; reason: TPublishFailure }> => {
  const response = await callPublish(auth, {
    action: 'publish',
    termsVersion,
    category,
    pack,
    picture,
  });
  if (!response) {
    return { ok: false, reason: 'offline' };
  }
  return response.ok
    ? { ok: true }
    : { ok: false, reason: await publishFailure(response) };
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
