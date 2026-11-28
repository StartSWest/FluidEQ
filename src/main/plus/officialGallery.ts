import {
  isScenePackEnvelope,
  MAX_PACK_BYTES,
  parseScenePackPayload,
  type IScenePack,
  type IScenePackEnvelope,
} from '../../common/scenePacks';
import { verifyScenePackEnvelope } from '../scenePackVerify';
import type { IGalleryAuth } from './galleryAccess';
import { fetchSceneMedia } from './sceneMediaApi';

/**
 * Same bounded envelope as the official pack download, including artwork:
 * the pack as base64, four bytes for every three, with its key and
 * signature — 1.4 times the largest pack, the room a member's scene file
 * gets (`MAX_MEMBER_SCENE_FILE_BYTES`). It was a fixed 12 MiB, which held a
 * 9 MiB pack and would have refused a 10 MiB one once packs could be that
 * large (2026-11-28).
 */
export const MAX_ENVELOPE_BYTES = Math.ceil(MAX_PACK_BYTES * 1.4);

export interface IFetchedOfficialScene {
  pack: IScenePack;
  envelope: IScenePackEnvelope;
}

/**
 * Official previews keep their original signature; member signatures never
 * qualify. `'plus-required'` when the server keeps the scene for Plus: only
 * the scenes chosen as free samples taste live without it (server migration
 * 0023), and the page shows the rest's picture and the way to Plus instead.
 */
/** An envelope's bytes, verified and parsed, when they are this scene's. */
const officialSceneOf = (
  bytes: Uint8Array | ArrayBuffer,
  sceneId: string,
): IFetchedOfficialScene | undefined => {
  const envelope: unknown = JSON.parse(
    Buffer.from(
      bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes),
    ).toString('utf8'),
  );
  if (!isScenePackEnvelope(envelope)) {
    return undefined;
  }
  const payload = verifyScenePackEnvelope(envelope);
  const pack = payload ? parseScenePackPayload(payload) : undefined;
  // Taken whatever contract it names: a scene written against a newer
  // FluidEQ that uses nothing new plays here, and one that does need
  // something this build has not got is shown as the scene that could not build here.
  return pack && pack.id === sceneId ? { pack, envelope } : undefined;
};

export const fetchOfficialScene = async (
  auth: IGalleryAuth,
  sceneId: string,
): Promise<IFetchedOfficialScene | 'plus-required' | undefined> => {
  // From R2 first (`sceneMediaApi.ts`), owners only, as the RPC below.
  const fromMedia = await fetchSceneMedia(
    auth,
    { pack: sceneId },
    MAX_ENVELOPE_BYTES,
  );
  if (fromMedia.kind === 'refused') {
    return 'plus-required';
  }
  if (fromMedia.kind === 'paused') {
    return undefined;
  }
  if (fromMedia.kind === 'bytes') {
    try {
      return officialSceneOf(fromMedia.bytes, sceneId);
    } catch {
      return undefined;
    }
  }
  try {
    const response = await (auth.fetchImpl ?? fetch)(
      new URL(
        '/rest/v1/rpc/official_scene_preview',
        auth.config.supabaseUrl,
      ).toString(),
      {
        method: 'POST',
        headers: {
          apikey: auth.config.supabaseAnonKey,
          Authorization: `Bearer ${auth.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ p_scene: sceneId }),
      },
    );
    if (response.status === 403) {
      return 'plus-required';
    }
    if (
      !response.ok ||
      Number(response.headers.get('content-length')) > MAX_ENVELOPE_BYTES
    ) {
      return undefined;
    }
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength > MAX_ENVELOPE_BYTES) {
      return undefined;
    }
    return officialSceneOf(bytes, sceneId);
  } catch {
    return undefined;
  }
};
