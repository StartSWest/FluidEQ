/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import zlib from 'zlib';

/**
 * RGBA to PNG at the smallest this format gets without a dependency: each
 * row filtered the way that leaves it least to say (the usual heuristic, the
 * smallest sum of absolute differences), deflated at level 9. The stills are
 * mostly empty masks and smooth gradients, where the filter choice is most
 * of the size. The same bytes in always give the same file out.
 */

const SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

const chunk = (type: string, data: Buffer): Buffer => {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(zlib.crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, crc]);
};

const paeth = (left: number, up: number, upLeft: number) => {
  const estimate = left + up - upLeft;
  const toLeft = Math.abs(estimate - left);
  const toUp = Math.abs(estimate - up);
  const toUpLeft = Math.abs(estimate - upLeft);
  if (toLeft <= toUp && toLeft <= toUpLeft) {
    return left;
  }
  return toUp <= toUpLeft ? up : upLeft;
};

/** One row under each of the five filters, the cheapest kept. */
const filterRow = (
  row: Uint8Array,
  previous: Uint8Array | undefined,
  stride: number,
): Buffer => {
  const candidates = [0, 1, 2, 3, 4].map((filter) => {
    const out = Buffer.alloc(row.length + 1);
    out[0] = filter;
    let cost = 0;
    for (let at = 0; at < row.length; at += 1) {
      const left = at >= stride ? row[at - stride] : 0;
      const up = previous ? previous[at] : 0;
      const upLeft = previous && at >= stride ? previous[at - stride] : 0;
      let predicted = 0;
      if (filter === 1) {
        predicted = left;
      } else if (filter === 2) {
        predicted = up;
      } else if (filter === 3) {
        predicted = Math.floor((left + up) / 2);
      } else if (filter === 4) {
        predicted = paeth(left, up, upLeft);
      }
      // The difference wraps round a byte, as the format's filters say.
      const value = (row[at] - predicted + 256) % 256;
      out[at + 1] = value;
      cost += value < 128 ? value : 256 - value;
    }
    return { out, cost };
  });
  return candidates.reduce((best, each) =>
    each.cost < best.cost ? each : best,
  ).out;
};

const encodePng = (rgba: Uint8Array, width: number, height: number): Buffer => {
  const stride = 4;
  const rowBytes = width * stride;
  const rows: Buffer[] = [];
  for (let y = 0; y < height; y += 1) {
    const row = rgba.subarray(y * rowBytes, (y + 1) * rowBytes);
    const previous =
      y > 0 ? rgba.subarray((y - 1) * rowBytes, y * rowBytes) : undefined;
    rows.push(filterRow(row, previous, stride));
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bits per channel
  header[9] = 6; // RGBA
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;
  return Buffer.concat([
    SIGNATURE,
    chunk('IHDR', header),
    chunk(
      'IDAT',
      zlib.deflateSync(Buffer.concat(rows), { level: 9, memLevel: 9 }),
    ),
    chunk('IEND', Buffer.alloc(0)),
  ]);
};

export default encodePng;
