import {
  isScenePackEnvelope,
  parseScenePackPayload,
} from '../../common/scenePacks';
import { SCENE_CONTRACT_VERSION } from '../../common/sceneUniformContract';
import { verifyScenePackEnvelope } from '../scenePackVerify';
import type { IGalleryAuth } from './galleryAccess';

/** Same bounded envelope as the official pack download, including artwork. */
const MAX_ENVELOPE_BYTES = 12 * 1024 * 1024;

/** Official previews keep their original signature; member signatures never qualify. */
export const fetchOfficialScene = async (
  auth: IGalleryAuth,
  sceneId: string,
) => {
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
    return pack &&
      pack.id === sceneId &&
      pack.contract <= SCENE_CONTRACT_VERSION
      ? { pack, envelope }
      : undefined;
  } catch {
    return undefined;
  }
};
