/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */
import type { IAppNews } from '../../common/appNews';
import { isRecord } from '../../common/sceneAnnouncements';

export type TNewsReadState = Record<string, { startsAt: number; id: number }>;

export const readNewsReadState = (raw: unknown): TNewsReadState => {
  if (!isRecord(raw)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(raw).flatMap(([key, point]) => {
      if (
        !isRecord(point) ||
        typeof point.startsAt !== 'number' ||
        !Number.isFinite(point.startsAt) ||
        typeof point.id !== 'number' ||
        !Number.isSafeInteger(point.id) ||
        point.id <= 0
      ) {
        return [];
      }
      return [[key, { startsAt: point.startsAt, id: point.id }]];
    }),
  );
};

export const newsWasRead = (
  seen: TNewsReadState,
  key: string,
  item: IAppNews,
) => {
  const point = seen[key];
  return (
    point !== undefined &&
    (item.startsAt < point.startsAt ||
      (item.startsAt === point.startsAt && item.id <= point.id))
  );
};

/** A cutoff also covers backlog beyond the feed's page, without an ID limit. */
export const rememberNewsRead = (
  seen: TNewsReadState,
  keys: string[],
  item: IAppNews,
): TNewsReadState => {
  const next = { ...seen };
  keys.forEach((key) => {
    if (!newsWasRead(seen, key, item)) {
      next[key] = { startsAt: item.startsAt, id: item.id };
    }
  });
  return next;
};
