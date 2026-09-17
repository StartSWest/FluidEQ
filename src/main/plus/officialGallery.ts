import {
  isScenePackEnvelope,
  parseScenePackPayload,
  type IScenePack,
  type IScenePackEnvelope,
} from '../../common/scenePacks';
import { verifyScenePackEnvelope } from '../scenePackVerify';
import type { IGalleryAuth } from './galleryAccess';

/** Same bounded envelope as the official pack download, including artwork. */
const MAX_ENVELOPE_BYTES = 12 * 1024 * 1024;

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
export const fetchOfficialScene = async (
  auth: IGalleryAuth,
  sceneId: string,
): Promise<IFetchedOfficialScene | 'plus-required' | undefined> => {
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
    const envelope: unknown = JSON.parse(Buffer.from(bytes).toString('utf8'));
    if (!isScenePackEnvelope(envelope)) {
      return undefined;
    }
    const payload = verifyScenePackEnvelope(envelope);
    const pack = payload ? parseScenePackPayload(payload) : undefined;
    // Taken whatever contract it names: a scene written against a newer
    // FluidEQ that uses nothing new plays here, and one that does need
    // something this build has not got is drawn as its own fallbackStyle.
    return pack && pack.id === sceneId ? { pack, envelope } : undefined;
  } catch {
    return undefined;
  }
};
