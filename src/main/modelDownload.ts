/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { createHash } from 'crypto';
import fs from 'fs';

/**
 * A model file, written to disk as it arrives.
 *
 * The three model downloads — RMVPE (361 MB), the separation network's
 * weights and the Voice model — each kept every chunk in memory, joined them
 * with `Buffer.concat` into a second copy of the whole file, and wrote that
 * with `writeFileSync`: twice the file in memory at the end, and main held for
 * as long as the disk took to swallow hundreds of megabytes. Here each chunk
 * is written as it comes, one awaited write before the next read, to a file
 * beside the target that is renamed over it only once every byte is in (and
 * accepted, when there is a digest to check): nothing half-written ever
 * stands where a cached model is looked for.
 *
 * Read from the body's own reader and written by hand — never through
 * `pipeline`, which crashes inside Node's HTTP parser when the disk is slower
 * than the socket (CLAUDE.md). Awaiting each write before the next read is
 * what lets a slow disk hold the download back instead.
 */

const MEBIBYTE = 1024 * 1024;

/**
 * Byte counts worth passing on. Every network chunk used to be a message to
 * the window — thousands for RMVPE, each one a render of the download panel.
 * A count goes out when the whole percentage moves, or when another
 * mebibyte has arrived since the last one went (a server that sends no
 * length has no percentage, and a percent of a large file is megabytes).
 */
const createByteReports = (
  report: (received: number, total: number) => void,
) => {
  const percentOf = (received: number, total: number) =>
    total > 0 ? Math.floor((received * 100) / total) : -1;
  // Undefined until the first chunk, which always goes out.
  let lastPercent: number | undefined;
  let lastReceived = 0;
  const send = (received: number, total: number) => {
    lastPercent = percentOf(received, total);
    lastReceived = received;
    report(received, total);
  };
  return {
    arrived: (received: number, total: number) => {
      if (
        percentOf(received, total) !== lastPercent ||
        received - lastReceived >= MEBIBYTE
      ) {
        send(received, total);
      }
    },
    /** The final count, unless it was the last one sent. */
    finished: (received: number, total: number) => {
      if (received !== lastReceived) {
        send(received, total);
      }
    },
  };
};

export interface IModelDownload {
  /** The response body, read once, a chunk at a time. */
  body: ReadableStream<Uint8Array>;
  /** The length the server gave for it, or 0 when it gave none. */
  total: number;
  /** Where the file ends up; nothing is there until it is complete. */
  target: string;
  onBytes: (received: number, total: number) => void;
  /**
   * Given the SHA-256 of every byte written: the file is kept only when this
   * says yes. Without it nothing is hashed.
   */
  accept?: (sha256: string) => boolean;
}

/**
 * Saves `body` as `target`. False when `accept` refused the bytes; a failure
 * of the download or the disk throws. Either way nothing is left behind.
 */
export const saveDownload = async ({
  body,
  total,
  target,
  onBytes,
  accept,
}: IModelDownload): Promise<boolean> => {
  const temporary = `${target}.download`;
  const digest = accept ? createHash('sha256') : undefined;
  const reports = createByteReports(onBytes);
  try {
    const handle = await fs.promises.open(temporary, 'w');
    let received = 0;
    try {
      const reader = body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        // `writeFile` on a handle writes at its position and loops until
        // every byte is down; one chunk is never left partly written.
        await handle.writeFile(value);
        digest?.update(value);
        received += value.length;
        reports.arrived(received, total);
      }
    } finally {
      await handle.close();
    }
    reports.finished(received, total);
    if (digest && accept && !accept(digest.digest('hex'))) {
      return false;
    }
    await fs.promises.rename(temporary, target);
    return true;
  } finally {
    await fs.promises.rm(temporary, { force: true });
  }
};
