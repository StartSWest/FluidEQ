/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IStudioChat } from 'common/studioChat';

/**
 * Where the member is in a chat: at its end, following what is written
 * there, or on a message, so many pixels into it.
 *
 * Never a scroll offset. The thread's pictures take their size after it is
 * drawn, so an offset read with them in place points somewhere else while
 * they are still coming; a message and a distance into it are found again
 * however much above them has grown.
 */
export type TThreadPlace =
  | { readonly end: true }
  | { readonly end: false; readonly entry: string; readonly offset: number };

export const AT_END: TThreadPlace = { end: true };

/** Within this many pixels of the end, the member is at the end. */
const END_SLACK = 48;

/** Enough for every chat a sitting opens; the oldest go first. */
const KEPT_CHATS = 50;

const kept = new Map<string, TThreadPlace>();

/**
 * Which chat a place belongs to: the project's, and among its chats - the
 * current one, a new one, one brought back from the past - the one that
 * began with this first message. None for an empty chat, which has nowhere
 * to be.
 */
export const threadPlaceKey = (chat: IStudioChat | undefined) => {
  const first = chat?.entries[0];
  return chat && first ? `${chat.projectId}\n${first.id}` : undefined;
};

/** Where the member left this chat; a chat never opened opens at its end. */
export const placeLeft = (key: string): TThreadPlace => kept.get(key) ?? AT_END;

export const leavePlace = (key: string, place: TThreadPlace) => {
  kept.delete(key);
  kept.set(key, place);
  if (kept.size > KEPT_CHATS) {
    const oldest = kept.keys().next();
    if (!oldest.done) {
      kept.delete(oldest.value);
    }
  }
};

/**
 * The thread's messages, each marked with its entry's id. Their `offsetTop`
 * is from the thread's own top, scrolled content included, because the
 * thread is their offset parent (`position: relative` in its sheet).
 */
const messagesOf = (thread: HTMLElement) =>
  [...thread.children].filter(
    (child): child is HTMLElement =>
      child instanceof HTMLElement && child.dataset.entry !== undefined,
  );

/**
 * The place the thread shows now: the last message that starts at or above
 * the top of the view, or the first one while the view is above them all.
 */
export const placeShown = (thread: HTMLElement): TThreadPlace => {
  const top = thread.scrollTop;
  if (thread.scrollHeight - top - thread.clientHeight < END_SLACK) {
    return AT_END;
  }
  const messages = messagesOf(thread);
  const message =
    messages.filter((child) => child.offsetTop <= top).pop() ?? messages[0];
  const entry = message?.dataset.entry;
  return message && entry !== undefined
    ? { end: false, entry, offset: top - message.offsetTop }
    : AT_END;
};

/**
 * The scroll offset that shows `place` as the thread is laid out now. A
 * message no longer in the chat leaves the member at its end.
 */
export const scrollFor = (thread: HTMLElement, place: TThreadPlace) => {
  const furthest = Math.max(0, thread.scrollHeight - thread.clientHeight);
  if (place.end) {
    return furthest;
  }
  const message = messagesOf(thread).find(
    (child) => child.dataset.entry === place.entry,
  );
  return message
    ? Math.min(furthest, Math.max(0, message.offsetTop + place.offset))
    : furthest;
};
