/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

/* eslint-disable no-bitwise, no-continue, no-loop-func, no-restricted-syntax */
/*
 * The lint exemptions above are for this file only, and they are not laziness:
 *
 * - no-bitwise: QR error correction is Reed-Solomon over GF(256). XOR *is* the
 *   field's addition and shifts *are* its multiplication. Writing it with
 *   arithmetic operators would be slower, longer, and wrong.
 * - no-restricted-syntax / no-continue / no-loop-func: the mask-penalty scoring
 *   walks the matrix in place. Rebuilding it as array iterations would allocate
 *   a new grid per pattern for no gain in clarity.
 *
 * Everything here is covered by tests that check real encoded output, not just
 * that the functions run.
 */

/**
 * Minimal QR encoder: byte mode, error-correction level M, versions 1-10.
 *
 * Generated at runtime rather than shipped as an image, because a picture of a
 * QR code cannot be checked against the URL it claims to encode. Bundling one
 * means that the day the destination changes, the app keeps showing a code
 * that silently points somewhere else — which for a payment link is the worst
 * possible failure. Encoding the configured URL makes the two impossible to
 * disagree.
 *
 * Scope is deliberately small: byte mode covers URLs and payment URIs, level M
 * is the usual 15% recovery, and version 10 holds 216 bytes — far more than
 * any link here. Anything longer is rejected rather than silently truncated.
 */

/** Data codewords, EC codewords per block, and block layout for level M. */
interface IVersionSpec {
  ecPerBlock: number;
  /** [blockCount, dataCodewordsPerBlock] for the two block groups. */
  groups: [number, number][];
}

const VERSIONS: Record<number, IVersionSpec> = {
  1: { ecPerBlock: 10, groups: [[1, 16]] },
  2: { ecPerBlock: 16, groups: [[1, 28]] },
  3: { ecPerBlock: 26, groups: [[1, 44]] },
  4: { ecPerBlock: 18, groups: [[2, 32]] },
  5: { ecPerBlock: 24, groups: [[2, 43]] },
  6: { ecPerBlock: 16, groups: [[4, 27]] },
  7: { ecPerBlock: 18, groups: [[4, 31]] },
  8: {
    ecPerBlock: 22,
    groups: [
      [2, 38],
      [2, 39],
    ],
  },
  9: {
    ecPerBlock: 22,
    groups: [
      [3, 36],
      [2, 37],
    ],
  },
  10: {
    ecPerBlock: 26,
    groups: [
      [4, 43],
      [1, 44],
    ],
  },
};

/** Alignment-pattern centre coordinates per version. */
const ALIGNMENT: Record<number, number[]> = {
  1: [],
  2: [6, 18],
  3: [6, 22],
  4: [6, 26],
  5: [6, 30],
  6: [6, 34],
  7: [6, 22, 38],
  8: [6, 24, 42],
  9: [6, 26, 46],
  10: [6, 28, 50],
};

const dataCapacity = (version: number) =>
  VERSIONS[version].groups.reduce(
    (total, [blocks, perBlock]) => total + blocks * perBlock,
    0,
  );

/* --- GF(256) ------------------------------------------------------------ */

const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i += 1) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    // Primitive polynomial 0x11d, as the QR specification requires.
    if (x & 0x100) {
      x ^= 0x11d;
    }
  }
  for (let i = 255; i < 512; i += 1) {
    EXP[i] = EXP[i - 255];
  }
})();

const mul = (a: number, b: number) =>
  a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]];

/** Generator polynomial for `degree` error-correction codewords. */
const generatorPoly = (degree: number): number[] => {
  let poly = [1];
  for (let i = 0; i < degree; i += 1) {
    const next = new Array<number>(poly.length + 1).fill(0);
    poly.forEach((coefficient, index) => {
      next[index] ^= coefficient;
      next[index + 1] ^= mul(coefficient, EXP[i]);
    });
    poly = next;
  }
  return poly;
};

const remainder = (data: number[], degree: number): number[] => {
  const generator = generatorPoly(degree);
  const buffer = [...data, ...new Array<number>(degree).fill(0)];
  for (let i = 0; i < data.length; i += 1) {
    const factor = buffer[i];
    if (factor === 0) {
      continue;
    }
    generator.forEach((coefficient, index) => {
      buffer[i + index] ^= mul(coefficient, factor);
    });
  }
  return buffer.slice(data.length);
};

