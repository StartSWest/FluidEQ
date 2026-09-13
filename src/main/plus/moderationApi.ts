import {
  parseModerationStatus,
  parseReportedRow,
  type IModerationStatus,
  type IReportedScene,
  type TModerationAction,
  type TModerationList,
} from '../../common/plusModeration';
import type { IGalleryAuth } from './galleryAccess';
import { rpc, type TGalleryFailure } from './galleryApi';

/**
 * The admin's queue of reported scenes, spoken to with the account's own
 * token. Whether the account is the admin is the server's to say on every
 * call (`require_admin` in migration 0017); nothing here decides it.
 */

export type TModerationFailure = TGalleryFailure | 'forbidden';

const failureOf = (status: number): TModerationFailure => {
  if (status === 401) {
    return 'signed-out';
  }
  // `admin_required` is raised as insufficient_privilege, which PostgREST
  // answers as 403.
  return status === 403 ? 'forbidden' : 'server';
};

const FUNCTIONS: Record<TModerationAction, string> = {
  'take-down': 'admin_take_down_scene',
  dismiss: 'admin_dismiss_scene_reports',
  restore: 'admin_restore_scene',
};

/** Whether this account is the admin, and how many scenes wait. */
export const moderationStatus = async (
  auth: IGalleryAuth,
): Promise<
  | { ok: true; status: IModerationStatus }
  | { ok: false; reason: TGalleryFailure }
> => {
  let response: Response;
  try {
    response = await rpc(auth, 'moderation_status', {});
  } catch {
    return { ok: false, reason: 'offline' };
  }
  if (!response.ok) {
    return {
      ok: false,
      reason: response.status === 401 ? 'signed-out' : 'server',
    };
  }
  try {
    return { ok: true, status: parseModerationStatus(await response.json()) };
  } catch {
    return { ok: false, reason: 'server' };
  }
};

export const listReportedScenes = async (
  auth: IGalleryAuth,
  list: TModerationList,
): Promise<
  | { ok: true; scenes: IReportedScene[] }
  | { ok: false; reason: TModerationFailure }
> => {
  let response: Response;
  try {
    response = await rpc(auth, 'admin_reported_scenes', { p_list: list });
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
        const scene = parseReportedRow(row);
        return scene ? [scene] : [];
      }),
    };
  } catch {
    return { ok: false, reason: 'server' };
  }
};

export const moderateScene = async (
  auth: IGalleryAuth,
  action: TModerationAction,
  authorId: string,
  sceneId: string,
): Promise<{ ok: true } | { ok: false; reason: TModerationFailure }> => {
  let response: Response;
  try {
    response = await rpc(auth, FUNCTIONS[action], {
      p_author: authorId,
      p_scene: sceneId,
    });
  } catch {
    return { ok: false, reason: 'offline' };
  }
  return response.ok
    ? { ok: true }
    : { ok: false, reason: failureOf(response.status) };
};
