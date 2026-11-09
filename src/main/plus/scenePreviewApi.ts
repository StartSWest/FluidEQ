import { createHash } from 'crypto';
import type { IScenePack } from '../../common/scenePacks';
import {
  canonicalPreviewPayload,
  MAX_PREVIEW_BYTES,
  readScenePreviewMedia,
  type IScenePreviewUpload,
} from '../../common/scenePreviewMedia';
import storedScenePack from '../../common/sceneStoredPack';
import { headers, type IAuthorised } from './galleryApi';
import type { TPublishFailure } from './galleryPublishApi';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SHA = /^[0-9a-f]{64}$/;
/** Over the scene as it is sent and the server rebuilds it (`storedScenePack`). */
export const previewPackSha256 = (pack: IScenePack): string =>
  createHash('sha256')
    .update(canonicalPreviewPayload(storedScenePack(pack)))
    .digest('hex');

export const readPreviewUpload = (
  value: unknown,
): IScenePreviewUpload | undefined => {
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  const item = value as Record<string, unknown>;
  const bytes = item.bytes instanceof Uint8Array ? item.bytes : undefined;
  if (
    !bytes ||
    !bytes.length ||
    bytes.length > MAX_PREVIEW_BYTES ||
    typeof item.operationId !== 'string' ||
    !UUID.test(item.operationId) ||
    typeof item.sceneId !== 'string' ||
    typeof item.packSha256 !== 'string' ||
    !SHA.test(item.packSha256) ||
    typeof item.sourceVersion !== 'number' ||
    !Number.isSafeInteger(item.sourceVersion) ||
    item.sourceVersion < 1 ||
    typeof item.version !== 'number' ||
    !Number.isSafeInteger(item.version) ||
    // Not held to the project's own number: a publication goes out one above
    // the gallery's (b2d35067b), which is below a project the AI pushed ahead
    // (v23 on the bench, v11 out). That the clip is this pack's, at the version
    // published, is `previewMatchesSource`'s check; that it goes up, the
    // server's.
    item.version < 1
  ) {
    return undefined;
  }
  return {
    bytes,
    operationId: item.operationId,
    sceneId: item.sceneId,
    sourceVersion: item.sourceVersion,
    version: item.version,
    packSha256: item.packSha256,
  };
};

export const previewMatchesSource = (
  preview: IScenePreviewUpload,
  pack: IScenePack,
  version: number,
) =>
  preview.sceneId === pack.id &&
  preview.sourceVersion === pack.version &&
  preview.version === version &&
  preview.packSha256 === previewPackSha256({ ...pack, version });

const typeOf = (bytes: Uint8Array) =>
  bytes[0] === 0x1a ? 'video/webm' : 'video/mp4';

/** Binary upload has its own bounded endpoint. The existing publish JSON
 * carries only its opaque receipt, never base64 video or larger body limits. */
export const uploadScenePreview = async (
  auth: IAuthorised,
  preview: IScenePreviewUpload,
  uploadId: string,
): Promise<
  { ok: true; uploadId: string } | { ok: false; reason: TPublishFailure }
> => {
  let mimeType: string;
  try {
    mimeType = readScenePreviewMedia(
      preview.bytes,
      typeOf(preview.bytes),
    ).mimeType;
  } catch {
    return { ok: false, reason: 'preview-invalid' };
  }
  const url = new URL(`${auth.config.apiUrl}/scene-preview-media`);
  url.searchParams.set('sceneId', preview.sceneId);
  url.searchParams.set('version', String(preview.version));
  url.searchParams.set('packSha256', preview.packSha256);
  url.searchParams.set('uploadId', uploadId);
  let response: Response;
  try {
    response = await (auth.fetchImpl ?? fetch)(url, {
      method: 'POST',
      headers: { ...headers(auth), 'Content-Type': mimeType },
      body: new Uint8Array(preview.bytes),
    });
  } catch {
    return { ok: false, reason: 'offline' };
  }
  if (!response.ok) {
    const failures: Record<number, TPublishFailure> = {
      401: 'signed-out',
      403: 'forbidden',
      429: 'rate-limited',
    };
    const reason = failures[response.status] ?? 'preview-upload';
    return { ok: false, reason };
  }
  try {
    const reply: unknown = await response.json();
    if (
      reply &&
      typeof reply === 'object' &&
      'uploadId' in reply &&
      reply.uploadId === uploadId &&
      'mediaSha256' in reply &&
      reply.mediaSha256 ===
        createHash('sha256').update(preview.bytes).digest('hex')
    ) {
      return { ok: true, uploadId: reply.uploadId };
    }
  } catch {
    return { ok: false, reason: 'preview-upload' };
  }
  return { ok: false, reason: 'preview-upload' };
};

/** The server checks current references under the receipt's lock. This is
 * safe even after an ambiguous publish response: bound media is never swept. */
export const discardScenePreview = async (
  auth: IAuthorised,
  uploadId: string,
): Promise<void> => {
  const url = new URL(`${auth.config.apiUrl}/scene-preview-media`);
  url.searchParams.set('uploadId', uploadId);
  try {
    const response = await (auth.fetchImpl ?? fetch)(url, {
      method: 'DELETE',
      headers: headers(auth),
    });
    if (!response.ok) {
      throw new Error(`Preview cleanup answered ${response.status}`);
    }
  } catch (error) {
    console.error('Releasing an unused scene preview', error);
  }
};