/* --- bitstream ---------------------------------------------------------- */

class BitBuffer {
  private bits: number[] = [];

  put(value: number, length: number) {
    for (let i = length - 1; i >= 0; i -= 1) {
      this.bits.push((value >>> i) & 1);
    }
  }

  get length() {
    return this.bits.length;
  }

  toCodewords(count: number): number[] {
    const padded = [...this.bits];
    while (padded.length % 8 !== 0) {
      padded.push(0);
    }
    const codewords: number[] = [];
    for (let i = 0; i < padded.length; i += 8) {
      let byte = 0;
      for (let bit = 0; bit < 8; bit += 1) {
        byte = (byte << 1) | padded[i + bit];
      }
      codewords.push(byte);
    }
    // Alternating pad bytes, per the specification.
    const PAD = [0xec, 0x11];
    let padIndex = 0;
    while (codewords.length < count) {
      codewords.push(PAD[padIndex % 2]);
      padIndex += 1;
    }
    return codewords;
  }
}

/* --- matrix ------------------------------------------------------------- */

type Matrix = (0 | 1 | null)[][];

const placeFinder = (matrix: Matrix, row: number, col: number) => {
  for (let r = -1; r <= 7; r += 1) {
    for (let c = -1; c <= 7; c += 1) {
      const y = row + r;
      const x = col + c;
      if (y < 0 || y >= matrix.length || x < 0 || x >= matrix.length) {
        continue;
      }
      const inRing =
        (r >= 0 && r <= 6 && (c === 0 || c === 6)) ||
        (c >= 0 && c <= 6 && (r === 0 || r === 6));
      const inCore = r >= 2 && r <= 4 && c >= 2 && c <= 4;
      matrix[y][x] = inRing || inCore ? 1 : 0;
    }
  }
};

const buildMatrix = (version: number, codewords: number[], mask: number) => {
  const size = version * 4 + 17;
  const matrix: Matrix = Array.from({ length: size }, () =>
    new Array<0 | 1 | null>(size).fill(null),
  );

  placeFinder(matrix, 0, 0);
  placeFinder(matrix, 0, size - 7);
  placeFinder(matrix, size - 7, 0);

  // Timing patterns.
  for (let i = 8; i < size - 8; i += 1) {
    const bit: 0 | 1 = i % 2 === 0 ? 1 : 0;
    matrix[6][i] = bit;
    matrix[i][6] = bit;
  }

  // Alignment patterns, skipping any that would collide with a finder.
  const centres = ALIGNMENT[version];
  centres.forEach((row) => {
    centres.forEach((col) => {
      const nearFinder =
        (row === 6 && col === 6) ||
        (row === 6 && col === size - 7) ||
        (row === size - 7 && col === 6);
      if (nearFinder) {
        return;
      }
      for (let r = -2; r <= 2; r += 1) {
        for (let c = -2; c <= 2; c += 1) {
          matrix[row + r][col + c] =
            Math.max(Math.abs(r), Math.abs(c)) !== 1 ? 1 : 0;
        }
      }
    });
  });

  // Always-dark module.
  matrix[size - 8][8] = 1;

  // Reserve the format areas so data placement skips them.
  const reserve = (y: number, x: number) => {
    if (matrix[y][x] === null) {
      matrix[y][x] = 0;
    }
  };
  for (let i = 0; i < 9; i += 1) {
    reserve(8, i);
    reserve(i, 8);
  }
  for (let i = 0; i < 8; i += 1) {
    reserve(8, size - 1 - i);
    reserve(size - 1 - i, 8);
  }
  if (version >= 7) {
    for (let i = 0; i < 6; i += 1) {
      for (let j = 0; j < 3; j += 1) {
        reserve(size - 11 + j, i);
        reserve(i, size - 11 + j);
      }
    }
  }

  // Remember which modules are function patterns before any data lands.
  const isFunction = matrix.map((row) => row.map((cell) => cell !== null));

  // Zigzag data placement from the bottom right, skipping the vertical timing
  // column.
  const bits: number[] = [];
  codewords.forEach((byte) => {
    for (let i = 7; i >= 0; i -= 1) {
      bits.push((byte >>> i) & 1);
    }
  });

  let bitIndex = 0;
  let upward = true;
  for (let col = size - 1; col > 0; col -= 2) {
    const column = col === 6 ? col - 1 : col;
    for (let step = 0; step < size; step += 1) {
      const row = upward ? size - 1 - step : step;
      for (let offset = 0; offset < 2; offset += 1) {
        const x = column - offset;
        if (isFunction[row][x]) {
          continue;
        }
        const bit = bitIndex < bits.length ? bits[bitIndex] : 0;
        bitIndex += 1;
        const masked = applyMask(mask, row, x) ? bit ^ 1 : bit;
        matrix[row][x] = masked as 0 | 1;
      }
    }
    upward = !upward;
  }

  writeFormat(matrix, mask);
  if (version >= 7) {
    writeVersion(matrix, version);
  }

  return { matrix, isFunction, size };
};

