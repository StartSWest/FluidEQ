/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { useSyncExternalStore } from 'react';
import {
  currentAppNews,
  EMPTY_NEWS,
  type IAppNews,
  type IAppNewsState,
} from 'common/appNews';

let state = EMPTY_NEWS;
let preview: IAppNews | undefined;
let open = false;
let revision = 0;
let nextExpiry = Number.POSITIVE_INFINITY;
let stop: (() => void) | undefined;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());
const api = () => window.electron?.ipcRenderer;
const publish = (next: IAppNewsState) => {
  state = next;
  nextExpiry = Math.min(...state.items.map((item) => item.expiresAt));
  revision += 1;
  notify();
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  if (!stop) {
    const off = api()?.onAppNews?.(publish);
    const read = (refresh = false) => {
      const before = revision;
      api()
        ?.getAppNews?.(refresh)
        .then((next) => {
          if (before === revision) {
            publish(next);
          }
          return undefined;
        })
        .catch(() => undefined);
    };
    const reconnect = () => read(true);
    const visible = () => {
      if (document.visibilityState === 'visible') {
        read(true);
      }
    };
    window.addEventListener('online', reconnect);
    window.addEventListener('focus', reconnect);
    document.addEventListener('visibilitychange', visible);
    read();
    stop = () => {
      off?.();
      window.removeEventListener('online', reconnect);
      window.removeEventListener('focus', reconnect);
      document.removeEventListener('visibilitychange', visible);
    };
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size) {
      stop?.();
      stop = undefined;
    }
  };
};

export const useAppNews = () =>
  useSyncExternalStore(
    subscribe,
    () => state,
    () => EMPTY_NEWS,
  );
export const useNewsOpen = () =>
  useSyncExternalStore(
    subscribe,
    () => open,
    () => false,
  );
export const useNewsPreview = () =>
  useSyncExternalStore(
    subscribe,
    () => preview,
    () => undefined,
  );
export const openAppNews = () => {
  open = true;
  notify();
};
export const closeAppNews = () => {
  open = false;
  preview = undefined;
  notify();
};
/** An admin draft cannot outlive the authorized editor that opened it. */
export const clearNewsPreview = () => {
  if (preview) {
    closeAppNews();
  }
};
export const previewAppNews = (item: IAppNews) => {
  preview = item;
  open = true;
  notify();
};

export const putNewsAway = async (newsId: number) => {
  const item = state.items.find((entry) => entry.id === newsId);
  if (!item || !state.unread.includes(item.id)) {
    return;
  }
  publish({
    ...state,
    unread: state.unread.filter(
      (id) =>
        !state.items.some(
          (entry) => entry.id === id && entry.startsAt <= item.startsAt,
        ),
    ),
  });
  const ticket = revision;
  try {
    const next = await api()?.appNewsSeen?.(item.id);
    // A sign-out/feed push can overtake the acknowledgement from main.
    if (next && ticket === revision) {
      publish(next);
    }
  } catch {
    // Keep the session dismissal when main is temporarily unavailable.
  }
};

/** Expiration is reevaluated on painted frames and events, never a feed poll. */
export const expirePaintedNews = () => {
  if (Date.now() < nextExpiry) {
    return;
  }
  const items = currentAppNews(state.items);
  if (items.length !== state.items.length) {
    publish({
      ...state,
      items,
      unread: state.unread.filter((id) => items.some((item) => item.id === id)),
    });
  }
};

export const resetAppNewsStore = () => {
  stop?.();
  stop = undefined;
  state = EMPTY_NEWS;
  preview = undefined;
  open = false;
  revision += 1;
  nextExpiry = Number.POSITIVE_INFINITY;
  listeners.clear();
};
