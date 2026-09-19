/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { memberLookId, parseMemberLookId } from './memberScenes';
import {
  isPlusCategory,
  readAuthorHandle,
  readAuthorName,
  readCount,
  readDate,
  readNames,
  readSecondCategory,
  readSwatch,
  type TPlusCategory,
} from './plusGallery';
import type { TLocalizedName } from './scenePacks';
import { readVersionNote } from './sceneVersionNote';

/**
 * A member's scene waits for the admin before anybody else sees it, and so
 * does every new version of it (server migration 0037). This is what both
 * sides of that are told: the maker, what became of what they sent; the
 * admin, what is waiting.
 *
 * Every rule is the server's. A submission is written only by the publishing
 * function, answered only by the review function, and the database says who
 * may read either list. The app asks, shows, and reads what comes back
 * through the parsers below.
 */

/** Why a scene was not approved: the words the server accepts, and no others. */
export const REJECT_REASONS = [
  'flashing',
  'rights',
  'offensive',
  'broken',
  'other',
] as const;

export type TRejectReason = (typeof REJECT_REASONS)[number];

export const isRejectReason = (value: unknown): value is TRejectReason =>
  typeof value === 'string' &&
  (REJECT_REASONS as readonly string[]).includes(value);

export type TSubmissionState = 'pending' | 'approved' | 'rejected';

const isSubmissionState = (value: unknown): value is TSubmissionState =>
  value === 'pending' || value === 'approved' || value === 'rejected';

/** What a maker sent for review, and what became of it. */
export interface ISceneSubmission {
  sceneId: string;
  version: number;
  category: TPlusCategory;
  category2?: TPlusCategory;
  names: TLocalizedName;
  swatch: string[];
  state: TSubmissionState;
  /** Why it was not approved, while it stands refused. */
  reason?: TRejectReason;
  /** The admin's own line to the maker, if they wrote one. */
  reasonNote?: string;
  submittedAt: string;
  decidedAt?: string;
  /** The version members have in the gallery now; absent for a first. */
  liveVersion?: number;
  /**
   * The first version the scene was ever in the gallery at. An approved
   * version above it was an update, whatever its number; absent for a scene
   * never approved.
   */
  firstVersion?: number;
  /**
   * The hash of what was signed, which names the folder its files wait in
   * (server migration 0038) — where the maker's app finds the picture it
   * sent. Absent from a server before it.
   */
  sha256?: string;
}

/** One scene waiting for the admin. */
export interface IReviewItem {
  authorId: string;
  /** The id it will have in a member's looks once it is approved. */
  lookId: string;
  authorName: string | null;
  authorHandle: string | null;
  sceneId: string;
  version: number;
  category: TPlusCategory;
  category2?: TPlusCategory;
  names: TLocalizedName;
  swatch: string[];
  hasPhoto: boolean;
  /**
   * The SHA-256 of the signed bytes that wait. An answer names it, so what is
   * approved is exactly what was watched — never a file sent meanwhile.
   */
  sha256: string;
  /** What the maker wrote about this version. */
  note?: string;
  submittedAt: string;
  /** The version it would replace; absent for a scene new to the gallery. */
  liveVersion?: number;
  takenDown: boolean;
  authorBanned: boolean;
  /** Open reports against the version members have now. */
  openReports: number;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const SHA256 = /^[0-9a-f]{64}$/;

/** A line of text as a note is kept: one line, nothing invisible, bounded. */
const readNote = (value: unknown): string | undefined =>
  readVersionNote(value) ?? undefined;

/** One row of `my_scene_submissions`, or nothing when any part is not right. */
export const parseSubmissionRow = (
  value: unknown,
): ISceneSubmission | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }
  const sceneId = typeof value.scene_id === 'string' ? value.scene_id : '';
  const names = readNames(value.names);
  const swatch = readSwatch(value.swatch);
  const version = readCount(value.version);
  const submittedAt = readDate(value.submitted_at);
  if (
    !/^[a-z][a-z0-9-]{1,47}$/.test(sceneId) ||
    !names ||
    !swatch ||
    !version ||
    !submittedAt ||
    !isPlusCategory(value.category) ||
    !isSubmissionState(value.state)
  ) {
    return undefined;
  }
  // A refusal always carries its reason; one that does not is not a row this
  // app can say anything true about.
  if (value.state === 'rejected' && !isRejectReason(value.reason)) {
    return undefined;
  }
  const decidedAt = readDate(value.decided_at);
  const liveVersion = readCount(value.live_version);
  const firstVersion = readCount(value.first_version);
  const reasonNote =
    value.state === 'rejected' ? readNote(value.reason_note) : undefined;
  return {
    sceneId,
    version,
    category: value.category,
    ...readSecondCategory(value.category2, value.category),
    names,
    swatch,
    state: value.state,
    ...(value.state === 'rejected' && isRejectReason(value.reason)
      ? { reason: value.reason }
      : {}),
    ...(reasonNote ? { reasonNote } : {}),
    submittedAt,
    ...(decidedAt ? { decidedAt } : {}),
    ...(liveVersion ? { liveVersion } : {}),
    ...(firstVersion ? { firstVersion } : {}),
    ...(typeof value.payload_sha256 === 'string' &&
    SHA256.test(value.payload_sha256)
      ? { sha256: value.payload_sha256 }
      : {}),
  };
};

/** One row of `admin_scene_submissions`, or nothing when any part is not right. */
export const parseReviewRow = (value: unknown): IReviewItem | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }
  const authorId =
    typeof value.author_id === 'string' ? value.author_id.toLowerCase() : '';
  const sceneId = typeof value.scene_id === 'string' ? value.scene_id : '';
  const lookId = memberLookId(authorId, sceneId);
  const names = readNames(value.names);
  const swatch = readSwatch(value.swatch);
  const version = readCount(value.version);
  const submittedAt = readDate(value.submitted_at);
  const openReports = readCount(value.open_reports);
  if (
    !parseMemberLookId(lookId) ||
    !names ||
    !swatch ||
    !version ||
    !submittedAt ||
    openReports === undefined ||
    typeof value.payload_sha256 !== 'string' ||
    !SHA256.test(value.payload_sha256) ||
    !isPlusCategory(value.category)
  ) {
    return undefined;
  }
  const note = readNote(value.note);
  const liveVersion = readCount(value.live_version);
  return {
    authorId,
    lookId,
    authorName: readAuthorName(value.author_name),
    authorHandle: readAuthorHandle(value.author_handle),
    sceneId,
    version,
    category: value.category,
    ...readSecondCategory(value.category2, value.category),
    names,
    swatch,
    hasPhoto: value.has_photo === true,
    sha256: value.payload_sha256,
    ...(note ? { note } : {}),
    submittedAt,
    ...(liveVersion ? { liveVersion } : {}),
    takenDown: value.taken_down === true,
    authorBanned: value.author_banned === true,
    openReports,
  };
};

/** The admin's answer to one scene waiting for review. */
export type TReviewAnswer =
  | { action: 'approve' }
  | { action: 'reject'; reason: TRejectReason; note?: string };

/** The answer as it arrives over IPC, rebuilt from only the parts that check out. */
export const readReviewAnswer = (value: unknown): TReviewAnswer | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }
  if (value.action === 'approve') {
    return { action: 'approve' };
  }
  if (value.action !== 'reject' || !isRejectReason(value.reason)) {
    return undefined;
  }
  const note = readVersionNote(value.note);
  if (note === undefined) {
    return undefined;
  }
  return { action: 'reject', reason: value.reason, ...(note ? { note } : {}) };
};
