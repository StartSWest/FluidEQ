/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import encodePng from './png';
import type { IBuildAnswer } from './protocol';
import { GAP, OUT } from './request';

/**
 * A still's file from the page's answer: the layers stacked top to bottom,
 * `GAP` clear rows apart - the rest as it is, then each role's mask in the
 * alpha alone - as `ShippedLookStill` cuts them apart again.
 */

const fromBase64 = (text: string) =>
  new Uint8Array(Buffer.from(text, 'base64'));

const spriteOf = (answer: IBuildAnswer) => {
  const layer = OUT.width * OUT.height;
  const layers = answer.roles.length + 1;
  const height = layers * OUT.height + (layers - 1) * GAP;
  const rgba = new Uint8Array(OUT.width * height * 4);
  const rowOf = (index: number) => index * (OUT.height + GAP);
  rgba.set(fromBase64(answer.rest), 0);
  const masks = fromBase64(answer.masks);
  answer.roles.forEach((_, index) => {
    const top = rowOf(index + 1) * OUT.width * 4;
    for (let pixel = 0; pixel < layer; pixel += 1) {
      rgba[top + pixel * 4 + 3] = masks[index * layer + pixel];
    }
  });
  return encodePng(rgba, OUT.width, height);
};

export default spriteOf;
