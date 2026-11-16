/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * How long each playlist song is, read the first time its row is seen.
 *
 * A playlist item is a file and nothing more until it is played, and a
 * session holds up to 5,000 of them, so the lengths the rows print are read
 * on demand: one media element asked for metadata alone, one file at a
 * time, each read once and kept for the life of the window (a `File` is
 * the key, so a second import of the same song reads it again). One at a
 * time because forty rows scrolled into view at once would otherwise open
 * forty decoders together.
 */

const durations = new WeakMap<File, number | null>();
const pending = new Map<File, Promise<number | null>>();
let queue: Promise<unknown> = Promise.resolve();

const readOne = (file: File): Promise<number | null> =>
  new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const element = document.createElement('audio');
    const finish = (seconds: number | null) => {
      element.removeAttribute('src');
      element.load();
      URL.revokeObjectURL(url);
      resolve(seconds);
    };
    element.preload = 'metadata';
    element.addEventListener(
      'loadedmetadata',
      () =>
        finish(
          Number.isFinite(element.duration) && element.duration > 0
            ? element.duration
            : null,
        ),
      { once: true },
    );
    element.addEventListener('error', () => finish(null), { once: true });
    element.src = url;
  });

/** The length already read, `null` for one that cannot be, or nothing yet. */
export const knownKaraokeItemDuration = (
  file: File,
): number | null | undefined => durations.get(file);

export const readKaraokeItemDuration = (file: File): Promise<number | null> => {
  const known = durations.get(file);
  if (known !== undefined) {
    return Promise.resolve(known);
  }
  const waiting = pending.get(file);
  if (waiting) {
    return waiting;
  }
  const read = queue.then(() => readOne(file));
  queue = read;
  const kept = read.then((seconds) => {
    durations.set(file, seconds);
    pending.delete(file);
    return seconds;
  });
  pending.set(file, kept);
  return kept;
};
