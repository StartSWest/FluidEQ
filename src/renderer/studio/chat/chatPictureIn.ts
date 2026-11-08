/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A picture from outside the Studio — pasted with Ctrl+V, dropped on the
 * message box or chosen from the computer (Ivan, 2026-11-07: "I also need to
 * be able to paste image into the chat with control v", "or attach images
 * from outside") — as the chat's message picture is kept: one JPEG, like the
 * stage's, so it can be drawn on, kept with the draft and sent the same way.
 *
 * Brought down to `LONGEST` on its longest side: main makes the chat's copy
 * smaller still, and a 6000px photo held whole in the draft would be tens of
 * megabytes on disk for nothing. A transparent picture is laid on white,
 * which is how a cut-out is read.
 */

/** The longest side kept, in pixels. */
const LONGEST = 2048;
const QUALITY = 0.9;
/** Past this a file is not read at all: no picture worth sending is this big. */
const MAX_FILE_BYTES = 40 * 1024 * 1024;

/** Whether `file` claims to be a picture the window can decode. */
export const isPictureFile = (file: File) => file.type.startsWith('image/');

/** The picture in `file` as a JPEG, or nothing for one that does not decode. */
export const chatPictureIn = async (
  file: Blob,
): Promise<Uint8Array | undefined> => {
  if (file.size > MAX_FILE_BYTES) {
    return undefined;
  }
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return undefined;
  }
  try {
    const scale = Math.min(1, LONGEST / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) {
      return undefined;
    }
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', QUALITY);
    });
    return blob ? new Uint8Array(await blob.arrayBuffer()) : undefined;
  } finally {
    bitmap.close();
  }
};

/** The first picture among `files`, if any. */
export const firstPicture = (files: FileList | null | undefined) =>
  Array.from(files ?? []).find(isPictureFile);
