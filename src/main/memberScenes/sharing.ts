import fs from 'fs';
import type { IAccountConfig } from '../../common/accountConfig';
import {
  MAX_MEMBER_SCENE_FILE_BYTES,
  parseMemberScenePayload,
  type IMemberScenePayload,
} from '../../common/memberSceneFile';
import {
  isScenePackEnvelope,
  type IScenePack,
  type IScenePackEnvelope,
} from '../../common/scenePacks';
import { verifyMemberSceneEnvelope } from '../scenePackVerify';

/**
 * Sharing a member's scene: the server signs it on the way out, and the member
 * key verifies it on the way in.
 *
 * Signing is a round trip on purpose. It is the one step a modified app cannot
 * do without a paying account, which is what makes "only Plus members can
 * export" hold outside the official build. Offline, export says so; nothing
 * else in the Studio needs the network.
 */

export type TExportFailure =
  | 'offline'
  | 'signed-out'
  | 'not-entitled'
  | 'banned'
  | 'terms'
  | 'rate-limited'
  | 'refused'
  | 'server';

export type TSignOutcome =
  | { ok: true; envelope: IScenePackEnvelope }
  | { ok: false; reason: TExportFailure };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const errorWord = async (response: Response): Promise<string> => {
  try {
    const body: unknown = await response.json();
    return isRecord(body) && typeof body.error === 'string' ? body.error : '';
  } catch {
    return '';
  }
};

export const signMemberScene = async ({
  config,
  accessToken,
  pack,
  termsVersion,
  fetchImpl = fetch,
}: {
  config: IAccountConfig;
  accessToken: string;
  pack: IScenePack;
  termsVersion: number;
  fetchImpl?: typeof fetch;
}): Promise<TSignOutcome> => {
  let response: Response;
  try {
    response = await fetchImpl(`${config.apiUrl}/sign-member-scene`, {
      method: 'POST',
      headers: {
        apikey: config.supabaseAnonKey,
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ termsVersion, pack }),
    });
  } catch {
    return { ok: false, reason: 'offline' };
  }
  if (response.status === 401) {
    return { ok: false, reason: 'signed-out' };
  }
  if (!response.ok) {
    const word = await errorWord(response);
    if (response.status === 409 && word === 'terms_outdated') {
      return { ok: false, reason: 'terms' };
    }
    if (response.status === 403 && word === 'banned') {
      return { ok: false, reason: 'banned' };
    }
    if (response.status === 403) {
      return { ok: false, reason: 'not-entitled' };
    }
    if (response.status === 429) {
      return { ok: false, reason: 'rate-limited' };
    }
    if (response.status === 422 || response.status === 413) {
      return { ok: false, reason: 'refused' };
    }
    return { ok: false, reason: 'server' };
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { ok: false, reason: 'server' };
  }
  const envelope = isRecord(body) ? body.envelope : undefined;
  // What came back must be a member file the app itself would import — a
  // server answering with something else is not a success.
  if (!isScenePackEnvelope(envelope) || !verifyMemberSceneEnvelope(envelope)) {
    return { ok: false, reason: 'server' };
  }
  return { ok: true, envelope };
};

export type TReadFailure = 'unreadable' | 'changed';

export type TReadOutcome =
  | { ok: true; envelope: IScenePackEnvelope; payload: IMemberScenePayload }
  | { ok: false; reason: TReadFailure };

/**
 * A scene file somebody sent, or why it cannot be opened.
 *
 * "Unreadable" is not a scene file at all — a screenshot picked by mistake.
 * "Changed" is a scene file whose signature does not verify against the
 * member key: edited after export, or never exported through FluidEQ. The
 * difference matters to the sentence the member reads, not to what happens:
 * neither is imported.
 */
export const readMemberSceneFile = async (
  filePath: string,
): Promise<TReadOutcome> => {
  let text: string;
  try {
    const stats = await fs.promises.stat(filePath);
    if (!stats.isFile() || stats.size > MAX_MEMBER_SCENE_FILE_BYTES) {
      return { ok: false, reason: 'unreadable' };
    }
    text = await fs.promises.readFile(filePath, 'utf8');
  } catch {
    return { ok: false, reason: 'unreadable' };
  }
  let envelope: unknown;
  try {
    envelope = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'unreadable' };
  }
  if (!isScenePackEnvelope(envelope)) {
    return { ok: false, reason: 'unreadable' };
  }
  const payload = verifyMemberSceneEnvelope(envelope);
  const parsed = payload ? parseMemberScenePayload(payload) : null;
  if (!parsed) {
    return { ok: false, reason: 'changed' };
  }
  return { ok: true, envelope, payload: parsed };
};
