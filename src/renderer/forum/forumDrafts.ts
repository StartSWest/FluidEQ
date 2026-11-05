/**
 * What is being written in the Forum, kept for each place it is written —
 * a thread's reply box, the reply under one comment, a new topic — so that
 * leaving the page and coming back finds it as it was (Ivan, 2026-11-02:
 * "if I am typing anything in any forum and exit that forum page it keeps
 * the message on those specific forums when I come back to continue").
 *
 * Kept on this machine only, like what has been read (`forumUnread.ts`). A
 * draft goes when it is posted, or when its box is emptied by hand. Storage
 * that cannot be read or written costs the draft, never the box: what is on
 * screen stays on screen.
 */

const PREFIX = 'fluideq.forum.draft.v1:';

/** A thread's own reply box. */
export const threadDraftKey = (topicId: string) => `reply:${topicId}`;

/** The reply box under one comment of a thread. */
export const commentDraftKey = (topicId: string, threadId: string) =>
  `reply:${topicId}:${threadId}`;

/** The one new topic being started. */
export const NEW_TOPIC_DRAFT = 'topic';

export const readDraft = (key: string): string => {
  try {
    return window.localStorage.getItem(PREFIX + key) ?? '';
  } catch {
    return '';
  }
};

/** Keeps `text` for `key`; an empty box keeps nothing. */
export const writeDraft = (key: string, text: string) => {
  try {
    if (text.trim() === '') {
      window.localStorage.removeItem(PREFIX + key);
    } else {
      window.localStorage.setItem(PREFIX + key, text);
    }
  } catch {
    // Quota or a locked profile: the text is still in the box.
  }
};

export const clearDraft = (key: string) => writeDraft(key, '');