const applyMask = (mask: number, row: number, col: number): boolean => {
  switch (mask) {
    case 0:
      return (row + col) % 2 === 0;
    case 1:
      return row % 2 === 0;
    case 2:
      return col % 3 === 0;
    case 3:
      return (row + col) % 3 === 0;
    case 4:
      return (Math.floor(row / 2) + Math.floor(col / 3)) % 2 === 0;
    case 5:
      return ((row * col) % 2) + ((row * col) % 3) === 0;
    case 6:
      return (((row * col) % 2) + ((row * col) % 3)) % 2 === 0;
    default:
      return (((row + col) % 2) + ((row * col) % 3)) % 2 === 0;
  }
};

/** 15-bit BCH format information for level M and the chosen mask. */
const writeFormat = (matrix: Matrix, mask: number) => {
  const size = matrix.length;
  // Level M is 0b00.
  const data = (0b00 << 3) | mask;
  let value = data << 10;
  for (let i = 4; i >= 0; i -= 1) {
    if (value & (1 << (i + 10))) {
      value ^= 0b10100110111 << i;
    }
  }
  const format = ((data << 10) | value) ^ 0b101010000010010;

  for (let i = 0; i < 15; i += 1) {
    const bit = ((format >>> i) & 1) as 0 | 1;
    // Copy one: around the top-left finder.
    if (i < 6) {
      matrix[8][i] = bit;
    } else if (i < 8) {
      matrix[8][i + 1] = bit;
    } else if (i === 8) {
      matrix[7][8] = bit;
    } else {
      matrix[14 - i][8] = bit;
    }
    // Copy two: seven modules up column 8 from the bottom, then eight along
    // row 8 from the right. The split is at seven, not eight — module
    // (size - 8, 8) is the always-dark module and is not part of the format.
    if (i < 7) {
      matrix[size - 1 - i][8] = bit;
    } else {
      matrix[8][size - 15 + i] = bit;
    }
  }
};

/** 18-bit BCH version information, versions 7 and up. */
const writeVersion = (matrix: Matrix, version: number) => {
  const size = matrix.length;
  let value = version << 12;
  for (let i = 5; i >= 0; i -= 1) {
    if (value & (1 << (i + 12))) {
      value ^= 0b1111100100101 << i;
    }
  }
  const info = (version << 12) | value;

  for (let i = 0; i < 18; i += 1) {
    const bit = ((info >>> i) & 1) as 0 | 1;
    const row = Math.floor(i / 3);
    const col = size - 11 + (i % 3);
    matrix[row][col] = bit;
    matrix[col][row] = bit;
  }
};

