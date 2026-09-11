import type { IAccountConfig } from '../../common/accountConfig';

/**
 * The two things about members' scenes that live on the server rather than
 * in the file: which scenes the maker has blocked, and likes.
 *
 * Both through PostgREST with the member's own token, so row-level security
 * decides what each account may read — the block list only for paying
 * accounts, a like only through `like_scene`, which refuses one's own scene,
 * a blocked one, and anything never exported.
 */

export interface ILikeStatus {
  likes: number;
  liked: boolean;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const headers = (config: IAccountConfig, accessToken: string) => ({
  apikey: config.supabaseAnonKey,
  Authorization: `Bearer ${accessToken}`,
  'Content-Type': 'application/json',
  Accept: 'application/json',
});

/** The block list's fingerprints, or undefined when it could not be asked. */
export const fetchBlockedScenes = async ({
  config,
  accessToken,
  fetchImpl = fetch,
}: {
  config: IAccountConfig;
  accessToken: string;
  fetchImpl?: typeof fetch;
}): Promise<string[] | undefined> => {
  const url = new URL('/rest/v1/blocked_scenes', config.supabaseUrl);
  url.searchParams.set('select', 'fingerprint');
  try {
    const response = await fetchImpl(url.toString(), {
      headers: headers(config, accessToken),
    });
    if (!response.ok) {
      return undefined;
    }
    const rows: unknown = await response.json();
    if (!Array.isArray(rows)) {
      return undefined;
    }
    return rows
      .map((row) => (isRecord(row) ? row.fingerprint : undefined))
      .filter(
        (print): print is string =>
          typeof print === 'string' && /^[0-9a-f]{64}$/.test(print),
      );
  } catch {
    return undefined;
  }
};

const rpc = (
  config: IAccountConfig,
  accessToken: string,
  name: string,
  body: Record<string, unknown>,
  fetchImpl: typeof fetch,
) =>
  fetchImpl(new URL(`/rest/v1/rpc/${name}`, config.supabaseUrl).toString(), {
    method: 'POST',
    headers: headers(config, accessToken),
    body: JSON.stringify(body),
  });

export const fetchLikeStatus = async ({
  config,
  accessToken,
  authorId,
  sceneId,
  fetchImpl = fetch,
}: {
  config: IAccountConfig;
  accessToken: string;
  authorId: string;
  sceneId: string;
  fetchImpl?: typeof fetch;
}): Promise<ILikeStatus | undefined> => {
  try {
    const response = await rpc(
      config,
      accessToken,
      'scene_like_status',
      { p_author: authorId, p_scene: sceneId },
      fetchImpl,
    );
    if (!response.ok) {
      return undefined;
    }
    const rows: unknown = await response.json();
    const first = Array.isArray(rows) ? rows[0] : rows;
    if (!isRecord(first) || typeof first.liked !== 'boolean') {
      return undefined;
    }
    // The count is a `bigint`, which PostgREST hands back as a string — the
    // leaderboard reads its counts the same way.
    const likes =
      typeof first.likes === 'string' ? Number(first.likes) : first.likes;
    if (typeof likes !== 'number' || !Number.isInteger(likes) || likes < 0) {
      return undefined;
    }
    return { likes, liked: first.liked };
  } catch {
    return undefined;
  }
};

/** Likes or takes a like back; true when the server accepted it. */
export const setLike = async ({
  config,
  accessToken,
  authorId,
  sceneId,
  liked,
  fetchImpl = fetch,
}: {
  config: IAccountConfig;
  accessToken: string;
  authorId: string;
  sceneId: string;
  liked: boolean;
  fetchImpl?: typeof fetch;
}): Promise<boolean> => {
  try {
    const response = await rpc(
      config,
      accessToken,
      liked ? 'like_scene' : 'unlike_scene',
      { p_author: authorId, p_scene: sceneId },
      fetchImpl,
    );
    return response.ok;
  } catch {
    return false;
  }
};
