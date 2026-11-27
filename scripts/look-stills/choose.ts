/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import type { IStateRender } from './fit';
import { gramOfColumns, invert, type TMatrix } from './linear';

/**
 * Which roles a look paints in (`fit.ts`): taken one at a time, the one that
 * explains most of what is left first, for as long as one explains more than
 * the drawings' own rounding. Judged on Σ y yᵀ over the pixels alone, so a
 * choice costs a few small matrices however large the still.
 */

/** Each role's colours down the drawings, one value per state and channel. */
export const columnOf = (
  renders: readonly IStateRender[],
  role: string,
): Float64Array =>
  Float64Array.from(
    renders.flatMap((render) =>
      [...render.roles[role]].map((value) => value / 255),
    ),
  );

/** A fixed ink's column: 1 on its channel in every drawing. */
export const biasColumn = (renders: readonly IStateRender[], channel: number) =>
  Float64Array.from(
    renders.flatMap(() => [0, 1, 2].map((each) => (each === channel ? 1 : 0))),
  );

/**
 * Σ y yᵀ over the pixels `left` does not mark: all a choice of roles needs
 * to be judged by.
 */
export const scatterOf = (
  observed: Float64Array,
  size: number,
  count: number,
  left: Uint8Array,
) => {
  const scatter: TMatrix = Array.from({ length: size }, () =>
    new Array<number>(size).fill(0),
  );
  for (let pixel = 0; pixel < count; pixel += 1) {
    const base = pixel * size;
    for (let row = 0; row < size && !left[pixel]; row += 1) {
      const value = observed[base + row];
      if (value !== 0) {
        const line = scatter[row];
        for (let column = row; column < size; column += 1) {
          line[column] += value * observed[base + column];
        }
      }
    }
  }
  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column < row; column += 1) {
      scatter[row][column] = scatter[column][row];
    }
  }
  return scatter;
};

/**
 * How much of every pixel's drawings `columns` explain together, summed:
 * trace((XᵀX)⁻¹ XᵀSX) for the scatter S. The error left is the scatter's
 * trace less this.
 */
const explainedBy = (
  columns: readonly Float64Array[],
  scatter: TMatrix,
): number => {
  const inverse = invert(gramOfColumns(columns));
  const scattered = columns.map((column) =>
    scatter.map((line) =>
      line.reduce((sum, value, index) => sum + value * column[index], 0),
    ),
  );
  let trace = 0;
  inverse.forEach((line, row) => {
    columns.forEach((column, inner) => {
      const projected = scattered[row];
      let product = 0;
      for (let index = 0; index < column.length; index += 1) {
        product += column[index] * projected[index];
      }
      trace += line[inner] * product;
    });
  });
  return trace;
};

interface ITried {
  role: string;
  column: Float64Array;
  explained: number;
}

/** What `column` explains beside those taken, or nothing if it is one of them. */
const tryRole = (
  role: string,
  column: Float64Array,
  taken: readonly Float64Array[],
  scatter: TMatrix,
): ITried | undefined => {
  try {
    return {
      role,
      column,
      explained: explainedBy([...taken, column], scatter),
    };
  } catch {
    // A role that moved exactly with those taken says nothing new.
    return undefined;
  }
};

/**
 * The roles a look paints in, taken one at a time, the one that explains
 * most first, for as long as one explains more than `minGain`.
 */
export const chooseRoles = (
  renders: readonly IStateRender[],
  candidates: readonly string[],
  scatter: TMatrix,
  minGain: number,
): { roles: string[]; gains: number[] } => {
  const taken: Float64Array[] = [0, 1, 2].map((channel) =>
    biasColumn(renders, channel),
  );
  const chosen: string[] = [];
  const gains: number[] = [];
  let explained = explainedBy(taken, scatter);
  const left = new Set(candidates);
  for (;;) {
    const best = [...left].reduce<ITried | undefined>((found, role) => {
      const tried = tryRole(role, columnOf(renders, role), taken, scatter);
      return tried && (!found || tried.explained > found.explained)
        ? tried
        : found;
    }, undefined);
    if (!best || best.explained - explained < minGain) {
      return { roles: chosen, gains };
    }
    chosen.push(best.role);
    gains.push(best.explained - explained);
    taken.push(best.column);
    left.delete(best.role);
    explained = best.explained;
  }
};
