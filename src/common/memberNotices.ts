/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { readNames } from './plusGallery';
import type { TLocalizedName } from './scenePackFields';

/**
 * What the server has to tell an account about its scenes (premium 0105),
 * read once on whichever computer opens first and then never again. A buyer
 * is told only that a scene is no longer available and its credit is back —
 * never why, never by whom, never before the day it happens (Ivan,
 * 2026-11-12). A maker is told of a takedown with the block that came with
 * it, of a restore, and of a refunded purchase of one of their scenes.
 */
export type TMemberNoticeKind =
  | 'scene-returned'
  | 'scene-taken-down'
  | 'scene-restored'
  | 'purchase-refunded';

const KINDS: ReadonlySet<string> = new Set<TMemberNoticeKind>([
  'scene-returned',
  'scene-taken-down',
  'scene-restored',
  'purchase-refunded',
]);

/** The lengths an admin may block for; the server holds the same list. */
export const PUBLISHING_BLOCK_DAYS = [15, 30, 60, 90] as const;

export type TBlockScope = 'scene' | 'account';

export interface IPublishingBlockChoice {
  days: (typeof PUBLISHING_BLOCK_DAYS)[number];
  scope: TBlockScope;
}

const isBlockDays = (value: unknown): value is IPublishingBlockChoice['days'] =>
  PUBLISHING_BLOCK_DAYS.some((days) => days === value);

export interface IMemberNotice {
  id: number;
  kind: TMemberNoticeKind;
  /** The scene's names, for a maker's notice; a buyer's names none. */
  names?: TLocalizedName;
  /** The block a takedown came with, when the admin chose one. */
  block?: IPublishingBlockChoice;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** A block as the server sends it, or nothing when it is not one of the choices. */
export const readBlockChoice = (
  days: unknown,
  scope: unknown,
): IPublishingBlockChoice | undefined =>
  isBlockDays(days) && (scope === 'scene' || scope === 'account')
    ? { days, scope }
    : undefined;

const readNotice = (row: unknown): IMemberNotice | undefined => {
  if (
    !isRecord(row) ||
    typeof row.id !== 'number' ||
    !Number.isSafeInteger(row.id) ||
    row.id <= 0 ||
    typeof row.kind !== 'string' ||
    !KINDS.has(row.kind)
  ) {
    return undefined;
  }
  const kind = row.kind as TMemberNoticeKind;
  if (kind === 'scene-returned') {
    return { id: row.id, kind };
  }
  // A maker's notice names its scene; one whose names do not read is not
  // shown rather than shown with a blank where the name goes.
  const names = readNames(row.names);
  if (!names) {
    return undefined;
  }
  const block =
    kind === 'scene-taken-down'
      ? readBlockChoice(row.blockDays, row.blockScope)
      : undefined;
  return { id: row.id, kind, names, ...(block ? { block } : {}) };
};

/**
 * The server's `notices`. Each one is read on its own: a kind this app does
 * not know (from a newer server) or one that does not read is left out, and
 * the rest of the store still reads — a notice is something to say, never
 * something the store's money or scenes depend on.
 */
export const parseMemberNotices = (value: unknown): IMemberNotice[] =>
  Array.isArray(value)
    ? value.flatMap((row: unknown): IMemberNotice[] => {
        const notice = readNotice(row);
        return notice ? [notice] : [];
      })
    : [];

/** As this app wrote them: checked whole, as the rest of a stored store is. */
export const isMemberNoticeList = (value: unknown): value is IMemberNotice[] =>
  Array.isArray(value) &&
  value.every(
    (notice: unknown) =>
      isRecord(notice) &&
      readNotice({
        id: notice.id,
        kind: notice.kind,
        names: notice.names,
        blockDays: isRecord(notice.block) ? notice.block.days : undefined,
        blockScope: isRecord(notice.block) ? notice.block.scope : undefined,
      }) !== undefined,
  );
