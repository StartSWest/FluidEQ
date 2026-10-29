/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { sanitizeDisplayText } from './memberScenes';
import { readCount } from './plusGallery';
import { isRecord, timeOf, MAX_ANNOUNCEMENT_TITLE } from './sceneAnnouncements';

export const MAX_NEWS_BODY = 4000;
export const MAX_NEWS_ACTION = 48;
export type TNewsAudience = 'everyone' | 'accounts';

/** A notice introduces the authored story without reading its whole body aloud. */
export const newsPreviewText = (body: string): string => {
  const text = body.replace(/\s+/g, ' ').trim();
  if (text.length <= 180) {
    return text;
  }
  const start = text.slice(0, 180);
  return `${start.replace(/\s+\S*$/, '') || start}…`;
};

/** Keep authored paragraphs while applying the app's display-text rules. */
export const newsBody = (value: unknown): string | undefined => {
  if (typeof value !== 'string' || value.length > MAX_NEWS_BODY) {
    return undefined;
  }
  const body = value
    .split(/\r?\n/)
    .map((line) => sanitizeDisplayText(line) ?? '')
    .join('\n')
    .trim();
  return body || undefined;
};

/** General news shares the announcement catalog, with no scene dependency. */
export interface IAppNews {
  id: number;
  title: string;
  body: string;
  startsAt: number;
  expiresAt: number;
  audience: TNewsAudience;
  action?: { label: string; url: string };
}

export interface IAppNewsState {
  items: IAppNews[];
  unread: number[];
  offline: boolean;
}

export const EMPTY_NEWS: IAppNewsState = {
  items: [],
  unread: [],
  offline: false,
};

/** An announcement may open a web page, never a local file or app command. */
export const newsActionUrl = (value: unknown): string | undefined => {
  if (typeof value !== 'string' || value.length > 2048) {
    return undefined;
  }
  try {
    const url = new URL(value);
    return url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      url.href.length <= 2048
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
};

/** Strict parsing also protects cached data and admin IPC. */
export const readAppNews = (value: unknown): IAppNews | undefined => {
  if (!isRecord(value) || value.kind !== 'news') {
    return undefined;
  }
  const id = readCount(value.id);
  const title = sanitizeDisplayText(value.title);
  const body = newsBody(value.body);
  const startsAt = timeOf(value.starts_at);
  const expiresAt = timeOf(value.expires_at);
  const label = sanitizeDisplayText(value.action_label);
  const url = newsActionUrl(value.action_url);
  const hasAction =
    value.action_label !== null && value.action_label !== undefined;
  if (
    !id ||
    !Number.isSafeInteger(id) ||
    !title ||
    title.length > MAX_ANNOUNCEMENT_TITLE ||
    !body ||
    body.length > MAX_NEWS_BODY ||
    !Number.isFinite(startsAt) ||
    !Number.isFinite(expiresAt) ||
    expiresAt <= startsAt ||
    (value.audience !== 'everyone' && value.audience !== 'accounts') ||
    (hasAction
      ? !label || label.length > MAX_NEWS_ACTION || !url
      : value.action_url != null)
  ) {
    return undefined;
  }
  return {
    id,
    title,
    body,
    startsAt,
    expiresAt,
    audience: value.audience,
    ...(hasAction && label && url ? { action: { label, url } } : {}),
  };
};

export const parseAppNews = (rows: unknown): IAppNews[] =>
  Array.isArray(rows)
    ? rows.flatMap((row: unknown) => {
        const news = readAppNews(row);
        return news ? [news] : [];
      })
    : [];

export const currentAppNews = (items: readonly IAppNews[], now = Date.now()) =>
  items
    .filter((item) => item.startsAt <= now && item.expiresAt > now)
    .sort((a, b) => b.startsAt - a.startsAt || b.id - a.id);

export const newsRow = (item: IAppNews) => ({
  kind: 'news',
  id: item.id,
  title: item.title,
  body: item.body,
  starts_at: new Date(item.startsAt).toISOString(),
  expires_at: new Date(item.expiresAt).toISOString(),
  audience: item.audience,
  action_label: item.action?.label ?? null,
  action_url: item.action?.url ?? null,
});
