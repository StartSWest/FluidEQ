/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { nativeImage, type NativeImage } from 'electron';
import { isDecodablePicture } from '../common/pictureBounds';

/**
 * A picture from a project, or one that came through a chat, decoded in
 * main only once its header says it fits (`pictureBounds.ts`). Anything
 * else is an empty image, which every caller already answers as "not a
 * picture FluidEQ can read" — never a decode of whatever size it claims.
 */
export const pictureFromBytes = (bytes: Uint8Array): NativeImage =>
  isDecodablePicture(bytes)
    ? nativeImage.createFromBuffer(Buffer.from(bytes))
    : nativeImage.createEmpty();

const DATA_URL = /^data:image\/[a-z0-9.+-]+;base64,([A-Za-z0-9+/=\r\n]*)$/i;

/** The same, for a picture handed over as a base64 data URL. */
export const pictureFromDataUrl = (dataUrl: string): NativeImage => {
  const match = DATA_URL.exec(dataUrl);
  return match
    ? pictureFromBytes(new Uint8Array(Buffer.from(match[1], 'base64')))
    : nativeImage.createEmpty();
};
