/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  isPlusCategory,
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
 * does every new version of it (server migration 0037). This is what the
 * maker is told: what became of what they sent.
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

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const SHA256 = /^[0-9a-f]{64}$/;

/** A line of text as a note is kept: one line, nothing invisible, bounded. */
export const readNote = (value: unknown): string | undefined =>
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
