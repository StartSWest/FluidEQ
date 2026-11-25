/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * How light a JPEG is, read from the file itself: the average brightness of
 * every 8x8 block of its luma, 0 (black) to 1 (white).
 *
 * A block's average is its DC coefficient alone, so this decodes the entropy
 * stream and no inverse transform: enough to tell a dark window from a white
 * one, which is what a picture shipped as the wrong side of a pair looks like
 * (What's New 2.6 shipped its "dark" window as a second white one, and Jest
 * maps every image import to one stub, so nothing else could see it).
 *
 * Baseline (SOF0) Huffman JPEGs only - what Chromium's encoder writes -
 * interleaved or not, with or without restart markers. Anything else throws
 * rather than answering a level it did not read.
 */

/* eslint-disable no-bitwise -- a JPEG's entropy stream is bits and nibbles: Huffman codes, packed sampling factors and table ids, written as the standard describes them */

/** Code length (1-16) → code → symbol. */
type THuffman = Map<number, number>[];

interface IComponent {
  id: number;
  h: number;
  v: number;
  quantTable: number;
}

/** What the markers before the scan said. */
interface IFrame {
  file: Uint8Array;
  width: number;
  height: number;
  components: IComponent[];
  /** Each quantisation table's DC step, the only one an average needs. */
  dcSteps: Map<number, number>;
  dcTables: Map<number, THuffman>;
  acTables: Map<number, THuffman>;
  restartInterval: number;
}

export interface IJpegLevels {
  width: number;
  height: number;
  /** Each luma block's average brightness, 0 to 1, in no particular order. */
  blocks: number[];
}

/** Frame types other than baseline: progressive, lossless, arithmetic. */
const UNREAD_FRAMES = new Set([
  0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
]);

const wordAt = (file: Uint8Array, offset: number) =>
  (file[offset] << 8) | file[offset + 1];

const buildHuffman = (counts: number[], symbols: number[]): THuffman => {
  const codes: THuffman = [];
  let code = 0;
  let next = 0;
  for (let length = 1; length <= 16; length += 1) {
    const table = new Map<number, number>();
    for (let i = 0; i < counts[length - 1]; i += 1) {
      table.set(code, symbols[next]);
      code += 1;
      next += 1;
    }
    codes[length] = table;
    code <<= 1;
  }
  return codes;
};

/** The entropy-coded bits of one scan, with stuffed bytes taken out. */
class BitReader {
  private bit = 0;

  private byte = 0;

  private at: number;

  constructor(
    private readonly data: Uint8Array,
    start: number,
  ) {
    this.at = start;
  }

  get position() {
    return this.at;
  }

  read(): number {
    if (this.bit === 0) {
      this.byte = this.data[this.at];
      if (this.byte === 0xff) {
        const marker = this.data[this.at + 1];
        if (marker !== 0x00) {
          throw new Error(`marker 0xff${marker.toString(16)} inside a block`);
        }
        this.at += 1;
      }
      this.at += 1;
      this.bit = 8;
    }
    this.bit -= 1;
    return (this.byte >> this.bit) & 1;
  }

  bits(count: number): number {
    let value = 0;
    for (let i = 0; i < count; i += 1) {
      value = (value << 1) | this.read();
    }
    return value;
  }

  decode(table: THuffman): number {
    let code = 0;
    for (let length = 1; length <= 16; length += 1) {
      code = (code << 1) | this.read();
      const symbol = table[length].get(code);
      if (symbol !== undefined) {
        return symbol;
      }
    }
    throw new Error('no Huffman code matches');
  }

  /** Skip to the byte after a restart marker, dropping the padding bits. */
  restart() {
    this.bit = 0;
    const isRestart =
      this.data[this.at] === 0xff && (this.data[this.at + 1] & 0xf8) === 0xd0;
    if (!isRestart) {
      throw new Error('restart marker missing');
    }
    this.at += 2;
  }
}

/** A value of `size` bits as JPEG's magnitude categories sign it. */
const extend = (value: number, size: number) =>
  size === 0 || value >= 1 << (size - 1) ? value : value - (1 << size) + 1;

/** Reads past one block's AC terms, which say nothing about its average. */
const skipAcTerms = (reader: BitReader, table: THuffman) => {
  for (let k = 1; k < 64;) {
    const symbol = reader.decode(table);
    const run = symbol >> 4;
    const size = symbol & 15;
    if (size === 0) {
      if (run !== 15) {
        return; // end of block
      }
      k += 16;
    } else {
      reader.bits(size);
      k += run + 1;
    }
  }
};

