import {
  MAX_PREVIEW_BYTES,
  readScenePreviewMedia,
} from '../../common/scenePreviewMedia';
import { download, rpc, type IAuthorised } from './galleryApi';

/**
 * A published scene's ten-second clip, recorded in the Studio when it was
 * published: what a member who does not own a scene watches on its page, in
 * place of the scene itself — whose code goes to its owners alone.
 */
export interface IGalleryClip {
  bytes: Uint8Array;
  mimeType: 'video/webm' | 'video/mp4';
}

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

/** The format by its own first bytes: WebM opens with EBML's 0x1A45DFA3. */
const mimeOf = (bytes: Uint8Array): IGalleryClip['mimeType'] =>
  bytes[0] === 0x1a ? 'video/webm' : 'video/mp4';

/**
 * Bytes are a clip only when the bounded reader says so — one video track,
 * ten seconds, within the box — whatever a disk or a server says they are.
 */
export const asGalleryClip = (bytes: Uint8Array): IGalleryClip | undefined => {
  try {
    return {
      bytes,
      mimeType: readScenePreviewMedia(bytes, mimeOf(bytes)).mimeType,
    };
  } catch {
    return undefined;
  }
};

/**
 * The clip bound to a scene's published version, or nothing: a scene
 * published before clips existed, a viewer the bucket refuses, or no network.
 * The server names the file; it is fetched only when the name is exactly a
 * clip of this scene (`<author>/<scene>/preview/<uuid>.webm|mp4`).
 */
export const fetchGalleryClip = async (
  auth: IAuthorised,
  authorId: string,
  sceneId: string,
): Promise<IGalleryClip | undefined> => {
  let media: unknown;
  try {
    const response = await rpc(auth, 'scene_preview_media', {
      p_author: authorId,
      p_scene: sceneId,
    });
    if (!response.ok) {
      return undefined;
    }
    media = await response.json();
  } catch {
    return undefined;
  }
  const path =
    typeof media === 'object' && media !== null && 'path' in media
      ? media.path
      : undefined;
  const expected = new RegExp(
    `^${authorId}/${sceneId}/preview/${UUID}\\.(webm|mp4)$`,
  );
  if (typeof path !== 'string' || !expected.test(path)) {
    return undefined;
  }
  // The name carries the upload's own id, so its bytes never change: no
  // version is needed to get past the CDN (`download`).
  const bytes = await download(auth, path, MAX_PREVIEW_BYTES);
  return bytes ? asGalleryClip(bytes) : undefined;
};
