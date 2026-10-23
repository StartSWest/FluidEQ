import { useSyncExternalStore } from 'react';

/**
 * Whether Help's button shows the Forum's count of what is new. Some people
 * do not want a number asking for their attention (Ivan, 2026-10-16: "turn
 * off that if they like, so they dont see numbers in forum icon"); off, the
 * count leaves Help's button and its menus, and nothing reads the Forum in
 * the background. The Forum's own page still says what is new — that is
 * where somebody looking for it has gone.
 *
 * Kept on this machine, like what has been read (`forumUnread.ts`). Storage
 * that cannot be read reads as shown: the default, and what a fresh profile
 * would say.
 */

const STORAGE_KEY = 'fluideq.forum.newsHidden.v1';

const readHidden = (): boolean => {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    // Unreadable storage is the default: the count shown.
    return false;
  }
};

let hidden = readHidden();
const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** Whether the count is hidden from Help's button and menus. */
export const useForumNewsHidden = (): boolean =>
  useSyncExternalStore(
    subscribe,
    () => hidden,
    () => hidden,
  );

export const setForumNewsHidden = (next: boolean) => {
  hidden = next;
  try {
    if (next) {
      window.localStorage.setItem(STORAGE_KEY, '1');
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Quota or a locked profile: the choice holds for this session, which
    // is the part on screen.
  }
  listeners.forEach((listener) => listener());
};

/** Test seam: the choice as storage holds it now. */
export const reloadForumNewsHidden = () => {
  hidden = readHidden();
  listeners.forEach((listener) => listener());
};