/** The luma blocks' averages from the scan whose header starts at `at`. */
const readScan = (frame: IFrame, at: number): number[] => {
  const { file } = frame;
  const count = file[at + 4];
  if (count !== frame.components.length) {
    throw new Error('progressive or split scans are not read');
  }
  const inScan = Array.from({ length: count }, (_, i) => {
    const p = at + 5 + i * 2;
    const component = frame.components.find((c) => c.id === file[p]);
    const dc = frame.dcTables.get(file[p + 1] >> 4);
    const ac = frame.acTables.get(file[p + 1] & 15);
    const step = component && frame.dcSteps.get(component.quantTable);
    if (!component || !dc || !ac || step === undefined) {
      throw new Error('the scan names a component or table never given');
    }
    return {
      dc,
      ac,
      step,
      perMcu: count === 1 ? 1 : component.h * component.v,
    };
  });
  const [maxH, maxV] = [0, 1].map((axis) =>
    Math.max(...frame.components.map((c) => (axis === 0 ? c.h : c.v))),
  );
  const mcus =
    count === 1
      ? Math.ceil(frame.width / 8) * Math.ceil(frame.height / 8)
      : Math.ceil(frame.width / (8 * maxH)) *
        Math.ceil(frame.height / (8 * maxV));
  const reader = new BitReader(file, at + 2 + wordAt(file, at + 2));
  const predictions = inScan.map(() => 0);
  const blocks: number[] = [];

  for (let mcu = 0; mcu < mcus; mcu += 1) {
    const isRestart =
      frame.restartInterval > 0 && mcu > 0 && mcu % frame.restartInterval === 0;
    if (isRestart) {
      reader.restart();
      predictions.fill(0);
    }
    inScan.forEach(({ dc, ac, step, perMcu }, index) => {
      for (let b = 0; b < perMcu; b += 1) {
        const size = reader.decode(dc);
        predictions[index] += extend(reader.bits(size), size);
        skipAcTerms(reader, ac);
        // The first component is the luma. Its DC term is eight times the
        // block's mean, level-shifted by 128.
        if (index === 0) {
          const mean = (predictions[index] * step) / 8 + 128;
          blocks.push(Math.min(1, Math.max(0, mean / 255)));
        }
      }
    });
  }
  if (reader.position > file.length) {
    throw new Error('the scan ran past the file');
  }
  return blocks;
};

export default function jpegBlockLevels(file: Uint8Array): IJpegLevels {
  if (file[0] !== 0xff || file[1] !== 0xd8) {
    throw new Error('not a JPEG');
  }
  const frame: IFrame = {
    file,
    width: 0,
    height: 0,
    components: [],
    dcSteps: new Map(),
    dcTables: new Map(),
    acTables: new Map(),
    restartInterval: 0,
  };
  for (let at = 2; at < file.length;) {
    if (file[at] !== 0xff) {
      throw new Error(`expected a marker at byte ${at}`);
    }
    const marker = file[at + 1];
    const body = at + 4;
    const end = at + 2 + wordAt(file, at + 2);
    if (marker === 0xda) {
      return {
        width: frame.width,
        height: frame.height,
        blocks: readScan(frame, at),
      };
    }
    if (UNREAD_FRAMES.has(marker)) {
      throw new Error(`unsupported frame type 0xff${marker.toString(16)}`);
    }
    if (marker === 0xdb) {
      for (let p = body; p < end;) {
        const isWide = file[p] >> 4 === 1;
        frame.dcSteps.set(
          file[p] & 15,
          isWide ? wordAt(file, p + 1) : file[p + 1],
        );
        p += 1 + 64 * (isWide ? 2 : 1);
      }
    } else if (marker === 0xc4) {
      for (let p = body; p < end;) {
        const counts = Array.from(file.subarray(p + 1, p + 17));
        const total = counts.reduce((sum, n) => sum + n, 0);
        const symbols = Array.from(file.subarray(p + 17, p + 17 + total));
        const tables = file[p] >> 4 === 0 ? frame.dcTables : frame.acTables;
        tables.set(file[p] & 15, buildHuffman(counts, symbols));
        p += 17 + total;
      }
    } else if (marker === 0xdd) {
      frame.restartInterval = wordAt(file, body);
    } else if (marker === 0xc0) {
      frame.height = wordAt(file, body + 1);
      frame.width = wordAt(file, body + 3);
      frame.components = Array.from({ length: file[body + 5] }, (_, i) => {
        const p = body + 6 + i * 3;
        return {
          id: file[p],
          h: file[p + 1] >> 4,
          v: file[p + 1] & 15,
          quantTable: file[p + 2],
        };
      });
    }
    at = end;
  }
  throw new Error('no scan');
}
