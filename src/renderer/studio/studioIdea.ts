import { useSyncExternalStore } from 'react';

/**
 * The member's idea for the scene their AI is about to write.
 *
 * Kept outside the component, and on disk, because it is the member's own
 * words: leaving the Studio, opening a project or restarting the app must
 * never be what throws them away. Copying the prompt reads it and changes
 * nothing — the idea used to live in the copy action itself, so pressing
 * "Copy AI prompt" after picking an example wiped the example out.
 */

const IDEA_KEY = 'fluideq.studio.idea';

/** Longer than any idea needs; the prompt is pasted, not stored. */
export const MAX_IDEA_LENGTH = 1200;

const readStored = (): string => {
  try {
    return (window.localStorage.getItem(IDEA_KEY) ?? '').slice(
      0,
      MAX_IDEA_LENGTH,
    );
  } catch {
    // Storage refused (a locked profile): start empty, as a first visit does.
    return '';
  }
};

let idea = readStored();
const listeners = new Set<() => void>();

export const setStudioIdea = (next: string) => {
  idea = next.slice(0, MAX_IDEA_LENGTH);
  try {
    window.localStorage.setItem(IDEA_KEY, idea);
  } catch {
    // Same as reading: it is kept for this session only.
  }
  listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const useStudioIdea = (): string =>
  useSyncExternalStore(
    subscribe,
    () => idea,
    () => '',
  );

/** For tests: forget the idea, where it was kept, and anyone listening. */
export const resetStudioIdea = () => {
  idea = '';
  listeners.clear();
  window.localStorage.removeItem(IDEA_KEY);
};