/** Standard penalty score used to pick the least-ambiguous mask. */
const penalty = (matrix: Matrix): number => {
  const size = matrix.length;
  const at = (r: number, c: number) => (matrix[r][c] === 1 ? 1 : 0);
  let score = 0;

  // Rule 1: runs of five or more.
  for (let i = 0; i < size; i += 1) {
    for (const horizontal of [true, false]) {
      let run = 1;
      for (let j = 1; j < size; j += 1) {
        const current = horizontal ? at(i, j) : at(j, i);
        const previous = horizontal ? at(i, j - 1) : at(j - 1, i);
        if (current === previous) {
          run += 1;
        } else {
          if (run >= 5) {
            score += run - 2;
          }
          run = 1;
        }
      }
      if (run >= 5) {
        score += run - 2;
      }
    }
  }

  // Rule 2: 2x2 blocks of one colour.
  for (let r = 0; r < size - 1; r += 1) {
    for (let c = 0; c < size - 1; c += 1) {
      const value = at(r, c);
      if (
        value === at(r, c + 1) &&
        value === at(r + 1, c) &&
        value === at(r + 1, c + 1)
      ) {
        score += 3;
      }
    }
  }

  // Rule 3: finder-like 1:1:3:1:1 sequences.
  const PATTERNS = [
    [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1],
  ];
  for (let i = 0; i < size; i += 1) {
    for (let j = 0; j + 11 <= size; j += 1) {
      PATTERNS.forEach((pattern) => {
        let horizontal = true;
        let vertical = true;
        for (let k = 0; k < 11; k += 1) {
          if (at(i, j + k) !== pattern[k]) {
            horizontal = false;
          }
          if (at(j + k, i) !== pattern[k]) {
            vertical = false;
          }
        }
        if (horizontal) {
          score += 40;
        }
        if (vertical) {
          score += 40;
        }
      });
    }
  }

  // Rule 4: deviation from an even balance of dark and light.
  let dark = 0;
  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      dark += at(r, c);
    }
  }
  const percent = (dark * 100) / (size * size);
  score += Math.floor(Math.abs(percent - 50) / 5) * 10;

  return score;
};

/**
 * Encode `text` as a QR matrix of booleans, true meaning a dark module.
 * Returns undefined when the text is too long for version 10 at level M,
 * rather than silently producing a code that decodes to something else.
 */
export const encodeQr = (text: string): boolean[][] | undefined => {
  const bytes = Array.from(new TextEncoder().encode(text));

  const version = Object.keys(VERSIONS)
    .map(Number)
    .sort((a, b) => a - b)
    .find((candidate) => {
      const countBits = candidate < 10 ? 8 : 16;
      const needed = Math.ceil((4 + countBits + bytes.length * 8) / 8);
      return needed <= dataCapacity(candidate);
    });

  if (version === undefined) {
    return undefined;
  }

  const spec = VERSIONS[version];
  const capacity = dataCapacity(version);
  const buffer = new BitBuffer();
  // Byte mode.
  buffer.put(0b0100, 4);
  buffer.put(bytes.length, version < 10 ? 8 : 16);
  bytes.forEach((byte) => buffer.put(byte, 8));
  // Terminator, up to four bits.
  buffer.put(0, Math.min(4, capacity * 8 - buffer.length));
  const data = buffer.toCodewords(capacity);

  // Split into blocks, compute EC, then interleave both.
  const blocks: { data: number[]; ec: number[] }[] = [];
  let offset = 0;
  spec.groups.forEach(([count, perBlock]) => {
    for (let i = 0; i < count; i += 1) {
      const slice = data.slice(offset, offset + perBlock);
      offset += perBlock;
      blocks.push({ data: slice, ec: remainder(slice, spec.ecPerBlock) });
    }
  });

  const interleaved: number[] = [];
  const maxData = Math.max(...blocks.map((block) => block.data.length));
  for (let i = 0; i < maxData; i += 1) {
    blocks.forEach((block) => {
      if (i < block.data.length) {
        interleaved.push(block.data[i]);
      }
    });
  }
  for (let i = 0; i < spec.ecPerBlock; i += 1) {
    blocks.forEach((block) => interleaved.push(block.ec[i]));
  }

  // Try every mask and keep the least penalised, as the specification says.
  let best: { matrix: Matrix; score: number } | undefined;
  for (let mask = 0; mask < 8; mask += 1) {
    const { matrix } = buildMatrix(version, interleaved, mask);
    const score = penalty(matrix);
    if (!best || score < best.score) {
      best = { matrix, score };
    }
  }

  return best!.matrix.map((row) => row.map((cell) => cell === 1));
};

/**
 * Render an encoded matrix as an SVG path string plus its module count, so the
 * caller can size it however it likes. One path for the whole code keeps the
 * DOM to a single node instead of hundreds of rects.
 */
export const qrToPath = (matrix: boolean[][]): string =>
  matrix
    .flatMap((row, y) =>
      row.map((dark, x) => (dark ? `M${x} ${y}h1v1h-1z` : '')),
    )
    .join('');
