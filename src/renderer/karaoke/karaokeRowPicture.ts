/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { karaokeRestoredFileToken } from '../../common/karaoke/files';
import { materializeRestoredMedia } from './karaokeRestoredFiles';

/**
 * The picture a playlist row draws, as a small square of its own.
 *
 * A row used to point an object URL at the picture file itself. A song
 * restored from the last session has no bytes in the window until it is
 * opened (`restoredKaraokeFile`), so every restored row drew a broken image
 * (Ivan, 2026-11-16: "in karaoke why the files show no picture"). The bytes
 * are fetched now, and a row keeps only a thumbnail at twice its size: a
 * folder's cover is often megabytes, a session holds up to 5,000 songs, and
 * the list is never virtualised, so keeping each row's whole picture would
 * hold every cover the list was ever scrolled past.
 *
 * One picture at a time, as the lengths are read (`karaokeItemDuration`),
 * so forty rows scrolled into view do not decode forty pictures together;
 * and once per picture, by its session token or its file, because every
 * song of an album shares the folder's one cover.
 */
const THUMBNAIL_PX = 96;

const byToken = new Map<string, Promise<string | undefined>>();
const byFile = new WeakMap<File, Promise<string | undefined>>();
let queue: Promise<unknown> = Promise.resolve();

const thumbnailOf = async (file: File): Promise<string | undefined> => {
  const readable = await materializeRestoredMedia(file);
  if (!readable?.size) {
    return undefined;
  }
  const bitmap = await createImageBitmap(readable);
  try {
    // Cropped to the square's middle, as the Library's covers are drawn.
    const side = Math.min(bitmap.width, bitmap.height);
    const canvas = new OffscreenCanvas(THUMBNAIL_PX, THUMBNAIL_PX);
    const context = canvas.getContext('2d');
    if (!context || side <= 0) {
      return undefined;
    }
    context.imageSmoothingQuality = 'high';
    context.drawImage(
      bitmap,
      (bitmap.width - side) / 2,
      (bitmap.height - side) / 2,
      side,
      side,
      0,
      0,
      THUMBNAIL_PX,
      THUMBNAIL_PX,
    );
    const blob = await canvas.convertToBlob({
      type: 'image/webp',
      quality: 0.86,
    });
    return URL.createObjectURL(blob);
  } finally {
    bitmap.close();
  }
};

/**
 * The row's picture as an object URL kept for the life of the window, or
 * nothing for a picture that is gone or will not decode.
 */
const karaokeRowPicture = (file: File): Promise<string | undefined> => {
  const token = karaokeRestoredFileToken(file);
  const known = token ? byToken.get(token) : byFile.get(file);
  if (known) {
    return known;
  }
  const made = queue.then(() => thumbnailOf(file)).catch(() => undefined);
  queue = made;
  if (token) {
    byToken.set(token, made);
  } else {
    byFile.set(file, made);
  }
  return made;
};

export default karaokeRowPicture;
