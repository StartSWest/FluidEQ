import { checkMemberScene, sanitizeDisplayText } from './memberScenes';
import { MAX_PACK_BYTES, type IScenePack } from './scenePacks';

/**
 * A member's scene as it travels between members: a signed envelope, the
 * same shape the Plus looks arrive in, around a payload the server wrote.
 *
 * The payload carries the pack — checked by the server, comments stripped —
 * and who made it and when. The author's id and name come from the server's
 * own records, never from the file's sender, so the name under a scene in
 * somebody's picker is the name on the author's profile.
 *
 * Parsed only after the envelope's signature verified against the MEMBER key,
 * and the pack is held to every member rule again here: a signature says the
 * server checked it, not that nothing could be wrong with it.
 */

export const MEMBER_SCENE_FILE_EXTENSION = '.fluideq-scene.json';

/** The envelope, the base64 payload inside it, and some room for the JSON. */
export const MAX_MEMBER_SCENE_FILE_BYTES = Math.ceil(MAX_PACK_BYTES * 1.4);

const AUTHOR_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_AUTHOR_NAME = 60;

export interface IMemberSceneAuthor {
  id: string;
  /** Their profile's display name, or null for a member with no profile. */
  name: string | null;
}

export interface IMemberScenePayload {
  author: IMemberSceneAuthor;
  exportedAt: string;
  pack: IScenePack;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Never throws: the bytes were signed, which is not the same as vetted. */
export const parseMemberScenePayload = (
  json: string,
): IMemberScenePayload | null => {
  if (json.length > MAX_MEMBER_SCENE_FILE_BYTES) {
    return null;
  }
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return null;
  }
  if (!isRecord(raw) || raw.schema !== 1 || raw.kind !== 'member-scene') {
    return null;
  }
  const { author } = raw;
  if (
    !isRecord(author) ||
    typeof author.id !== 'string' ||
    !AUTHOR_ID.test(author.id)
  ) {
    return null;
  }
  const name =
    author.name === null ? null : (sanitizeDisplayText(author.name) ?? null);
  if (
    typeof raw.exportedAt !== 'string' ||
    Number.isNaN(Date.parse(raw.exportedAt))
  ) {
    return null;
  }
  const checked = checkMemberScene(raw.pack);
  if (!checked.ok) {
    return null;
  }
  return {
    author: {
      id: author.id.toLowerCase(),
      name: name ? name.slice(0, MAX_AUTHOR_NAME) : null,
    },
    exportedAt: raw.exportedAt,
    pack: checked.pack,
  };
};

/** A filename that survives being saved on any of the three platforms. */
export const memberSceneFileName = (pack: IScenePack): string =>
  `${pack.id}${MEMBER_SCENE_FILE_EXTENSION}`;
