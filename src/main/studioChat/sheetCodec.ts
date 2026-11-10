/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { nativeImage } from 'electron';
import { pictureFromBytes } from '../safePicture';
import type { ISheetCodec } from './sheetFiles';
import type { IPixels } from './sheetRig';

/**
 * The sheet tools' pictures through Electron's own decoder, in main: no
 * process is started for any of it. Electron's bitmaps are BGRA with each
 * colour multiplied by its alpha, which is the form the tools work in.
 * `pictureFromBytes` decodes nothing whose header is past the bounds.
 */

const fromImage = (image: Electron.NativeImage): IPixels | undefined => {
  const { width, height } = image.getSize();
  if (image.isEmpty() || width < 1 || height < 1) {
    return undefined;
  }
  return { data: new Uint8Array(image.toBitmap()), width, height };
};

const toImage = (picture: IPixels) =>
  nativeImage.createFromBitmap(Buffer.from(picture.data), {
    width: picture.width,
    height: picture.height,
  });

/** A mid grey every drawing shows against, as `look_at_animation` uses. */
const GROUND = 92;

const sheetCodec: ISheetCodec = {
  decode: (bytes) => fromImage(pictureFromBytes(bytes)),
  encodePng: (picture) => toImage(picture).toPNG(),
  resize: (picture, width, height) => {
    if (picture.width === width && picture.height === height) {
      return picture;
    }
    const resized = fromImage(
      toImage(picture).resize({ width, height, quality: 'best' }),
    );
    // A size other than the one asked for would put the frame in the wrong
    // place; the tool answers the failure instead.
    if (!resized || resized.width !== width || resized.height !== height) {
      throw new Error(
        `A picture could not be resized to ${width} x ${height}.`,
      );
    }
    return resized;
  },
  shown: (picture, longest) => {
    const scale = Math.min(
      1,
      longest / Math.max(picture.width, picture.height),
    );
    const width = Math.max(1, Math.round(picture.width * scale));
    const height = Math.max(1, Math.round(picture.height * scale));
    const small = sheetCodec.resize(picture, width, height);
    const flat = new Uint8Array(small.data.length);
    for (let at = 0; at < flat.length; at += 4) {
      const keep = 1 - small.data[at + 3] / 255;
      flat[at] = Math.round(small.data[at] + GROUND * keep);
      flat[at + 1] = Math.round(small.data[at + 1] + GROUND * keep);
      flat[at + 2] = Math.round(small.data[at + 2] + GROUND * keep);
      flat[at + 3] = 255;
    }
    return toImage({
      data: flat,
      width: small.width,
      height: small.height,
    }).toJPEG(86);
  },
};

export default sheetCodec;
