/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { nativeImage, type NativeImage } from 'electron';

/**
 * A picture as the chat keeps it: what Claude looked at, or the stage the
 * member attached, brought down to the width the chat pane can show sharply
 * at twice its size. A look comes back at up to 2400px wide, and a chat that
 * kept every one whole would be megabytes a reply, held in memory and written
 * to disk on every message.
 */
const CHAT_PICTURE_WIDTH = 720;
const CHAT_PICTURE_QUALITY = 82;

const toChat = (image: NativeImage): string | undefined => {
  if (image.isEmpty()) {
    return undefined;
  }
  const { width } = image.getSize();
  const small =
    width > CHAT_PICTURE_WIDTH
      ? image.resize({ width: CHAT_PICTURE_WIDTH, quality: 'good' })
      : image;
  return `data:image/jpeg;base64,${small
    .toJPEG(CHAT_PICTURE_QUALITY)
    .toString('base64')}`;
};

/** A look's picture, from the data URL the stream carried it in. */
export const chatPictureFromDataUrl = (dataUrl: string) =>
  toChat(nativeImage.createFromDataURL(dataUrl));

/** The stage the member attached, from its JPEG bytes. */
export const chatPictureFromBytes = (bytes: Uint8Array) =>
  toChat(nativeImage.createFromBuffer(Buffer.from(bytes)));

/**
 * A picture ChatGPT made, as the chat keeps it: a PNG, because a cut-out's
 * transparency is half of what the member is shown, and smaller than a look
 * — it sits in a step's row at the pane's width, not as the stage.
 */
const MADE_PICTURE_EDGE = 480;

export const chatPictureKeepingAlpha = (dataUrl: string) => {
  const image = nativeImage.createFromDataURL(dataUrl);
  if (image.isEmpty()) {
    return undefined;
  }
  const { width, height } = image.getSize();
  const small =
    Math.max(width, height) > MADE_PICTURE_EDGE
      ? image.resize(
          width >= height
            ? { width: MADE_PICTURE_EDGE, quality: 'good' }
            : { height: MADE_PICTURE_EDGE, quality: 'good' },
        )
      : image;
  return `data:image/png;base64,${small.toPNG().toString('base64')}`;
};
