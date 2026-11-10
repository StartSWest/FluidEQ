/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { MAX_ANIMATION_FRAMES } from 'common/studioAnimation';

/**
 * What the member chose to import, told apart by what the files are, not
 * by their names: a still picture (a sheet of frames in a grid), a picture
 * with the atlas JSON its exporter wrote beside it, an animated picture
 * (GIF, APNG, animated WebP), or several pictures, one frame each.
 */

/** A file as chosen: its name and its bytes. */
export interface IChosenFile {
  name: string;
  bytes: Uint8Array;
}

export type TImportKind =
  | { kind: 'grid'; picture: IChosenFile }
  | { kind: 'atlas'; picture: IChosenFile; atlas: IChosenFile }
  | { kind: 'animated'; picture: IChosenFile; type: TAnimatedType }
  | { kind: 'sequence'; pictures: IChosenFile[] };

export type TAnimatedType = 'image/gif' | 'image/png' | 'image/webp';

export type TImportRefusal =
  | { refused: 'nothing' }
  | { refused: 'mixed' }
  | { refused: 'too-large'; file: string }
  | { refused: 'too-many'; most: number }
  | { refused: 'unreadable'; file: string };

/** A file past this is not one frame or one sheet anyone meant. */
export const MAX_IMPORT_FILE_BYTES = 40 * 1024 * 1024;
/** An atlas's JSON: thousands of frames fit in far less. */
export const MAX_ATLAS_BYTES = 4 * 1024 * 1024;

const ascii = (bytes: Uint8Array, from: number, length: number) =>
  String.fromCharCode(...bytes.subarray(from, from + length));

const isPng = (bytes: Uint8Array) =>
  bytes.length > 8 &&
  bytes[0] === 0x89 &&
  ascii(bytes, 1, 3) === 'PNG' &&
  bytes[4] === 0x0d &&
  bytes[5] === 0x0a;

const isJpeg = (bytes: Uint8Array) =>
  bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8;

const isWebp = (bytes: Uint8Array) =>
  bytes.length > 12 &&
  ascii(bytes, 0, 4) === 'RIFF' &&
  ascii(bytes, 8, 4) === 'WEBP';

export const isGif = (bytes: Uint8Array) =>
  bytes.length > 10 && /^GIF8[79]a$/.test(ascii(bytes, 0, 6));

const view = (bytes: Uint8Array) =>
  new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

/** A GIF's logical screen, every frame's canvas: width and height. */
export const gifSize = (bytes: Uint8Array): [number, number] | null =>
  isGif(bytes)
    ? [view(bytes).getUint16(6, true), view(bytes).getUint16(8, true)]
    : null;

/**
 * A PNG whose `acTL` chunk comes before its image data: an APNG. Walked
 * chunk by chunk, so the four letters inside some other chunk's data do
 * not count.
 */
export const isApng = (bytes: Uint8Array) => {
  if (!isPng(bytes)) {
    return false;
  }
  const chunks = view(bytes);
  let at = 8;
  while (at + 8 <= bytes.length) {
    const length = chunks.getUint32(at);
    const type = ascii(bytes, at + 4, 4);
    if (type === 'acTL') {
      return true;
    }
    if (type === 'IDAT' || type === 'IEND') {
      return false;
    }
    at += 12 + length;
  }
  return false;
};

/** VP8X's flags: the bit worth 2 says the WebP is animated. */
const ANIMATION_FLAG = 2;

/** A WebP whose extended header says it is animated. */
export const isAnimatedWebp = (bytes: Uint8Array) =>
  isWebp(bytes) &&
  ascii(bytes, 12, 4) === 'VP8X' &&
  bytes.length > 20 &&
  Math.floor(bytes[20] / ANIMATION_FLAG) % 2 === 1;

const isJson = (file: IChosenFile) => {
  const first = file.bytes.find(
    (byte) => byte !== 0x20 && byte !== 0x0a && byte !== 0x0d && byte !== 0x09,
  );
  return first === 0x7b || /\.json$/i.test(file.name);
};

const isStill = (bytes: Uint8Array) =>
  isPng(bytes) || isJpeg(bytes) || isWebp(bytes);

/** Names in the order a person numbers frames: 2 before 10. */
const naturally = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: 'base',
}).compare;

/** What the files are, or why they cannot be imported together. */
export const importKindOf = (
  files: readonly IChosenFile[],
): TImportKind | TImportRefusal => {
  if (files.length === 0) {
    return { refused: 'nothing' };
  }
  if (files.length > MAX_ANIMATION_FRAMES) {
    return { refused: 'too-many', most: MAX_ANIMATION_FRAMES };
  }
  const tooLarge = files.find(
    (file) =>
      file.bytes.length >
      (isJson(file) ? MAX_ATLAS_BYTES : MAX_IMPORT_FILE_BYTES),
  );
  if (tooLarge) {
    return { refused: 'too-large', file: tooLarge.name };
  }
  const atlases = files.filter(isJson);
  const pictures = files.filter((file) => !isJson(file));
  const unreadable = pictures.find(
    (file) => !isStill(file.bytes) && !isGif(file.bytes),
  );
  if (unreadable) {
    return { refused: 'unreadable', file: unreadable.name };
  }
  if (atlases.length === 1 && pictures.length === 1) {
    const [picture] = pictures;
    return isStill(picture.bytes)
      ? { kind: 'atlas', picture, atlas: atlases[0] }
      : { refused: 'unreadable', file: picture.name };
  }
  if (atlases.length > 0) {
    return { refused: 'mixed' };
  }
  if (pictures.length === 1) {
    const [picture] = pictures;
    if (isGif(picture.bytes)) {
      return { kind: 'animated', picture, type: 'image/gif' };
    }
    if (isApng(picture.bytes)) {
      return { kind: 'animated', picture, type: 'image/png' };
    }
    if (isAnimatedWebp(picture.bytes)) {
      return { kind: 'animated', picture, type: 'image/webp' };
    }
    return { kind: 'grid', picture };
  }
  if (pictures.some((file) => !isStill(file.bytes))) {
    return { refused: 'mixed' };
  }
  return {
    kind: 'sequence',
    pictures: [...pictures].sort((a, b) => naturally(a.name, b.name)),
  };
};

/**
 * A name for the animation from a file's: the scene's rule for names
 * (lowercase letters, digits and hyphens, a letter first, at most 40),
 * kept apart from every name in `taken` by a number.
 */
export const animationNameFrom = (
  file: string,
  taken: ReadonlySet<string>,
): string => {
  const stem = file
    .replace(/\.[^.]*$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const lettered = /^[a-z]/.test(stem) ? stem : `animation-${stem}`;
  const base = lettered.replace(/-+$/, '').slice(0, 36).replace(/-+$/, '');
  if (!taken.has(base)) {
    return base;
  }
  let number = 2;
  while (taken.has(`${base}-${number}`)) {
    number += 1;
  }
  return `${base}-${number}`;
};
