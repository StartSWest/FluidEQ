/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

/**
 * When this reader last opened the gallery's front page, so the look picker
 * can say how many scenes went up since (Ivan, 2026-10-29: "if there are new
 * ones on the lib show n new ones"). In this window's own storage: it is one
 * reader's convenience, and losing it only starts the count again.
 */
const SEEN_KEY = 'fluideq.gallery.seenAt';

/**
 * The moment the gallery was last opened. Asked before it ever was, it is
 * now, and remembered as such: a first run would otherwise call the whole
 * gallery new.
 */
export const gallerySeenAt = (now = Date.now()): number => {
  try {
    const stored = Number(window.localStorage.getItem(SEEN_KEY));
    if (Number.isFinite(stored) && stored > 0) {
      return stored;
    }
    window.localStorage.setItem(SEEN_KEY, String(now));
  } catch {
    // Storage refused: counted from now, for this run.
  }
  return now;
};

/** The gallery's front page was shown: nothing in it is new any more. */
export const markGallerySeen = (now = Date.now()) => {
  try {
    window.localStorage.setItem(SEEN_KEY, String(now));
  } catch {
    // Storage refused: the count simply keeps its start.
  }
};

/** How many scenes went up, or were updated, after `seenAt`. */
export const scenesNewSince = (
  scenes: readonly { updatedAt: string }[],
  seenAt: number,
): number =>
  scenes.filter((scene) => Date.parse(scene.updatedAt) > seenAt).length;
