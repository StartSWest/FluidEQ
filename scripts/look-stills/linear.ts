/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

/**
 * The small dense algebra the stills' split needs (`fit.ts`): a few dozen
 * unknowns at most, so plain Gauss-Jordan with partial pivoting in doubles,
 * with a ridge far under a step of 8 bits to keep a near-repeated column
 * from blowing up.
 */

export type TMatrix = number[][];

/** Ridge on the normal equations: well under a step of 8 bits. */
export const RIDGE = 1e-6;

/** The inverse of a small square matrix. */
export const invert = (square: TMatrix): TMatrix => {
  const size = square.length;
  const work = square.map((line) => [...line]);
  const inverse = work.map((line, row) =>
    line.map((_, column) => (row === column ? 1 : 0)),
  );
  for (let pivot = 0; pivot < size; pivot += 1) {
    let best = pivot;
    for (let row = pivot + 1; row < size; row += 1) {
      if (Math.abs(work[row][pivot]) > Math.abs(work[best][pivot])) {
        best = row;
      }
    }
    [work[pivot], work[best]] = [work[best], work[pivot]];
    [inverse[pivot], inverse[best]] = [inverse[best], inverse[pivot]];
    const lead = work[pivot][pivot];
    if (Math.abs(lead) < 1e-14) {
      throw new Error('The roles cannot be told apart in these drawings.');
    }
    for (let column = 0; column < size; column += 1) {
      work[pivot][column] /= lead;
      inverse[pivot][column] /= lead;
    }
    for (let row = 0; row < size; row += 1) {
      const factor = work[row][pivot];
      if (row !== pivot && factor !== 0) {
        for (let column = 0; column < size; column += 1) {
          work[row][column] -= factor * work[pivot][column];
          inverse[row][column] -= factor * inverse[pivot][column];
        }
      }
    }
  }
  return inverse;
};

/** XᵀX plus the ridge, for columns given as vectors. */
export const gramOfColumns = (columns: readonly Float64Array[]): TMatrix =>
  columns.map((left, row) =>
    columns.map((right, column) => {
      let sum = row === column ? RIDGE : 0;
      for (let index = 0; index < left.length; index += 1) {
        sum += left[index] * right[index];
      }
      return sum;
    }),
  );

/** (XᵀX + λI)⁻¹ Xᵀ, a row per column of X. */
export const leastSquares = (columns: readonly Float64Array[]): TMatrix => {
  const inverse = invert(gramOfColumns(columns));
  const rows = columns[0]?.length ?? 0;
  return inverse.map((line) =>
    Array.from({ length: rows }, (_, index) =>
      line.reduce(
        (sum, value, column) => sum + value * columns[column][index],
        0,
      ),
    ),
  );
};

/**
 * The least-squares answer from the rows `keeps` marks only: for a pixel some
 * of whose drawings were clipped at white, which say only "at least this".
 * `into` receives the unknowns.
 */
export const solveRows = (
  columns: readonly Float64Array[],
  observed: Float64Array,
  base: number,
  keeps: (row: number) => boolean,
  into: Float64Array,
): void => {
  const unknowns = columns.length;
  const rows = columns[0]?.length ?? 0;
  const normal: TMatrix = Array.from({ length: unknowns }, (_, row) =>
    Array.from({ length: unknowns }, (__, column) =>
      row === column ? RIDGE : 0,
    ),
  );
  const right = new Float64Array(unknowns);
  for (let row = 0; row < rows; row += 1) {
    if (keeps(row)) {
      const value = observed[base + row];
      for (let left = 0; left < unknowns; left += 1) {
        const x = columns[left][row];
        if (x !== 0) {
          right[left] += x * value;
          for (let other = 0; other < unknowns; other += 1) {
            normal[left][other] += x * columns[other][row];
          }
        }
      }
    }
  }
  const inverse = invert(normal);
  for (let unknown = 0; unknown < unknowns; unknown += 1) {
    let sum = 0;
    for (let index = 0; index < unknowns; index += 1) {
      sum += inverse[unknown][index] * right[index];
    }
    into[unknown] = sum;
  }
};
