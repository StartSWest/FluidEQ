/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>

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

import { encodeQr, qrToPath } from 'common/qr';

const COFFEE_URL = 'https://buymeacoffee.com/startswest';

describe('qr', () => {
  const encoded = encodeQr(COFFEE_URL);

  it('encodes the support URL', () => {
    expect(encoded).toBeDefined();
  });

  // Structure is what a scanner locks onto first; if any of this is wrong the
  // code cannot be read at all.
  describe('structure', () => {
    const matrix = encoded as boolean[][];

    it('is square with a valid version size', () => {
      expect(matrix.length).toBeGreaterThan(0);
      matrix.forEach((row) => expect(row).toHaveLength(matrix.length));
      // size = 4v + 17, so (size - 17) must be a positive multiple of four.
      expect((matrix.length - 17) % 4).toBe(0);
      expect(matrix.length).toBeGreaterThanOrEqual(21);
      expect(matrix.length).toBeLessThanOrEqual(57);
    });

    it('has all three finder patterns', () => {
      const size = matrix.length;
      const corners: [number, number][] = [
        [0, 0],
        [0, size - 7],
        [size - 7, 0],
      ];
      corners.forEach(([row, col]) => {
        // Outer ring dark, inner ring light, 3x3 core dark.
        expect(matrix[row][col]).toBe(true);
        expect(matrix[row][col + 6]).toBe(true);
        expect(matrix[row + 6][col]).toBe(true);
        expect(matrix[row + 1][col + 1]).toBe(false);
        expect(matrix[row + 3][col + 3]).toBe(true);
      });
    });

    it('has alternating timing patterns', () => {
      const size = matrix.length;
      for (let i = 8; i < size - 8; i += 1) {
        expect(matrix[6][i]).toBe(i % 2 === 0);
        expect(matrix[i][6]).toBe(i % 2 === 0);
      }
    });

    it('sets the always-dark module', () => {
      expect(matrix[matrix.length - 8][8]).toBe(true);
    });

    it('uses a plausible mix of dark and light', () => {
      const dark = matrix.flat().filter(Boolean).length;
      const ratio = dark / (matrix.length * matrix.length);
      // Mask selection exists to keep this near a half.
      expect(ratio).toBeGreaterThan(0.35);
      expect(ratio).toBeLessThan(0.65);
    });
  });

  describe('capacity', () => {
    it('grows the version with the payload', () => {
      const small = encodeQr('hi') as boolean[][];
      const large = encodeQr('x'.repeat(180)) as boolean[][];
      expect(small.length).toBeLessThan(large.length);
    });

    // Silently truncating would produce a code that scans to the wrong thing,
    // which for a payment link is the one unacceptable outcome.
    it('refuses a payload it cannot hold rather than truncating', () => {
      expect(encodeQr('x'.repeat(500))).toBeUndefined();
    });

    it('handles multi-byte characters by their encoded length', () => {
      expect(encodeQr('café ☕')).toBeDefined();
    });
  });

  describe('qrToPath', () => {
    it('emits one unit square per dark module', () => {
      const matrix = encoded as boolean[][];
      const dark = matrix.flat().filter(Boolean).length;
      const path = qrToPath(matrix);
      expect(path.match(/M/g)).toHaveLength(dark);
      expect(path).toMatch(/^M\d+ \d+h1v1h-1z/);
    });
  });

  it('is deterministic', () => {
    expect(qrToPath(encodeQr(COFFEE_URL) as boolean[][])).toBe(
      qrToPath(encoded as boolean[][]),
    );
  });
});
