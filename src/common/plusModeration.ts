import {
  parseGalleryRow,
  readCount,
  readDate,
  type IGalleryScene,
  type TReportReason,
} from './plusGallery';

/**
 * The admin's side of the gallery: the scenes members reported, and the three
 * answers to one — take it down, dismiss its reports, restore it.
 *
 * Every rule is the server's (`admin_reported_scenes` and the functions beside
 * it in migration 0017): who the admin is, what counts as an open report, and
 * that nobody, the admin included, is told who reported. The app only asks,
 * shows, and reads what comes back through the parser below.
 */

export const MODERATION_LISTS = ['open', 'taken-down'] as const;

export type TModerationList = (typeof MODERATION_LISTS)[number];

export const isModerationList = (value: unknown): value is TModerationList =>
  typeof value === 'string' &&
  (MODERATION_LISTS as readonly string[]).includes(value);

export const MODERATION_ACTIONS = ['take-down', 'dismiss', 'restore'] as const;

export type TModerationAction = (typeof MODERATION_ACTIONS)[number];

export const isModerationAction = (
  value: unknown,
): value is TModerationAction =>
  typeof value === 'string' &&
  (MODERATION_ACTIONS as readonly string[]).includes(value);

export interface IModerationStatus {
  admin: boolean;
  /** Scenes waiting with at least one open report; always 0 for a member. */
  open: number;
}

export interface IReportedScene {
  /** The scene as the gallery lists it, so its page can be opened. */
  scene: IGalleryScene;
  authorBanned: boolean;
  /** When it was taken down; absent while it is up. */
  takenDownAt?: string;
  /** Open reports on the open list; every report it had once taken down. */
  reports: number;
  reasons: Record<TReportReason, number>;
  firstReportedAt?: string;
  lastReportedAt?: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const parseModerationStatus = (value: unknown): IModerationStatus => {
  if (!isRecord(value) || value.admin !== true) {
    return { admin: false, open: 0 };
  }
  return { admin: true, open: readCount(value.open) ?? 0 };
};

/** One row of `admin_reported_scenes`, or nothing when any part is not right. */
export const parseReportedRow = (
  value: unknown,
): IReportedScene | undefined => {
  const scene = parseGalleryRow(value);
  if (!scene || scene.official || !isRecord(value)) {
    return undefined;
  }
  const reports = readCount(value.reports);
  const rights = readCount(value.rights);
  const flashing = readCount(value.flashing);
  const offensive = readCount(value.offensive);
  const broken = readCount(value.broken);
  if (
    reports === undefined ||
    rights === undefined ||
    flashing === undefined ||
    offensive === undefined ||
    broken === undefined
  ) {
    return undefined;
  }
  const reasons: Record<TReportReason, number> = {
    rights,
    flashing,
    offensive,
    broken,
  };
  const takenDownAt = readDate(value.taken_down_at);
  const firstReportedAt = readDate(value.first_reported_at);
  const lastReportedAt = readDate(value.last_reported_at);
  return {
    scene,
    authorBanned: value.author_banned === true,
    reports,
    reasons,
    ...(takenDownAt ? { takenDownAt } : {}),
    ...(firstReportedAt ? { firstReportedAt } : {}),
    ...(lastReportedAt ? { lastReportedAt } : {}),
  };
};
